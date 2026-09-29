import { getMetadata, toCamelCase } from '../scripts/aem.js';

const SHEETS = {
  'fr-CA': 'fr',
  'zh-Hans': 'sc',
  'zh-Hant': 'tc',
};

async function fetchPlaceholders(sheet) {
  window.placeholders = window.placeholders || {};
  if (!window.placeholders[sheet]) {
    window.placeholders[sheet] = new Promise((resolve) => {
      fetch('/placeholders.json')
        .then((resp) => (resp.ok ? resp.json() : {}))
        .then((json) => {
          const rows = Array.isArray(json.data)
            ? json.data
            : (json[sheet] || json.data || {}).data || [];
          const placeholders = {};
          rows
            .filter((placeholder) => placeholder.Key)
            .forEach((placeholder) => {
              placeholders[toCamelCase(placeholder.Key)] = placeholder.Text;
            });
          window.placeholders[sheet] = placeholders;
          resolve(placeholders);
        })
        .catch(() => {
          window.placeholders[sheet] = {};
          resolve(window.placeholders[sheet]);
        });
    });
  }
  return window.placeholders[sheet];
}

export default function fetchLocalPlaceholders() {
  return fetchPlaceholders(SHEETS[getMetadata('lang')] || 'data');
}
