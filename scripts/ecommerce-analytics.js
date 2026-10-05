import { getMetadata } from './aem.js';

const registrations = new Map();
let started = false;
let observer;
let frame;

function warn(element, message) {
  // eslint-disable-next-line no-console
  console.warn(`[ecommerce] ${message}`, element);
}

function placement(element) {
  return element.closest('[data-block-name]')?.dataset.blockName;
}

function resolveUrl(value, element) {
  try {
    return new URL(value, window.location.href).href;
  } catch (error) {
    warn(element, `Invalid analytics URL: ${value}`);
    return undefined;
  }
}

function exposed(element) {
  if (!element.isConnected || document.visibilityState === 'hidden'
    || element.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
  for (let parent = element; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    if (style.display === 'none' || style.visibility === 'hidden'
      || style.visibility === 'collapse' || style.opacity === '0') return false;
  }
  return true;
}

function listName(block, listTitle) {
  const internal = listTitle?.trim();
  if (internal) return { name: internal };
  const section = block.closest('.section');
  if (!section) return undefined;
  const headings = [...(block.closest('main')?.querySelectorAll('h1, h2, h3, h4, h5, h6') || [])]
    .filter((heading) => !heading.closest('.block') && exposed(heading)
      && heading.textContent.trim()
      // compareDocumentPosition returns DOM position flags.
      // eslint-disable-next-line no-bitwise
      && (heading.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING));
  const local = headings.filter((heading) => heading.closest('.section') === section).at(-1);
  if (local) return { name: local.textContent.trim() };
  const fallback = headings.filter((heading) => {
    const earlier = heading.closest('.section');
    return earlier && earlier !== section
      // eslint-disable-next-line no-bitwise
      && (earlier.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING);
  }).at(-1);
  return fallback ? { name: fallback.textContent.trim(), fallback: true } : undefined;
}

function push(event, key, value) {
  window.dataLayer = window.dataLayer || [];
  // GTM merges object values; clear the previous interaction before sending the next one.
  window.dataLayer.push({ product: null, product_list: null });
  window.dataLayer.push({ event, [key]: value });
}

function visibleRatio(element) {
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) return 0;
  let left = Math.max(0, rect.left);
  let right = Math.min(window.innerWidth, rect.right);
  let top = Math.max(0, rect.top);
  let bottom = Math.min(window.innerHeight, rect.bottom);
  const viewportRatio = (Math.max(0, right - left) * Math.max(0, bottom - top))
    / (rect.width * rect.height);
  if (viewportRatio <= 0.5) return viewportRatio;
  if (!exposed(element)) return 0;
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    const bounds = parent.getBoundingClientRect();
    if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) {
      left = Math.max(left, bounds.left + parent.clientLeft);
      right = Math.min(right, bounds.left + parent.clientLeft + parent.clientWidth);
    }
    if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) {
      top = Math.max(top, bounds.top + parent.clientTop);
      bottom = Math.min(bottom, bounds.top + parent.clientTop + parent.clientHeight);
    }
  }
  return (Math.max(0, right - left) * Math.max(0, bottom - top)) / (rect.width * rect.height);
}

function stopTimer(registration) {
  clearTimeout(registration.timer);
  registration.timer = undefined;
  registration.since = undefined;
}

function impression(registration) {
  if (registration.kind === 'product_list') {
    const title = listName(registration.list, registration.listTitle);
    if (!title) {
      if (!registration.warned) {
        warn(registration.list, 'Product list has no internal title or eligible preceding heading.');
        registration.warned = true;
      }
      return false;
    }
    const products = [...registration.products]
      .filter(([element]) => exposed(element))
      .map(([, product]) => product)
      .sort((a, b) => a.context.index - b.context.index);
    if (!products.length) {
      warn(registration.list, 'Product list has no valid connected product records.');
      registration.impressions = false;
      return false;
    }
    if (title.fallback) {
      warn(
        registration.list,
        `Product list name "${title.name}" uses a preceding-section heading.`,
      );
    }
    push('product_list_viewed', 'product_list', { name: title.name, products });
  } else {
    push('product_viewed', 'product', registration.payload);
  }
  return true;
}

function update(element, registration) {
  if (registration.viewed) return;
  if (registration.detail) {
    if (element.isConnected) registration.viewed = impression(registration);
    return;
  }
  if (!registration.impressions) return;
  if (visibleRatio(element) <= 0.5) {
    stopTimer(registration);
    return;
  }
  if (registration.since !== undefined) return;
  registration.since = performance.now();
  registration.timer = setTimeout(() => {
    registration.timer = undefined;
    if (visibleRatio(element) > 0.5 && performance.now() - registration.since > 1000) {
      registration.viewed = impression(registration);
    }
    registration.since = undefined;
  }, 1001);
}

function register(element, registration) {
  const existing = registrations.get(element) || [];
  const previous = existing.find((item) => item.kind === registration.kind);
  if (previous) {
    if (JSON.stringify(previous.payload) === JSON.stringify(registration.payload)
      && JSON.stringify(previous.urls) === JSON.stringify(registration.urls)
      && previous.list === registration.list
      && previous.detail === registration.detail
      && previous.listTarget === registration.listTarget) return;
    stopTimer(previous);
    registration.viewed = previous.payload.id === registration.payload.id && previous.viewed;
    existing.splice(existing.indexOf(previous), 1, registration);
  } else {
    existing.push(registration);
  }
  registration.connected = element.isConnected;
  registrations.set(element, existing);
  if (started) {
    if (registration.impressions) observer.observe(element);
    update(element, registration);
  }
}

