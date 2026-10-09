// featured.js (worktree) imports decorateIcons from scripts/scripts.js — mock it so the
// AEM page-initialisation side-effects never run during tests.
import featuredBody, { rowExtras, featuredArt } from './featured.js';

jest.mock('../../scripts/scripts.js', () => ({ decorateIcons: jest.fn() }));

const product = {
  name: 'Test Card',
  tagline: 'tagline',
  productPage: '/products/test',
  cardImage: null,
  cardImageAlt: '',
  fees: [],
  applyUrl: null,
  category: 'credit-card',
  highlights: [],
};

describe('rowExtras', () => {
  test('extracts picture, cta, and lines from cell', () => {
    const cell = document.createElement('div');

    // The product link paragraph — excluded from extras because it contains link
    const linkP = document.createElement('p');
    const link = document.createElement('a');
    link.href = '/products/test';
    link.textContent = 'Product link';
    linkP.append(link);
    cell.append(linkP);

    // Picture paragraph
    const picP = document.createElement('p');
    const picture = document.createElement('picture');
    picP.append(picture);
    cell.append(picP);

    // CTA paragraph — text equals its anchor's text
    const ctaP = document.createElement('p');
    const ctaA = document.createElement('a');
    ctaA.textContent = 'Apply Now';
    ctaP.append(ctaA);
    cell.append(ctaP);

    // Other paragraph (tagline / lines)
    const otherP = document.createElement('p');
    otherP.textContent = 'Some tagline text';
    cell.append(otherP);

    const result = rowExtras(cell, link);
    expect(result.picture).toBe(picture);
    expect(result.cta).toBe(ctaA);
    expect(result.lines).toEqual([otherP]);
  });

  test('when link is null all non-picture content goes to lines', () => {
    const cell = document.createElement('div');

    const picP = document.createElement('p');
    const img = document.createElement('img');
    picP.append(img);
    cell.append(picP);

    const textP = document.createElement('p');
    textP.textContent = 'Some text';
    cell.append(textP);

    const result = rowExtras(cell, null);
    expect(result.picture).toBe(img);
    expect(result.cta).toBeUndefined();
    expect(result.lines).toEqual([textP]);
  });

  test('finds picture via querySelector on img as well as picture', () => {
    const cell = document.createElement('div');
    const link = document.createElement('a');
    link.textContent = 'link';

    const imgDiv = document.createElement('div');
    const img = document.createElement('img');
    imgDiv.append(img);
    cell.append(imgDiv);

    const result = rowExtras(cell, link);
    expect(result.picture).toBe(img);
  });
});

describe('featuredArt', () => {
  test('returns null when product.cardImage is falsy and no picture arg', () => {
    expect(featuredArt(product, null, null)).toBeNull();
  });

  test('returns cards-featured-art wrapper containing the picture', () => {
    const picture = document.createElement('picture');
    const result = featuredArt(product, null, picture);
    expect(result).not.toBeNull();
    expect(result.classList.contains('cards-featured-art')).toBe(true);
    expect(result.contains(picture)).toBe(true);
  });

  test('includes cards-featured-label when label string is provided', () => {
    const picture = document.createElement('picture');
    const result = featuredArt(product, 'Credit Card', picture);
    const label = result.querySelector('.cards-featured-label');
    expect(label).not.toBeNull();
    expect(label.textContent).toBe('Credit Card');
  });

  test('omits cards-featured-label when label is falsy', () => {
    const picture = document.createElement('picture');
    const result = featuredArt(product, '', picture);
    expect(result.querySelector('.cards-featured-label')).toBeNull();
  });
});

describe('featuredBody', () => {
  test('renders h3 with product name', () => {
    const body = featuredBody(product, {}, []);
    expect(body.querySelector('h3').textContent).toBe('Test Card');
  });

  test('renders a link with productPage href', () => {
    const body = featuredBody(product, {}, []);
    expect(body.querySelector('a[href*="/products/test"]')).not.toBeNull();
  });
});
