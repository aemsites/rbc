export const getMetadata = jest.fn((key) => (key === 'lang' ? 'en-CA' : null));

export const createOptimizedPicture = jest.fn(() => document.createElement('picture'));

export const loadCSS = jest.fn();

export const decorateIcons = jest.fn();

export const toClassName = jest.fn((s) => s.toLowerCase().replace(/[^0-9a-z]/gi, '-'));

export const toCamelCase = jest.fn((s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase()));

export const readBlockConfig = jest.fn(() => ({}));

export const buildBlock = jest.fn((name) => {
  const b = document.createElement('div');
  b.className = name;
  return b;
});

export const decorateBlock = jest.fn();

export const loadBlock = jest.fn();

export const loadSections = jest.fn();
