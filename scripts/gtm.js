import { getMetadata, loadScript } from './aem.js';
import {
  CONSENT_GROUPS, hasConsentGroup, resolveGroups, consentOverride,
} from './consent-check.js';

// TODO(open question): the DataLayer/GTM guide says the GTM snippet should load "the root GTM
// container and its child container based on the LOB". If RBC's GTM is on 360, this may already
// be handled purely via GTM-side "Zones" config keyed off the `lob` value below - confirm with
// RBC's GTM admin before assuming code changes (e.g. a second container id) are needed here.
const GTM_ID = 'GTM-KPSBBC6';
const PROD_HOSTS = ['main--rbc--aemsites.aem.live', 'www.rbcroyalbank.com'];
const CHANNEL = 'public'; // hardcoded per spec, same value for every page
const CMS_TYPE = 'adobe'; // hardcoded per spec, EDS has no other cms_type value

// Manually maintained: update this to the current date (YYYY-MM-DD) any time this file or any
// other dataLayer-related code is changed. See AGENTS.md ("DataLayer") for why this isn't
// automated.
const RELEASE_DATE = '2026-10-01';

const defined = (obj) => Object.fromEntries(
  Object.entries(obj).filter(([, value]) => value !== undefined && value !== null && value !== ''),
);

function environment() {
  const { hostname } = window.location;
  if (PROD_HOSTS.includes(hostname)) return 'prod';
  if (hostname.endsWith('.aem.page')) return 'staging';
  return 'dev';
}

// Flat, top-level keys per the "Standard DataLayer GTM Implementation Guide".
// lob / page-type / content-group / business-line are page metadata that must be authored
// per-page or bulk-applied via the metadata sheet (not yet populated - see PR description for
// the proposed column additions).
function initialPushData() {
  return defined({
    lob: getMetadata('lob'),
    page_type: getMetadata('page-type'),
    content_group: getMetadata('content-group'),
    channel: CHANNEL,
    cms_type: CMS_TYPE,
    page_language: (document.documentElement.lang || 'en').split('-')[0],
    business_line: getMetadata('business-line') || 'personal',
    env: environment(),
    release_date: RELEASE_DATE,
  });
}

function marketingData() {
  const params = new URLSearchParams(window.location.search);
  const utm = defined({
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
    utm.click_id = id;
    utm.click_id_type = type;
  }
  return Object.keys(utm).length ? { utm } : undefined;
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
    variant_id: `${arm}-${agent}`,
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

function initClickTracking() {
  document.addEventListener('click', (event) => {
    const clickable = event.target.closest?.('a[href], button[href]');
    if (!clickable) return;
    const url = clickable.getAttribute('href');
    if (!url) return;
    window.dataLayer.push({
      event: 'element_click',
      click_url: url,
      click_text: (clickable.textContent || '').trim(),
      click_section: clickable.tagName.toLowerCase(),
      outbound: isOutbound(url),
    });
  }, true);
}

function pushGlobalParameters() {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(initialPushData());
  window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
  loadScript(`https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`, { async: true });

  // Pushed as soon as it's available, before the page_view event fires below.
  window.dataLayer.push({
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
