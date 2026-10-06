/* eslint-disable no-console -- Author-visible errors also need developer diagnostics. */
import { createElement } from '../../utils/dom.js';
import {
  languageForPath, loadProducts, matchingItems, offerValue, productURL,
} from './products.js';

const root = document.querySelector('.rbc-picker');
const find = (name) => root.querySelector(`.picker-${name}`);
const controls = ['search', 'language', 'category', 'persona'];
const state = {
  products: [],
  selected: null,
  actions: null,
  loading: false,
  loaded: false,
  inserting: false,
  request: null,
};

function showError(message = '', retry = false) {
  find('error').textContent = message;
  find('error').hidden = !message;
  find('retry').hidden = !retry;
}

function mode() {
  return root.querySelector('[name="mode"]:checked').value;
}

function options() {
  return {
    language: find('language').value,
    mode: mode(),
    query: find('search').value,
    category: find('category').value,
    persona: find('persona').value,
  };
}

function addDetail(list, label, value) {
  if (typeof value !== 'string' || !value) return;
  list.append(createElement('dt', {}, label), createElement('dd', {}, value));
}

function renderDetails() {
  const content = find('detail-content');
  const button = find('insert');
  find('actionbar').hidden = !state.selected;
  const selection = find('selection');
  const isOffer = mode() === 'offers';
  button.textContent = isOffer ? 'Insert Offer' : 'Insert Product';
  button.disabled = !state.selected || state.loading || state.inserting;
  selection.classList.remove('picker-invalid');
  if (state.inserting) {
    selection.textContent = 'Sending selection to the editor...';
  } else if (state.loading) {
    selection.textContent = 'Connecting or loading records...';
  } else if (!state.loaded) {
    selection.textContent = 'Catalog unavailable. Use Retry loading before inserting.';
  } else if (!state.selected) {
    selection.textContent = `Select ${isOffer ? 'an offer' : 'a product'} to enable Insert.`;
  }
  find('instructions').textContent = isOffer
    ? 'Place the cursor in the value cell of a promo or offer Section Metadata row. Only Name:ID is inserted; no row, copy, or CTA is created. Existing values do not update automatically.'
    : 'Products insert a structured product link, not a product page link.';
  if (!state.selected) {
    content.replaceChildren(createElement('p', {}, `Select ${isOffer ? 'an offer' : 'a product'} to review its details.`));
    return;
  }
  const { product, offer } = state.selected;
  const details = createElement('dl');
  addDetail(details, 'Product', product.name || product.shortName || product.path);
  addDetail(details, 'Short name', product.shortName);
  addDetail(details, 'Path', product.path);
  addDetail(details, 'Product code', product.productCode);
  addDetail(details, 'Category', product.categoryLabel || product.category);
  addDetail(details, 'Persona', product.persona);
  addDetail(details, 'Variant of', product.variantOf);
  addDetail(details, 'Tagline', product.tagline);
  const selectedOffers = offer ? [offer] : product.offers;
  selectedOffers.forEach((entry) => {
    addDetail(details, 'Offer name', entry.offerName);
    addDetail(details, 'Offer ID', entry.offerId);
    addDetail(details, 'Offer headline', entry.offerHeadline);
    addDetail(details, 'Offer badge', entry.offerBadge);
    addDetail(details, 'Start date (not enforced)', entry.offerStartDate);
    addDetail(details, 'End date (not enforced)', entry.offerEndDate);
    addDetail(details, 'Conditions', entry.offerConditions);
    addDetail(details, 'Offer details URL', entry.offerDetailsUrl);
  });
  content.replaceChildren(details);
  try {
    if (offer?.error) throw new Error(offer.error);
    const output = offer ? offerValue(offer) : product.path;
    if (!offer) addDetail(details, 'Link destination', productURL(product.path));
    content.append(createElement('h3', {}, 'Exact insertion output'), createElement('pre', {}, output));
    if (!state.loading && !state.inserting) {
      selection.textContent = `Ready to insert ${isOffer ? 'offer' : 'product'}: ${offer ? output : product.shortName || product.name || product.path}`;
    }
  } catch (error) {
    button.disabled = true;
    selection.textContent = `Cannot insert: ${error.message}`;
    selection.classList.add('picker-invalid');
    content.append(createElement('p', { class: 'picker-invalid' }, error.message));
  }
}

