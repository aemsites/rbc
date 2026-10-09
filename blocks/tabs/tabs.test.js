import decorate from './tabs.js';

// toClassName is auto-mocked via moduleNameMapper for scripts/aem.js:
// jest.fn((s) => s.toLowerCase().replace(/[^0-9a-z]/gi, '-'))

function buildBlock(rows) {
  const block = document.createElement('div');
  rows.forEach(([tabText, ...contentTexts]) => {
    const row = document.createElement('div');
    const tabCell = document.createElement('div');
    tabCell.textContent = tabText;
    row.append(tabCell);
    contentTexts.forEach((text) => {
      const cell = document.createElement('div');
      cell.textContent = text;
      row.append(cell);
    });
    block.append(row);
  });
  return block;
}

describe('decorate', () => {
  describe('panel mode (no sections class)', () => {
    test('creates a .tabs-list with role="tablist"', () => {
      const block = buildBlock([['Tab 1', 'Content 1'], ['Tab 2', 'Content 2']]);
      decorate(block);
      const tablist = block.querySelector('.tabs-list');
      expect(tablist).not.toBeNull();
      expect(tablist.getAttribute('role')).toBe('tablist');
    });

    test('each row becomes a .tabs-panel with role="tabpanel"', () => {
      const block = buildBlock([['Tab 1', 'Content 1'], ['Tab 2', 'Content 2']]);
      decorate(block);
      const panels = block.querySelectorAll('.tabs-panel');
      expect(panels).toHaveLength(2);
      panels.forEach((panel) => {
        expect(panel.getAttribute('role')).toBe('tabpanel');
      });
    });

    test('tab buttons have role="tab" and aria-controls pointing to a panel', () => {
      const block = buildBlock([['Tab 1', 'Content 1'], ['Tab 2', 'Content 2']]);
      decorate(block);
      const buttons = block.querySelectorAll('[role="tab"]');
      expect(buttons).toHaveLength(2);
      buttons.forEach((btn) => {
        const controls = btn.getAttribute('aria-controls');
        expect(controls).toBeTruthy();
        expect(block.querySelector(`#${controls}`)).not.toBeNull();
      });
    });

    test('first tab has aria-selected="true"; rest have aria-selected="false"', () => {
      const block = buildBlock([
        ['Tab 1', 'Content 1'],
        ['Tab 2', 'Content 2'],
        ['Tab 3', 'Content 3'],
      ]);
      decorate(block);
      const tabs = [...block.querySelectorAll('[role="tab"]')];
      expect(tabs[0].getAttribute('aria-selected')).toBe('true');
      tabs.slice(1).forEach((tab) => {
        expect(tab.getAttribute('aria-selected')).toBe('false');
      });
    });

    test('first panel has aria-hidden="false"; others have aria-hidden="true"', () => {
      const block = buildBlock([['Tab 1', 'Content 1'], ['Tab 2', 'Content 2']]);
      decorate(block);
      const panels = [...block.querySelectorAll('[role="tabpanel"]')];
      expect(panels[0].getAttribute('aria-hidden')).toBe('false');
      panels.slice(1).forEach((panel) => {
        expect(panel.getAttribute('aria-hidden')).toBe('true');
      });
    });

    test('aria-labelledby on each panel matches the corresponding tab button id', () => {
      const block = buildBlock([['Tab 1', 'Content 1'], ['Tab 2', 'Content 2']]);
      decorate(block);
      const panels = block.querySelectorAll('[role="tabpanel"]');
      const buttons = block.querySelectorAll('[role="tab"]');
      panels.forEach((panel, i) => {
        expect(panel.getAttribute('aria-labelledby')).toBe(buttons[i].id);
      });
    });
  });
});
