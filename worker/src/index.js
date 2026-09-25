/*
 * PBA homepage server-side personalization.
 * Ports cgi-bin/credit-cards/personalization-v4 (Render.pm::render_pba_banner) to the edge.
 *
 * Segment comes from the c-traits-list cookie, or the rules engine for known customers.
 * Conductrics returns the experiment ARM: B/C shows the segment's banner, A is the control.
 */

// Traits.pm PROSPECT_SEGMENT_LOBS, in its precedence order.
const TRAIT_SEGMENTS = ['international-student', 'student', 'newcomer', 'senior'];

// The page shell and its fragments are identical for every visitor; only assembly is personal.
const SHARED_TTL = 300;
// How long a resolved decision sticks to a visitor. Conductrics assignments are session-stable.
const DECISION_TTL = 1800;
const DECISION_COOKIE = 'pzn-decision';

// DesignTestVid.pm: the Conductrics visitor id is a v4 UUID in its own 30-day cookie, not the
// GA client id. Kept byte-compatible so a visitor migrating between stacks keeps their identity.
const VID_COOKIE = 'design_test_vid';
const VID_TTL = 2592000;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-[45][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const cookies = (header) => Object.fromEntries(
  (header || '').split(';').map((pair) => {
    const eq = pair.indexOf('=');
    return eq < 0 ? [pair.trim(), ''] : [pair.slice(0, eq).trim(), pair.slice(eq + 1)];
  }),
);

// Consent.pm: OptanonConsent group 3 is the personalization category.
function hasConsent(jar) {
  if (!jar.OptanonConsent) return false;
  const groups = /(?:^|&)groups=([^&;]*)/.exec(decodeURIComponent(jar.OptanonConsent));
  if (!groups) return false;
  return groups[1].split(',').some((entry) => {
    const [category, status] = entry.split(':');
    return category === '3' && status === '1';
  });
}

// GA.pm: the gaClientID cookie, else fields 3-4 of _ga.
function gaClientId(jar) {
  if (jar.gaClientID) return jar.gaClientID;
  const parts = (jar._ga || '').split('.');
  return parts.length >= 4 ? `${parts[2]}.${parts[3]}` : null;
}

// Traits.pm: prospect segment lives in the c-traits-list cookie, not the rules engine.
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
 * A visitor's decision is determined by their trait cookie, or failing that their GA client id.
 * Both are readable without touching an API, so the cache key costs nothing to compute and a
 * repeat view skips the rules engine and Conductrics entirely.
 */
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
  if (trait) return { segment: trait, source: 'c-traits-list' };

  const clientId = gaClientId(jar);
  if (!clientId) return { segment: null, source: 'no-ga-client-id' };

  // Rules.pm sets no explicit User-Agent; LWP supplies one and the API rejects requests without it.
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
  return { segment: rules.AGrQuIjdEunH || rules.lob || null, source: 'rules' };
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

// Returns the segment whose banner should render, or null for the authored default.
// Populates `ssr`, the payload the page publishes as serverSideRulesEngineResponse.
async function decideSegment(request, url, env, trace, jar, page, ssr, visitorUuid) {
  const userAgent = request.headers.get('user-agent') || 'Mozilla/5.0';

  // Authoring/QA: render a segment's banner without asking Conductrics, which would otherwise
  // hand back the control arm and show the default instead.
  const preview = url.searchParams.get('variant');
  if (preview) {
    trace.source = 'preview';
    return preview;
  }

  // AICrawler.pm: crawlers skip personalization entirely and get the default.
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

  /*
   * Pages like Savings Overview run a single agent with no segment lookup: the arm code maps
   * straight to a variant. Arm codes are Conductrics wiring, so they sit beside the agent id in
   * config rather than in authored content.
   */
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

  // ssGTM splits by visit: returning visitors go to the rules engine keyed on GA client id,
  // first visitors to the prospect engine keyed on IP and URL flags.
  // A trait cookie identifies the visitor on its own, so only a visitor with neither that nor a
  // GA client id is genuinely on a first visit.
  if (!forced && !gaClientId(jar) && !traitSegment(jar)) {
    trace.skipped = 'first-visit-prospect-engine';
    ssr.prospect = { result_code: 'P00', result_content: 'prospect engine not implemented' };
    return null;
  }

  const resolved = forced
    ? { segment: forced, source: 'forced' }
    : await resolveSegment(jar, userAgent, env, page);
  trace.segment = resolved.segment;
  trace.source = resolved.source;
  ssr.rules = { result_code: '0', result_content: { lob: resolved.segment, source: resolved.source } };
  if (!resolved.segment) return null;

  const clientId = gaClientId(jar) || `anon-${resolved.segment}`;
  const { arm, agent, reason } = await experimentArm(
    (page.agents || {})[resolved.segment],
    clientId,
    url.searchParams.has('qa'),
    env,
  );
  if (reason) trace.reason = `${reason}-for-${resolved.segment}`;
  trace.agent = agent;
  trace.arm = arm;
  ssr.conductrics = { result_code: '0', result_content: { sels: agent ? { [agent]: arm } : {}, agent_id: agent } };

  // Render.pm: only B and C are treatment arms; A is the control and keeps the default.
  return arm === 'B' || arm === 'C' ? resolved.segment : null;
}

/*
 * The page declares where its variants live via `personalization` section metadata, which the
 * pipeline surfaces as data-personalization on the section. Variants are <base>/<segment>, so
 * authors add a segment by adding a document, with no list to maintain and no code change.
 */
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

// Resolve the fragment at the edge so the hero ships in the page HTML, as the SSI include does.
// ponytail: the wrapper strip assumes the fragment is a single section; a multi-section
// fragment would need real parsing.
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

    const page = (env.PAGES || {})[url.pathname];
    if (!page) return shell;

    const jar = cookies(request.headers.get('cookie'));
    const key = decisionKey(jar);
    const cached = cachedDecision(jar, key);
    const vid = visitorId(jar);
    const ssr = { design_test_vid: vid.uuid };

    // The page's own variant list and the decision are independent, so resolve them together.
    const [base, segment] = await Promise.all([
      heroBase(origin, url.pathname).catch(() => null),
      (async () => {
        if (cached) {
          trace.cache = 'hit';
          return cached === 'default' ? null : cached;
        }
        trace.cache = 'miss';
        try {
          return await decideSegment(request, url, env, trace, jar, page, ssr, vid.uuid);
        } catch (err) {
          // Render.pm wraps its decision in an eval; any failure keeps the default banner.
          trace.error = `${err.name}: ${err.message}`;
          return null;
        }
      })(),
    ]);

    const fragmentPath = base && segment ? `${base}/${segment}` : null;
    if (segment && !base) trace.reason = 'page-declares-no-personalization';
    trace.decisionMs = Date.now() - started;

    // The authored page already carries the default hero, so only a variant needs assembling.
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
      if (vid.isNew) headers.append('set-cookie', visitorCookie(vid.uuid, secure));
      if (key && !cached) {
        headers.append('set-cookie', decisionCookie(key, segment || 'default', secure));
      }
    }
    return new Response(out.body, { status: out.status, headers });
  },
};
