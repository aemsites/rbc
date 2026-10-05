/* eslint-env node */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';

const gtmSource = await readFile(new URL('../scripts/gtm.js', import.meta.url), 'utf8');
const consentSource = await readFile(new URL('../scripts/consent-check.js', import.meta.url), 'utf8');

async function initialize({
  href = 'https://www.rbcroyalbank.com/personal.html',
  lang = 'en-CA',
  metadata = {},
  cookie = '',
  ssr,
  isErrorPage = false,
  errorCode,
  dataLayer = [],
  source = gtmSource,
} = {}) {
  const location = new URL(href);
  const listeners = new Map();
  const scripts = [];
  const sections = [{}, {}];
  const consentEvents = [];
  const document = {
    cookie,
    documentElement: { lang },
    title: 'Personal banking',
    referrer: 'https://www.rbc.com/',
    querySelectorAll: (selector) => {
      assert.equal(selector, 'main .section');
      return sections;
    },
    addEventListener: (type, handler, capture) => {
      listeners.set(type, { handler, capture });
    },
  };
  const window = {
    location,
    dataLayer,
    serverSideRulesEngineResponse: ssr,
    isErrorPage,
    errorCode,
    dispatchEvent: (event) => consentEvents.push(event),
  };
  const context = createContext({
    window,
    document,
    URL,
    URLSearchParams,
    CustomEvent: class {
      constructor(type, options) {
        this.type = type;
        this.detail = options.detail;
      }
    },
  });
  const aem = new SyntheticModule(['getMetadata', 'loadScript'], function initializeAem() {
    this.setExport('getMetadata', (name) => metadata[name] || '');
    this.setExport('loadScript', (url, options) => scripts.push({ url, options }));
  }, { context });
  const consent = new SourceTextModule(consentSource, {
    context,
    importModuleDynamically: async (specifier) => {
      assert.equal(specifier, './consented.js');
      const consented = new SyntheticModule([], () => {}, { context });
      await consented.link(() => {});
      await consented.evaluate();
      return consented;
    },
  });
  const gtm = new SourceTextModule(source, { context });
  await gtm.link((specifier) => {
    if (specifier === './aem.js') return aem;
    assert.equal(specifier, './consent-check.js');
    return consent;
  });
  await gtm.evaluate();
  const snapshot = () => JSON.parse(JSON.stringify(window.dataLayer));
  const click = ({
    href: linkHref = '/accounts',
    text = ' Apply now ',
    block,
    section,
    type = 'click',
    button = 0,
    clickable = true,
    target = null,
  } = {}) => {
    const element = {
      textContent: text,
      getAttribute: (name) => {
        assert.equal(name, 'href');
        return linkHref;
      },
      closest: (selector) => {
        if (selector === '[data-block-name]') return block ? { dataset: { blockName: block } } : null;
        assert.equal(selector, '.section');
        return section || null;
      },
    };
    listeners.get(type).handler({
      button,
      target: target || {
        closest: (selector) => {
          assert.equal(selector, 'a[href], button[href]');
          return clickable ? element : null;
        },
      },
    });
  };
  return {
    window, document, scripts, sections, listeners, consentEvents, snapshot, click,
  };
}

test('exact v2 page metadata and unchanged initialization order', async () => {
  const existing = [{ existing: true }];
  const state = await initialize({
    dataLayer: existing,
    lang: 'fr-CA',
    metadata: {
      lob: 'accounts',
      'page-type': 'product',
      'content-group': 'chequing',
      'business-line': 'commercial',
    },
  });
  assert.equal(state.window.dataLayer, existing);
  const pushes = state.snapshot();
  assert.deepEqual(pushes[1], {
    page: {
      lob: 'accounts',
      page_type: 'product',
      content_group: 'chequing',
      site_section: 'public',
      cms_type: 'aem',
      page_language: 'fr',
      business_line: 'commercial',
      environment: 'prod',
      site_version: '1.3.0-100226',
    },
  });
  assert.equal(pushes[2].event, 'gtm.js');
  assert.equal(typeof pushes[2]['gtm.start'], 'number');
  assert.deepEqual(pushes[3], {
    user: {
      user_id: null, user_id_primary: null, user_type: null, login_status: 'guest',
    },
    consent: { consent_status: 'pending' },
  });
  assert.deepEqual(pushes[4], {
    event: 'page_view',
    page_title: state.document.title,
    page_location: state.window.location.href,
    page_referrer: state.document.referrer,
  });
  assert.equal(pushes.length, 5);
  assert.deepEqual(JSON.parse(JSON.stringify(state.scripts)), [{
    url: 'https://www.googletagmanager.com/gtm.js?id=GTM-KPSBBC6',
    options: { async: true },
  }]);
});

test('missing metadata, language defaults, and environment detection are preserved', async () => {
  await Promise.all([
    ['www.rbcroyalbank.com', 'prod'],
    ['main--rbc--aemsites.aem.live', 'prod'],
    ['feat--rbc--aemsites.aem.page', 'staging'],
    ['localhost', 'dev'],
    ['feat--rbc--aemsites.aem.live', 'dev'],
  ].map(async ([hostname, environment]) => {
    const state = await initialize({ href: `https://${hostname}/`, lang: '' });
    assert.deepEqual(state.snapshot()[0], {
      page: {
        site_section: 'public',
        cms_type: 'aem',
        page_language: 'en',
        business_line: 'personal',
        environment,
        site_version: '1.3.0-100226',
      },
    });
  }));
});

