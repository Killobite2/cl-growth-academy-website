// Page weight, by resource type.
//
// Tracking is blocked like everywhere else, which DOES change the number: the
// GTM container and GA4 together are roughly 900 KB on a cold load. So this
// measures what the site itself ships, not what a first-time visitor
// downloads. That is the more useful figure for judging our own work, and the
// only one that does not cost a fake pageview to obtain. For the real-world
// total, run with ALLOW_TRACKERS=1 and know that it reports to GA4.
const { chromium } = require('playwright-core');
const notrack = require('./notrack');
(async () => {
  const w = parseInt(process.argv[2]||'360',10);
  const b = await chromium.launch({ channel:'msedge' });
  const c = await b.newContext({ viewport:{width:w,height:800}, isMobile:w<700, hasTouch:w<700, deviceScaleFactor:2 });
  const tracking = notrack.collector();
  await tracking.block(c);
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
  console.log(`  ${'TOTAL'.padEnd(12)} ${(tot/1024).toFixed(0)} KB   @ ${w}px, DPR2  (first-party only)`);
  await b.close();
  tracking.report();
})();
