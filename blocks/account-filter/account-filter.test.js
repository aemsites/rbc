import decorate from './account-filter.js';

/** Build a detached block div from row/cell HTML strings. */
function makeBlock(...rows) {
  const block = document.createElement('div');
  rows.forEach((cells) => {
    const row = document.createElement('div');
    cells.forEach((html) => {
      const cell = document.createElement('div');
      cell.innerHTML = html;
      row.append(cell);
    });
    block.append(row);
  });
  return block;
}

describe('account-filter decorate — checkbox structure', () => {
  test('wraps block in a form with class account-filter-form', () => {
    const block = makeBlock(
      ['Account Type', '<p>Basic</p><ul><li>Day to Day Banking</li></ul>'],
    );
    decorate(block);
    const form = block.querySelector('form.account-filter-form');
    expect(form).not.toBeNull();
  });

  test('each row produces a fieldset with a legend', () => {
    const block = makeBlock(
      ['Account Type', '<p>Basic</p><ul><li>Day to Day Banking</li></ul>'],
      ['Eligibility', '<p>Student</p><ul><li>Day to Day Banking</li></ul>'],
    );
    decorate(block);
    const fieldsets = block.querySelectorAll('fieldset');
    expect(fieldsets).toHaveLength(2);
    expect(fieldsets[0].querySelector('legend').textContent).toBe('Account Type');
    expect(fieldsets[1].querySelector('legend').textContent).toBe('Eligibility');
  });

  test('each option cell produces a checkbox input', () => {
    const block = makeBlock([
      'Account Type',
      '<p>Basic</p><ul><li>Day to Day Banking</li></ul>',
      '<p>Premium</p><ul><li>Signature No Limit</li></ul>',
    ]);
    decorate(block);
    const inputs = block.querySelectorAll('input[type="checkbox"]');
    expect(inputs).toHaveLength(2);
  });

  test('checkbox name is normalised legend text', () => {
    const block = makeBlock([
      'Account  Type',
      '<p>Basic</p><ul><li>Day to Day Banking</li></ul>',
    ]);
    decorate(block);
    const input = block.querySelector('input[type="checkbox"]');
    // norm collapses whitespace and lowercases
    expect(input.name).toBe('account type');
  });

  test('data-products attribute is JSON array of normalised product names', () => {
    const block = makeBlock([
      'Type',
      '<p>Basic</p><ul><li>Day to Day Banking</li><li>Advantage Banking</li></ul>',
    ]);
    decorate(block);
    const input = block.querySelector('input[type="checkbox"]');
    const products = JSON.parse(input.dataset.products);
    expect(products).toEqual(['day to day banking', 'advantage banking']);
  });
});

describe('account-filter decorate — change event filters comparison table', () => {
  /**
   * Build a minimal account-comparison table with:
   * - a thead row with a label th + one th per product
   * - a tbody .account-comparison-products row with one td per product
   */
  function makeComparisonTable(productNames) {
    const table = document.createElement('table');

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const labelTh = document.createElement('th');
    headerRow.append(labelTh);
    productNames.forEach((name) => {
      const th = document.createElement('th');
      th.textContent = name;
      headerRow.append(th);
    });
    thead.append(headerRow);

    const tbody = document.createElement('tbody');
    const productsRow = document.createElement('tr');
    productsRow.className = 'account-comparison-products';
    productNames.forEach((name) => {
      const td = document.createElement('td');
      td.textContent = name;
      productsRow.append(td);
    });
    tbody.append(productsRow);

    table.append(thead, tbody);
    return table;
  }

  test('checking a box adds account-comparison-match to matching account column headers', () => {
    // Build section: filter + comparison table
    const section = document.createElement('div');
    section.className = 'section';

    const filterWrapper = document.createElement('div');
    const filterBlock = makeBlock([
      'Type',
      '<p>Basic</p><ul><li>Day to Day Banking</li></ul>',
      '<p>Premium</p><ul><li>Signature No Limit</li></ul>',
    ]);
    filterWrapper.append(filterBlock);

    const compWrapper = document.createElement('div');
    compWrapper.className = 'account-comparison';
    const table = makeComparisonTable(['Day to Day Banking', 'Signature No Limit']);
    compWrapper.append(table);

    section.append(filterWrapper, compWrapper);
    document.body.append(section);

    decorate(filterBlock);

    const form = filterBlock.querySelector('form');
    const [basicCheckbox] = form.querySelectorAll('input[type="checkbox"]');

    basicCheckbox.checked = true;
    basicCheckbox.dispatchEvent(new Event('change', { bubbles: true }));

    const headerThs = [...table.querySelectorAll('thead th')].slice(1);
    expect(headerThs[0].classList.contains('account-comparison-match')).toBe(true);
    expect(headerThs[1].classList.contains('account-comparison-match')).toBe(false);

    // Cleanup
    section.remove();
  });

  test('unchecking all boxes removes the match class', () => {
    const section = document.createElement('div');
    section.className = 'section';

    const filterWrapper = document.createElement('div');
    const filterBlock = makeBlock([
      'Type',
      '<p>Basic</p><ul><li>Day to Day Banking</li></ul>',
    ]);
    filterWrapper.append(filterBlock);

    const compWrapper = document.createElement('div');
    compWrapper.className = 'account-comparison';
    const table = makeComparisonTable(['Day to Day Banking']);
    compWrapper.append(table);

    section.append(filterWrapper, compWrapper);
    document.body.append(section);

    decorate(filterBlock);

    const form = filterBlock.querySelector('form');
    const checkbox = form.querySelector('input[type="checkbox"]');

    // Check then uncheck
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));

    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));

    const headerThs = [...table.querySelectorAll('thead th')].slice(1);
    expect(headerThs[0].classList.contains('account-comparison-match')).toBe(false);

    section.remove();
  });
});
