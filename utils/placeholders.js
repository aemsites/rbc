import { getMetadata } from '../scripts/aem.js';
import { fetchPlaceholders } from '../scripts/placeholders.js';

const PREFIX = {
  'fr-CA': '/fr',
  'zh-Hans': '/sc',
  'zh-Hant': '/tc',
};

/**
 * Fetches the placeholders for the page language.
 * @returns {Promise<object>} the placeholders
 */
export default function fetchLocalPlaceholders() {
  return fetchPlaceholders(PREFIX[getMetadata('lang')] || 'default');
}
