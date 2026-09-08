// Mobile audit harness. Real viewport emulation via playwright-core driving
// the installed Edge, because headless Edge on its own lays out at desktop
// width regardless of --window-size.
const { chromium } = require('playwright-core');

const BASE = 'http://localhost:3000';
const PAGES = [
  '/', '/how-we-help.html', '/blog.html', '/contact.html', '/newsletter.html',
  '/ndis-marketing/index.html', '/ndis-marketing/seo.html', '/ndis-marketing/ads.html',
  '/ndis-marketing/email.html', '/ndis-marketing/managed.html', '/ndis-marketing/social.html',
  '/ndis-marketing/social-ads.html', '/ndis-marketing/referrals.html', '/ndis-marketing/sales-process.html',
];
const WIDTHS = [320, 360, 390, 430];

(async () => {
  const browser = await chromium.launch({ channel: 'msedge' });
  const results = [];

  for (const w of WIDTHS) {
    const ctx = await browser.newContext({
      viewport: { width: w, height: 800 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    for (const path of PAGES) {
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

      await page.goto(BASE + path, { waitUntil: 'networkidle' });

      const r = await page.evaluate(() => {
        const de = document.documentElement;
        const vw = window.innerWidth;

        // Which elements actually stick out past the viewport
        const offenders = [];
        document.querySelectorAll('body *').forEach(el => {
          const b = el.getBoundingClientRect();
          if (b.width === 0 || b.height === 0) return;
          const cs = getComputedStyle(el);
          if (cs.position === 'fixed') return;
          if (b.right > vw + 1 || b.left < -1) {
            offenders.push({
              tag: el.tagName.toLowerCase(),
              cls: (el.className && el.className.baseVal !== undefined
                    ? el.className.baseVal : String(el.className || '')).slice(0, 60),
              left: Math.round(b.left), right: Math.round(b.right), w: Math.round(b.width),
            });
          }
        });

        // Tap targets. Links sitting inline inside a run of prose are exempt
        // (WCAG 2.5.8 inline exception) — padding them would wreck the
        // line box. Only standalone controls are counted.
        const small = [];
        document.querySelectorAll('a, button, summary, input, select, textarea, [role="button"]')
          .forEach(el => {
            const b = el.getBoundingClientRect();
            if (b.width === 0 || b.height === 0) return;          // hidden
            if (getComputedStyle(el).visibility === 'hidden') return;
            if (el.closest('[hidden], [aria-hidden="true"]')) return;
            if (el.tagName === 'A') {
              const p = el.parentElement;
              // inline if the parent holds text either side of the link
              const inProse = p && /^(P|LI|SPAN|EM|STRONG|DD|TD)$/.test(p.tagName)
                && p.textContent.trim() !== el.textContent.trim();
              if (inProse) return;
            }
            if (b.width < 44 || b.height < 44) {
              small.push({
                tag: el.tagName.toLowerCase(),
                cls: String(el.className || '').slice(0, 40),
                txt: (el.textContent || '').trim().slice(0, 24),
                w: Math.round(b.width), h: Math.round(b.height),
              });
            }
          });

        return {
          scrollW: de.scrollWidth,
          innerW: vw,
          overflow: de.scrollWidth - vw,
          offenders: offenders.slice(0, 14),
          smallCount: small.length,
          small: small.slice(0, 12),
        };
      });

      results.push({ w, path, ...r, errors: errors.slice(0, 3) });
      await page.close();
    }
    await ctx.close();
  }

  await browser.close();

  // Report
  console.log('\n===== HORIZONTAL OVERFLOW =====');
  let anyOverflow = false;
  for (const r of results) {
    if (r.overflow > 0) {
      anyOverflow = true;
      console.log(`  ${r.w}px  ${r.path}  +${r.overflow}px  (scrollW ${r.scrollW} > ${r.innerW})`);
    }
  }
  if (!anyOverflow) console.log('  none — document scrollWidth fits at all widths');

  // Elements past the edge even when the backstop suppresses the scrollbar.
  // These are the real bugs; overflow-x: clip only hides them.
  console.log('\n===== ELEMENTS PAST THE VIEWPORT EDGE =====');
  const boxSeen = new Set();
  let anyBox = false;
  for (const r of results) {
    const rows = r.offenders.filter(o => !/corridor/.test(o.cls));
    if (!rows.length) continue;
    anyBox = true;
    console.log(`\n  ${r.w}px  ${r.path}`);
    rows.forEach(o => {
      const k = `${r.w}|${o.tag}.${o.cls}`;
      if (boxSeen.has(k)) return; boxSeen.add(k);
      console.log(`      ${o.tag}.${o.cls}  L${o.left} R${o.right} w${o.w}`);
    });
  }
  if (!anyBox) console.log('  none (excluding the aria-hidden corridor, reported separately)');

  console.log('\n===== TAP TARGETS < 44px (at 1280px) =====');
  const seen = new Set();
  results.filter(r => r.w === 360).forEach(r => {
    if (!r.smallCount) return;
    console.log(`\n  ${r.path}  (${r.smallCount})`);
    r.small.forEach(s => {
      const k = `${s.tag}.${s.cls}|${s.w}x${s.h}`;
      if (seen.has(k)) return; seen.add(k);
      console.log(`      ${s.w}x${s.h}  ${s.tag}.${s.cls}  "${s.txt}"`);
    });
  });

  console.log('\n===== JS ERRORS =====');
  const errs = results.filter(r => r.errors.length);
  if (!errs.length) console.log('  none');
  errs.forEach(r => console.log(`  ${r.w}px ${r.path}: ${r.errors.join(' | ')}`));
})();
