import { loadScript } from './aem.js';

const CONDUCTRICS_BASE = 'https://client-rbc.cdn-v3.conductrics.com/ac-VyDHnrdzqf/v3/agent-api/js/f-BXnDgyehSJ';
const CONDUCTRICS_APIKEY = 'api-twHCbSC7tgpE31tzowIfmIUpP3';
const DEPLOY_TARGETS = {
  stage: 'dt-dHlP3MpvHEujt11xHPJ7Ejb6WkICDf',
  prod: 'dt-FuGmpoSyp9pocP3U7tW3shfK8kMD3r',
};
const PROD_HOSTS = ['main--rbc--aemsites.aem.live', 'www.rbcroyalbank.com'];

const target = PROD_HOSTS.includes(window.location.hostname)
  ? DEPLOY_TARGETS.prod
  : DEPLOY_TARGETS.stage;

loadScript(`${CONDUCTRICS_BASE}/${target}?apikey=${CONDUCTRICS_APIKEY}`, { async: true });
