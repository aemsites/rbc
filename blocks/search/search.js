import { readBlockConfig } from '../../scripts/aem.js';
import { createElement as el } from '../../utils/dom.js';
import fetchLocalPlaceholders from '../../utils/placeholders.js';
import wireSuggest from '../../utils/search-suggest.js';

let count = 0;

export default async function decorate(block) {
  const searchLabel = readBlockConfig(block)['search-label'];
  const ph = await fetchLocalPlaceholders();
  const label = searchLabel || ph.searchLabel || 'Search';

  count += 1;
  const id = `search-input-${count}`;
  const suggestId = `search-suggest-${count}`;

  const form = el('form', { class: 'search-form' });
  form.method = 'get';
  form.action = ph.searchAction || 'https://www.rbcroyalbank.com/search-public/index.html';

  const input = el('input', {
    type: 'search',
    id,
    name: 'question',
    placeholder: label,
    autocomplete: 'off',
    role: 'combobox',
    'aria-autocomplete': 'list',
    'aria-expanded': 'false',
    'aria-controls': suggestId,
  });

  const suggest = el('ul', { class: 'search-suggest', role: 'listbox', id: suggestId });
  suggest.hidden = true;

  const labelEl = el('label', { class: 'search-label' }, label);
  labelEl.htmlFor = id;

  form.append(
    el('input', { type: 'hidden', name: 'type', value: '0' }),
    labelEl,
    el('div', { class: 'search-field' }, [input, suggest]),
    el('button', { class: 'search-submit', type: 'submit' }, ph.searchButton || 'Search'),
  );

  wireSuggest(input, suggest, 'search');

  block.replaceChildren(form);
}
