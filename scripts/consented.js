import { loadScript } from './aem.js';
import getPublicConfig from '../utils/config.js';
import recordTraits from './pzn-traits.js';

const CONDUCTRICS_BASE = 'https://client-rbc.cdn-v3.conductrics.com/ac-VyDHnrdzqf/v3/agent-api/js/f-BXnDgyehSJ';
const DEPLOY_TARGETS = {
  stage: 'dt-dHlP3MpvHEujt11xHPJ7Ejb6WkICDf',
  prod: 'dt-FuGmpoSyp9pocP3U7tW3shfK8kMD3r',
};
const PROD_HOSTS = ['main--rbc--aemsites.aem.live', 'www.rbcroyalbank.com'];

const target = PROD_HOSTS.includes(window.location.hostname)
  ? DEPLOY_TARGETS.prod
  : DEPLOY_TARGETS.stage;

// the savings product being viewed is knowable without Conductrics, so recording it must not
// depend on Conductrics loading; a failure there would otherwise lose the trait entirely
recordTraits();
window.addEventListener('pagehide', recordTraits);

getPublicConfig().then(({ conductricsApiKey }) => {
  if (typeof conductricsApiKey !== 'string' || !conductricsApiKey.trim()) {
    throw new Error('Could not obtain a valid public.conductricsApiKey from /config.json');
  }
  const url = new URL(`${CONDUCTRICS_BASE}/${target}`);
  url.searchParams.set('apikey', conductricsApiKey.trim());
  return loadScript(url.href, { async: true });
}).then(() => {
  // Conductrics has now computed its own traits, so fold those in as well
  recordTraits();
}).catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Conductrics loading failed', error);
});
