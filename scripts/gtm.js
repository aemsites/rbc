import { getMetadata, loadScript } from './aem.js';

const GTM_ID = 'GTM-KPSBBC6';

function pushPageData() {
  window.dataLayer = window.dataLayer || [];
  const data = {
    page_language: (document.documentElement.lang || 'en').split('-')[0],
    lob: 'accounts',
    channel: getMetadata('channel') || 'public',
  };
  // only sent when authored, so no taxonomy is invented before RBC confirms the vocabulary
  const pageType = getMetadata('page-type');
  const contentGroup = getMetadata('content-group');
  if (pageType) data.page_type = pageType;
  if (contentGroup) data.content_group = contentGroup;
  window.dataLayer.push(data);
}

pushPageData();
window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
loadScript(`https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`, { async: true });
