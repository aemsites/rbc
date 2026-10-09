import decorate from './carousel.js';

beforeAll(() => {
  global.IntersectionObserver = class {
    constructor() {}

    observe() {}

    disconnect() {}
  };
  global.ResizeObserver = class {
    observe() {}

    disconnect() {}
  };
});

describe('decorate', () => {
  test('creates ul.carousel-slides track element in the block', async () => {
    const block = document.createElement('div');
    block.classList.add('carousel');

    const row1 = document.createElement('div');
    const col1 = document.createElement('div');
    col1.innerHTML = '<h2>Slide 1</h2><p>Content for slide one</p>';
    row1.append(col1);

    const row2 = document.createElement('div');
    const col2 = document.createElement('div');
    col2.innerHTML = '<h2>Slide 2</h2><p>Content for slide two</p>';
    row2.append(col2);

    block.append(row1, row2);

    await decorate(block);

    expect(block.querySelector('ul.carousel-slides')).not.toBeNull();
  });
});
