import pages, { TRAIT_LOBS, TRAIT_SEGMENTS } from '../../scripts/pzn-config.js';

const SHARED_TTL = 300;
const PAGE_TTL = 300;
const DECISION_TTL = 1800;
const DECISION_COOKIE = 'pzn-decision';
const VID_COOKIE = 'design_test_vid';
const VID_TTL = 2592000;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-[45][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/*
 * aem.live emits no cache tag unless asked, and names the header after the CDN: cloudflare gets
 * x-cache-tag, akamai edge-cache-tag, fastly surrogate-key. Push invalidation is what keeps a
 * composed page correct after its parts change - see adobe-rnd/helix-mixer's inlines.js.
 */
const TAG_HEADER = {
  cloudflare: 'x-cache-tag',
  akamai: 'edge-cache-tag',
  fastly: 'surrogate-key',
};

const cdnType = (env) => (TAG_HEADER[env.BYO_CDN_TYPE] ? env.BYO_CDN_TYPE : 'cloudflare');

// both /path and /path/ address the same page; the agents' URL lists match one form exactly
const canonicalPath = (pathname) => pathname.replace(/(.)\/$/, '$1');

const addClass = (existing, name) => `${existing || ''} ${name}`.trim();

const originHeaders = (url, env) => ({
  'x-forwarded-host': url.host,
  'x-byo-cdn-type': cdnType(env),
  'x-push-invalidation': 'enabled',
});

// one entry per variant, so a cached page can never be served to the wrong segment
const pageCacheKey = (url, variant) => new Request(
  `${url.origin}${url.pathname}__pzn=${encodeURIComponent(variant)}`,
  { method: 'GET' },
);

function unionCacheTags(...lists) {
  const tags = new Set();
  lists.filter(Boolean).forEach((list) => {
    list.split(',').map((t) => t.trim()).filter(Boolean).forEach((t) => tags.add(t));
  });
  return [...tags].join(',');
}

const cookies = (header) => Object.fromEntries(
  (header || '').split(';').map((pair) => {
    const eq = pair.indexOf('=');
    return eq < 0 ? [pair.trim(), ''] : [pair.slice(0, eq).trim(), pair.slice(eq + 1)];
  }),
);

function hasConsent(jar) {
  if (!jar.OptanonConsent) return false;
  const groups = /(?:^|&)groups=([^&;]*)/.exec(decodeURIComponent(jar.OptanonConsent));
  if (!groups) return false;
  return groups[1].split(',').some((entry) => {
    const [category, status] = entry.split(':');
    return category === '3' && status === '1';
  });
}

function gaClientId(jar) {
  if (jar.gaClientID) return jar.gaClientID;
  const parts = (jar._ga || '').split('.');
  return parts.length >= 4 ? `${parts[2]}.${parts[3]}` : null;
}

function traitSegment(jar) {
  const raw = jar['c-traits-list'];
  if (!raw) return null;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }
  const haystack = `${raw} ${decoded}`.toLowerCase();
  return TRAIT_SEGMENTS.find((s) => new RegExp(`visitorsegment(?::|%3a)${s}`).test(haystack)) || null;
}

/*
 * Conductrics keeps the visitor profile in localStorage, which the edge cannot read, so the agent
 * would see no traits and never select. c-traits-list is the subset RBC marks as persisted to a
 * cookie; forwarding it lets the same targeting run server-side.
 */
function conductricsTraits(jar) {
  const decode = (raw) => {
    if (!raw) return [];
    let value = raw;
    try {
      value = decodeURIComponent(raw);
    } catch {
      value = raw;
    }
    return value.split(',').map((trait) => trait.trim()).filter(Boolean);
  };
  // RBC persists a configured subset unprefixed; scripts/consented.js mirrors the rest already
  // prefixed. Later entries win, so the fresher mirror overrides a stale cookie value.
  const merged = new Map();
  [
    ...decode(jar['c-traits-list']).map((trait) => `cust/${trait}`),
    ...decode(jar['pzn-traits']),
  ].forEach((trait) => {
    const [name, ...rest] = trait.split(':');
    if (rest.join(':') !== 'null') merged.set(name, trait);
  });
  return merged.size ? [...merged.values()].join(',') : null;
}

/*
 * Conductrics' own preview override, base64 "agent:arm", as a query param or the cookie its JS
 * sets from one. Its server-side API ignores it, so the worker applies it here and RBC's existing
 * QA links preview a page this worker decides exactly as they preview an Express one.
 */