function highlight(text) {
  const span = createElement('span');
  const query = find('search').value.trim();
  if (!query) {
    span.textContent = text;
    return span;
  }
  const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  let start = 0;
  [...text.matchAll(regex)].forEach((match) => {
    span.append(text.slice(start, match.index), createElement('mark', {}, match[0]));
    start = match.index + match[0].length;
  });
  span.append(text.slice(start));
  return span;
}

function select(item) {
  state.selected = item;
  find('list').querySelectorAll('button').forEach((button) => {
    const selected = button.dataset.key === item.key;
    button.setAttribute('aria-pressed', selected);
    button.tabIndex = selected ? 0 : -1;
  });
  renderDetails();
}

function renderResults() {
  const items = matchingItems(state.products, options());
  if (!items.some((item) => item.key === state.selected?.key)) state.selected = null;
  const list = find('list');
  list.replaceChildren(...items.map((item, index) => {
    const { product, offer } = item;
    const selected = state.selected?.key === item.key;
    const tabbable = state.selected ? selected : index === 0;
    const title = offer ? offer.offerName || offer.offerHeadline || offer.offerBadge || 'Incomplete offer'
      : product.shortName || product.name || product.path;
    const button = createElement('button', {
      type: 'button',
      'data-key': item.key,
      'aria-pressed': selected,
      tabindex: tabbable ? 0 : -1,
    }, [
      highlight(typeof title === 'string' ? title : 'Incomplete offer'),
      createElement('small', {}, product.name || product.path),
      createElement('small', {}, `${product.path}${product.persona ? ` · ${product.persona}` : ''}`),
      ...(offer?.error ? [createElement('small', { class: 'picker-invalid' }, `Cannot insert: ${offer.error}`)] : []),
    ]);
    button.addEventListener('click', () => select(item));
    return createElement('li', {}, button);
  }));
  if (!items.length) list.append(createElement('li', { class: 'picker-empty' }, 'No matching records. Try another search, filter, or language.'));
  find('status').textContent = `${items.length} ${mode() === 'offers' ? 'offer associations' : 'products'} shown in ${find('language').value === 'fr' ? 'French' : 'English'}.`;
  renderDetails();
}

function updateFilters() {
  const products = state.products.filter((product) => product.language === find('language').value);
  ['category', 'persona'].forEach((field) => {
    const control = find(field);
    const selected = control.value;
    const values = [...new Set(products.map((product) => product[field]).filter(Boolean))].sort();
    control.replaceChildren(
      createElement('option', { value: '' }, `All ${field === 'category' ? 'categories' : 'personas'}`),
      ...values.map((value) => createElement('option', { value }, value)),
    );
    control.value = values.includes(selected) ? selected : '';
  });
}

function setLoading(loading) {
  state.loading = loading;
  find('results').setAttribute('aria-busy', loading);
  controls.forEach((name) => { find(name).disabled = loading || !state.loaded; });
  root.querySelectorAll('[name="mode"]').forEach((input) => {
    input.disabled = loading || !state.loaded;
  });
  find('clear').disabled = loading || !state.loaded;
  find('retry').disabled = loading || !state.actions;
  renderDetails();
}

async function refresh() {
  state.request?.abort();
  const request = new AbortController();
  state.request = request;
  const timeout = setTimeout(() => request.abort(new Error('Product index request timed out.')), 15000);
  state.selected = null;
  state.products = [];
  state.loaded = false;
  find('list').replaceChildren();
  find('warnings').hidden = true;
  showError();
  setLoading(true);
  find('status').textContent = 'Loading products and offers...';
  try {
    const { products, warnings } = await loadProducts(fetch, request.signal);
    if (request !== state.request) return;
    state.products = products;
    state.loaded = true;
    updateFilters();
    find('warnings').hidden = !warnings.length;
    find('warnings').querySelector('ul').replaceChildren(...warnings.map((warning) => createElement('li', {}, warning)));
    renderResults();
  } catch (error) {
    if (request !== state.request) return;
    console.error('RBC picker: index loading failed', error);
    showError(error.message, true);
    find('status').textContent = 'Products could not be loaded.';
  } finally {
    clearTimeout(timeout);
    if (request === state.request) setLoading(false);
  }
}

