import pages, { TRAIT_LOBS, TRAIT_SEGMENTS } from '../../scripts/pzn-config.js';

const SHARED_TTL = 300;
const DECISION_TTL = 1800;
const DECISION_COOKIE = 'pzn-decision';
const VID_COOKIE = 'design_test_vid';
const VID_TTL = 2592000;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-[45][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

async function experimentArm(agent, clientId, qa, env) {
  if (!agent) return { arm: 'A', agent: null, reason: 'no-agent' };

  const vid = String(clientId).replace(/\./g, '-');
  const data = await postJson(
    `${env.CONDUCTRICS_URL}&session=${vid}&vid=${vid}${qa ? '&qa=true' : ''}`,
    {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: JSON.stringify({ commands: [{ a: agent }] }),
    },
    2000,
  );

  const sels = data?.data?.sels || data?.sels || {};
  return { arm: sels[agent] || 'A', agent };
}

async function decideSegment(request, url, env, trace, jar, page, ssr, visitorUuid) {
  const userAgent = request.headers.get('user-agent') || 'Mozilla/5.0';

  const preview = url.searchParams.get('variant');
  if (preview) {
    trace.source = 'preview';
    return preview;
  }

  if (/bot|crawler|spider|gptbot|chatgpt-user/i.test(userAgent)) {
    trace.skipped = 'bot';
    ssr.is_ai_crawler = 1;
    return null;
  }

  const forced = url.searchParams.get('segment');
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
    const { arm, agent } = await experimentArm(
      page.agent,
      visitorUuid,
      url.searchParams.has('qa'),
      env,
    );
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

  const { arm, agent, reason } = await experimentArm(
    (page.agents || {})[lob],
    identity,
    url.searchParams.has('qa'),
    env,
  );
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

async function heroBase(origin, path) {
  const res = await fetch(`${origin}${path}.plain.html`, {
    headers: { 'accept-encoding': 'identity' },
    cf: { cacheEverything: true, cacheTtl: SHARED_TTL },
  });
  if (!res.ok) return null;
  const html = await res.text();
  const found = /data-personalization="([^"]+)"/.exec(html);
  return found ? found[1].trim().replace(/\/$/, '') : null;
}

async function inlineHero(origin, fragmentPath) {
  const res = await fetch(`${origin}${fragmentPath}.plain.html`, {
    headers: { 'accept-encoding': 'identity' },
    cf: { cacheEverything: true, cacheTtl: SHARED_TTL },
  });
  if (!res.ok) return null;
  const html = await res.text();
  return html.trim().replace(/^<div>/, '').replace(/<\/div>$/, '').trim();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = env.ORIGIN || 'http://localhost:3000';
    const started = Date.now();
    const trace = {};

    // The page shell is the same for everyone, so fetching it does not wait on the decision.
    const shell = fetch(new URL(url.pathname + url.search, origin), {
      cf: { cacheEverything: true, cacheTtl: SHARED_TTL },
    });

    const path = url.pathname;
    const prod = /aem\.live|rbcroyalbank\.com/.test(env.ORIGIN || '');
    const page = pages(prod)[path];
    if (!page) {
      const passthrough = await shell;
      const headers = new Headers(passthrough.headers);
      headers.set('x-pzn-trace', JSON.stringify({ skipped: 'path-not-personalized', path }));
      return new Response(passthrough.body, { status: passthrough.status, headers });
    }

    const jar = cookies(request.headers.get('cookie'));
    const key = decisionKey(jar);
    const preview = url.searchParams.has('variant');
    const cached = preview ? null : cachedDecision(jar, key);
    const vid = visitorId(jar);
    const ssr = { design_test_vid: vid.uuid };

    // The page's own variant list and the decision are independent, so resolve them together.
    const [base, segment] = await Promise.all([
      heroBase(origin, path).catch(() => null),
      (async () => {
        if (cached) {
          trace.cache = 'hit';
          return cached === 'default' ? null : cached;
        }
        trace.cache = 'miss';
        try {
          return await decideSegment(request, url, env, trace, jar, page, ssr, vid.uuid);
        } catch (err) {
          trace.error = `${err.name}: ${err.message}`;
          return null;
        }
      })(),
    ]);

    const fragmentPath = base && segment ? `${base}/${segment}` : null;
    if (segment && !base) trace.reason = 'page-declares-no-personalization';
    trace.decisionMs = Date.now() - started;

    const [upstream, hero] = await Promise.all([
      shell,
      fragmentPath ? inlineHero(origin, fragmentPath).catch(() => null) : null,
    ]);

    const isHtml = (upstream.headers.get('content-type') || '').includes('text/html');
    if (!isHtml) return upstream;
    // Report what shipped: a declared variant with no document still renders the default.
    trace.inlined = Boolean(hero);
    trace.variant = hero ? segment : 'default';
    if (segment && !hero) trace.reason = base ? `no-document-for-${segment}` : 'page-declares-no-personalization';

    ssr.variant = trace.variant;

    /*
     * Utils::script_variable. The server-side path has no auto-GA4 integration, unlike Express
     * and the client JS API, so the page publishes the decision and scripts/personalization.js
     * turns it into experience_impression and model_result events.
     */
    let replaced = false;
    const out = new HTMLRewriter()
      .on('div.hero', {
        element(el) {
          if (!hero || replaced) return;
          replaced = true;
          el.replace(hero, { html: true });
        },
      })
      .on('[data-personalization]', {
        element(el) {
          // tells the client half this page was already decided here
          el.removeAttribute('data-personalization');
          if (hero) el.removeAttribute('data-background');
        },
      })
      .on('[data-personas]', {
        element(el) {
          const allowed = (el.getAttribute('data-personas') || '')
            .split(',')
            .map((p) => p.trim())
            .filter(Boolean);
          if (allowed.length && !allowed.includes(trace.variant)) el.remove();
          else el.removeAttribute('data-personas');
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
    const secure = url.protocol === 'https:';
    if (!trace.skipped) {
      headers.set('cache-control', 'no-store');
      headers.set('vary', 'cookie');
      if (vid.isNew && !preview) headers.append('set-cookie', visitorCookie(vid.uuid, secure));
      if (key && !cached && !preview) {
        headers.append('set-cookie', decisionCookie(key, segment || 'default', secure));
      }
    }
    return new Response(out.body, { status: out.status, headers });
  },
};
