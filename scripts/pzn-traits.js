/*
 * Conductrics keeps the visitor profile in localStorage, which the edge worker cannot read, and
 * its own listeners only fire on hostnames in its URL targeting, so a worker-fronted preview
 * records nothing at all. This keeps a cookie the worker can read: the traits Conductrics did
 * compute, plus the savings product being viewed when Conductrics was not the one to see it.
 *
 * Delete once RBC persists lastviewedsavings to c-traits-list themselves; the worker already
 * merges both sources.
 */

const COOKIE = 'pzn-traits';
const TTL = 86400;

const SAVINGS_PRODUCTS = {
  '/bank-accounts/savings-accounts/high-interest-savings-account': 'hisa',
  '/bank-accounts/savings-accounts/day-to-day-savings': 'd2d',
  '/bank-accounts/us-high-interest-savings-account': 'us-hisa',
};

function stored() {
  const [, raw] = document.cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]*)`)) || [];
  if (!raw) return [];
  try {
    return decodeURIComponent(raw).split(',').filter(Boolean);
  } catch (e) {
    return [];
  }
}

function computed() {
  let traits;
  try {
    ({ traits } = JSON.parse(localStorage.getItem('cp-sess') || '{}'));
  } catch (e) {
    return [];
  }
  if (!Array.isArray(traits)) return [];
  return traits.filter((t) => t.startsWith('cust/') && !t.endsWith(':null'));
}

export default function recordTraits() {
  const merged = new Map();
  // last write wins, so a fresher value replaces the one already in the cookie
  const add = (trait) => merged.set(trait.split(':')[0], trait);
  stored().forEach(add);
  computed().forEach(add);

  const product = SAVINGS_PRODUCTS[window.location.pathname.replace(/(.)\/$/, '$1')];
  if (product) add(`cust/lastviewedsavings:${product}`);

  if (!merged.size) return;
  const value = encodeURIComponent([...merged.values()].join(','));
  document.cookie = `${COOKIE}=${value}; path=/; max-age=${TTL}; samesite=lax`;
}