async function insert() {
  if (!state.selected || state.loading || state.inserting || find('insert').disabled) return;
  showError();
  state.inserting = true;
  renderDetails();
  try {
    const { product, offer } = state.selected;
    if (offer) {
      await state.actions.sendText(offerValue(offer));
    } else {
      const url = productURL(product.path);
      await state.actions.sendHTML(createElement('a', { href: url }, product.path).outerHTML);
    }
  } catch (error) {
    console.error('RBC picker: insertion failed', error);
    showError(`Could not insert the selection: ${error.message}`);
    state.inserting = false;
    renderDetails();
    return;
  }
  // The SDK sends a message without an editor acknowledgement.
  find('status').textContent = 'Insertion sent to the editor.';
  try {
    await state.actions.closeLibrary();
  } catch (error) {
    console.error('RBC picker: library close failed', error);
    showError('Insertion was sent, but the picker could not close. Check the document before inserting again.');
  } finally {
    state.inserting = false;
    renderDetails();
  }
}

async function init() {
  let timeout;
  setLoading(true);
  try {
    // eslint-disable-next-line import/no-unresolved
    const sdk = import('https://da.live/nx/utils/sdk.js').then((module) => module.default);
    const { context, actions } = await Promise.race([
      sdk,
      new Promise((resolve, reject) => {
        timeout = setTimeout(() => reject(new Error('Open this picker from the RBC DA library to connect to the editor.')), 10000);
      }),
    ]);
    if (context?.org !== 'aemsites' || context?.repo !== 'rbc') throw new Error('This picker is configured for aemsites/rbc.');
    if (['sendHTML', 'sendText', 'closeLibrary'].some((name) => typeof actions?.[name] !== 'function')) {
      throw new Error('The editor does not provide the required insertion actions.');
    }
    state.actions = actions;
    find('language').value = languageForPath(context.path);
    await refresh();
  } catch (error) {
    console.error('RBC picker: initialization failed', error);
    find('status').textContent = 'Editor connection unavailable.';
    find('selection').textContent = 'Cannot insert: editor connection unavailable.';
    showError(error.message);
  } finally {
    clearTimeout(timeout);
  }
}

controls.forEach((name) => find(name).addEventListener(name === 'search' ? 'input' : 'change', () => {
  if (name === 'language') {
    state.selected = null;
    updateFilters();
  }
  renderResults();
}));
root.querySelectorAll('[name="mode"]').forEach((input) => input.addEventListener('change', () => {
  state.selected = null;
  renderResults();
}));
find('clear').addEventListener('click', () => {
  ['search', 'category', 'persona'].forEach((name) => { find(name).value = ''; });
  renderResults();
  find('search').focus();
});
find('retry').addEventListener('click', refresh);
find('insert').addEventListener('click', insert);
new ResizeObserver(() => {
  root.style.setProperty('--picker-action-height', `${find('actionbar').offsetHeight}px`);
}).observe(find('actionbar'));
find('list').addEventListener('keydown', (event) => {
  if (event.key === 'Tab' && !event.shiftKey && !find('insert').disabled) {
    event.preventDefault();
    find('insert').focus();
    return;
  }
  if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
  const buttons = [...find('list').querySelectorAll('button')];
  if (!buttons.length) return;
  event.preventDefault();
  const index = buttons.indexOf(document.activeElement);
  const next = event.key === 'ArrowDown' ? (index + 1) % buttons.length
    : (index <= 0 ? buttons.length : index) - 1;
  buttons[next].focus();
  buttons[next].click();
});
init();