function removeListProduct(element, product) {
  const group = registrations.get(product.listTarget)?.find((item) => item.kind === 'product_list');
  if (!group) return;
  group.products.delete(element);
  stopTimer(group);
  group.impressions = group.products.size > 0;
  if (started) update(product.listTarget, group);
}

/**
 * Retain the structured record on the rendered placement, not its display text or URL.
 * The product index's string productCode is RBC's analytics ID.
 */
export function trackProduct(element, record, {
  list, listTarget = list, listTitle, index = 0, detail = false,
} = {}) {
  const id = record?.productCode;
  const name = record?.name;
  const category = record?.category;
  const slot = placement(element);
  if (typeof id !== 'string' || !id.trim() || typeof name !== 'string' || !name.trim()
    || typeof category !== 'string' || !category.trim() || !slot) {
    const existing = registrations.get(element) || [];
    existing.filter((item) => item.kind === 'product').forEach((item) => {
      stopTimer(item);
      removeListProduct(element, item);
    });
    const remaining = existing.filter((item) => item.kind !== 'product');
    if (remaining.length) registrations.set(element, remaining);
    else {
      registrations.delete(element);
      observer?.unobserve(element);
    }
    warn(element, 'Product requires a string productCode, name, category and block placement.');
    return;
  }
  const payload = {
    id: id.trim(),
    name: name.trim(),
    category: category.trim(),
    context: { index, placement: slot },
  };
  const urls = [record.productPage, record.applyUrl].filter(Boolean)
    .map((url) => resolveUrl(url, element)).filter(Boolean);
  const previous = registrations.get(element)?.find((item) => item.kind === 'product');
  if (previous && previous.listTarget !== listTarget) removeListProduct(element, previous);
  register(element, {
    kind: 'product',
    payload,
    list,
    listTarget,
    urls,
    detail: Boolean(detail && !list),
    impressions: false,
    viewed: false,
  });
  if (list) {
    let group = registrations.get(listTarget)?.find((item) => item.kind === 'product_list');
    if (!group) {
      group = {
        kind: 'product_list', list, listTitle, products: new Map(), impressions: true, viewed: false,
      };
      register(listTarget, group);
    }
    group.listTitle = listTitle;
    group.products.set(element, payload);
    group.impressions = true;
    if (started) update(listTarget, group);
  }
}

export function isProductDetail() {
  return getMetadata('template') === 'product' || getMetadata('page-type') === 'product';
}

export function selectProduct(element) {
  const registration = registrations.get(element)?.find((item) => item.kind === 'product');
  if (started && registration && exposed(element)) {
    push('product_selected', 'product', registration.payload);
  }
}

function refresh() {
  frame = undefined;
  registrations.forEach((registration, element) => {
    if (!element.isConnected) {
      registration.forEach(stopTimer);
      // Fragments decorate while detached; keep them until their first attachment.
      if (registration.some((item) => item.connected)) {
        observer.unobserve(element);
        registrations.delete(element);
      }
    } else {
      registration.forEach((item) => {
        item.connected = true;
        update(element, item);
      });
    }
  });
}

function scheduleRefresh() {
  if (frame === undefined) frame = requestAnimationFrame(refresh);
}

function select(event) {
  if (event.type === 'auxclick' && event.button !== 1) return;
  if (event.type === 'click' && event.button !== 0) return;
  const link = event.target.closest?.('a[href], button[href]');
  if (!link || !link.getAttribute('href') || link.closest('sup') || !exposed(link)) return;
  for (let element = link; element; element = element.parentElement) {
    const registration = registrations.get(element)?.find((item) => item.kind === 'product');
    if (registration) {
      const url = resolveUrl(link.getAttribute('href'), link);
      if (!url) return;
      if (registration.urls.includes(url)) {
        push('product_selected', 'product', registration.payload);
        return;
      }
    }
  }
}

export function initEcommerce() {
  if (started) return;
  if (!window.IntersectionObserver) {
    warn(document.documentElement, 'IntersectionObserver unavailable; e-commerce tracking not started.');
    return;
  }
  started = true;
  observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting || entry.intersectionRatio <= 0.5) {
        (registrations.get(entry.target) || []).forEach(stopTimer);
      }
    });
    refresh();
  }, { threshold: [0, 0.5, 1] });
  registrations.forEach((registration, element) => {
    if (registration.some((item) => item.impressions)) observer.observe(element);
  });
  const mutations = new MutationObserver(scheduleRefresh);
  mutations.observe(document.querySelector('main') || document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['hidden', 'inert', 'aria-hidden', 'class', 'style'],
  });
  document.addEventListener('click', select, true);
  document.addEventListener('auxclick', select, true);
  document.addEventListener('scroll', () => {
    registrations.forEach((registration, element) => {
      if (registration.some((item) => item.impressions && !item.viewed)
        && visibleRatio(element) <= 0.5) registration.forEach(stopTimer);
    });
    scheduleRefresh();
  }, true);
  window.addEventListener('resize', scheduleRefresh);
  document.addEventListener('visibilitychange', () => {
    registrations.forEach((registration) => registration.forEach(stopTimer));
    refresh();
  });
  refresh();
}
