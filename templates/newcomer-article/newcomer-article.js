import { loadCSS } from '../../scripts/aem.js';
import { decorateArticle } from '../article/article.js';

// newcomer articles share the article layout; they drop the topic pill, byline and
// closing share strip, and keep the share links beside the publish date
export default async function decorate(main) {
  document.body.classList.add('article');
  loadCSS(`${window.hlx.codeBasePath}/templates/article/article.css`);
  await decorateArticle(main, {
    category: false, byline: false, endShare: false, shareInRail: false,
  });
}