function previewArm(url, jar, agent) {
  const raw = url.searchParams.get('c-conductrics-preview') || jar['c-conductrics-preview'];
  if (!raw || !agent) return null;
  let decoded;
  try {
    decoded = atob(decodeURIComponent(raw));
  } catch {
    return null;
  }
  const [previewAgent, arm] = decoded.split(':');
  return previewAgent === agent && arm ? arm : null;
}

/*
 * Everything the decision was made from, so acquiring or changing any trait retires the cached
 * one. Keying on the segment alone outlived a change to lastviewedsavings, which pins a visitor
 * who had no trait on arrival to the default hero for the rest of the cookie's life.
 */
function decisionKey(jar) {
  const traits = conductricsTraits(jar);
  if (traits) return `t:${traits}`;
  const clientId = gaClientId(jar);
  return clientId ? `g:${clientId}` : null;
}

function cachedDecision(jar, key) {
  if (!key || !jar[DECISION_COOKIE]) return null;
  const [cachedKey, segment, expires] = decodeURIComponent(jar[DECISION_COOKIE]).split('|');
  if (cachedKey !== key || !segment) return null;
  if (!(Number(expires) * 1000 > Date.now())) return null;
  return segment;
}

function decisionCookie(key, variant, secure) {
  const expires = Math.floor(Date.now() / 1000) + DECISION_TTL;
  const value = encodeURIComponent(`${key}|${variant}|${expires}`);
  const flags = `Path=/; Max-Age=${DECISION_TTL}; SameSite=Lax${secure ? '; Secure' : ''}`;
  return `${DECISION_COOKIE}=${value}; ${flags}`;
}

function visitorId(jar) {
  const existing = jar[VID_COOKIE];
  if (existing && UUID_V4.test(existing)) return { uuid: existing.toLowerCase(), isNew: false };
  return { uuid: crypto.randomUUID(), isNew: true };
}

function visitorCookie(uuid, secure) {
  const flags = `Path=/; Max-Age=${VID_TTL}; SameSite=Lax; HttpOnly${secure ? '; Secure' : ''}`;
  return `${VID_COOKIE}=${uuid}; ${flags}`;
}

/*
 * First visits have no OptanonConsent cookie, so consent is inferred from the CDN's geolocation:
 * Quebec is opted out, every other region opted in. Only then may the prospect engine be called.
 */
function geoConsent(request) {
  const cf = request.cf || {};
  if (!cf.country) return false;
  return !(cf.country === 'CA' && cf.regionCode === 'QC');
}

async function postJson(url, init, timeoutMs) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`${url.split('?')[0]} responded ${res.status}`);
  const body = await res.text();
  return body === 'null' ? null : JSON.parse(body);
}

async function resolveSegment(jar, userAgent, env, page) {
  const trait = traitSegment(jar);
  if (trait) return { segment: trait, lob: TRAIT_LOBS[trait], source: 'c-traits-list' };

  const clientId = gaClientId(jar);
  if (!clientId) return { segment: null, source: 'no-ga-client-id' };

  const rules = await postJson(env.RULES_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: env.RULES_KEY,
      'user-agent': userAgent,
    },
    body: JSON.stringify({ gaClientId: clientId, decisionLogic: page.decisionLogic }),
  }, 2000);

  if (!rules) return { segment: null, source: 'rules-null' };

  const segment = rules.AGrQuIjdEunH || null;
  return {
    segment,
    lob: rules.conductrics_lob || segment,
    source: 'rules',
    raw: rules,
  };
}

async function experimentArm(agent, clientId, {
  qa, loc, traits, env,
}) {
  if (!agent) return { arm: 'A', agent: null, reason: 'no-agent' };

  const vid = String(clientId).replace(/\./g, '-');
  const params = new URLSearchParams({ session: vid, vid });
  if (qa) params.set('qa', 'true');
  // the agents gate on ${v.loc}; with no location every condition is false and nothing selects
  if (loc) params.set('loc', loc);
  if (traits) params.set('traits', traits);

  const data = await postJson(
    `${env.CONDUCTRICS_URL}&${params}`,
    {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: JSON.stringify({ commands: [{ a: agent }] }),
    },
    2000,
  );

  const sels = data?.data?.sels || data?.sels || {};
  // an unselected agent and a control arm both render the default, so they are traced apart
  return { arm: sels[agent] || 'A', agent, reason: sels[agent] ? null : 'no-selection' };
}

