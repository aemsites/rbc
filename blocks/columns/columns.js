export default function decorate(block) {
  const cols = [...block.firstElementChild.children];
  block.classList.add(`columns-${cols.length}-cols`);
  block.style.setProperty('--columns-count', cols.length);

  // authored width ratio, e.g. columns (70-30); ignored unless it matches the column count
  const ratio = [...block.classList].find((c) => /^\d+(-\d+)+$/.test(c));
  if (ratio) {
    const parts = ratio.split('-');
    if (parts.length === cols.length) {
      block.style.setProperty('--columns-ratio', parts.map((n) => `${n}fr`).join(' '));
    }
  }

  // setup image columns
  [...block.children].forEach((row) => {
    [...row.children].forEach((col) => {
      const pic = col.querySelector('picture, img');
      if (pic) {
        const picWrapper = pic.closest('div');
        if (picWrapper && picWrapper.children.length === 1) {
          // picture is only content in column
          picWrapper.classList.add('columns-img-col');
        }
      }
    });
  });

  // a short bold-only line straight above a heading is a tag, as in the newcomer feature lists
  block.querySelectorAll('p:has(> strong:only-child)').forEach((p) => {
    const next = p.nextElementSibling;
    if (next?.matches('h2, h3, h4, h5, h6') && p.textContent.trim().length <= 24) p.classList.add('columns-tag');
  });

  // slide-in: the first column enters from the left, the rest from the right, once in view
  if (block.classList.contains('slide-in')) {
    block.classList.add('slide-in-ready');
    new IntersectionObserver(([entry], observer) => {
      if (!entry.isIntersecting) return;
      block.classList.add('in-view');
      observer.disconnect();
    }, { threshold: 0.25 }).observe(block);
  }
}
