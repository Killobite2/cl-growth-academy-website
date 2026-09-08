const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ channel:'msedge' });
  for (const p0 of ['/index.html', '/newsletter.html']) {
    const c = await b.newContext({ viewport:{width:1280,height:900} });
    const p = await c.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(String(e)));
    await p.goto('http://localhost:3000' + p0, { waitUntil:'networkidle' });
    if (p0 === '/index.html') {
      await p.evaluate(() => [...document.querySelectorAll('a.btn')]
        .find(x => /contact\.html$/.test(x.getAttribute('href')||'')).click());
      await p.waitForTimeout(700);
    }
    const r = await p.evaluate(() => {
      const EM = '—';
      const out = [];
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n; while ((n = walk.nextNode())) {
        if (n.nodeValue.includes(EM) && n.parentElement &&
            !['SCRIPT','STYLE'].includes(n.parentElement.tagName))
          out.push(n.nodeValue.trim().slice(0,60));
      }
      document.querySelectorAll('*').forEach(el => ['::before','::after'].forEach(ps => {
        const cc = getComputedStyle(el, ps).content;
        if (cc && cc.includes(EM)) out.push(`${el.tagName.toLowerCase()}.${el.className}${ps} = ${cc}`);
      }));
      const d = document.querySelector('dialog.consult');
      return { emdash: out,
               dialogOpen: !!(d && d.open),
               eyebrow: d ? d.querySelector('.eyebrow').textContent : null,
               sub: d ? d.querySelector('.consult-sub').textContent : null,
               bullets: d ? [...d.querySelectorAll('.consult-visual-points li')]
                              .map(li => getComputedStyle(li,'::before').content) : null };
    });
    console.log(`${p0}: em-dashes=${r.emdash.length ? JSON.stringify(r.emdash) : 'none'}  jsErrors=${errs.length||'none'}`);
    if (r.dialogOpen) {
      console.log(`  dialog eyebrow: "${r.eyebrow}"`);
      console.log(`  dialog sub:     "${r.sub}"`);
      console.log(`  bullet content: ${JSON.stringify(r.bullets)}`);
    }
    await c.close();
  }
  await b.close();
})();
