const CONSENT_GROUP = '3';

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

// exact match per group, so group 3 is not satisfied by 13:1 or 23:1
function hasConsentGroup(groups) {
  return groups.split(',').some((group) => group.trim() === `${CONSENT_GROUP}:1`);
}

// OneTrust persists its decision here, so returning visitors resolve without waiting for the SDK
function groupsFromCookie() {
  const [, value] = document.cookie.match(/(?:^|;\s*)OptanonConsent=([^;]*)/) || [];
  if (!value) return null;
  try {
    return new URLSearchParams(decodeURIComponent(value)).get('groups');
  } catch (e) {
    return null;
  }
}

window.OptanonWrapper = () => {
  const active = window.OnetrustActiveGroups || '';
  onConsentUpdate(active.split(',').includes(CONSENT_GROUP));
};

const params = new URLSearchParams(window.location.search);
const override = params.get('consent');
if (override !== null) {
  onConsentUpdate(['accept', 'true', '1', 'yes'].includes(override.toLowerCase()));
} else {
  const groups = params.get('_ot') || groupsFromCookie();
  if (groups) onConsentUpdate(hasConsentGroup(groups));
}
