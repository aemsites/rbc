import decorate from './disclaimers.js';

describe('decorate', () => {
  test('creates a details element with a summary inside', async () => {
    const block = document.createElement('div');

    const row1 = document.createElement('div');
    const label1 = document.createElement('div');
    label1.textContent = '1)';
    const content1 = document.createElement('div');
    content1.innerHTML = '<p>First disclaimer content.</p>';
    row1.append(label1, content1);

    const row2 = document.createElement('div');
    const label2 = document.createElement('div');
    label2.textContent = '2)';
    const content2 = document.createElement('div');
    content2.innerHTML = '<p>Second disclaimer content.</p>';
    row2.append(label2, content2);

    block.append(row1, row2);

    await decorate(block);

    const details = block.querySelector('details');
    expect(details).not.toBeNull();
    expect(details.querySelector('summary')).not.toBeNull();
  });

  test('summary text defaults to Legal Disclaimers when no placeholder', async () => {
    const block = document.createElement('div');

    const row = document.createElement('div');
    const label = document.createElement('div');
    label.textContent = 'a)';
    const content = document.createElement('div');
    content.innerHTML = '<p>Disclaimer text here.</p>';
    row.append(label, content);
    block.append(row);

    await decorate(block);

    const summary = block.querySelector('summary');
    expect(summary.textContent).toBe('Legal Disclaimers');
  });

  test('creates a list item for each labelled row', async () => {
    const block = document.createElement('div');

    ['1)', '2)', '3)'].forEach((label, i) => {
      const row = document.createElement('div');
      const labelCell = document.createElement('div');
      labelCell.textContent = label;
      const textCell = document.createElement('div');
      textCell.innerHTML = `<p>Disclaimer ${i + 1}.</p>`;
      row.append(labelCell, textCell);
      block.append(row);
    });

    await decorate(block);

    const items = block.querySelectorAll('details > ul > li');
    expect(items.length).toBe(3);
  });
});
