import { getMetadata } from '../scripts/aem.js';
import getPublicConfig from './config.js';
import { escapeHtml } from './dom.js';

const TTL = 60 * 60 * 1000;
const RATE = /^rate\s+(\d+)\s*(.*)$/;
const lang = () => ((getMetadata('lang') || document.documentElement.lang).startsWith('fr') ? 'fr' : 'en');
const requests = new Map();

async function fetchRate(code) {
  const key = `rbc-rate-${lang()}-${code}`;
  try {
    const cached = JSON.parse(sessionStorage.getItem(key));
    if (cached && Date.now() - cached.time < TTL) return cached.value;
  } catch (e) { /* no cache */ }
  try {
    const { liveRateApi } = await getPublicConfig();
    const json = await fetch(`${liveRateApi}?lang=${lang()}&code=${code}`).then((r) => (r.ok ? r.json() : null));
    const value = json?.result_code === '0' ? String(json.result_content.Value).trim() : '';
    try {
      if (value) sessionStorage.setItem(key, JSON.stringify({ time: Date.now(), value }));
    } catch (e) { /* storage full or blocked */ }
    return value;
  } catch (e) {
    return '';
  }
}

export function rateSpan(code, fallback = '') {
  return `<span data-rate-code="${escapeHtml(code)}">${escapeHtml(fallback)}</span>`;
}

// inline code `rate 0026840006 0.550%` in authored copy becomes a live rate with its fallback
export function decorateRateCode(root) {
  root.querySelectorAll('code').forEach((code) => {
    const [, rate, fallback] = code.textContent.trim().match(RATE) || [];
    if (rate) code.outerHTML = rateSpan(rate, fallback);
  });
}

export async function decorateRates(root = document) {
  await Promise.all([...root.querySelectorAll('[data-rate-code]')].map(async (el) => {
    const { rateCode } = el.dataset;
    if (!requests.has(rateCode)) requests.set(rateCode, fetchRate(rateCode));
    const value = await requests.get(rateCode);
    if (value) el.textContent = `${value}${lang() === 'fr' ? ' %' : '%'}`;
  }));
}
