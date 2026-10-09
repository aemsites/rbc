import { loadScript } from './aem.js';

const OT_DOMAIN_ID = '051ec25d-8edf-4043-a57e-af9e3a458709';

// The production domain script is bound to rbcroyalbank.com and writes its consent cookies with
// domain=.rbcroyalbank.com, which browsers reject on any other host (aem.page, aem.live,
// localhost). There consent never persists and the banner returns on every page. OneTrust's
// -test variant writes host-only cookies, so it is used everywhere except the production domain.
const OT_DOMAIN_SCRIPT = /(^|\.)rbcroyalbank\.com$/.test(window.location.hostname)
  ? OT_DOMAIN_ID
  : `${OT_DOMAIN_ID}-test`;

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

let resolveOneTrustReady;
const oneTrustReady = new Promise((resolve) => { resolveOneTrustReady = resolve; });

window.OptanonWrapper = () => {
  resolveOneTrustReady();
  const active = window.OnetrustActiveGroups || '';
  onConsentUpdate(active.split(',').includes(CONSENT_GROUPS.personalization));
};

// Authors can't add OneTrust's .ot-sdk-show-settings class in DA, so a link to
// #cookie-settings opens the preference center instead.
let pendingOpen;
document.addEventListener('click', (event) => {
  if (!event.target.closest?.('a[href$="#cookie-settings"]')) return;
  event.preventDefault();
  // repeat clicks before the SDK is ready would toggle the preference center open and shut
  if (pendingOpen) return;
  pendingOpen = oneTrustReady.then(() => {
    pendingOpen = undefined;
    window.OneTrust?.ToggleInfoDisplay();
  });
});

const override = consentOverride();
if (override !== null) {
  onConsentUpdate(override);
} else {
  const groups = resolveGroups();
  if (groups) onConsentUpdate(hasConsentGroup(groups));
}

// OneTrust reaches the EDS site through GTM today, which never fires its tag here and would
// land after the martech delay anyway; loading the stub ourselves is what resolves consent
// for a first-time visitor. Returning visitors resolve from the cookie above, ahead of it; the
// stub still loads for them, since OneTrust also serves the preference center.
loadScript('https://cdn.cookielaw.org/scripttemplates/otSDKStub.js', {
  async: '',
  'data-domain-script': OT_DOMAIN_SCRIPT,
});
