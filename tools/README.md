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

## Checks

### `rules.js` — the two hard rules
```
node rules.js
```
Crawls from the homepage, following internal links, and asserts:

1. **No rendered em-dash anywhere.** Chris's rule is no em-dashes, ever.
   This walks every text node *and* every `::before`/`::after` computed
   `content`, because grep cannot see generated content: an em-dash lived in
   a CSS `content:` declaration for weeks, rendering on every page, and no
   amount of searching the HTML would have found it.
2. **No dead internal link.**

Exits non-zero if either fails. Because it discovers pages by crawling, new
pages are covered the moment they are linked, and a page linked from
*nowhere* shows up as a missing row in the crawl list. `newsletter.html` is
deliberately unreachable, so it never appears and has to be checked by hand.

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
```
Bytes by resource type at the given width, DPR 2, after scrolling the whole
page so lazy images fire. Written after a "70KB" change turned out to add
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
Rewrites the header and footer across all 13 pages that carry them.

**Use this rather than editing them by hand.** There is no include mechanism
here, so those blocks exist as 13 copies, and hand-editing is what caused
the drift that took a while to find: the nav said `managed=04` while every
card grid said `managed=05`.

The channel order lives in the `MARKETING`, `GROWTH` and `TIER` tables at
the top of the file. Change a label or a number there and re-run. Anything
listing channels elsewhere (the two homepage grids, the hub, how-we-help)
has to be updated to match, and a numbering check is worth re-running after.
