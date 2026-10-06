/* eslint-env node */
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const { SourceTextModule, SyntheticModule, createContext } = require('node:vm');
const { resolve } = require('node:path');
const { JSDOM } = require('jsdom');

const model = new SourceTextModule(readFileSync(resolve(__dirname, '../tools/product-picker/products.js'), 'utf8'));
const ready = model.link(() => {}).then(() => model.evaluate()).then(() => model.namespace);
const row = (fields = {}) => ({
  path: '/products/signature',
  name: 'Signature',
  shortName: 'Signature',
  category: 'chequing',
  persona: 'everyone',
  sortOrder: '10',
  ...fields,
});
const response = (data, metadata = {}) => ({
  ok: true, json: async () => ({ data, ...metadata }),
});

async function picker(actions = {}) {
  const source = (path) => readFileSync(resolve(__dirname, '..', path), 'utf8');
  const dom = new JSDOM(source('tools/product-picker/product-picker.html'));
  const calls = [];
  const context = createContext({
    document: dom.window.document,
    AbortController,
    setTimeout,
    clearTimeout,
    console: { error: () => {} },
    fetch: async () => response([
      row({ offerName: 'Offer: summer', offerId: 'summer' }),
      row({ path: '/products/incomplete', offerHeadline: 'Incomplete offer' }),
    ]),
  });
  const sdk = new SyntheticModule(['default'], function initializeSDK() {
    this.setExport('default', Promise.resolve({
      context: { org: 'aemsites', repo: 'rbc', path: '/bank-accounts' },
      actions: {
        sendHTML: (value) => { calls.push({ action: 'html', value }); },
        sendText: (value) => { calls.push({ action: 'text', value }); },
        closeLibrary: () => { calls.push({ action: 'close' }); },
        ...actions,
      },
    }));
  }, { context });
  await sdk.link(() => {});
  await sdk.evaluate();
  const modules = {
    './products.js': new SourceTextModule(source('tools/product-picker/products.js'), { context }),
    '../../utils/dom.js': new SourceTextModule(source('utils/dom.js'), { context }),
  };
  const ui = new SourceTextModule(source('tools/product-picker/product-picker.js'), {
    context,
    importModuleDynamically: async () => sdk,
  });
  await ui.link((specifier) => modules[specifier]);
  await ui.evaluate();
  const flush = () => new Promise((complete) => { setImmediate(complete); });
  await flush();
  assert.match(dom.window.document.querySelector('.picker-status').textContent, /shown/);
  return {
    calls,
    flush,
    find: (selector) => dom.window.document.querySelector(selector),
    changeMode: (value) => {
      const input = dom.window.document.querySelector(`[name="mode"][value="${value}"]`);
      input.checked = true;
      input.dispatchEvent(new dom.window.Event('change'));
    },
  };
}

test('product insertion uses relative link text and can be repeated while the picker stays open', async () => {
  const { find, calls, flush } = await picker();
  assert.equal(find('.picker-insert').disabled, true);
  find('.picker-list button[data-key="/products/signature:products:0"]').click();
  const button = find('.picker-insert');
  assert.equal(button.disabled, false);
  assert.equal(find('.picker-detail-content pre').textContent, '/products/signature');
  button.click();
  assert.equal(button.disabled, true);
  await flush();
  assert.equal(button.disabled, false);
  button.click();
  await flush();
  assert.deepEqual(calls, [
    { action: 'html', value: '<a href="https://main--rbc--aemsites.aem.live/products/signature">/products/signature</a>' },
    { action: 'close' },
    { action: 'html', value: '<a href="https://main--rbc--aemsites.aem.live/products/signature">/products/signature</a>' },
    { action: 'close' },
  ]);
});

test('valid offer insertion can be repeated; incomplete offers remain disabled', async () => {
  const {
    find, changeMode, calls, flush,
  } = await picker();
  changeMode('offers');
  assert.equal(find('.picker-insert').disabled, true);
  find('.picker-list button[data-key="/products/signature:offers:0"]').click();
  const button = find('.picker-insert');
  assert.equal(button.disabled, false);
  button.click();
  await flush();
  assert.equal(button.disabled, false);
  button.click();
  await flush();
  assert.deepEqual(calls, [
    { action: 'text', value: 'Offer: summer:summer' }, { action: 'close' },
    { action: 'text', value: 'Offer: summer:summer' }, { action: 'close' },
  ]);
  find('.picker-list button[data-key="/products/incomplete:offers:0"]').click();
  assert.equal(button.disabled, true);
});

test('pending insertion prevents double sends and enables Insert after completion', async () => {
  let finish;
  let count = 0;
  const { find, flush } = await picker({
    sendHTML: () => {
      count += 1;
      return new Promise((complete) => { finish = complete; });
    },
  });
  find('.picker-list button').click();
  const button = find('.picker-insert');
  button.click();
  button.click();
  await flush();
  assert.equal(count, 1);
  assert.equal(button.disabled, true);
  finish();
  await flush();
  assert.equal(button.disabled, false);
});

test('failed insertion or library close never leaves a valid selection permanently disabled', async () => {
  const failed = await picker({ sendHTML: () => { throw new Error('Insertion failed'); } });
  failed.find('.picker-list button').click();
  failed.find('.picker-insert').click();
  await failed.flush();
  assert.equal(failed.find('.picker-insert').disabled, false);
  assert.match(failed.find('.picker-error').textContent, /Insertion failed/);
  assert.equal(failed.calls.length, 0);

  const open = await picker({ closeLibrary: () => { throw new Error('Close failed'); } });
  open.find('.picker-list button').click();
  open.find('.picker-insert').click();
  await open.flush();
  assert.equal(open.find('.picker-insert').disabled, false);
  assert.match(open.find('.picker-error').textContent, /could not close/);
  assert.equal(open.calls.length, 1);
});

