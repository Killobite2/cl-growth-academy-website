# tools

Checks and generators for this site. Not part of the deployed output:
`tools/` is in `.vercelignore`, and nothing in `css/`, `js/` or the pages
references anything here.

These exist because this repo has no build step and no test suite, so the
things that break tend to break silently. Each script below was written for
a bug that had already shipped.

## Setup

Needs Node and the browser you already have. `playwright-core` drives the
installed Chrome/Edge rather than downloading its own:

```
cd tools
npm install playwright-core
```

Then serve the site from the repo root in another terminal:

```
python3 -m http.server 3000
```

Every script assumes `http://localhost:3000`.

`compare.js` also hits the live deployment, so it needs network.

> **On macOS:** the scripts launch `{ channel: 'msedge' }`. If Edge is not
> installed, change that to `'chrome'` in each file.

---

## `notrack.js` — tracking is blocked in every run

Every script here drives a real browser against a real build, so for months
every run loaded the real GTM container and fired real hits into the live GA4
property. `rules.js` crawls all twenty pages; `audit.js` loads seventy-two.
That traffic sat in the client's reporting looking exactly like visitors, and
`compare.js` made it worse by doing it on the production domain.

Each script now blocks Google Tag Manager, Google Analytics and the Meta Pixel
and says so at the end of its output:

```
===== THIRD-PARTY TRACKING =====
  blocked 40 request(s):
      20x  connect.facebook.net
      20x  www.googletagmanager.com
```

Adding a script? Two lines:

```js
const notrack = require('./notrack');
const tracking = notrack.collector();   // once per run
await tracking.block(ctx);              // once per BrowserContext
...
tracking.report();                      // prints; returns the escape count
```

**No globs.** The previous attempt at this was `'**/googletagmanager.com/**'`,
which never matched anything, because a glob path segment wants a slash before
the host and the URL is `www.googletagmanager.com` — a dot. The handler never
ran, the real container loaded every time, and the run still printed `ok`: a
route that matches nothing looks identical to a route with nothing to match.
Hosts are compared by parsing the URL and checking the hostname, which a
subdomain or query string cannot fool.

**It reports escapes, and they fail the run.** Any response from a tracker host
that did not come from the stub is counted and printed. That check is the part
that would have caught the bug above on day one, instead of months later.

Run the matcher's own self-test after touching the host list:

```
node notrack.js
```

It asserts twenty-two URLs, including the ones the old glob missed and the
lookalike hosts (`googletagmanager.com.evil.test`) that must stay allowed.
`facebook.com` is deliberately *not* blocked wholesale, only `/tr` — a link to
a Facebook page is content, not tracking.

`ALLOW_TRACKERS=1` turns the blocking off for a run that genuinely needs the
real thing. It prints a loud warning, because that run reports to GA4.

---

## Checks

### `rules.js` — the hard rules
```
node rules.js
BASE=https://thegrowthacademy.com.au node rules.js
```
Crawls from the homepage, following internal links, and asserts:

1. **No rendered em-dash anywhere.** Chris's rule is no em-dashes, ever.
   This walks every text node *and* every `::before`/`::after` computed
   `content`, because grep cannot see generated content: an em-dash lived in
   a CSS `content:` declaration for weeks, rendering on every page, and no
   amount of searching the HTML would have found it.
2. **No dead internal link.**
3. **No console error or uncaught exception** on any crawled page.
4. **Card markup matches where the card points.** An internal `.post-card`
   must not carry `is-external`, `target="_blank"` or an `.sr-only` new-tab
   announcement; an off-site one must carry all four. A half-converted card
   is how the four blog cards went wrong once already.
5. **Canonicals are off-domain only on the four article pages**, and `og:url`
   is ours everywhere. See the blog note in `HANDOVER.md` for why.
6. **Every `#anchor` resolves.** The crawler filters `#` links out of the
   queue, so without this a broken contents-list anchor is invisible, and
   each article ships seven of them.
7. **Every JSON-LD block parses**, which catches a stray comma in a sixty-line
   block that nothing else here can see.
8. **None of the four article pages is orphaned** from the crawl.

Exits non-zero if any of them fails.

Note what it cannot see: the link collector drops absolute URLs, which is why
the off-domain canonicals need no allowlist, and equally why a dead link to
thegrowthacademy.com.au will not be caught. Check those with `curl` by hand. Because it discovers pages by crawling, new
pages are covered the moment they are linked, and a page linked from
*nowhere* shows up as a missing row in the crawl list. `newsletter.html` is
deliberately unreachable, so it never appears and has to be checked by hand.

