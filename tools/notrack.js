// Block Google Tag Manager, Google Analytics and the Meta Pixel in every
// browser check, and prove it blocked them.
//
// WHY THIS FILE EXISTS
//
// The checks in here drive a real browser against a real build, so every run
// loaded the real GTM container and fired real hits into the live GA4
// property from localhost. Months of test traffic sat in the client's
// reporting as if it were visitors.
//
// Worse, the one script that did try to stub Google got it wrong and said
// nothing:
//
//     page.route('**' + '/googletagmanager.com/**', ...)   // never fires
//
// A glob path segment wants a slash before the host. The URL is
// www.googletagmanager.com — a dot. The handler never ran, the real container
// loaded every time, and the run still printed "ok" because a route that
// matches nothing is indistinguishable from a route with nothing to match.
//
// So two rules here:
//
//   1. No globs. Hosts are matched by parsing the URL and comparing
//      hostnames, which cannot be fooled by a subdomain or a query string.
//   2. Every run reports what it blocked, and fails if anything got through.
//      A blocker that silently stops working is worse than none, because it
//      buys confidence it is not providing. The escape count below is the
//      part that would have caught the bug above on day one.
//
// Run `node tools/notrack.js` to see the match table, including the URLs the
// old glob missed.

// Blocked whole, including every subdomain. www.googletagmanager.com and
// region1.google-analytics.com are the ones that turn up in practice.
const HOSTS = [
  'googletagmanager.com',      // gtm.js, gtag/js, the ns.html noscript iframe
  'google-analytics.com',      // GA4 /g/collect, and the region1..N shards
  'analytics.google.com',      // GA4 again, newer endpoint
  'stats.g.doubleclick.net',   // GA's advertising beacon
  'connect.facebook.net',      // fbevents.js and the pixel's signals config
];

// facebook.com is NOT blocked wholesale: only /tr, which is the pixel's
// beacon. A link to a Facebook page, or an embed added later, is ordinary
// content and has nothing to do with tracking.
function isPixelBeacon(u) {
  const h = u.hostname.toLowerCase();
  if (h !== 'facebook.com' && !h.endsWith('.facebook.com')) return false;
  return u.pathname === '/tr' || u.pathname.indexOf('/tr/') === 0;
}

function isTracker(u) {
  const url = typeof u === 'string' ? new URL(u) : u;
  const h = url.hostname.toLowerCase();
  const hit = HOSTS.some(d => h === d || h.endsWith('.' + d));
  return hit || isPixelBeacon(url);
}

// A 1x1 transparent GIF, so a tracking pixel loaded as an <img> decodes
// instead of firing onerror. An empty body would still count as blocked but
// would put a console error in a run whose whole job is counting console
// errors.
const GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

// Serve each kind of request as the kind of thing it asked for. A script
// handed back as text/plain is refused by the browser and logged as a console
// error, which again is exactly what the callers are measuring.
function emptyBody(resourceType) {
  if (resourceType === 'script') return { contentType: 'application/javascript', body: '' };
  if (resourceType === 'image') return { contentType: 'image/gif', body: GIF };
  if (resourceType === 'document') return { contentType: 'text/html', body: '<!doctype html><title>blocked</title>' };
  if (resourceType === 'stylesheet') return { contentType: 'text/css', body: '' };
  return { contentType: 'text/plain', body: '' };
}

// Stamped on every reply this file serves. Anything coming back from a
// tracker host WITHOUT it reached the network, which is the failure state.
const MARK = 'x-notrack';

const ALLOWED = process.env.ALLOW_TRACKERS === '1';

