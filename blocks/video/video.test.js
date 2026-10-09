import decorate from './video.js';

// jsdom does not implement matchMedia or IntersectionObserver
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });

  global.IntersectionObserver = class {
    constructor(callback) { this.callback = callback; }

    observe() {}

    unobserve() {}

    disconnect() {}
  };

  // jsdom stubs for media playback
  window.HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = jest.fn();
});

describe('decorate', () => {
  test('returns without error when block has no .mp4 link', async () => {
    const block = document.createElement('div');
    await expect(decorate(block)).resolves.toBeUndefined();
    // block should be unchanged (no video appended)
    expect(block.querySelector('video')).toBeNull();
  });

  test('replaces block content with a <video> and a toggle button when .mp4 link is present', async () => {
    const block = document.createElement('div');
    const row = document.createElement('div');
    const cell = document.createElement('div');
    const link = document.createElement('a');
    link.href = 'https://example.com/test.mp4';
    link.textContent = 'Watch video';
    cell.append(link);
    row.append(cell);
    block.append(row);

    await decorate(block);

    expect(block.querySelector('video')).not.toBeNull();
    expect(block.querySelector('button.video-toggle')).not.toBeNull();
  });

  test('video element is muted and loops', async () => {
    const block = document.createElement('div');
    const link = document.createElement('a');
    link.href = 'https://example.com/clip.mp4';
    block.append(link);

    await decorate(block);

    const video = block.querySelector('video');
    expect(video.muted).toBe(true);
    expect(video.getAttribute('loop')).not.toBeNull();
  });
});
