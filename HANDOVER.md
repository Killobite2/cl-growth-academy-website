# Handover: 6 November 2026

Where the site stands after round 2, how it is set up, and what is waiting on whom.
This file is in `.vercelignore`, so it is never deployed.

---

## Read this first: round 2 is live

Round 2 was built on `round-2-2026-11` and merged into `main` on 6 November 2026.
Each commit names the task it covers, so `git log` reads as the change list.

Preview builds sit behind Vercel's login (a 302 to `vercel.com/sso-api`), so open
them while signed in to Vercel. The preview address for a commit comes from:

```
gh api repos/Killobite2/cl-growth-academy-website/deployments --jq '.[0] | {id, sha}'
gh api repos/Killobite2/cl-growth-academy-website/deployments/<id>/statuses --jq '.[0].environment_url'
```

After any production deploy, run the IndexNow command below.

---

## How the site is set up

**Hosting.** Static HTML on Vercel, project `cl-growth-academy-website`, Git-connected:
a push to `main` deploys to production in seconds, any other branch gets a preview.
`thegrowthacademy.com.au` points at Vercel (`216.198.79.1`) since 20 October 2026. DNS
is hosted at SiteGround (GoDaddy is only the registrar); keep the SiteGround account
for that reason. Mail is Google Workspace and was not touched.

**Email domain.** Use `chris@thegrowthacademy.com.au`. `clgrowthacademy.com.au` has no
MX records and mail to it bounces. There is a note in `js/main.js` saying so.

**Forms.**
- Contact page and the "Free growth audit" popup post to Web3Forms
  (`api.web3forms.com/submit`, key in `W3F_KEY` in `js/main.js`). The success state
  only shows once Web3Forms confirms; a failure shows the direct email and phone.
  Honeypot field: `botcheck`.
- Every newsletter form posts to `/api/subscribe` (`api/subscribe.js`), which calls
  beehiiv server-side so the API key never reaches a browser. `BEEHIIV_API_KEY` and
  `BEEHIIV_PUBLICATION_ID` are Vercel environment variables.
- Every form carries "We handle your details as set out in our Privacy Policy."

**Tracking.** Google Tag Manager `GTM-KP93RRXS` loads GA4 (`G-YWQ0FQ5T50`). There is
no direct gtag.js on any page: that was counting every visit twice and was removed
on 3 November. The Meta Pixel (`588636164309071`) is on every page. The scripts in
`tools/` block all three, so a test run never lands in the client's reporting.

**Privacy policy.** `/privacy.html`, from Chris's approved C09, linked from every
footer and every form. Its "tools we use" list deliberately leaves out Google Ads,
because no Google Ads tag is on the site. **Add Google Ads to that list before a
Google Ads tag goes live.**

**Blog posts are self-canonical.** Every post canonicalises to its own address on
`thegrowthacademy.com.au`, its `BlogPosting.url` matches, and every post is in
`sitemap.xml`. The old WordPress addresses redirect to the rebuilt posts
(`vercel.json`, with and without the trailing slash), and `/2024/:path*` sends the
old date pages to `/blog.html`. This replaces the earlier setup, where four posts
canonicalised to the WordPress copies and were kept out of the sitemap.

**Channel numbering.** 01 SEO, 02 Google Ads, 03 Social Media Ads, 04 Email,
05 Social & Content, 06 LinkedIn (Marketing); 07 Referrals, 08 Sales & Enquiry
Process (Growth). The same numbers appear in the nav, the hub cards, How We Help,
the homepage engine panel and each service page's hero eyebrow. Change one, change
all of them.

**Links in body copy are underlined site-wide** (paragraphs, list items, table cells,
captions and quotes inside `<main>`). Nav, footer, buttons, cards, breadcrumbs, the
in-page TOC and the homepage engine panel are not. See the rule beside
`.article .prose a` in `css/styles.css`.

---

## What round 2 added

| Page | Source |
|---|---|
| `/privacy.html` | C09 |
| `/aged-care-marketing.html` | C02 |
| `/blog/grow-your-business-with-virtual-assistants.html` | C04 |
| `/blog/virtual-assistant-vs-ai.html` | C05 |
| `/blog/key-areas-for-business-growth.html` | C07 |
| `/blog/founder-issues-impacting-your-business-growth.html` | C08 |

Also in round 2:
- **Copy changes.** The homepage and hub ranking changes from C10, the approved
  C03 and C06 copy applied to the live LinkedIn page and social media post, and
  "Sydney" removed everywhere ("NSW-based, working with providers Australia-wide";
  the JSON-LD address is NSW 2261 with no locality).
- **Structure.** The "Still over on thegrowthacademy.com.au" band removed from the
  blog, and one in-text link from each service page to the hub and from each post to
  the homepage.
- **Listings.** `sitemap.xml` and `llms.txt` updated, and every sitemap entry dated
  5 November 2026.

The content files live in `_round2-content/`, which is in `.gitignore` and
`.vercelignore`.

---

## IndexNow

IndexNow tells Bing (which ChatGPT and Copilot search use) about new and changed
pages as soon as they are live.