test('site version uses independent DataLayer SemVer and an MMDDYY date stamp', async () => {
  const state = await initialize();
  const { site_version: version } = state.snapshot()[0].page;
  assert.equal(version, '1.3.0-100226');
  assert.match(version, /^\d+\.\d+\.\d+-\d{6}$/);
  const source = gtmSource.replace(
    /const SITE_VERSION_NUMBER = '[^']+';/,
    "const SITE_VERSION_NUMBER = '2.4.1';",
  );
  assert.notEqual(source, gtmSource);
  const independent = await initialize({ source });
  assert.equal(independent.snapshot()[0].page.site_version, '2.4.1-100226');
});

test('error codes are nested under page only for known error pages', async () => {
  await Promise.all(['404', '403'].map(async (errorCode) => {
    const state = await initialize({ isErrorPage: true, errorCode });
    const initial = state.snapshot()[0];
    assert.equal(initial.page.error_code, errorCode);
    assert.deepEqual(Object.keys(initial), ['page']);
  }));
  const unknown = await initialize({ isErrorPage: true });
  assert.equal(Object.hasOwn(unknown.snapshot()[0].page, 'error_code'), false);
  const ordinary = await initialize({ errorCode: '404' });
  assert.equal(Object.hasOwn(ordinary.snapshot()[0].page, 'error_code'), false);
});

test('marketing preserves UTM/campaign fields and prioritizes uppercase GCLID', async () => {
  const params = new URLSearchParams({
    utm_source: 'search',
    utm_medium: 'cpc',
    utm_campaign: 'fall',
    utm_content: 'banner',
    utm_term: 'bank account',
    campaign_id: 'campaign-42',
    gclid: 'google-id',
    fbclid: 'facebook-id',
  });
  const state = await initialize({ href: `https://www.rbcroyalbank.com/?${params}` });
  const additional = state.snapshot()[2];
  assert.deepEqual(additional.marketing, {
    utm_source: 'search',
    utm_medium: 'cpc',
    utm_campaign: 'fall',
    utm_content: 'banner',
    utm_term: 'bank account',
    campaign_id: 'campaign-42',
    click_id: 'google-id',
    click_id_type: 'GCLID',
  });
  assert.equal(Object.hasOwn(additional, 'utm'), false);
});

test('FBCLID and omitted empty marketing values retain existing selection behavior', async () => {
  const facebook = await initialize({
    href: 'https://www.rbcroyalbank.com/?gclid=&fbclid=fb-id&utm_source=',
  });
  assert.deepEqual(facebook.snapshot()[2].marketing, {
    click_id: 'fb-id', click_id_type: 'FBCLID',
  });
  const empty = await initialize({ href: 'https://www.rbcroyalbank.com/?utm_source=&gclid=' });
  assert.equal(Object.hasOwn(empty.snapshot()[2], 'marketing'), false);
  const campaign = await initialize({ href: 'https://www.rbcroyalbank.com/?campaign_id=internal' });
  assert.deepEqual(campaign.snapshot()[2].marketing, { campaign_id: 'internal' });
});

test('real consent helper preserves pending, overrides, cookie groups, and exact matches', async () => {
  await Promise.all([
    [{}, { consent_status: 'pending' }],
    [{ href: 'https://www.rbcroyalbank.com/?consent=accept' }, {
      consent_status: 'granted', analytics_consent: 'granted', marketing_consent: 'granted',
    }],
    [{ href: 'https://www.rbcroyalbank.com/?consent=decline&_ot=2:1,3:1,4:1' }, {
      consent_status: 'denied', analytics_consent: 'denied', marketing_consent: 'denied',
    }],
    [{ href: 'https://www.rbcroyalbank.com/?_ot=2:1,3:0,4:1' }, {
      consent_status: 'denied', analytics_consent: 'granted', marketing_consent: 'granted',
    }],
    [{ href: 'https://www.rbcroyalbank.com/?_ot=12:1,13:1,14:1' }, {
      consent_status: 'denied', analytics_consent: 'denied', marketing_consent: 'denied',
    }],
    [{ cookie: `OptanonConsent=${encodeURIComponent('groups=2:0,3:1,4:0')}` }, {
      consent_status: 'granted', analytics_consent: 'denied', marketing_consent: 'denied',
    }],
    [{ cookie: 'OptanonConsent=%malformed' }, { consent_status: 'pending' }],
  ].map(async ([options, expected]) => {
    const state = await initialize(options);
    assert.deepEqual(state.snapshot()[2].consent, expected);
  }));
});

