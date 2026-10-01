/* eslint-disable */
/* global WebImporter */

// PARSER IMPORTS
import disclaimersParser from './parsers/disclaimers.js';

// TRANSFORMER IMPORTS (cleanup must run before sections)
import cleanupTransformer from './transformers/rbc-cleanup.js';
import sectionsTransformer from './transformers/rbc-sections.js';

// PARSER REGISTRY
const parsers = {
  disclaimers: disclaimersParser,
};

// PAGE TEMPLATE CONFIGURATION - Embedded from page-templates.json
const PAGE_TEMPLATE = {
  "name": "newcomer-article",
  "description": "Newcomer article: bordered title box with image, date + share row, TLDR callout, on-this-page rail, legal disclaimers",
  "urls": [
    "https://www.rbcroyalbank.com/new-to-canada/international-students/article/how-to-find-the-best-bank-account-for-international-students.html"
  ],
  "blocks": [
    {
      "name": "disclaimers",
      "instances": [
        "section.disclaimer"
      ]
    }
  ],
  "sections": [
    {
      "id": "1",
      "name": "article-title",
      "selector": [
        "section.banner.html-bnr"
      ],
      "style": null,
      "blocks": [],
      "defaultContent": [
        "h1",
        "p",
        ".banner-img[data-img]"
      ]
    },
    {
      "id": "2",
      "name": "tldr",
      "selector": [
        ".col-9 > .block-wpr.top-line-blue"
      ],
      "style": "callout",
      "blocks": [],
      "defaultContent": [
        "h4",
        "ul"
      ]
    },
    {
      "id": "3",
      "name": "body",
      "selector": [
        ".col-9"
      ],
      "style": null,
      "blocks": [],
      "defaultContent": [
        "h2",
        "h3",
        "p",
        "ul",
        "ol"
      ]
    },
    {
      "id": "4",
      "name": "legal",
      "selector": [
        "section.disclaimer"
      ],
      "style": null,
      "blocks": [
        "disclaimers"
      ],
      "defaultContent": []
    }
  ]
};

// TRANSFORMER REGISTRY
const transformers = [
  cleanupTransformer,
  ...(PAGE_TEMPLATE.sections && PAGE_TEMPLATE.sections.length > 1 ? [sectionsTransformer] : []),
];

/**
 * Execute all page transformers for a specific hook
 * @param {string} hookName - 'beforeTransform' or 'afterTransform'
 * @param {Element} element - The DOM element to transform
 * @param {Object} payload - { document, url, html, params }
 */
function executeTransformers(hookName, element, payload) {
  const enhancedPayload = { ...payload, template: PAGE_TEMPLATE };
  transformers.forEach((transformerFn) => {
    try {
      transformerFn.call(null, hookName, element, enhancedPayload);
    } catch (e) {
      console.error(`Transformer failed at ${hookName}:`, e);
    }
  });
}

/**
 * Find all blocks on the page based on the embedded template configuration
 * @param {Document} document - The DOM document
 * @param {Object} template - The embedded PAGE_TEMPLATE object
 * @returns {Array} block instances found on the page
 */
function findBlocksOnPage(document, template) {
  const pageBlocks = [];
  template.blocks.forEach((blockDef) => {
    blockDef.instances.forEach((selector) => {
      const elements = document.querySelectorAll(selector);
      if (elements.length === 0) {
        console.warn(`Block "${blockDef.name}" selector not found: ${selector}`);
      }
      elements.forEach((element) => {
        pageBlocks.push({
          name: blockDef.name,
          selector,
          element,
          section: blockDef.section || null,
        });
      });
    });
  });
  console.log(`Found ${pageBlocks.length} block instances on page`);
  return pageBlocks;
}

export default {
  transform: (payload) => {
    const { document, url, params } = payload;
    const main = document.body;

    // 1. Initial cleanup (also builds the Metadata block)
    executeTransformers('beforeTransform', main, payload);

    // 2-3. Find and parse blocks; skip elements a prior parser already replaced
    const pageBlocks = findBlocksOnPage(document, PAGE_TEMPLATE);
    pageBlocks.forEach((block) => {
      if (!block.element.parentNode) return;
      const parser = parsers[block.name];
      if (parser) {
        try {
          parser(block.element, { document, url, params });
        } catch (e) {
          console.error(`Failed to parse ${block.name} (${block.selector}):`, e);
        }
      } else {
        console.warn(`No parser found for block: ${block.name}`);
      }
    });

    // 4. Final cleanup + section breaks/metadata
    executeTransformers('afterTransform', main, payload);

    // 5. Built-in rules. rbc-cleanup already built the Metadata block (and stripped the head
    // tags createMetadata reads), so no extra <hr> here — it would leave an empty section.
    WebImporter.rules.createMetadata(main, document);
    WebImporter.rules.transformBackgroundImages(main, document);
    WebImporter.rules.adjustImageUrls(main, url, params.originalURL);

    // 6. Document path mirrors the source path without the extension
    const rawPath = new URL(params.originalURL).pathname
      .replace(/\/$/, '')
      .replace(/\.html?$/, '');
    const path = WebImporter.FileUtils.sanitizePath(rawPath === '' ? '/index' : rawPath);

    return [{
      element: main,
      path,
      report: {
        title: document.title,
        template: PAGE_TEMPLATE.name,
        blocks: pageBlocks.map((b) => b.name),
      },
    }];
  },
};
