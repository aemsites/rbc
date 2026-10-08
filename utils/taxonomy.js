import { getMetadata } from '../scripts/aem.js';
import { SHEETS } from './placeholders.js';

// the sheet the DA Tagger plugin (aemsites/da-blog-tools tools/tags) reads its choices from
const TAXONOMY_PATH = '/docs/library/tagging.json';

let taxonomy;

/**
 * Loads the topic taxonomy. Rows hold a language-neutral `key` (what the tagger writes into
 * page metadata), the English `value` and `url`, and per-language `value-{lang}` and
 * `url-{lang}` columns named after the placeholder sheets (e.g. `value-fr`).
 * @returns {Promise<object[]>} the taxonomy rows, empty if the sheet can't be loaded
 */
export function fetchTaxonomy() {
  taxonomy = taxonomy || fetch(TAXONOMY_PATH)
    .then((resp) => (resp.ok ? resp.json() : {}))
    .then((json) => {
      const rows = Array.isArray(json.data) ? json.data : json.data?.data || [];
      return rows.filter((row) => row.key);
    })
    .catch(() => []);
  return taxonomy;
}

/**
 * Resolves a metadata value to its label and link in the page's language. Values are tagger
 * keys, though labels in any language are matched too so hand-typed metadata still resolves.
 * @param {object[]} rows the taxonomy rows
 * @param {string} value a key or label from page metadata
 * @returns {{label: string, url?: string}} the localized topic, or the value itself if unknown
 */
export function resolveTopic(rows, value) {
  const lang = SHEETS[getMetadata('lang')];
  // whitespace is ignored so labels typed as "Banking/ Digital banking" still match
  const norm = (v) => (v || '').replace(/\s+/g, '').toLowerCase();
  const target = norm(value);
  const row = rows.find((r) => norm(r.key) === target)
    || rows.find((r) => Object.keys(r)
      .some((col) => (col === 'value' || col.startsWith('value-')) && norm(r[col]) === target));
  if (!row) return { label: value };
  const localized = (col) => (lang && row[`${col}-${lang}`]) || row[col];
  return { label: localized('value') || value, url: localized('url') || undefined };
}
