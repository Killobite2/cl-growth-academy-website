// Hard rules, checked in a real browser rather than by grep:
//   1. no rendered em-dash anywhere, including ::before/::after content
//   2. no dead internal link
//   3. every .post-card's markup matches where it actually points
//   4. the off-domain canonicals are exactly the four article pages
//   5. no broken #anchor, which the crawl in rule 2 cannot see
//   6. every JSON-LD block parses
//   7. no page is orphaned from the crawl
const { chromium } = require('playwright-core');

const BASE = process.env.BASE || 'http://localhost:3000';

// The article pages canonicalise to the live WordPress copies so the two do
// not compete for the same searches. That is deliberate and unusual, so it is
// asserted here rather than left to a comment somebody deletes.
const OFF_DOMAIN_CANONICAL = 'https://thegrowthacademy.com.au/';
const ARTICLES = [
  '/blog/ndis-digital-marketing-strategy.html',
  '/blog/attract-ndis-participants-with-google-ads.html',
  '/blog/marketing-for-business-growth.html',
  '/blog/how-can-seo-grow-my-business.html',
];

(async () => {
  const browser = await chromium.launch({ channel: 'msedge' });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  // Crawl from the homepage so new pages are discovered automatically
  const seen = new Set(['/index.html']);
  const queue = ['/index.html'];
  const dead = [];
  const emdash = [];
  const errors = [];
  const cards = [];
  const canon = [];
  const anchors = [];
  const jsonld = [];

  while (queue.length) {
    const path = queue.shift();
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(`${path}: ${e}`));
    page.on('console', m => { if (m.type() === 'error') errors.push(`${path}: ${m.text()}`); });

    const resp = await page.goto(BASE + path, { waitUntil: 'networkidle' }).catch(() => null);
    if (!resp || !resp.ok()) {
      dead.push({ path, status: resp ? resp.status() : 'no response' });
      await page.close();
      continue;
    }

    // --- rule 1: em-dash in rendered text or generated content ---
    const hits = await page.evaluate(() => {
      const EM = '—';
      const out = [];
      // text nodes (comments are not text nodes, so they are excluded for free)
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walk.nextNode())) {
        if (!n.nodeValue.includes(EM)) continue;
        const p = n.parentElement;
        if (!p || p.tagName === 'SCRIPT' || p.tagName === 'STYLE') continue;
        out.push({ where: `<${p.tagName.toLowerCase()} class="${p.className}">`,
                   text: n.nodeValue.trim().slice(0, 70) });
      }
      // generated content
      document.querySelectorAll('*').forEach(el => {
        ['::before', '::after'].forEach(pse => {
          const c = getComputedStyle(el, pse).content;
          if (c && c.includes(EM)) {
            out.push({ where: `${el.tagName.toLowerCase()}.${el.className}${pse}`, text: c });
          }
        });
      });
      return out;
    });
    hits.forEach(h => emdash.push({ path, ...h }));

    // --- rule 3: a card's markup has to match where it points ---
    // A half-converted card is exactly how the four blog cards went wrong
    // before: an internal href still carrying target="_blank" and an
    // .sr-only span announcing a new tab that never opens.
    const cardHits = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('a.post-card').forEach(a => {
        const external = new URL(a.href, location.href).origin !== location.origin;
        const isExt = a.classList.contains('is-external');
        const blank = a.getAttribute('target') === '_blank';
        const rel = (a.getAttribute('rel') || '').includes('noopener');
        const announced = !!a.querySelector('.sr-only');
        const title = (a.querySelector('h3') || {}).textContent || a.href;
        if (external && !(isExt && blank && rel && announced)) {
          out.push(`offsite card missing is-external/target/rel/sr-only: ${title.trim()}`);
        }
        if (!external && (isExt || blank || announced)) {
          out.push(`internal card still marked as offsite: ${title.trim()}`);
        }
      });
      return out;
    });
    cardHits.forEach(m => cards.push({ path, m }));

    // --- rule 4: canonical, off-domain only where intended ---
    const canonHit = await page.evaluate(() => {
      const l = document.querySelector('link[rel="canonical"]');
      const og = document.querySelector('meta[property="og:url"]');
      return { canonical: l ? l.href : null, ogUrl: og ? og.content : null };
    });
    const wantOff = ARTICLES.includes(path);
    const isOff = !!canonHit.canonical && canonHit.canonical.startsWith(OFF_DOMAIN_CANONICAL);
    if (!canonHit.canonical) {
      canon.push({ path, m: 'no canonical at all' });
    } else if (wantOff && !isOff) {
      canon.push({ path, m: `article should canonicalise off-domain, got ${canonHit.canonical}` });
    } else if (!wantOff && isOff) {
      canon.push({ path, m: `unexpected off-domain canonical: ${canonHit.canonical}` });
    }
    // og:url is a sharing address and must always be ours, even where the
    // canonical is not.
    if (canonHit.ogUrl && canonHit.ogUrl.startsWith(OFF_DOMAIN_CANONICAL)) {
      canon.push({ path, m: `og:url points off-domain: ${canonHit.ogUrl}` });
    }

    // --- rule 5: #anchors resolve ---
    // The link filter below drops these, so a broken contents-list anchor is
    // otherwise undetectable, and each article ships seven of them.
    const anchorHits = await page.evaluate(() =>
      [...document.querySelectorAll('a[href^="#"]')]
        .map(a => a.getAttribute('href'))
        .filter(h => h.length > 1 && !document.getElementById(h.slice(1)))
    );
    anchorHits.forEach(h => anchors.push({ path, m: h }));

    // --- rule 6: JSON-LD parses ---
    const ldHits = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('script[type="application/ld+json"]').forEach((s, i) => {
        try { JSON.parse(s.textContent); } catch (e) { out.push(`block ${i}: ${e.message}`); }
      });
      return out;
    });
    ldHits.forEach(m => jsonld.push({ path, m }));

    // --- rule 2: collect internal links to crawl ---
    const links = await page.evaluate(() =>
      [...document.querySelectorAll('a[href]')]
        .map(a => a.getAttribute('href'))
        .filter(h => h && !/^(https?:|mailto:|tel:|#)/.test(h))
    );
    for (const href of links) {
      const abs = new URL(href, BASE + path).pathname;
      if (!abs.endsWith('.html') && abs !== '/') continue;
      const norm = abs === '/' ? '/index.html' : abs;
      if (!seen.has(norm)) { seen.add(norm); queue.push(norm); }
    }
    await page.close();
  }

  await browser.close();

  console.log(`\n===== CRAWLED ${seen.size} PAGES =====`);
  [...seen].sort().forEach(p => console.log(`  ${p}`));

  console.log('\n===== DEAD LINKS =====');
  console.log(dead.length ? dead.map(d => `  ${d.path} -> ${d.status}`).join('\n') : '  none');

  console.log('\n===== RENDERED EM-DASHES =====');
  if (!emdash.length) console.log('  none');
  emdash.forEach(e => console.log(`  ${e.path}  ${e.where}\n      ${e.text}`));

  console.log('\n===== JS ERRORS =====');
  console.log(errors.length ? errors.map(e => '  ' + e).join('\n') : '  none');

  console.log('\n===== CARD MARKUP =====');
  console.log(cards.length ? cards.map(c => `  ${c.path}  ${c.m}`).join('\n') : '  none');

  console.log('\n===== CANONICALS =====');
  console.log(canon.length ? canon.map(c => `  ${c.path}  ${c.m}`).join('\n') : '  none');

  console.log('\n===== BROKEN ANCHORS =====');
  console.log(anchors.length ? anchors.map(a => `  ${a.path}  ${a.m}`).join('\n') : '  none');

  console.log('\n===== JSON-LD =====');
  console.log(jsonld.length ? jsonld.map(j => `  ${j.path}  ${j.m}`).join('\n') : '  none');

  // --- rule 7: orphans. A page nobody links to shows up as a missing row in
  // the crawl list above, but only if a human reads the list.
  const orphans = ARTICLES.filter(a => !seen.has(a));
  console.log('\n===== ORPHANED ARTICLES =====');
  console.log(orphans.length ? orphans.map(o => '  unreachable: ' + o).join('\n') : '  none');

  process.exit(dead.length || emdash.length || errors.length || cards.length ||
               canon.length || anchors.length || jsonld.length || orphans.length ? 1 : 0);
})();
