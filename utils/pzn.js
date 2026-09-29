const PROD_HOSTS = ['main--rbc--aemsites.aem.live', 'www.rbcroyalbank.com'];

const slots = new Map();
const pending = new Map();

async function fill(name, path) {
  const slot = slots.get(name);
  if (!slot) {
    pending.set(name, path);
    return;
  }
  // eslint-disable-next-line import/no-cycle
  const { loadFragment } = await import('../blocks/fragment/fragment.js');
  const fragment = await loadFragment(path);
  if (!fragment) return;
  slot.replaceChildren(...[...fragment.querySelectorAll(':scope > .section')]
    .flatMap((section) => [...section.childNodes]));
  slot.dataset.pznFragment = path;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: 'pzn_fragment', pznSlot: name, pznFragment: path });
}

export default function registerSlot(name, slot) {
  slots.set(name, slot);
  if (!pending.has(name)) return;
  const path = pending.get(name);
  pending.delete(name);
  fill(name, path);
}

// Conductrics variations fire this instead of editing markup; targeting stays in Conductrics
window.addEventListener('pzn:fragment', (e) => {
  const { slot, path } = e.detail || {};
  if (slot && path) fill(slot, path);
});

// ?pzn=slot:/path previews an experience without Conductrics, off production only
const preview = !PROD_HOSTS.includes(window.location.hostname)
  && new URLSearchParams(window.location.search).get('pzn');
if (preview) {
  const [name, path] = preview.split(':');
  if (name && path) fill(name, path);
}
