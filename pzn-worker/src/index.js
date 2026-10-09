import pages, { TRAIT_LOBS, TRAIT_SEGMENTS } from '../../scripts/pzn-config.js';

const SHARED_TTL = 300;
const PAGE_TTL = 60;
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

function decisionKey(jar) {
  const trait = traitSegment(jar);
  if (trait) return `t:${trait}`;
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

  // Both params bypass consent below, so a real visitor could use either to peek at another
  // segment's offer. Fine on .page for QA; not something to leave reachable on .live.
  const preview = !prod && url.searchParams.get('variant');
  if (preview) {
    trace.source = 'preview';
    return preview;
  }

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
    const { arm, agent, reason } = await experimentArm(page.agent, visitorUuid, {
      qa: url.searchParams.has('qa'),
      loc,
      traits,
      env,
    });
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

  const { arm, agent, reason } = await experimentArm((page.agents || {})[lob], identity, {
    qa: url.searchParams.has('qa'),
    loc,
    traits,
    env,
  });
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
 */
async function slotVariants(origin, path) {
  const res = await fetch(`${origin}${path}.plain.html`, {
    headers: { 'accept-encoding': 'identity' },
    cf: { cacheEverything: true, cacheTtl: SHARED_TTL },
  });
  if (!res.ok) return null;
  const html = await res.text();
  const [tag] = /<div\b[^>]*\sdata-pzn-slot="[^"]*"[^>]*>/.exec(html) || [];
  if (!tag) return null;
  const variants = {};
  [...tag.matchAll(/\sdata-pzn-([a-z0-9-]+)="([^"]*)"/g)].forEach(([, name, value]) => {
    if (name !== 'slot') variants[name] = value.trim().replace(/\/$/, '');
  });
  return Object.keys(variants).length ? variants : null;
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
    const preview = !prod && url.searchParams.has('variant');
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
    const [variants, segment] = await Promise.all([
      slotVariants(origin, path).catch(() => null),
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

    const fragmentPath = (segment && variants && variants[segment]) || null;
    if (segment && !variants) trace.reason = 'page-declares-no-pzn-slot';
    else if (segment && !fragmentPath) trace.reason = `no-pzn-row-for-${segment}`;
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
        },
      })
      .on('head', {
        element(el) {
          // Bots and unconsented visitors get the page untouched, so it stays cacheable.
          if (trace.skipped) return;
          el.append(
            `<script>var serverSideRulesEngineResponse = ${JSON.stringify(ssr)};</script>`,
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