test('product URL validation preserves full language paths and rejects unsafe paths', async () => {
  const { productURL, languageForPath } = await ready;
  assert.equal(productURL('/fr/products/signature'), 'https://main--rbc--aemsites.aem.live/fr/products/signature');
  assert.equal(languageForPath('/fr/bank-accounts'), 'fr');
  assert.equal(languageForPath('/bank-accounts'), 'en');
  ['https://evil.test/products/a', '/products/../a', '/products/a?x=1',
    '/products/a#b', '/products//a', '/products/a"', '/products/a/'].forEach((path) => {
    assert.throws(() => productURL(path), /Invalid product path/);
  });
});

test('offer output trims identity, accepts localized names/colons, rejects invalid types and lines', async () => {
  const { offerValue } = await ready;
  assert.equal(offerValue({ offerName: ' Offre: été ', offerId: ' shared-id ' }), 'Offre: été:shared-id');
  [
    { offerName: '', offerId: 'id' }, { offerName: 'Name', offerId: '' },
    { offerName: 'Name', offerId: 123 }, { offerName: 'Name', offerId: 'bad:id' },
    { offerName: 'Name\n', offerId: 'id' }, { offerName: 'Name', offerId: 'id\r' },
  ].forEach((offer) => assert.throws(() => offerValue(offer)));
});

test('normalizer retains incomplete offers without making them insertable', async () => {
  const { normalizeProduct } = await ready;
  assert.equal(normalizeProduct(row()).offers.length, 0);
  const incomplete = normalizeProduct(row({ offerHeadline: 'Get an iPad' }));
  assert.equal(incomplete.offers.length, 1);
  assert.match(incomplete.offers[0].error, /name and ID are required/);
  const wrongType = normalizeProduct(row({ offerId: 123, offerName: 'Name' }));
  assert.match(wrongType.offers[0].error, /must be text/);
  assert.equal(normalizeProduct(row({ offerId: 'id', offerName: 'Name' })).offers[0].error, '');
  assert.throws(() => normalizeProduct(row({ category: 12 })), /category must be text/);
});

test('search keeps variants and languages distinct and matches accents and offer identities', async () => {
  const { normalizeProduct, matchingItems } = await ready;
  const products = [
    normalizeProduct(row({ productCode: '099', offerName: 'Summer', offerId: 'promo' })),
    normalizeProduct(row({
      path: '/products/newcomer', productCode: '099', persona: 'newcomer', variantOf: '099',
    })),
    normalizeProduct(row({
      path: '/fr/products/signature', name: 'Épargne', offerName: 'Été', offerId: 'promo',
    })),
  ];
  assert.equal(matchingItems(products).length, 2);
  assert.equal(matchingItems(products, { query: '099', persona: 'newcomer' }).length, 1);
  assert.equal(matchingItems(products, { language: 'fr', query: 'epargne' }).length, 1);
  assert.equal(matchingItems(products, { query: 'promo' }).length, 1);
  assert.equal(matchingItems(products, { mode: 'offers', language: 'fr', query: 'ete' }).length, 1);
});

test('multiple normalized associations remain independently selectable, including shared IDs', async () => {
  const { normalizeProduct, matchingItems, offerValue } = await ready;
  const product = normalizeProduct(row());
  product.offers = [
    { offerId: 'shared', offerName: 'First' },
    { offerId: 'shared', offerName: 'Second' },
  ];
  const items = matchingItems([product], { mode: 'offers' });
  assert.equal(items.length, 2);
  assert.notEqual(items[0].key, items[1].key);
  assert.equal(offerValue(items[1].offer), 'Second:shared');
});

test('loader retrieves every page and surfaces invalid records', async () => {
  const { loadProducts } = await ready;
  const calls = [];
  const result = await loadProducts(async (url, options) => {
    calls.push(url);
    assert.equal(options.cache, 'no-store');
    return calls.length === 1
      ? response([row()], { offset: 0, total: 3 })
      : response([row({ path: '/products/other' }), row({ path: '/products/../bad' })], { offset: 1, total: 3 });
  });
  assert.deepEqual(calls, ['/products/query-index.json', '/products/query-index.json?offset=1']);
  assert.equal(result.products.length, 2);
  assert.equal(result.warnings.length, 1);
});

test('loader rejects HTTP, malformed data, changing totals and incomplete pagination', async () => {
  const { loadProducts } = await ready;
  await assert.rejects(loadProducts(async () => ({ ok: false, status: 503 })), /503/);
  await assert.rejects(loadProducts(async () => ({ ok: true, json: async () => ({}) })), /data array/);
  await assert.rejects(loadProducts(async () => response([], { offset: 0, total: 2 })), /expected records/);
  await assert.rejects(loadProducts(async () => response([row()], { offset: 9, total: 2 })), /pagination/);
  let call = 0;
  await assert.rejects(loadProducts(async () => {
    call += 1;
    return response([row()], { offset: call - 1, total: call === 1 ? 2 : 3 });
  }), /changed/);
  const empty = await loadProducts(async () => response([], { offset: 0, total: 0 }));
  assert.equal(empty.products.length, 0);
});
