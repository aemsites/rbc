import { getMetadata, loadScript } from './aem.js';

const GTM_ID = 'GTM-KPSBBC6';
const PROD_HOSTS = ['main--rbc--aemsites.aem.live', 'www.rbcroyalbank.com'];
const PAGE_COUNTRY = 'ca';

const defined = (obj) => Object.fromEntries(
  Object.entries(obj).filter(([, value]) => value !== undefined && value !== ''),
);

function environment() {
  const { hostname } = window.location;
  if (PROD_HOSTS.includes(hostname)) return 'prod';
  if (hostname.endsWith('.aem.page')) return 'staging';
  return 'dev';
}

function pageData() {
  return defined({
    page_type: getMetadata('page-type'),
    page_category: getMetadata('page-category'),
    page_sub_category: getMetadata('page-sub-category'),
    page_location: window.location.href,
    page_title: document.title,
    page_referrer: document.referrer,
    page_language: (document.documentElement.lang || 'en').split('-')[0],
    page_country: PAGE_COUNTRY,
    business_line: getMetadata('business-line') || 'personal',
    site_section: 'public_web',
    environment: environment(),
  });
}

function marketingData() {
  const params = new URLSearchParams(window.location.search);
  const data = defined({
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
    data.click_id = id;
    data.click_id_type = type;
  }
  return Object.keys(data).length ? data : undefined;
}

function consentData() {
  const [, raw] = document.cookie.match(/(?:^|;\s*)OptanonConsent=([^;]*)/) || [];
  if (!raw) return { consent_status: 'pending' };
  let groups;
  try {
    groups = new URLSearchParams(decodeURIComponent(raw)).get('groups');
  } catch (e) {
    groups = null;
  }
  if (!groups) return { consent_status: 'pending' };
  const granted = groups.split(',').some((group) => group.trim() === '3:1');
  return { consent_status: granted ? 'granted' : 'denied' };
}

function experimentData() {
  const ssr = window.serverSideRulesEngineResponse;
  const sels = ssr?.conductrics?.result_content?.sels;
  if (!sels) return undefined;
  const [agent, arm] = Object.entries(sels)[0] || [];
  if (!agent) return undefined;
  return {
    experiment_id: agent,
    variant_id: `${arm}-${agent}`,
    variant_name: ssr.variant || 'default',
    is_control: arm === 'A' ? 'yes' : 'no',
    experiment_type: 'Personalization',
  };
}

function pushGlobalParameters() {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(defined({
    page: pageData(),
    marketing: marketingData(),
    consent: consentData(),
    experiment: experimentData(),
  }));
}

pushGlobalParameters();
window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
loadScript(`https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`, { async: true });