async function decideSegment(request, url, env, trace, jar, page, ssr, visitorUuid, prod) {
  const userAgent = request.headers.get('user-agent') || 'Mozilla/5.0';
  // the agents' URL targeting lists the public address, not whichever host the worker answers on
  const loc = new URL(canonicalPath(url.pathname), env.CANONICAL_ORIGIN || url.origin).href;
  const traits = conductricsTraits(jar);
  trace.loc = loc;
  trace.traits = traits;

  if (/bot|crawler|spider|gptbot|chatgpt-user/i.test(userAgent)) {
    trace.skipped = 'bot';
    ssr.is_ai_crawler = 1;
    return null;
  }

  const forced = !prod && url.searchParams.get('segment');
  const firstVisit = !jar.OptanonConsent;
  const consented = forced || (firstVisit ? geoConsent(request) : hasConsent(jar));
  ssr.consent = {
    result_code: consented ? '0' : 'C01',
    result_content: { has_consent: consented ? '1' : '0' },
    source: firstVisit ? 'geo' : 'optanon',
  };
  if (!consented) {
    trace.skipped = firstVisit ? 'no-consent-geo' : 'no-consent';
    return null;
  }

  if (page.arms) {
    // a preview bypasses consent, so it stays off production origins
    const forcedArm = prod ? null : previewArm(url, jar, page.agent);
    const { arm, agent, reason } = forcedArm
      ? { arm: forcedArm, agent: page.agent, reason: null }
      : await experimentArm(page.agent, visitorUuid, {
        qa: url.searchParams.has('qa'),
        loc,
        traits,
        env,
      });
    if (forcedArm) trace.source = 'preview';
    if (reason) trace.reason = reason;
    trace.agent = agent;
    trace.arm = arm;
    ssr.conductrics = {
      result_code: '0',
      result_content: { sels: agent ? { [agent]: arm } : {}, agent_id: agent },
    };
    return page.arms[arm] || null;
  }

  const resolved = forced
    ? { segment: forced, lob: TRAIT_LOBS[forced] || forced, source: 'forced' }
    : await resolveSegment(jar, userAgent, env, page);
  trace.segment = resolved.segment;
  trace.source = resolved.source;
  ssr.rules = {
    result_code: '0',
    result_content: {
      ...(resolved.raw || {}),
      lob: resolved.raw?.lob || 'prospect',
      AGrQuIjdEunH: resolved.segment,
      conductrics_lob: resolved.lob,
      source: resolved.source,
    },
  };

  const lob = resolved.segment ? resolved.lob : 'prospect';
  const identity = resolved.segment
    ? (gaClientId(jar) || visitorUuid)
    : visitorUuid;

  // the same preview override the arms-based pages honour, against this lob's agent
  const lobAgent = (page.agents || {})[lob];
  const forcedArm = prod ? null : previewArm(url, jar, lobAgent);
  const { arm, agent, reason } = forcedArm
    ? { arm: forcedArm, agent: lobAgent, reason: null }
    : await experimentArm(lobAgent, identity, {
      qa: url.searchParams.has('qa'),
      loc,
      traits,
      env,
    });
  if (forcedArm) trace.source = 'preview';
  if (reason) trace.reason = `${reason}-for-${lob}`;
  trace.lob = lob;
  trace.agent = agent;
  trace.arm = arm;
  ssr.conductrics = {
    result_code: '0',
    result_content: { sels: agent ? { [agent]: arm } : {}, agent_id: agent },
  };

  if (arm !== 'B' && arm !== 'C') return null;
  return resolved.segment || 'prospect';
}

/*
 * A slot's variants are authored as section metadata: `pzn-slot` names the slot, and one
 * `pzn-<variant>` row per variant holds its fragment. Conductrics Express reads those same rows
 * client-side through utils/pzn.js, so both paths resolve the same authored content.
 *
 * The same fetch yields the tab strip, because a page can personalize either way: a slot swaps a
 * section's content, while a tab-scoped page authors one section per segment and reveals the
 * matching ones. Resolving the tab here ships it already applied, so no section paints only to be
 * hidden once tabs.js decorates.
 */
function slotVariants(html) {
  const [tag] = /<div\b[^>]*\sdata-pzn-slot="[^"]*"[^>]*>/.exec(html) || [];
  if (!tag) return null;
  const variants = {};
  [...tag.matchAll(/\sdata-pzn-([a-z0-9-]+)="([^"]*)"/g)].forEach(([, name, value]) => {
    if (name !== 'slot') variants[name] = value.trim().replace(/\/$/, '');
  });
  return Object.keys(variants).length ? variants : null;
}