- Key: `e340a0118852ac778194143ce1cc7a57`
- Key file: `/e340a0118852ac778194143ce1cc7a57.txt` at the site root, containing only
  the key. Do not delete or rename it.

After each production deploy, run this in PowerShell. It reads the live sitemap and
submits every URL in it:

```powershell
$s=[xml](Invoke-WebRequest 'https://thegrowthacademy.com.au/sitemap.xml' -UseBasicParsing).Content; Invoke-RestMethod -Method Post -Uri 'https://api.indexnow.org/indexnow' -ContentType 'application/json; charset=utf-8' -Body (@{host='thegrowthacademy.com.au'; key='e340a0118852ac778194143ce1cc7a57'; keyLocation='https://thegrowthacademy.com.au/e340a0118852ac778194143ce1cc7a57.txt'; urlList=@($s.urlset.url.loc)} | ConvertTo-Json)
```

Run it only after the deploy is live: IndexNow fetches the key file to check the
submission.

---

## Defaults set at go-live, 6 November 2026

Chris had not answered these, so Dreau set defaults that Chris can change later:

- **Aged care is in the footer only**, in every page's Services list, not the NDIS
  Growth nav.
- **The site says "eight channels"** everywhere it used to say seven: the hub (meta,
  `og:` and `twitter:` descriptions, hero intro, "I run all eight", "needs all
  eight"), How We Help, `llms.txt`, and the Google Ads, SEO and NDIS digital
  marketing posts.
- **The homepage shows six marketing channels**: "How you get found" says "Six
  channels" and carries a LinkedIn card at 06, as two rows of three (`grid-3`).
- **C04's `datePublished` is 2024-02-01.** The content file only had "2024-02".

## Done since go-live

- **The privacy line on `newsletter.html` is mirrored into `signup-website-chris`.**
  Live 6 November 2026, commit `2d61b49` in that repo. The same commit also removed
  "Sydney" there and fixed the logo and footer links.

## Waiting on Chris

- **Photos the round 2 content asks for that do not exist in `img/`.** None of them
  has an empty placeholder on the site:
  - Chris on a video call with a VA (C04, C05)
  - a care worker with an older client at home, with written consent (C02)
  - Chris running a LinkedIn session (C03)
  - the Support at Home price page mock-up (C02)
  - the Loom library and AI settings screenshots (C04, C05)
- **Whether the published rates should be public** (carried over from September).
  The service pages still show real numbers, for example `$1,500 to $3,000` a month
  ad spend. They are Chris's own figures, but once live they are a rate card competitors
  can read.
- **Longer copy for Referrals and Sales Process** (carried over from September; not
  rechecked in round 2). Longer versions need Chris's words, not invented ones.

---

## Decided, do not revisit without a reason

- **No stock imagery, anywhere.** Pages use real event photographs from `img/` and
  hand-drawn brand SVGs in `img/blog/` (shapes and text only, no people). The
  homepage says "Not stock photography" out loud, and the posts tell providers to
  ditch stock photos.
- **URLs stay under `/ndis-marketing/`** even though the section is labelled "NDIS
  Growth". "NDIS marketing" is the hub page's own primary search term.
- **"We meet regularly, you execute, we refine" keeps its "we".** It is genuinely
  Chris and the client. Everything else on the site is first person singular.
- **The Chris whiteboard photo keeps its tight crop.** The source has two other
  people in the room who have not agreed to appear on the site.

---

## The repos

| Repo | Deploys to | Note |
|---|---|---|
| `cl-growth-academy-website` | `thegrowthacademy.com.au` | the site |
| `signup-website-chris` | `signup-website-chris.vercel.app` | the standalone newsletter page, Git-connected |
| `website-sign-up` | nothing | **superseded**, older copy of the same page, no Vercel project |
| `Chris-Website1.0` | nothing live | a separate older copy; not the site |

`newsletter.html` exists in the first three. A change to it needs mirroring into
`signup-website-chris`, where only that repo's `canonical` and `og:url` differ. The
shared files are straight copies, not trimmed: trimming them is what left
`website-sign-up` with eight classes live and no CSS behind them.

## Checks before pushing

`tools/` holds them, and `tools/README.md` explains each. From the repo root with
`python -m http.server 3000` running:

```
cd tools && npm install playwright-core   # first time only
node rules.js     # no rendered em-dash, no dead link, valid JSON-LD. Must exit 0.
node audit.js     # overflow + tap targets, four phone widths
node dlgcheck.js  # the consult dialog, which no crawler reaches
node compare.js   # live vs local, side by side
```

`rules.js` and the others take `BASE=https://…` to run against production instead.
In Git Bash, prefix any command that passes a `/path` argument with
`MSYS_NO_PATHCONV=1`, or Git Bash rewrites it into a Windows path.

Two habits worth keeping. **`compare.js` earns its place**: rendering both builds
side by side has caught copy bugs that every automated check passed clean. And
**never trust a push**: byte-compare a live asset against `git show <sha>:<path>`
before saying a change is live.