function collector() {
  const blocked = [];   // requests this file answered
  const escaped = [];   // tracker responses that came from the real network
  let warned = false;

  return {
    // Call once per BrowserContext. Routing at context level rather than page
    // level covers pages opened later, including popups, with no chance of a
    // page being created before its own route is attached.
    async block(ctx) {
      if (ALLOWED) {
        if (!warned) {
          warned = true;
          console.log('\n  !! ALLOW_TRACKERS=1 — tracking is NOT blocked.');
          console.log('     Real hits will be sent to the live GA4 property and Meta Pixel.');
        }
        return;
      }

      ctx.on('response', r => {
        if (!isTracker(r.url())) return;
        if (r.headers()[MARK] !== 'blocked') escaped.push(r.url());
      });

      await ctx.route(u => isTracker(u), route => {
        blocked.push(route.request().url());
        const { contentType, body } = emptyBody(route.request().resourceType());
        route.fulfill({ status: 200, contentType, headers: { [MARK]: 'blocked' }, body })
          .catch(() => {});   // page closed mid-flight is not a failure
      });
    },

    // Prints what happened and returns the number that got through, so a
    // caller can fold it into its exit code.
    report() {
      if (ALLOWED) {
        console.log('\n===== THIRD-PARTY TRACKING =====');
        console.log('  NOT BLOCKED (ALLOW_TRACKERS=1) — this run sent real hits.');
        return 0;
      }
      console.log('\n===== THIRD-PARTY TRACKING =====');
      if (!blocked.length && !escaped.length) {
        // Not an error on its own: a single-page tool might legitimately see
        // none. It is worth printing, because it is also what a blocker that
        // has stopped matching looks like.
        console.log('  no tracker requests seen');
      } else {
        const byHost = {};
        blocked.forEach(u => {
          const h = new URL(u).hostname;
          byHost[h] = (byHost[h] || 0) + 1;
        });
        console.log(`  blocked ${blocked.length} request(s):`);
        Object.entries(byHost).sort().forEach(([h, n]) => console.log(`      ${n}x  ${h}`));
      }
      if (escaped.length) {
        console.log(`  ESCAPED — ${escaped.length} request(s) reached the network:`);
        [...new Set(escaped)].forEach(u => console.log(`      ${u}`));
      }
      return escaped.length;
    },

    blockedCount: () => blocked.length,
    escapedCount: () => escaped.length,
  };
}

module.exports = { collector, isTracker, HOSTS };

// --- self-test -------------------------------------------------------------
// `node tools/notrack.js` checks the matcher against the URLs this site
// actually produces, the ones the old glob missed, and the near misses that
// must stay allowed. Run it after touching HOSTS.
if (require.main === module) {
  const CASES = [
    // [url, should be blocked]
    ['https://www.googletagmanager.com/gtm.js?id=GTM-KP93RRXS', true],
    ['https://www.googletagmanager.com/gtag/js?id=G-YWQ0FQ5T50', true],
    ['https://www.googletagmanager.com/ns.html?id=GTM-KP93RRXS', true],
    ['https://googletagmanager.com/gtm.js', true],
    ['https://region1.google-analytics.com/g/collect?v=2', true],
    ['https://www.google-analytics.com/g/collect', true],
    ['https://analytics.google.com/g/collect', true],
    ['https://stats.g.doubleclick.net/g/collect', true],
    ['https://connect.facebook.net/en_US/fbevents.js', true],
    ['https://connect.facebook.net/signals/config/588636164309071', true],
    ['https://www.facebook.com/tr?id=588636164309071&ev=PageView', true],
    ['https://www.facebook.com/tr/?id=588636164309071', true],
    // must NOT be blocked
    ['http://localhost:3000/index.html', false],
    ['https://thegrowthacademy.com.au/index.html', false],
    ['https://fonts.googleapis.com/css2?family=Inter', false],
    ['https://fonts.gstatic.com/s/inter/v13/font.woff2', false],
    ['https://api.web3forms.com/submit', false],
    ['https://api.beehiiv.com/v2/subscribe', false],
    ['https://www.facebook.com/clgrowthacademy', false],  // a plain link
    ['https://www.linkedin.com/in/chrislapa', false],
    // the trap: a lookalike host must not match
    ['https://googletagmanager.com.evil.test/gtm.js', false],
    ['https://notgoogle-analytics.com/collect', false],
  ];

  let bad = 0;
  CASES.forEach(([url, want]) => {
    const got = isTracker(url);
    const ok = got === want;
    if (!ok) bad++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${got ? 'block ' : 'allow '} ${url}`);
  });

  // The specific bug this file was written for.
  const GLOB_MISS = 'https://www.googletagmanager.com/gtm.js?id=GTM-KP93RRXS';
  console.log(`\n  the URL the old glob missed is ${isTracker(GLOB_MISS) ? 'now blocked' : 'STILL ESCAPING'}`);
  console.log(`  ${CASES.length - bad}/${CASES.length} cases correct`);
  process.exit(bad ? 1 : 0);
}
