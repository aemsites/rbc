import {
  createElement, fragment, labelKind, escapeHtml, safeUrl,
} from './dom.js';

describe('escapeHtml', () => {
  test('escapes ampersand', () => expect(escapeHtml('a & b')).toBe('a &#38; b'));
  test('escapes less-than', () => expect(escapeHtml('<tag>')).toBe('&#60;tag&#62;'));
  test('escapes greater-than', () => expect(escapeHtml('a > b')).toBe('a &#62; b'));
  test('escapes double quote', () => expect(escapeHtml('"hi"')).toBe('&#34;hi&#34;'));
  test('returns empty string for null', () => expect(escapeHtml(null)).toBe(''));
  test('returns empty string for undefined', () => expect(escapeHtml(undefined)).toBe(''));
  test('passes through text with no special chars', () => expect(escapeHtml('hello')).toBe('hello'));
  test('escapes all four chars in one string', () => {
    expect(escapeHtml('<a href="x">&</a>')).toBe('&#60;a href=&#34;x&#34;&#62;&#38;&#60;/a&#62;');
  });
});

describe('safeUrl', () => {
  test('allows https URLs', () => expect(safeUrl('https://example.com')).toBe('https://example.com/'));
  test('allows http URLs', () => expect(safeUrl('http://example.com')).toBe('http://example.com/'));
  // eslint-disable-next-line no-script-url
  test('blocks javascript: URLs', () => expect(safeUrl('javascript:alert(1)')).toBe('#'));
  test('blocks data: URLs', () => expect(safeUrl('data:text/html,<h1>hi</h1>')).toBe('#'));
  test('blocks ftp: URLs', () => expect(safeUrl('ftp://example.com/file')).toBe('#'));
  test('blocks file: URLs', () => expect(safeUrl('file:///etc/passwd')).toBe('#'));
  test('resolves a root-relative path to an http URL', () => {
    expect(safeUrl('/path')).toMatch(/^http/);
  });
});

describe('createElement', () => {
  test('creates an element with the given tag', () => {
    expect(createElement('div').tagName).toBe('DIV');
  });

  test('sets attributes from props', () => {
    const el = createElement('a', { href: 'https://example.com', id: 'my-link' });
    expect(el.getAttribute('href')).toBe('https://example.com');
    expect(el.id).toBe('my-link');
  });

  test('sets class from string prop', () => {
    const el = createElement('div', { class: 'foo bar' });
    expect(el.classList.contains('foo')).toBe(true);
    expect(el.classList.contains('bar')).toBe(true);
  });

  test('sets class from array prop', () => {
    const el = createElement('div', { class: ['foo', 'bar'] });
    expect(el.classList.contains('foo')).toBe(true);
    expect(el.classList.contains('bar')).toBe(true);
  });

  test('skips null and undefined prop values', () => {
    const el = createElement('div', { 'data-x': null, 'data-y': undefined, 'data-z': 'ok' });
    expect(el.hasAttribute('data-x')).toBe(false);
    expect(el.hasAttribute('data-y')).toBe(false);
    expect(el.getAttribute('data-z')).toBe('ok');
  });

  test('appends a text child', () => {
    expect(createElement('p', {}, 'Hello').textContent).toBe('Hello');
  });

  test('appends multiple children', () => {
    const span = document.createElement('span');
    span.textContent = 'world';
    const el = createElement('p', {}, ['Hello ', span]);
    expect(el.textContent).toBe('Hello world');
  });

  test('text children are appended as text, not parsed as HTML', () => {
    const el = createElement('p', {}, '<script>alert(1)</script>');
    expect(el.querySelector('script')).toBeNull();
    expect(el.textContent).toBe('<script>alert(1)</script>');
  });

  test('skips null and undefined children', () => {
    const el = createElement('div', {}, [null, undefined, 'ok']);
    expect(el.textContent).toBe('ok');
  });
});

describe('fragment', () => {
  test('returns a DocumentFragment', () => {
    expect(fragment('<p>hi</p>')).toBeInstanceOf(DocumentFragment);
  });

  test('parses multiple elements', () => {
    const f = fragment('<p>hello</p><span>world</span>');
    expect(f.querySelector('p').textContent).toBe('hello');
    expect(f.querySelector('span').textContent).toBe('world');
  });
});

describe('labelKind', () => {
  function makeP(html) {
    const p = document.createElement('p');
    p.innerHTML = html;
    return p;
  }

  test('returns null for empty paragraph', () => expect(labelKind(makeP(''))).toBeNull());

  test('returns null when no <u> wraps the full text', () => {
    expect(labelKind(makeP('Hello'))).toBeNull();
  });

  test('returns null when <u> only covers partial text', () => {
    expect(labelKind(makeP('Hello <u>World</u>'))).toBeNull();
  });

  test('returns null when a non-footnote <a> is present', () => {
    expect(labelKind(makeP('<u><a href="#">Hello</a></u>'))).toBeNull();
  });

  test('returns null when a <picture> is present', () => {
    expect(labelKind(makeP('<u><picture></picture></u>'))).toBeNull();
  });

  test('returns "plain" when only <u> covers the full text', () => {
    expect(labelKind(makeP('<u>Hello</u>'))).toBe('plain');
  });

  test('returns "promo" when <em> inside <u> covers the full text', () => {
    expect(labelKind(makeP('<u><em>Hello</em></u>'))).toBe('promo');
  });

  test('returns "promo" when <i> inside <u> covers the full text', () => {
    expect(labelKind(makeP('<u><i>Hello</i></u>'))).toBe('promo');
  });

  test('returns "tag" when <strong> inside <u> covers the full text', () => {
    expect(labelKind(makeP('<u><strong>Hello</strong></u>'))).toBe('tag');
  });

  test('returns "tag" when <b> inside <u> covers the full text', () => {
    expect(labelKind(makeP('<u><b>Hello</b></u>'))).toBe('tag');
  });
});
