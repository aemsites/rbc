const PROD_HOSTS = ['main--rbc--aemsites.aem.live', 'www.rbcroyalbank.com'];

// a section with `pzn-slot` metadata is a named spot; its authored content is the default
async function fill(name, path) {
  const section = document.querySelector(`main .section[data-pzn-slot="${CSS.escape(name)}"]`);
  if (!section) return;
  // eslint-disable-next-line import/no-cycle
  const { loadFragment } = await import('../blocks/fragment/fragment.js');
  const fragment = await loadFragment(path);
  if (!fragment) return;
  section.replaceChildren(...[...fragment.querySelectorAll(':scope > .section')]
    .flatMap((part) => [...part.childNodes]));
  section.dataset.pznFragment = path;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: 'pzn_fragment', pznSlot: name, pznFragment: path });
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
