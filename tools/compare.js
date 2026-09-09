// Captures the same page from the live site and from localhost, at desktop
// and phone width, so the two builds can be put next to each other.
const { chromium } = require('playwright-core');

const LIVE = 'https://cl-growth-academy-website.vercel.app';
const LOCAL = 'http://localhost:3000';

const PAGES = [
  ['home', '/index.html'],
  ['hub', '/ndis-marketing/index.html'],
  ['howwehelp', '/how-we-help.html'],
  // blog.html exists live and is being restructured, so it is worth the
  // side-by-side. This check is the one that caught the mismatched headings
  // and the stranded card, both of which every automated rule passed clean.
  ['blog', '/blog.html'],
];

async function shoot(ctx, base, path, out) {
  const page = await ctx.newPage();
  try {
    const r = await page.goto(base + path, { waitUntil: 'networkidle', timeout: 45000 });
    if (!r || !r.ok()) { await page.close(); return { ok: false, status: r ? r.status() : 'none' }; }
    // scroll so lazy images and reveals fire, then force reveals visible
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y); await new Promise(r => setTimeout(r, 70));
      }
      window.scrollTo(0, 0);
      document.querySelectorAll('.reveal').forEach(e => e.classList.add('is-visible'));
      // stop the corridor and marquee so the two captures are comparable
      document.querySelectorAll('.corridor-wall, .marquee-track').forEach(e => {
        e.style.animationPlayState = 'paused';
      });
    });
    await page.waitForTimeout(1800);
    await page.screenshot({ path: out, fullPage: true });
    const h = await page.evaluate(() => document.body.scrollHeight);
    await page.close();
    return { ok: true, height: h };
  } catch (e) {
    await page.close();
    return { ok: false, status: e.message.slice(0, 60) };
  }
}

(async () => {
  const b = await chromium.launch({ channel: 'msedge' });
  const results = [];

  for (const [w, label] of [[1280, 'desktop'], [390, 'phone']]) {
    const ctx = await b.newContext({
      viewport: { width: w, height: 900 },
      isMobile: w < 700, hasTouch: w < 700, deviceScaleFactor: 1,
    });
    for (const [name, path] of PAGES) {
      const a = await shoot(ctx, LIVE, path, `cmp-${name}-${label}-live.png`);
      const c = await shoot(ctx, LOCAL, path, `cmp-${name}-${label}-new.png`);
      results.push({ name, label, live: a, local: c });
      console.log(`  ${name} @ ${label}: live ${a.ok ? a.height + 'px' : 'FAIL ' + a.status}` +
                  `  |  new ${c.ok ? c.height + 'px' : 'FAIL ' + c.status}`);
    }
    await ctx.close();
  }

  // Pages that do not exist live at all, so a 404 here is the expected result
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  console.log('\n  new pages, checked against live:');
  for (const p of ['/ndis-marketing/social-ads.html', '/ndis-marketing/referrals.html',
                   '/ndis-marketing/sales-process.html',
                   '/blog/ndis-digital-marketing-strategy.html',
                   '/blog/attract-ndis-participants-with-google-ads.html',
                   '/blog/marketing-for-business-growth.html',
                   '/blog/how-can-seo-grow-my-business.html']) {
    const pg = await ctx.newPage();
    const r = await pg.goto(LIVE + p, { waitUntil: 'domcontentloaded' }).catch(() => null);
    console.log(`    ${p}  live: ${r ? r.status() : 'no response'}`);
    await pg.close();
  }
  await ctx.close();
  await b.close();
})();
