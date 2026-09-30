// OneTrust cookie category IDs
// 1 Essential, 2 Performance, 3 Personalization, 4 Advertising.
export const CONSENT_GROUPS = {
  analytics: '2',
  personalization: '3',
  marketing: '4',
};

let consentedLoaded = false;
let lastState;

function loadConsented() {
  if (consentedLoaded) return;
  consentedLoaded = true;
  import('./consented.js');
}

function onConsentUpdate(consented) {
  if (consented === lastState) return;
  lastState = consented;
  window.dispatchEvent(new CustomEvent('consent.update', { detail: { consented } }));
  if (consented) loadConsented();
}

// exact match per group, so group 3 is not satisfied by 13:1 or 23:1 (matches the whole token)
export function hasConsentGroup(groups, groupId = CONSENT_GROUPS.personalization) {
  return groups.split(',').some((group) => group.trim() === `${groupId}:1`);
}

// OneTrust persists its decision here, so returning visitors resolve without waiting for the SDK
export function groupsFromCookie() {
  const [, value] = document.cookie.match(/(?:^|;\s*)OptanonConsent=([^;]*)/) || [];
  if (!value) return null;
  try {
    return new URLSearchParams(decodeURIComponent(value)).get('groups');
  } catch (e) {
    return null;
  }
}

// ?_ot=<groups> lets QA/testing simulate a real OneTrust groups cookie value
// (e.g. ?_ot=3:1) without needing the actual cookie set.
export function resolveGroups() {
  return new URLSearchParams(window.location.search).get('_ot') || groupsFromCookie();
}

// ?consent=accept/decline lets QA/testing force a consent state without a real OneTrust
// cookie. Applies to every group (returns null when no override is present).
export function consentOverride() {
  const override = new URLSearchParams(window.location.search).get('consent');
  if (override === null) return null;
  return ['accept', 'true', '1', 'yes'].includes(override.toLowerCase());
}

window.OptanonWrapper = () => {
  const active = window.OnetrustActiveGroups || '';
  onConsentUpdate(active.split(',').includes(CONSENT_GROUPS.personalization));
};

const override = consentOverride();
if (override !== null) {
  onConsentUpdate(override);
} else {
  const groups = resolveGroups();
  if (groups) onConsentUpdate(hasConsentGroup(groups));
}
