export const DEFAULT_SEGMENT = 'default';
export const SEGMENT_EVENT = 'personalization:segment';

function fromCookie() {
  const match = document.cookie.match(/(?:^|;\s*)rbc_lob=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

// ponytail: spike stub. The delayed Conductrics agent should write the rbc_lob cookie, and
// ConductricsStateChange should be bridged to SEGMENT_EVENT once we have the variation->LOB map.
// ?segment= forces a segment; ?platency= simulates the agent's decision latency.
function override() {
  const params = new URLSearchParams(window.location.search);
  return { forced: params.get('segment'), latency: Number(params.get('platency')) || 0 };
}

let pending;

export function resolveSegment() {
  if (!pending) {
    const { forced, latency } = override();
    const segment = forced || fromCookie() || DEFAULT_SEGMENT;
    pending = latency
      ? new Promise((resolve) => { setTimeout(() => resolve(segment), latency); })
      : Promise.resolve(segment);
  }
  return pending;
}

export function setSegment(segment) {
  window.dispatchEvent(new CustomEvent(SEGMENT_EVENT, { detail: segment }));
}
