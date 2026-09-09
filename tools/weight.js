const { chromium } = require('playwright-core');
(async () => {
  const w = parseInt(process.argv[2]||'360',10);
  const b = await chromium.launch({ channel:'msedge' });
  const c = await b.newContext({ viewport:{width:w,height:800}, isMobile:w<700, hasTouch:w<700, deviceScaleFactor:2 });
  const p = await c.newPage();
  const by = {};
  p.on('response', async r => {
    const u = r.url(); const t = r.request().resourceType();
    try { const buf = await r.body(); by[t] = (by[t]||0) + buf.length; } catch(e){}
  });
  // Path is an argument now: the whole point of this script is measuring a
  // specific page, and it could only ever measure the homepage.
  const path = process.argv[3] || '/';
  await p.goto('http://localhost:3000' + path, { waitUntil:'networkidle' });
  // scroll the whole page so lazy images fire
  await p.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y); await new Promise(r => setTimeout(r, 90));
    }
  });
  await p.waitForTimeout(2500);
  let tot = 0;
  Object.entries(by).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => { tot+=v; console.log(`  ${k.padEnd(12)} ${(v/1024).toFixed(0)} KB`); });
  console.log(`  ${'TOTAL'.padEnd(12)} ${(tot/1024).toFixed(0)} KB   @ ${w}px, DPR2`);
  await b.close();
})();