/*
 * The tab strip's rows, as blocks/tabs/tabs.js reads them: a row's link names the tab it opens
 * and its second cell lists the keys that activate it, defaulting to the tab's own name. A
 * segment is one of those keys, so these rows are what turns a decision into a selected tab.
 */
async function tabRows(html) {
  const rows = [];
  let cell = null;
  await new HTMLRewriter()
    .on('div[class~="tabs"][class~="sections"] > div > div', {
      element(el) {
        cell = { tab: null, keys: '' };
        el.onEndTag(() => {
          if (cell.tab) rows.push({ tab: cell.tab, activatedBy: [cell.tab] });
          else if (rows.length) {
            const keys = cell.keys.split(',').map((k) => k.trim()).filter((k) => k && k !== 'scroll');
            if (keys.length) rows[rows.length - 1].activatedBy = keys;
          }
          cell = null;
        });
      },
      text(chunk) {
        if (cell && !cell.tab) cell.keys += chunk.text;
      },
    })
    .on('div[class~="tabs"][class~="sections"] > div > div > a[href^="#"]', {
      element(el) {
        if (cell) cell.tab = decodeURIComponent((el.getAttribute('href') || '').slice(1));
      },
    })
    .transform(new Response(html))
    .arrayBuffer();
  return rows;
}

/*
 * The tab tabs.js would select for this key, or null when no row claims it. tabs.js falls back to
 * the default tab, which the stylesheet already shows on its own, so an unclaimed key leaves the
 * page exactly as authored rather than committing the edge to a state it has no decision for.
 */
function resolveTab(rows, key) {
  if (!rows || !key) return null;
  if (rows.some((r) => r.tab === key)) return key;
  return rows.find((r) => r.activatedBy.includes(key))?.tab || null;
}

/*
 * A fragment never reaches the edge, so a visitor arriving on an authored #tab link would have
 * the segment's tab painted and then corrected. These two pieces move that correction before the
 * first paint: the map lets an inline head script name the tab the hash asks for, and the rules
 * key visibility off that name rather than off classes only tabs.js can apply.
 */
function tabAliasMap(rows) {
  const map = {};
  rows.forEach(({ tab, activatedBy }) => {
    activatedBy.forEach((keyword) => { if (!(keyword in map)) map[keyword] = tab; });
  });
  // a tab's own name outranks an alias another row claims, exactly as resolveTab orders them
  rows.forEach(({ tab }) => { map[tab] = tab; });
  return map;
}

function tabVisibilityCss(rows, values) {
  const shows = (value, key) => value.split(',').map((t) => t.trim()).includes(key);
  return [...new Set(['default', ...rows.map((r) => r.tab)])].map((key) => {
    const visible = values.filter((value) => shows(value, key));
    const kept = visible.map((value) => `[data-tab="${value}"]`).join(',');
    const scope = `html[data-pzn-tab="${key}"] [data-tab]`;
    return `${kept ? `${scope}:not(${kept})` : scope}{display:none}`;
  }).join('');
}

