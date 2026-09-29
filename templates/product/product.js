export default function decorate(main) {
  const rail = main.querySelector('.product-rail');
  const railSection = rail?.closest('.section');
  if (!railSection) return;

  const sections = [...main.querySelectorAll(':scope > .section')];
  const end = sections.indexOf(railSection);
  const start = sections[0].querySelector('h1') ? 1 : 0;
  sections.slice(start, end).forEach((section) => section.classList.add('beside-rail'));
  railSection.classList.add('rail');
  railSection.style.setProperty('--rail-row', start + 1);
  railSection.style.setProperty('--rail-span', end - start);
  if (rail.classList.contains('left')) main.classList.add('rail-left');
  // on mobile the account summary reads first, right under the title
  if (start) sections[0].after(railSection);
  else main.prepend(railSection);
}
