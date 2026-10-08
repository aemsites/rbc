// a section with `pzn-slot` metadata is a named spot; its authored content is the default,
// and its `pzn-<variant>` rows hold the fragment paths an experience can swap in
async function fill(name, variant) {
  const section = document.querySelector(`main .section[data-pzn-slot="${CSS.escape(name)}"]`);
  const path = section?.getAttribute(`data-pzn-${variant || 'fragment'}`);
  if (!path) return;
  // eslint-disable-next-line import/no-cycle
  const { loadFragment } = await import('../blocks/fragment/fragment.js');
  const fragment = await loadFragment(path);
  if (!fragment) return;
  section.replaceChildren(...[...fragment.querySelectorAll(':scope > .section')]
    .flatMap((part) => [...part.childNodes]));
  section.dataset.pznApplied = path;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: 'pzn_fragment', pznSlot: name, pznFragment: path });
}

// Conductrics variations fire this instead of editing markup; targeting stays in Conductrics
window.addEventListener('pzn:fragment', (e) => {
  const { slot, variant } = e.detail || {};
  if (slot) fill(slot, variant);
});
