// Vertical spacing between stacked block siblings.
//
// Written after body copy shipped touching the top border of the card below it
// on all eight channel pages. Nothing else here looks at vertical geometry:
// audit.js checks horizontal overflow and tap targets, and compare.js does not
// cover the channel pages at all, which is why it went unnoticed.
//
// The site spaces blocks with margin-top on the FOLLOWING element and
// .section-head is the only thing that owns a margin-bottom, so any block that
// declares no top margin collides with whatever precedes it unless a
// .section-head happens to be there. This finds those.
//
// Two things this has to get right, both learned the hard way while diagnosing
// the original bug:
//
//   1. Reveal everything first. A .reveal element that has not fired sits at
//      opacity 0 and translateY(18px), and measuring it reports a gap 18px
//      smaller than the truth. That produced a phantom -2px "overlap" on four
//      pages and hid a real 0px gap on the pair below it. Forcing .is-visible
//      and waiting for the transitions is not optional.
//
//   2. Only compare pairs that actually stack. Two columns of a grid are
//      siblings whose boxes overlap vertically by design; the hero's copy and
//      its photograph "overlap" by 293px and that is correct. Pairs whose
//      horizontal ranges barely overlap are side by side, not stacked.
const { chromium } = require('playwright-core');

const BASE = process.env.BASE || 'http://localhost:3000';

// Hardcoded rather than crawled, same as audit.js. A page missing from this
// list gets no coverage and nobody finds out, so new page means new line.
const PAGES = [
  '/', '/how-we-help.html', '/blog.html', '/contact.html', '/newsletter.html',
  '/ndis-marketing/index.html', '/ndis-marketing/seo.html', '/ndis-marketing/ads.html',
  '/ndis-marketing/email.html', '/ndis-marketing/managed.html', '/ndis-marketing/social.html',
  '/ndis-marketing/social-ads.html', '/ndis-marketing/referrals.html', '/ndis-marketing/sales-process.html',
  '/blog/ndis-digital-marketing-strategy.html',
  '/blog/attract-ndis-participants-with-google-ads.html',
  '/blog/marketing-for-business-growth.html',
  '/blog/how-can-seo-grow-my-business.html',
];

const WIDTHS = [1280, 390];

// Containers whose direct children are stacked blocks. .channel-row > div and
// the card classes are in here because the managed.html list/paragraph
// collision was inside a column, not in a .wrap.
const BOXES = '.wrap, .prose, .channel-row > div, .channel-note, .card, .article-toc';

const FAIL_UNDER = 8;   // a collision: text meeting a border
const WARN_UNDER = 20;  // tight, sometimes deliberate (.note owns 16px)

(async () => {
  const browser = await chromium.launch({ channel: 'msedge' });
  const fails = [];
  const warns = [];
  const unreachable = [];

  for (const width of WIDTHS) {
    const ctx = await browser.newContext({
      viewport: { width, height: 900 },
      isMobile: width < 700,
      hasTouch: width < 700,
      deviceScaleFactor: 1,
    });

    for (const path of PAGES) {
      const page = await ctx.newPage();
      const resp = await page.goto(BASE + path, { waitUntil: 'networkidle' }).catch(() => null);

      // Bail on a page that did not load, rather than evaluating against a
      // dead context. Swallowing the goto failure alone is not enough: the
      // evaluate below then throws "Execution context was destroyed" and
      // takes the whole run down, which exits 1 and looks exactly like a
      // collision. An unreachable page has to report as an unreachable page.
      if (!resp || !resp.ok()) {
        unreachable.push(`${path} @${width}: ${resp ? resp.status() : 'no response'}`);
        await page.close();
        continue;
      }

      // Reveal everything up front rather than scrolling and hoping the
      // observer caught every target. See note 1 above.
      await page.evaluate(() => {
        document.querySelectorAll('.reveal').forEach(e => e.classList.add('is-visible'));
      });
      await page.waitForTimeout(1400); // longest transition here is 1.2s

      const rows = await page.evaluate((sel) => {
        const label = (e) => {
          const cls = typeof e.className === 'string' && e.className.trim()
            ? '.' + e.className.trim().split(/\s+/).filter(c => c !== 'is-visible').slice(0, 3).join('.')
            : '';
          return e.tagName.toLowerCase() + cls;
        };

        const out = [];
        document.querySelectorAll(sel).forEach((box) => {
          const kids = [...box.children].filter((e) => {
            const cs = getComputedStyle(e);
            return cs.display !== 'none' && cs.position !== 'absolute'
                   && e.getBoundingClientRect().height > 0;
          });

          for (let i = 0; i < kids.length - 1; i++) {
            const a = kids[i].getBoundingClientRect();
            const z = kids[i + 1].getBoundingClientRect();

            // Side by side rather than stacked? See note 2 above.
            const overlap = Math.min(a.right, z.right) - Math.max(a.left, z.left);
            if (overlap < Math.min(a.width, z.width) * 0.5) continue;

            out.push({
              gap: Math.round(z.top - a.bottom),
              pair: label(kids[i]) + '  ->  ' + label(kids[i + 1]),
            });
          }
        });
        return out;
      }, BOXES);

      rows.forEach((r) => {
        const entry = { width, path, ...r };
        if (r.gap < FAIL_UNDER) fails.push(entry);
        else if (r.gap < WARN_UNDER) warns.push(entry);
      });

      await page.close();
    }
    await ctx.close();
  }

  await browser.close();

  const show = (list) => {
    const byPair = {};
    list.forEach((e) => {
      byPair[e.pair] = byPair[e.pair] || [];
      byPair[e.pair].push(`${e.gap}px @${e.width} ${e.path}`);
    });
    Object.entries(byPair).sort().forEach(([pair, hits]) => {
      console.log(`  ${pair}`);
      hits.forEach(h => console.log(`      ${h}`));
    });
  };

  console.log(`\n===== COLLISIONS (< ${FAIL_UNDER}px between stacked blocks) =====`);
  if (fails.length) show(fails); else console.log('  none');

  console.log(`\n===== TIGHT (${FAIL_UNDER}px to ${WARN_UNDER - 1}px, review) =====`);
  if (warns.length) show(warns); else console.log('  none');

  console.log('\n===== UNREACHABLE =====');
  if (unreachable.length) unreachable.forEach(u => console.log('  ' + u));
  else console.log('  none');

  console.log(`\n  ${PAGES.length} pages x ${WIDTHS.length} widths`);
  // Unreachable pages fail the run too. A pass that silently checked nothing
  // is worse than a failure that says why.
  process.exit(fails.length || unreachable.length ? 1 : 0);
})();
