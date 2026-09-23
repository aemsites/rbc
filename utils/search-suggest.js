import { createElement as el } from './dom.js';

let searchConfig;
function loadSearchConfig() {
  if (!searchConfig) {
    searchConfig = fetch('/config.json')
      .then((r) => (r.ok ? r.json() : {}))
      .then((j) => j.public?.searchSuggest || {})
      .catch(() => ({}));
  }
  return searchConfig;
}

// until cors is fixed, use jsonp to fetch. replace with a plain fetch() once that happens
function jsonp(url) {
  return new Promise((resolve, reject) => {
    const cb = `irSuggest${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    const script = el('script');
    const cleanup = () => {
      delete window[cb];
      script.remove();
    };
    window[cb] = (data) => {
      cleanup();
      resolve(data);
    };
    script.onerror = () => {
      cleanup();
      reject(new Error('suggest request failed'));
    };
    script.src = `${url}${url.includes('?') ? '&' : '?'}callback=${cb}`;
    document.head.append(script);
  });
}

async function fetchSuggestions(term) {
  const cfg = await loadSearchConfig();
  if (!cfg.baseEndpoint || term.length < 2) return [];
  const lang = (document.documentElement.lang || 'en').slice(0, 2);
  const interfaceID = cfg.interfaceId?.[lang] ?? cfg.interfaceId?.en;
  if (interfaceID === undefined) return [];
  const params = new URLSearchParams({
    term,
    SESSIONID: '',
    interfaceID,
    _: Date.now(),
  });
  try {
    const data = await jsonp(`${cfg.baseEndpoint}?${params}`);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * Wires an input and a listbox into an intelliresponse suggest combobox.
 * @param {HTMLInputElement} input the search input, inside a form
 * @param {HTMLElement} suggest the listbox element
 * @param {string} idPrefix prefix for generated option ids
 * @returns {Function} closes the suggestion list
 */
export default function wireSuggest(input, suggest, idPrefix) {
  let active = -1;

  const closeSuggest = () => {
    suggest.replaceChildren();
    suggest.hidden = true;
    active = -1;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  };

  const submit = (value) => {
    input.value = value;
    input.form.submit();
  };

  const renderSuggest = (items) => {
    suggest.replaceChildren();
    if (!items.length) {
      closeSuggest();
      return;
    }
    items.forEach((item, i) => {
      const option = el('li', {
        class: `${idPrefix}-option`,
        role: 'option',
        id: `${idPrefix}-opt-${i}`,
        'aria-selected': 'false',
      }, item.label);
      option.addEventListener('mousedown', (e) => {
        e.preventDefault();
        submit(item.value);
      });
      suggest.append(option);
    });
    suggest.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  };

  const highlight = () => {
    [...suggest.children].forEach((option, i) => option.setAttribute('aria-selected', i === active ? 'true' : 'false'));
    if (active >= 0) input.setAttribute('aria-activedescendant', suggest.children[active].id);
    else input.removeAttribute('aria-activedescendant');
  };

  let debounce;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    const term = input.value.trim();
    if (term.length < 2) {
      closeSuggest();
      return;
    }
    debounce = setTimeout(async () => {
      const items = await fetchSuggestions(term);
      if (input.value.trim() === term) renderSuggest(items);
    }, 200);
  });

  input.addEventListener('keydown', (e) => {
    const options = [...suggest.children];
    if (e.key === 'ArrowDown' && options.length) {
      e.preventDefault();
      active = (active + 1) % options.length;
      highlight();
    } else if (e.key === 'ArrowUp' && options.length) {
      e.preventDefault();
      active = (active - 1 + options.length) % options.length;
      highlight();
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      submit(options[active].textContent);
    }
  });

  return closeSuggest;
}
