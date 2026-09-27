export default function decorate(block) {
  [...block.children].forEach((row) => {
    const [first, second] = [...row.children];
    if (!second) {
      row.className = row.querySelector('a.button') ? 'product-rail-cta' : 'product-rail-note';
      return;
    }
    if (first.querySelector('picture') && !first.textContent.trim()) {
      row.className = 'product-rail-image';
      second.className = 'product-rail-category';
      return;
    }
    if (second.querySelector('picture, a') || second.children.length > 1 || second.textContent.trim().length > 60) {
      row.className = 'product-rail-offer';
      first.className = 'product-rail-eyebrow';
      return;
    }
    row.className = 'product-rail-fee';
  });
}
