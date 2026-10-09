import { getMetadata } from '../scripts/aem.js';
import { SHEETS } from './placeholders.js';

// the sheet the DA Tags plugin (adobe-rnd/aem-apps tools/plugins/tags) reads its choices from
const TAXONOMY_PATH = '/taxonomy.json';

let taxonomy;

/**
 * Loads the topic taxonomy. It is the Tags plugin's sheet: a `Namespace` row starts a
 * namespace, and each `Tag` row below it is a tag, nested under its optional `Category` path.
 * Tag rows also hold the English `value` and `url`, and per-language `value-{lang}` and
 * `url-{lang}` columns named after the placeholder sheets (e.g. `value-fr`).
 * @returns {Promise<object[]>} the tag rows, each with its `namespace` and `path`
 */
export function fetchTaxonomy() {
  taxonomy = taxonomy || fetch(TAXONOMY_PATH)
    .then((resp) => (resp.ok ? resp.json() : {}))
    .then((json) => {
      const rows = Array.isArray(json.data) ? json.data : json.data?.data || [];
      let namespace = '';
      return rows.flatMap((row) => {
        if (row.Namespace) namespace = row.Namespace;
        if (!row.Tag) return [];
        const path = row.Category ? `${row.Category}/${row.Tag}` : row.Tag;
        return [{ ...row, namespace, path }];
      });
    })
    .catch(() => []);
  return taxonomy;
}

/**
 * Resolves a metadata value to its label and link in the page's language. Values are what the
 * Tags plugin inserts (`namespace:path`), though bare tags and labels in any language are
 * matched too so older and hand-typed metadata still resolve.
 * @param {object[]} rows the taxonomy rows
 * @param {string} value a tag or label from page metadata
 * @returns {{label: string, url?: string}} the localized topic, or the value itself if unknown
 */
export function resolveTopic(rows, value) {
  const lang = SHEETS[getMetadata('lang')];
  // whitespace is ignored so labels typed as "Banking/ Digital banking" still match
  const norm = (v) => (v || '').replace(/\s+/g, '').toLowerCase();
  const [, ns, path] = norm(value).match(/^(?:([^:]*):)?(.*)$/);
  const inNamespace = (r) => !ns || norm(r.namespace) === ns;
  const row = rows.find((r) => inNamespace(r) && norm(r.path) === path)
    || rows.find((r) => inNamespace(r) && norm(r.Tag) === path)
    || rows.find((r) => Object.keys(r)
      .some((col) => (col === 'value' || col.startsWith('value-')) && norm(r[col]) === norm(value)));
  // an unknown tag shows without its namespace
  if (!row) return { label: value.replace(/^[^:]*:/, '').trim() };
  const localized = (col) => (lang && row[`${col}-${lang}`]) || row[col];
  return { label: localized('value') || row.Tag, url: localized('url') || undefined };
}
