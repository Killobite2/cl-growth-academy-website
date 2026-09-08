// Two hard rules, checked in a real browser rather than by grep:
//   1. no rendered em-dash anywhere, including ::before/::after content
//   2. no dead internal link
const { chromium } = require('playwright-core');

const BASE = process.env.BASE || 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch({ channel: 'msedge' });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  // Crawl from the homepage so new pages are discovered automatically
  const seen = new Set(['/index.html']);
  const queue = ['/index.html'];
  const dead = [];
  const emdash = [];
  const errors = [];

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

  process.exit(dead.length || emdash.length || errors.length ? 1 : 0);
})();
