/*
 * Client-side half of personalization.
 *
 * The edge worker resolves the decision when it is in front of the origin, and strips the markers
 * it handled. When it is not — preview and live URLs, local dev, or an Akamai failover — the
 * markers survive and this resolves the same decision in the browser.
 *
 * Two entry points, because the cost of being late differs:
 *   personalizeEager() runs before the hero is decorated, so a decision we already hold (a
 *     ?variant= preview) swaps raw markup and never paints the default at all.
 *   personalize() runs delayed, because Conductrics is consent-gated and only loads after
 *     OneTrust. That decision cannot beat first paint, so it swaps visibly — the same cost every
 *     Conductrics Express treatment already pays. The edge worker is what removes it.
 *
 * Conductrics is the decision engine either way; the calls mirror RBC's savings-accounts.js.
 */

import pages, { TRAIT_LOBS, TRAIT_SEGMENTS, PROD_HOSTS } from './pzn-config.js';
import { whenConsented } from './consent-check.js';
// eslint-disable-next-line import/no-cycle
import { loadFragment } from '../blocks/fragment/fragment.js';

const READY_TIMEOUT = 5000;
const READY_POLL = 100;
const DECISION_TIMEOUT = 2000;
const HOLD_TIMEOUT = 1500;
const PENDING = 'data-pzn-pending';

// past the hold the visitor is reading the default; a late swap is worse than none, which is the
// same call RBC's savings-accounts.js makes on its own timeout
let holdExpired = false;

export function traitSegment() {
  try {
    const { traits = [] } = JSON.parse(window.localStorage.getItem('cp-sess') || '{}');
    const match = traits.map((trait) => /visitorsegment:(.+)$/.exec(trait)).find(Boolean);
    const segment = match && match[1];
    return TRAIT_SEGMENTS.includes(segment) ? segment : null;
  } catch (e) {
    return null;
  }
}

function conductricsReady() {
  return new Promise((resolve) => {
    const deadline = Date.now() + READY_TIMEOUT;
    const poll = () => {
      if (window.Conductrics && window.Conductrics.ClientApi) resolve(window.Conductrics);
      else if (Date.now() > deadline) resolve(null);
      else window.setTimeout(poll, READY_POLL);
    };
    poll();
  });
}

function selectArm(conductrics, agent) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (arm) => {
      if (settled) return;
      settled = true;
      resolve(arm);
    };
    window.setTimeout(() => done(null), DECISION_TIMEOUT);
    try {
      new conductrics.ClientApi().exec([{ a: agent }], (err, res) => {
        done(err ? null : ((res && res.sels) || {})[agent]);
      });
    } catch (e) {
      done(null);
    }
  });
}

function applyPersonas(segment, root = document) {
  root.querySelectorAll('[data-personas]').forEach((el) => {
    const allowed = el.dataset.personas.split(',').map((p) => p.trim()).filter(Boolean);
    if (allowed.length && !allowed.includes(segment)) el.remove();
    else el.removeAttribute('data-personas');
  });
}

/*
 * Before decoration the raw markup is swapped and the page decorates the result; after it, the
 * replacement has to arrive already decorated.
 */
async function rawHero(base, name) {
  try {
    const res = await fetch(`${base}/${name}.plain.html`);
    if (!res.ok) return null;
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    const hero = doc.querySelector('.hero');
    // the variant hero is the LCP candidate; authored markup ships it lazy
    const img = hero && hero.querySelector('img');
    if (img) {
      img.setAttribute('loading', 'eager');
      img.setAttribute('fetchpriority', 'high');
    }
    return hero;
  } catch (e) {
    return null;
  }
}

async function swapHero(section, base, name, root, decorated) {
  const target = root.querySelector('.hero');
  if (!target) return false;
  const replacement = decorated
    ? (await loadFragment(`${base}/${name}`) || document).querySelector('.hero')
    : await rawHero(base, name);
  if (!replacement) return false;
  target.replaceWith(replacement);
  // the section background belongs to the authored hero, not to the variant that replaced it
  section.removeAttribute('data-background');
  return true;
}

async function decide() {
  const config = pages(PROD_HOSTS.includes(window.location.hostname))[window.location.pathname];
  if (!config) return null;

  if (config.arms) {
    const conductrics = await conductricsReady();
    if (!conductrics) return null;
    return config.arms[await selectArm(conductrics, config.agent)] || null;
  }

  const segment = traitSegment();
  if (!segment) return null;
  const agent = config.agents[TRAIT_LOBS[segment]];
  if (!agent) return null;

  const conductrics = await conductricsReady();
  if (!conductrics) return null;
  const arm = await selectArm(conductrics, agent);
  return arm === 'B' || arm === 'C' ? segment : null;
}

/*
 * Before decoration: take a decision we already hold, and hold the hero back for one we are
 * about to make. Anything else leaves the page completely untouched.
 */
export async function personalizeEager(main) {
  const section = main.querySelector('[data-personalization]');
  if (!section) return;
  const base = section.dataset.personalization;

  const preview = new URLSearchParams(window.location.search).get('variant');
  if (preview) {
    section.removeAttribute('data-personalization');
    if (await swapHero(section, base, preview, main, false)) applyPersonas(preview, main);
    return;
  }

  // only hold the hero for a visitor a decision could actually change
  const config = pages(PROD_HOSTS.includes(window.location.hostname))[window.location.pathname];
  if (!config || (!config.arms && !traitSegment())) return;
  section.setAttribute(PENDING, '');
  window.setTimeout(() => {
    holdExpired = true;
    section.removeAttribute(PENDING);
  }, HOLD_TIMEOUT);
}

export default function personalize() {
  const section = document.querySelector('[data-personalization]');
  if (!section) return;

  const base = section.dataset.personalization;
  section.removeAttribute('data-personalization');

  whenConsented(async () => {
    const name = await decide();
    if (name && !holdExpired && await swapHero(section, base, name, document, true)) {
      applyPersonas(name);
    }
    section.removeAttribute(PENDING);
  });
}