test('consent updates do not introduce additional dataLayer pushes', async () => {
  const state = await initialize();
  const before = state.snapshot();
  state.window.OnetrustActiveGroups = ',2,4,';
  state.window.OptanonWrapper();
  state.window.OptanonWrapper();
  assert.equal(state.consentEvents.length, 1);
  assert.equal(state.consentEvents[0].type, 'consent.update');
  assert.equal(state.consentEvents[0].detail.consented, false);
  assert.deepEqual(state.snapshot(), before);
});

test('v2 experimentation uses raw arm IDs and preserves missing/empty experiment behavior', async () => {
  const state = await initialize({
    ssr: { variant: 'offer', conductrics: { result_content: { sels: { agent1: 'A', agent2: 'B' } } } },
  });
  assert.deepEqual(state.snapshot()[2].experimentation, {
    experiments: [
      {
        experiment_id: 'agent1',
        experiment_name: 'offer',
        variant_id: 'A',
        variant_name: 'offer',
        is_control: true,
        experiment_type: 'personalization',
      },
      {
        experiment_id: 'agent2',
        experiment_name: 'offer',
        variant_id: 'B',
        variant_name: 'offer',
        is_control: false,
        experiment_type: 'personalization',
      },
    ],
  });
  const fallback = await initialize({
    ssr: { conductrics: { result_content: { sels: { agent: 'A' } } } },
  });
  assert.deepEqual(fallback.snapshot()[2].experimentation.experiments[0], {
    experiment_id: 'agent',
    variant_id: 'A',
    variant_name: 'default',
    is_control: true,
    experiment_type: 'personalization',
  });
  const empty = await initialize({ ssr: { conductrics: { result_content: { sels: {} } } } });
  assert.deepEqual(empty.snapshot()[2].experimentation, { experiments: [] });
  const missing = await initialize({ ssr: {} });
  assert.equal(Object.hasOwn(missing.snapshot()[2], 'experimentation'), false);
});

test('numeric Conductrics arm IDs are emitted as strings without an agent suffix', async () => {
  const state = await initialize({
    ssr: { conductrics: { result_content: { sels: { agent1: 0, agent2: 1 } } } },
  });
  assert.deepEqual(
    state.snapshot()[2].experimentation.experiments.map((experiment) => experiment.variant_id),
    ['0', '1'],
  );
});

test('click schema keeps authored block precedence and capture-phase listeners', async () => {
  const state = await initialize();
  assert.equal(state.listeners.get('click').capture, true);
  assert.equal(state.listeners.get('auxclick').capture, true);
  state.click({ block: 'cards', section: state.sections[1] });
  assert.deepEqual(state.snapshot().at(-1), {
    event: 'element_click',
    element_url: '/accounts',
    element_text: 'Apply now',
    element_section: 'cards',
    outbound: false,
  });
  state.click({ section: state.sections[1], text: '' });
  assert.equal(state.snapshot().at(-1).element_section, 'default-content-2');
  assert.equal(state.snapshot().at(-1).element_text, '');
  state.click();
  assert.equal(state.snapshot().at(-1).element_section, 'default-content');
});

test('outbound classification preserves relative, hostname, and invalid URL behavior', async () => {
  const state = await initialize();
  [
    ['/accounts', false],
    ['#details', false],
    ['https://www.rbcroyalbank.com:8443/accounts', false],
    ['https://www.rbc.com/accounts', true],
    ['//external.example/accounts', true],
    ['http://[', false],
  ].forEach(([href, outbound]) => {
    state.click({ href });
    assert.equal(state.snapshot().at(-1).outbound, outbound);
    assert.equal(state.snapshot().at(-1).element_url, href);
  });
});

test('middle clicks track once; right clicks, empty hrefs, and non-clickable targets are ignored', async () => {
  const state = await initialize();
  state.click({ type: 'auxclick', button: 1 });
  assert.equal(state.snapshot().length, 5);
  assert.equal(state.snapshot().at(-1).event, 'element_click');
  state.click({ type: 'auxclick', button: 2 });
  state.click({ type: 'auxclick', button: 0 });
  state.click({ href: '' });
  state.click({ clickable: false });
  state.click({ target: {} });
  assert.equal(state.snapshot().length, 5);
});

test('GTM retains the deferred martech gate without adding noscript markup', async () => {
  const scripts = await readFile(new URL('../scripts/scripts.js', import.meta.url), 'utf8');
  assert.match(scripts, /function loadDelayed\(\) \{[\s\S]*?import\('\.\/consent-check\.js'\);/);
  assert.match(scripts, /if \(new URLSearchParams\(window\.location\.search\)\.get\('martech'\) !== 'off'\) import\('\.\/gtm\.js'\);/);
  assert.doesNotMatch(gtmSource, /<noscript|ns\.html/);
});

test('non-commerce initialization has no ecommerce payloads or integration', async () => {
  const state = await initialize();
  assert.deepEqual(
    state.snapshot().filter((entry) => entry.event).map((entry) => entry.event),
    ['gtm.js', 'page_view'],
  );
  state.snapshot().forEach((entry) => {
    ['product', 'product_list', 'promotion'].forEach((field) => {
      assert.equal(Object.hasOwn(entry, field), false);
    });
  });
  assert.doesNotMatch(gtmSource, /ecommerce|promotion_viewed|product_viewed|product_list_viewed/);
});