### `spacing.js` — vertical gaps between blocks
```
node spacing.js
BASE=https://thegrowthacademy.com.au node spacing.js
```
Walks the direct children of every `.wrap`, `.prose`, `.channel-row > div`,
`.channel-note`, `.card` and `.article-toc`, and measures the gap between each
stacked pair. Fails under 8px; reports 8 to 19px as "tight" without failing, so
the deliberate 16px cases (`.note` owns that) stay visible but do not block.
Runs at 1280px and 390px.

Written after body copy shipped touching the top border of the card below it on
**all eight** channel pages. Nothing else here looks at vertical geometry, and
`compare.js` did not cover the channel pages at all, which is why it went out.

The cause is structural and worth knowing before adding a component: this site
puts the gap on the **following** element's `margin-top`, and `.section-head` is
the only thing that owns a `margin-bottom`. A block with no top margin
therefore only looks right when a `.section-head` happens to sit above it.

Two things it has to do, both learned by getting them wrong first:

- **Force every `.reveal` to `.is-visible` and wait before measuring.** An
  unrevealed element sits at `translateY(18px)`, which reads as a gap 18px
  smaller than the truth. That invented a phantom `-2px` overlap on four pages
  *and* hid a real 0px gap on the pair below it.
- **Skip pairs that are side by side.** Two columns of a grid are siblings
  whose boxes overlap vertically on purpose; the article hero's copy and its
  photograph "overlap" by 293px and that is correct. Pairs whose horizontal
  ranges overlap by less than half the narrower box are not stacked.

### `audit.js` — mobile layout
```
node audit.js
```
Real device-width emulation at 320/360/390/430px. Reports:

- horizontal overflow, **per element**, not just `document.scrollWidth` —
  `overflow-x: clip` on `html, body` hides document-level overflow, so the
  document metric now always passes and tells you nothing
- tap targets under 44x44, skipping links inline in prose (WCAG 2.5.8's
  inline exception; padding those wrecks the line box)
- console errors

Elements inside an `overflow: hidden` parent still get reported. The logo
marquee always shows up here and is a false positive.

### `weight.js` — page weight
```
node weight.js 360
node weight.js 360 /blog/marketing-for-business-growth.html
```
Bytes by resource type at the given width, DPR 2, after scrolling the whole
page so lazy images fire. Second argument is the path, defaulting to the
homepage.

The total is **first-party only**, because tracking is blocked like everywhere
else, and that does change the number: GTM and GA4 together are roughly 900KB
on a cold load, against 988KB for the whole homepage. This measures what the
site itself ships, which is the figure to judge our own work by and the only
one that does not cost a fake pageview to obtain. For what a first-time
visitor actually downloads, run with `ALLOW_TRACKERS=1`.

**In Git Bash, export `MSYS_NO_PATHCONV=1` first.** A bare leading `/` gets
rewritten into a Windows path, and the error you get back is a confusing
`Cannot navigate to invalid URL` on `http://localhost:3000C:/Program Files/Git/`. Written after a "70KB" change turned out to add
176KB, because a portrait card fed landscape sources downloads the whole
frame and throws away the crop.

### `dlgcheck.js` — the consult dialog
```
node dlgcheck.js
```
The dialog is built in JS and opened by a delegated click, so no crawler
reaches it. This opens it and checks its copy and its bullet glyphs.

### `compare.js` — live vs local
```
node compare.js
```
Screenshots the same pages from the live deployment and from localhost, at
desktop and phone width, with animations paused so the two are comparable.
Writes `cmp-<page>-<width>-{live,new}.png`.

Worth running before any large push. It caught three copy bugs that every
automated check above passed clean: two section headings that disagreed with
each other, and a card stranded on its own grid row.

---

## Generators

### `navfoot.py` — the nav and the footer
```
python3 navfoot.py
```
Rewrites the header and footer across every page that carries them, and
prints the count from `len(PAGES)` rather than a hardcoded number, which is
exactly the kind of thing that had gone stale before.

**Use this rather than editing them by hand.** There is no include mechanism
here, so those blocks exist as one copy per page, and hand-editing is what caused
the drift that took a while to find: the nav said `managed=04` while every
card grid said `managed=05`.

The channel order lives in the `MARKETING`, `GROWTH` and `TIER` tables at
the top of the file. Change a label or a number there and re-run. Anything
listing channels elsewhere (the two homepage grids, the hub, how-we-help)
has to be updated to match, and a numbering check is worth re-running after.


### `faqschema.py` — FAQPage JSON-LD
```
python3 faqschema.py
```
Regenerates the `FAQPage` node on every page that carries a disclosure-style
FAQ, reading the questions and answers out of that page's own markup so the
schema cannot drift away from what a visitor reads. It replaces any existing
`FAQPage` node rather than appending a second one, so re-running is safe.

Run it after editing any FAQ copy.

The four article pages under `blog/` are deliberately excluded: their
`FAQPage` `@id` has to sit on the off-domain canonical rather than on our own
URL, so those are written by hand. See the note in `HANDOVER.md`.
