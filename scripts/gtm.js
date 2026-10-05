import { getMetadata, loadScript } from './aem.js';
import {
  CONSENT_GROUPS, hasConsentGroup, resolveGroups, consentOverride,
} from './consent-check.js';

// GTM owns child-container routing; page.lob is pushed before loading the root container.
const GTM_ID = 'GTM-KPSBBC6';
const PROD_HOSTS = ['main--rbc--aemsites.aem.live', 'www.rbcroyalbank.com'];
const SITE_SECTION = 'public';
const CMS_TYPE = 'aem';
// Independent DataLayer SemVer and date stamp; see AGENTS.md for bump rules.
const SITE_VERSION_NUMBER = '1.0.0';
const SITE_VERSION_DATE = '2026-10-05';

const defined = (obj) => Object.fromEntries(
  Object.entries(obj).filter(([, value]) => value !== undefined && value !== null && value !== ''),
);

function environment() {
  const { hostname } = window.location;
  if (PROD_HOSTS.includes(hostname)) return 'prod';
  if (hostname.endsWith('.aem.page')) return 'staging';
  return 'dev';
}

function siteVersion() {
  const [year, month, day] = SITE_VERSION_DATE.split('-');
  return `${SITE_VERSION_NUMBER}-${month}${day}${year.slice(-2)}`;
}

// Nested page keys per the v2 "Standard DataLayer GTM Implementation Guide".
// lob / page-type / content-group / business-line are page metadata that must be authored
// per-page or bulk-applied via the metadata sheet (not yet populated - see PR description for
// the proposed column additions).
function initialPushData() {
  return {
    page: defined({
      lob: getMetadata('lob'),
      page_type: getMetadata('page-type'),
      content_group: getMetadata('content-group'),
      site_section: SITE_SECTION,
      cms_type: CMS_TYPE,
      page_language: (document.documentElement.lang || 'en').split('-')[0],
      business_line: getMetadata('business-line') || 'personal',
      environment: environment(),
      site_version: siteVersion(),
      error_code: window.isErrorPage ? window.errorCode : undefined,
    }),
  };
}

function marketingData() {
  const params = new URLSearchParams(window.location.search);
  const marketing = defined({
    utm_source: params.get('utm_source'),
    utm_medium: params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
    utm_content: params.get('utm_content'),
    utm_term: params.get('utm_term'),
    campaign_id: params.get('campaign_id'),
  });
  const clickIds = { gclid: params.get('gclid'), fbclid: params.get('fbclid') };
  const [type, id] = Object.entries(clickIds).find(([, value]) => value) || [];
  if (id) {
    marketing.click_id = id;
    marketing.click_id_type = type.toUpperCase();
  }
  return Object.keys(marketing).length ? { marketing } : undefined;
}

// Group ids confirmed against RBC's live OneTrust config (see consent-check.js):
// analytics_consent -> group 2 (Performance), marketing_consent -> group 4 (Advertising).
// consent_status (overall gate for martech load) still reflects the personalization group,
// since that's what actually controls whether Conductrics/consented.js loads.
function consentData() {
  const override = consentOverride();
  if (override !== null) {
    const status = override ? 'granted' : 'denied';
    return {
      consent: {
        consent_status: status,
        analytics_consent: status,
        marketing_consent: status,
      },
    };
  }
  const groups = resolveGroups();
  if (!groups) return { consent: { consent_status: 'pending' } };
  const personalizationGranted = hasConsentGroup(groups, CONSENT_GROUPS.personalization);
  const analyticsGranted = hasConsentGroup(groups, CONSENT_GROUPS.analytics);
  const marketingGranted = hasConsentGroup(groups, CONSENT_GROUPS.marketing);
  return {
    consent: {
      consent_status: personalizationGranted ? 'granted' : 'denied',
      analytics_consent: analyticsGranted ? 'granted' : 'denied',
      marketing_consent: marketingGranted ? 'granted' : 'denied',
    },
  };
}

function experimentationData() {
  const ssr = window.serverSideRulesEngineResponse;
  const sels = ssr?.conductrics?.result_content?.sels;
  if (!sels) return undefined;
  const experiments = Object.entries(sels).map(([agent, arm]) => defined({
    experiment_id: agent,
    experiment_name: ssr.variant,
    variant_id: String(arm),
    variant_name: ssr.variant || 'default',
    is_control: arm === 'A',
    experiment_type: 'personalization',
  }));
  return { experimentation: { experiments } };
}

function isOutbound(url) {
  try {
    return new URL(url, window.location.href).hostname !== window.location.hostname;
  } catch (e) {
    return false;
  }
}

// Authored block name (set on every block by decorateBlock() in aem.js), or
// "default-content-<n>" (1-based section position) for clicks outside any block.
function clickSection(el) {
  const block = el.closest('[data-block-name]');
  if (block) return block.dataset.blockName;
  const section = el.closest('.section');
  const sections = [...document.querySelectorAll('main .section')];
  const index = section ? sections.indexOf(section) + 1 : 0;
  return index ? `default-content-${index}` : 'default-content';
}

function trackClick(event) {
  const clickable = event.target.closest?.('a[href], button[href]');
  if (!clickable) return;
  const url = clickable.getAttribute('href');
  if (!url) return;
  window.dataLayer.push({
    event: 'element_click',
    element_url: url,
    element_text: (clickable.textContent || '').trim(),
    element_section: clickSection(clickable),
    outbound: isOutbound(url),
  });
}

function initClickTracking() {
  document.addEventListener('click', trackClick, true);
  // auxclick covers the middle-mouse-button "open in new tab" gesture, which
  // never fires a regular click event. Ctrl/Cmd+click still fires click as usual.
  document.addEventListener('auxclick', (event) => {
    if (event.button === 1) trackClick(event);
  }, true);
}

function pushGlobalParameters() {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(initialPushData());
  window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
  loadScript(`https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`, { async: true });

  // Pushed as soon as it's available, before the page_view event fires below.
  window.dataLayer.push({
    user: {
      user_id: null,
      user_id_primary: null,
      user_type: null,
      login_status: 'guest',
    },
    ...marketingData(),
    ...consentData(),
    ...experimentationData(),
  });

  window.dataLayer.push({
    event: 'page_view',
    page_title: document.title,
    page_location: window.location.href,
    page_referrer: document.referrer,
  });

  initClickTracking();
}

pushGlobalParameters();
