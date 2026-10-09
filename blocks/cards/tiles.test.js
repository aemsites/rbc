import decorateTile, { tileWords } from './tiles.js';

describe('tileWords', () => {
  test('returns WORDS-matching classes from block classList', () => {
    const block = document.createElement('div');
    block.classList.add('cards', 'blue', 'wide', 'foo');
    expect(tileWords(block)).toEqual(['blue', 'wide']);
  });

  test('returns empty array when no WORDS classes match', () => {
    const block = document.createElement('div');
    block.classList.add('cards', 'foo', 'bar');
    expect(tileWords(block)).toEqual([]);
  });

  test('filters out non-WORDS classes and keeps valid ones', () => {
    const block = document.createElement('div');
    block.classList.add('navy', 'notaword', 'dark');
    expect(tileWords(block)).toEqual(['navy', 'dark']);
  });
});

function makeItem(contentHtml = '<p>Text</p>') {
  const item = document.createElement('div');
  const content = document.createElement('div');
  content.innerHTML = contentHtml;
  item.append(content);
  return item;
}

describe('decorateTile', () => {
  test('adds tile class to item', () => {
    const item = makeItem();
    decorateTile(item, []);
    expect(item.classList.contains('tile')).toBe(true);
  });

  test('adds tile-content class to content cell', () => {
    const item = makeItem();
    const content = item.firstElementChild;
    decorateTile(item, []);
    expect(content.classList.contains('tile-content')).toBe(true);
  });

  test('adds theme class when blockWords includes a theme', () => {
    const item = makeItem();
    decorateTile(item, ['blue']);
    expect(item.classList.contains('tile-blue')).toBe(true);
  });

  test('adds width class when blockWords includes a width', () => {
    const item = makeItem();
    decorateTile(item, ['wide']);
    expect(item.classList.contains('tile-wide')).toBe(true);
  });

  test('adds tile-light when blockWords includes light', () => {
    const item = makeItem();
    decorateTile(item, ['light']);
    expect(item.classList.contains('tile-light')).toBe(true);
  });

  test('does not add tile-light when blockWords includes dark', () => {
    const item = makeItem();
    decorateTile(item, ['dark']);
    expect(item.classList.contains('tile-light')).toBe(false);
  });

  test('converts h2 heading inside content to p.tile-title.h2', () => {
    const item = makeItem('<h2>My Heading</h2>');
    decorateTile(item, []);
    const title = item.querySelector('.tile-title');
    expect(title).not.toBeNull();
    expect(title.tagName).toBe('P');
    expect(title.classList.contains('h2')).toBe(true);
    expect(title.textContent).toBe('My Heading');
  });

  test('converts h3 heading inside content to p.tile-title.h3', () => {
    const item = makeItem('<h3>Sub Heading</h3>');
    decorateTile(item, []);
    const title = item.querySelector('.tile-title');
    expect(title).not.toBeNull();
    expect(title.classList.contains('h3')).toBe(true);
  });

  test('adds tile-pill class to first p whose only child is em', () => {
    const item = document.createElement('div');
    const content = document.createElement('div');
    const p = document.createElement('p');
    const em = document.createElement('em');
    em.textContent = 'Pill Text';
    p.append(em);
    content.append(p);
    item.append(content);
    decorateTile(item, []);
    expect(p.classList.contains('tile-pill')).toBe(true);
  });

  test('does not add tile-pill when p has other content besides em', () => {
    const item = document.createElement('div');
    const content = document.createElement('div');
    const p = document.createElement('p');
    const em = document.createElement('em');
    em.textContent = 'em text';
    p.append(em);
    p.append(document.createTextNode(' extra'));
    content.append(p);
    item.append(content);
    decorateTile(item, []);
    expect(p.classList.contains('tile-pill')).toBe(false);
  });
});