async function pageHints(origin, path) {
  const res = await fetch(`${origin}${path}.plain.html`, {
    headers: { 'accept-encoding': 'identity' },
    cf: { cacheEverything: true, cacheTtl: SHARED_TTL },
  });
  if (!res.ok) return {};
  const html = await res.text();
  const values = [...new Set([...html.matchAll(/\sdata-tab="([^"]*)"/g)].map(([, v]) => v))];
  return { variants: slotVariants(html), rows: await tabRows(html), values };
}

async function inlineFragment(origin, fragmentPath, env) {
  const res = await fetch(`${origin}${fragmentPath}.plain.html`, {
    headers: { 'accept-encoding': 'identity', ...originHeaders(new URL(origin), env) },
    cf: { cacheEverything: true, cacheTtl: SHARED_TTL },
  });
  if (!res.ok) return null;
  const html = await res.text();
  // strips the single section wrapper, leaving children decorateSections will wrap as authored
  return {
    html: html.trim().replace(/^<div>/, '').replace(/<\/div>$/, '').trim(),
    tag: res.headers.get(TAG_HEADER[cdnType(env)]) || '',
  };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = env.ORIGIN || 'http://localhost:3000';
    const started = Date.now();
    const trace = {};

    const path = canonicalPath(url.pathname);

    // The page shell is the same for everyone, so fetching it does not wait on the decision.
    const fetchShell = () => fetch(new URL(path + url.search, origin), {
      headers: originHeaders(url, env),
      cf: { cacheEverything: true, cacheTtl: SHARED_TTL },
    });
    const prod = /aem\.live|rbcroyalbank\.com/.test(env.ORIGIN || '');
    const page = pages(env.AGENT_SET)[path];
    if (!page) {
      const passthrough = await fetchShell();
      const headers = new Headers(passthrough.headers);
      headers.set('x-pzn-trace', JSON.stringify({ skipped: 'path-not-personalized', path }));
      return new Response(passthrough.body, { status: passthrough.status, headers });
    }

    const jar = cookies(request.headers.get('cookie'));
    const key = decisionKey(jar);
    /*
     * Any override from the URL is a preview: it must not persist a decision or fill the page
     * cache, or one preview visit pins that variant for every clean visit until the cookie
     * expires - which reads as the forced segment having become the default experience.
     */
    const overrides = ['variant', 'segment', 'c-conductrics-preview'];
    const preview = !prod && overrides.some((param) => url.searchParams.has(param));
    const cached = preview ? null : cachedDecision(jar, key);
    const vid = visitorId(jar);
    const ssr = { design_test_vid: vid.uuid };

    /*
     * A returning visitor already carries the decision, so the whole composed page can come from
     * cache without touching the origin. Everyone else starts the shell fetch now, in parallel
     * with the decision.
     */
    if (cached) {
      const hit = await caches.default.match(pageCacheKey(url, cached));
      if (hit) {
        const headers = new Headers(hit.headers);
        headers.set('x-pzn-trace', JSON.stringify({ cache: 'page-hit', variant: cached }));
        return new Response(hit.body, { status: hit.status, headers });
      }
    }
    const shell = fetchShell();

    // The page's own variant list and the decision are independent, so resolve them together.
    const [hints, segment] = await Promise.all([
      pageHints(origin, path).catch(() => ({})),
      (async () => {
        if (cached) {
          trace.cache = 'hit';
          return cached === 'default' ? null : cached;
        }
        trace.cache = 'miss';
        try {
          return await decideSegment(request, url, env, trace, jar, page, ssr, vid.uuid, prod);
        } catch (err) {
          trace.error = `${err.name}: ${err.message}`;
          return null;
        }
      })(),
    ]);

    const { variants, rows, values } = hints;
    const fragmentPath = (segment && variants && variants[segment]) || null;
    // a tab-scoped page carries no slot, so the tab is the whole of how its decision lands
    const tab = trace.skipped ? null : resolveTab(rows, segment);
    if (tab) trace.tab = tab;
    if (segment && !fragmentPath && !tab) {
      trace.reason = variants ? `no-pzn-row-for-${segment}` : 'page-personalizes-nothing';
    }
    trace.decisionMs = Date.now() - started;

    const [upstream, hero] = await Promise.all([
      shell,
      fragmentPath ? inlineFragment(origin, fragmentPath, env).catch(() => null) : null,
    ]);

    const isHtml = (upstream.headers.get('content-type') || '').includes('text/html');
    if (!isHtml) return upstream;
    /*
     * Only the hero is inlined here. Tab sections, including bank-accounts' per-tab heroes, ship
     * whole and switch client-side on the hash; body[data-preselect] below just names which one
     * opens by default.
     */
    trace.inlined = Boolean(hero);
    trace.variant = segment || 'default';
    if (fragmentPath && !hero) trace.reason = `no-document-at-${fragmentPath}`;

    ssr.variant = trace.variant;

    /*
     * Utils::script_variable. The server-side path has no auto-GA4 integration, unlike Express
     * and the client JS API, so the page publishes the decision and scripts/gtm.js turns it into
     * experience_impression and model_result events.
     */
    // EDS sends a per-request CSP nonce as a header; without it the payload is refused as inline
    const [, csp] = /'nonce-([^']+)'/.exec(upstream.headers.get('content-security-policy') || '') || [];
    const nonce = csp ? ` nonce="${csp}"` : '';
    const tabCss = rows && rows.length && values ? tabVisibilityCss(rows, values) : '';
    const aliasJson = tabCss ? JSON.stringify(tabAliasMap(rows)) : '';

    const out = new HTMLRewriter()
      .on('[data-pzn-slot]', {
        element(el) {
          if (!hero) return;
          // same marker utils/pzn.js sets, so the client half knows not to swap this slot again
          el.setInnerContent(hero.html, { html: true });
          el.setAttribute('data-pzn-applied', fragmentPath);
        },
      })
      .on('body', {
        element(el) {
          // section-tabs reads this as RBC's Tab Pre-selection; a segment with no claiming
          // tab (e.g. prospect) just falls through to the default tab, same as no signal at all
          if (!trace.skipped && segment) el.setAttribute('data-preselect', segment);
          if (trace.skipped || !tabCss) return;
          /*
           * The rules above exist only to get the first paint right. Once the sections are
           * parsed, the same answer is written as the `tab-hidden` classes tabs.js owns and the
           * rules are dropped, so the block stays the only thing deciding tabs afterwards and a
           * worker newer than the deployed code cannot fight it.
           */
          el.onEndTag((end) => end.before(
            `<script${nonce}>(function(){var d=document.documentElement,`
            + "t=d.getAttribute('data-pzn-tab');if(!t)return;"
            + "document.querySelectorAll('[data-tab]').forEach(function(s){"
            + "s.classList.toggle('tab-hidden',(s.getAttribute('data-tab')||'').split(',')"
            + '.map(function(x){return x.trim()}).indexOf(t)<0)});'
            + "d.classList.add('tab-js');"
            + "var c=document.getElementById('pzn-tab-css');if(c)c.remove()})();</script>",
            { html: true },
          ));
        },
      })
      /*
       * `tab-js` is what tells the stylesheet a tab is being chosen; without it the default
       * sections show alone, which stays the right fallback when nothing decorates.
       */
      .on('html', {
        element(el) {
          if (!tab) return;
          el.setAttribute('class', addClass(el.getAttribute('class'), 'tab-js'));
          el.setAttribute('data-pzn-tab', tab);
        },
      })
      .on('head', {
        element(el) {
          // Bots and unconsented visitors get the page untouched, so it stays cacheable.
          if (trace.skipped) return;
          el.append(
            `<script${nonce}>var serverSideRulesEngineResponse = ${JSON.stringify(ssr)};</script>`,
            { html: true },
          );
          if (!tabCss) return;
          /*
           * The hash wins over the segment, as it does in tabs.js: it is the visitor's own
           * choice. Running here means it wins before anything paints rather than after.
           */
          el.append(
            `<style id="pzn-tab-css">${tabCss}</style><script${nonce}>(function(){var h=location.hash.slice(1);`
            + 'if(!h)return;try{h=decodeURIComponent(h)}catch(e){}'
            + `var d=document.documentElement;d.setAttribute('data-pzn-tab',(${aliasJson})[h]||'default');`
            + "d.classList.add('tab-js')})();</script>",
            { html: true },
          );
        },
      })
      .transform(upstream);

    trace.totalMs = Date.now() - started;
    const headers = new Headers(out.headers);
    headers.set('x-pzn-trace', JSON.stringify(trace));

    // Bots and visitors without consent get the page exactly as authored, so it stays cacheable.
    // union so a change to an inlined fragment still purges every page that inlined it
    const tagHeader = TAG_HEADER[cdnType(env)];
    const tags = unionCacheTags(upstream.headers.get(tagHeader), hero && hero.tag);
    if (tags) headers.set(tagHeader, tags);

    const secure = url.protocol === 'https:';
    if (!trace.skipped) {
      /*
       * The response varies by visitor, so only this worker's per-variant cache may hold it.
       * The origin's CDN-Cache-Control/Surrogate-Control would otherwise let the CDN in front
       * cache one visitor's page and serve it to everyone.
       */
      headers.set('cache-control', 'private, no-store');
      headers.delete('cdn-cache-control');
      headers.delete('surrogate-control');
      if (vid.isNew && !preview) headers.append('set-cookie', visitorCookie(vid.uuid, secure));
      if (key && !cached && !preview) {
        headers.append('set-cookie', decisionCookie(key, segment || 'default', secure));
      }
    }

    const composed = new Response(out.body, { status: out.status, headers });
    if (!trace.skipped && !preview) {
      const storeHeaders = new Headers(headers);
      storeHeaders.delete('set-cookie');
      storeHeaders.set('cache-control', `max-age=${PAGE_TTL}`);
      ctx.waitUntil(caches.default.put(
        pageCacheKey(url, trace.variant),
        new Response(composed.clone().body, { status: composed.status, headers: storeHeaders }),
      ));
    }
    return composed;
  },
};
