# Handover: 18 November 2026

Where the site stands after round 4, how it is set up, and what is waiting on whom.
This file is in `.vercelignore`, so it is never deployed.

---

## Read this first: round 4 is live

| Round | Branch | Live | Content files |
|---|---|---|---|
| 2 | `round-2-2026-11` | 6 November 2026 | `_round2-content/` |
| 3 | worked on `main` | 9 November 2026 (checked 10 November) | `_round3-content/` |
| 4 | `round-4-2026-11` | 18 November 2026 | `_round4-content/` |

Every content folder is in `.gitignore` and `.vercelignore`, so none of them is ever
committed or deployed. Each commit names the task it covers, so `git log` reads as
the change list.

Preview builds sit behind Vercel's login (a 302 to `vercel.com/sso-api`), so open
them while signed in to Vercel. The preview address for a commit comes from:

```
gh api "repos/Killobite2/cl-growth-academy-website/deployments?sha=<sha>" --jq '.[0].id'
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

**Environment variables (Vercel, Production and Preview).** Never write any of these
into a file.

| Variable | Used by | If missing |
|---|---|---|
| `BEEHIIV_API_KEY` | `/api/subscribe` | every signup fails with `not_configured` |
| `BEEHIIV_PUBLICATION_ID` | `/api/subscribe` | same |
| `SLACK_SIGNUP_WEBHOOK_URL` | the owner alert | no alert; the answers still save, and the log says the alert was skipped |

**Forms.**
- Contact page and the "Free growth audit" popup post to Web3Forms
  (`api.web3forms.com/submit`, key in `W3F_KEY` in `js/main.js`). The success state
  only shows once Web3Forms confirms; a failure shows the direct email and phone.
  Honeypot field: `botcheck`. Do not change the contact form's submit handler.
- Every newsletter and resource form posts to `/api/subscribe`. See "Sign-ups and
  `/api/subscribe`" below.
- The resource forms and both forms on `newsletter.html` carry the opt-in line
  ("By signing up, you agree to receive my weekly newsletter and occasional marketing
  emails from CL Growth Academy. Unsubscribe any time. I never share your email.
  Privacy policy"). The footer form and the homepage panel still carry the older
  "We handle your details as set out in our Privacy Policy."

**Tracking.** Google Tag Manager `GTM-KP93RRXS` loads GA4 (`G-YWQ0FQ5T50`). There is
no direct gtag.js on any page: that was counting every visit twice and was removed
on 3 November. The Meta Pixel (`588636164309071`) is on every page. Do not change the
GTM snippet or the Pixel. The scripts in `tools/` block all three, so a test run never
lands in the client's reporting. Site events go to the `dataLayer`; see "GA4 events".

**Privacy policy.** `/privacy.html`, from Chris's approved C09, linked from every
footer and every form. Its "tools we use" list deliberately leaves out Google Ads,
because no Google Ads tag is on the site. **Add Google Ads to that list before a
Google Ads tag goes live.** It is now out of date on sign-ups: see "Open questions
with Chris".

**Blog posts are self-canonical.** Every post canonicalises to its own address on
`thegrowthacademy.com.au`, its `BlogPosting.url` matches, and every post is in
`sitemap.xml`. The old WordPress addresses redirect to the rebuilt posts
(`vercel.json`, with and without the trailing slash), and `/2024/:path*` and
`/2025/:path*` send the old date pages to `/blog.html`.

**Service numbering (round 3).** 01 SEO, 02 Google Ads, 03 Social Media Ads,
04 Email, 05 Social & Content, 06 LinkedIn, 07 Website Design (Marketing);
08 Referrals & Partnerships, 09 Sales & Enquiry Process, 10 Coaching & Workshops
(Growth); + Managed Growth. The site counts "ten services", not channels, because
Website Design and Coaching are not marketing channels. The same numbers appear in
the nav, the hub cards, How We Help, the homepage engine cards and panel, and each
service page's hero eyebrow. Change one, change all of them. Aged Care Marketing
stays out of the numbering, as the last footer link. The in-person workshops page
and the free resources have no number either.

**Menu and footer come from `tools/navfoot.py`.** Run it, never hand-edit them. Every
page with the site header is in its `PAGES` dict (46 pages); a new page must be added
there. `newsletter.html` is the exception: it has its own logo-only header and a
cut-down footer, and is not generated. `navfoot.py` writes LF line endings and the
checkout is CRLF, so after running it `git status` shows every page as changed even
where only line endings differ. Check with `git diff --ignore-cr-at-eol`, and restore
the line-ending-only files before committing. The card grids are edited by hand.

**Links in body copy are underlined site-wide** (paragraphs, list items, table cells,
captions and quotes inside `<main>`). Nav, footer, buttons, cards, breadcrumbs, the
in-page TOC and the homepage engine panel are not. See the rule beside
`.article .prose a` in `css/styles.css`.

---

## Free resources (round 4)

**Pages.**
- `/resources.html`, the hub: ten cards, the "Which resource should I start with?"
  table (each resource name links to its page), one sign-up form, FAQ.
- Ten resource pages under `/resources/`. Nine are gated: the page is open and
  readable, and the PDF comes after sign-up. Block Negative Comments is fully open,
  with three direct download buttons and no form.
- `/resources/thanks.html`, where every sign-up lands: every download link, plus the
  two questions (role, business type). `noindex, follow`; not in the menu, footer,
  sitemap or `llms.txt`.
- "Free resources" is in the top menu (after Blog) and the footer Company column.
- `/resources` and `/resources/` redirect (308) to `/resources.html`, because every
  PDF footer prints "thegrowthacademy.com.au/resources".

**Files.** `/resources/files/` holds the ten PDFs and two CSVs, byte for byte as Chris
supplied them. `vercel.json` sends `X-Robots-Tag: noindex` on the nine gated PDFs,
each named in its own rule so the three open files (the Block Negative Comments PDF
and both CSVs) stay indexable, and serves both CSVs as `text/csv; charset=utf-8`.
`.gitattributes` marks `resources/files/**` as `-text`; without it `core.autocrlf`
would rewrite the CSVs' CRLF line endings and the deployed files would no longer
match the originals. To replace a file, keep its name exactly, or update every link,
the thanks page, the `vercel.json` rule and the GA4 event name.

**Covers.** `/img/resources/<page>.webp` is page 1 of each PDF at 800px wide, plus the
two inline pages (Block Negative Comments page 3, Weekly Meta Ads Report page 5).
Re-render them from the PDF if a PDF changes (PyMuPDF and Pillow did it).

**Layout.** The resource pages use the round 3 service page template. Their styles
are section 32 of `css/styles.css`, all scoped to `resource-` classes, so no older
page renders any differently. Adding a sixth menu item made labels wrap between the
800px hamburger and about 960px, so `css/styles.css` tightens the nav gap in that
band only (the rule above `.nav-links a`).

---

## Sign-ups and `/api/subscribe`

`api/subscribe.js` calls beehiiv server-side, so the API key never reaches a browser.
It answers `{ok:true}` only once beehiiv has confirmed. It takes two kinds of request.

**1. Sign-up** (has an email). Every sign-up form on the site.
- The 11 resource forms (the hub, the nine gated pages, and both forms on
  `newsletter.html`) send a hidden `resource`. For those, a first name is required:
  the browser blocks an empty field, and the function refuses one of only spaces,
  with "Please add your first name." on the form. Allowed `resource` values are
  listed in `RESOURCES` in the function; anything else is refused.
- The footer form and the homepage "Join waitlist" panel send no `resource`. They
  stay email-only and keep their inline success message (Dreau's decision,
  18 November 2026).
- Sent to beehiiv: email, UTM values, referrer, and these custom fields when the form
  collected them:

  | beehiiv custom field | From |
  |---|---|
  | `First Name` | the first name field |
  | `Last Name` | no form collects it any more; the function still passes it on if sent |
  | `resource` | the hidden field: `resources-hub`, a resource page slug, or `newsletter` |
  | `role` | the thanks page |
  | `business_type` | the thanks page |

  The names must match the beehiiv custom fields exactly. **beehiiv does not refuse
  an unknown field name**: it drops the value, still answers 2xx and lists the
  problem under `warnings`. The function logs those warnings as
  `[subscribe] beehiiv warnings …`; that line in the Vercel logs is the only sign of
  a mismatch. This is how names were lost from 11 to 17 November: the function sent
  `first_name` and `last_name`, which beehiiv silently dropped (hotfix `7c0edb0`).
- On success it returns beehiiv's subscription id as `ref`. The browser keeps the
  ref, the first name and the resource in `sessionStorage` (never in an address),
  fires `resource_signup` and goes to `/resources/thanks.html`.

**2. Profile** (has a `ref`, no email). The two questions on the thanks page, shown
only when the tab holds a ref. Saves `role` (Owner, Executive, Marketing, Intake or
enquiries, Other) and `business_type` (NDIS, Aged care, Both) to the subscription.

**Owner alert.** When the role is Owner, the function posts one message to Slack
through `SLACK_SIGNUP_WEBHOOK_URL`: first name, email, role, business type, resource
and the date (Sydney time). Any other role posts nothing. The email is read back from
beehiiv. The first name and resource are also read back from beehiiv (field names
matched loosely), with the values the tab kept from sign-up as the fallback. On the
first preview test the read-back had no first name, so if beehiiv leaves either out,
the log prints `[subscribe] owner alert: beehiiv returned custom fields […]` with the
field names only. A Slack failure never fails the request, because the answers are
already saved.

**Testing it.** A test sign-up creates a real subscriber. Use a `+` address
(`you+test@…`) and delete it in beehiiv afterwards.

---

## GA4 events

All pushed to the `dataLayer`, once per action, for GTM to pick up. **Nothing in GTM
or GA4 is set up for them yet**: each needs a Custom Event trigger and a GA4 event tag
in GTM, and `resource` and `file_name` need registering as custom dimensions in GA4.

| Event | When | Parameter |
|---|---|---|
| `resource_signup` | every confirmed sign-up from a resource form or `newsletter.html` | `resource` |
| `download_` + file name, no extension, hyphens as `_` | every click on a link to that file, on any page | `file_name` (full file name) |

The twelve download events: `download_growth_audit_checklist`,
`download_linkedin_referral_outreach_sop`, `download_ndis_linkedin_playbook`,
`download_ndis_marketing_playbook`, `download_ndis_event_marketing_playbook`,
`download_facebook_groups_playbook`, `download_weekly_meta_ads_report`,
`download_ndis_website_checklist`, `download_enquiry_response_script`,
`download_block_negative_comments_meta`, `download_ndis_comment_block_keywords`,
`download_ndis_comment_block_keywords_block_only`.

The existing `generate_lead` event (contact form and popup) is unchanged.

---

## What round 3 added (9 November 2026)

| Page | |
|---|---|
| `/about.html` | ProfilePage; the Person `url` on every page points here |
| `/ndis-marketing/website-design.html` | service 07 |
| `/ndis-marketing/coaching.html` | service 10 |
| `/blog/how-to-get-ndis-clients.html` | the clients pillar guide |
| `/blog/ndis-facebook-ads-guide.html` | |
| `/blog/ndis-clients-from-hospitals.html` | |

Also in round 3: the service numbering above, with the menu, channel lists, hero
labels and counts moved to ten; new titles and H1s with the ` | ` separator; Google
Ads page and post rewrites; BreadcrumbList JSON-LD on every page; more WordPress
redirects (`/ndis-websites/`, `/ndis-sales-coaching/`, `/2025/`, `/blog`, `/about`);
a second IndexNow key file; and every sitemap entry dated 9 November 2026.

## What round 4 added (18 November 2026)

| Page | Source |
|---|---|
| `/blog/how-to-choose-an-ndis-marketing-agency.html` | R4-01 |
| `/ndis-marketing/in-person-workshops.html` (no number, not in the menu) | R4-04 |
| `/resources.html` and ten resource pages | R4-07 to R4-17 |
| `/resources/thanks.html` | R4-18 |

Also in round 4:
- **Metadata (R4-03).** Social descriptions match the meta descriptions; content-file,
  Chris and approval comments removed from the HTML.
- **Lists (R4-02).** Five sentences became numbered lists.
- **Keyword map (R4-06).** The SEO page retargeted to "NDIS SEO" with no fee figure;
  an NDIS advertising section on the hub; a Referrals FAQ;
  `/ndis-social-media-marketing-services` now redirects to `/ndis-marketing/`.
- **Strategy post (R4-05).** Retitled to the 90-day plan, a new section 04, new
  FAQs, links to the playbook page and the hub, 13 min read.
- **Sitewide fixes (R4-19).** "NDIS SEO" as the link words to the SEO page, the
  "See both engines" button to `/ndis-marketing/`, and breadcrumb level 2 "NDIS
  Growth" in the JSON-LD.
- **Newsletter page.** First name required, last name removed, opt-in line, and a
  confirmed sign-up now goes to `/resources/thanks.html`.
- **Listings.** 45 URLs in `sitemap.xml`, all dated 17 November 2026; a Resources
  section in `llms.txt`.

---

## IndexNow

IndexNow tells Bing (which ChatGPT and Copilot search use) about new and changed
pages as soon as they are live.

- Key: `e340a0118852ac778194143ce1cc7a57`
- Key file: `/e340a0118852ac778194143ce1cc7a57.txt` at the site root, containing only
  the key. A second key file, `/3ebcf21aacfd6cfde95e7199faaa90dc.txt`, was added in
  round 3. Do not delete or rename either.

After each production deploy, run this in PowerShell. It reads the live sitemap and
submits every URL in it:

```powershell
$s=[xml](Invoke-WebRequest 'https://thegrowthacademy.com.au/sitemap.xml' -UseBasicParsing).Content; Invoke-RestMethod -Method Post -Uri 'https://api.indexnow.org/indexnow' -ContentType 'application/json; charset=utf-8' -Body (@{host='thegrowthacademy.com.au'; key='e340a0118852ac778194143ce1cc7a57'; keyLocation='https://thegrowthacademy.com.au/e340a0118852ac778194143ce1cc7a57.txt'; urlList=@($s.urlset.url.loc)} | ConvertTo-Json)
```

Run it only after the deploy is live: IndexNow fetches the key file to check the
submission. Last run 18 November 2026 after round 4: 200 OK, 45 URLs.

---

## To do (Dreau)

- **beehiiv welcome email.** The hub and the thanks page promise "one welcome email
  straight away, with a link to every resource". The site cannot send it: set it up
  in beehiiv with the twelve file links (`https://thegrowthacademy.com.au/resources/files/…`),
  including `ndis-website-checklist`, which R4-16 asks to be added to the welcome email
  logic. Until then the thanks page is the only place a subscriber gets the files.
- **Confirm the owner alert live.** Sign up on a resource page, answer Owner, check
  that Slack shows the first name, and look in the Vercel logs for a
  `[subscribe] owner alert: beehiiv returned custom fields […]` line. If it appears,
  it shows the field names beehiiv actually returns.
- **GTM and GA4.** Triggers and tags for the events above, plus the two custom
  dimensions.
- **Weekly Meta Ads Report page (R4-12).** Open Claude (Connectors, scheduled tasks,
  plan names) and Meta Ads Reporting (Reports, Schedule email) once, and match the
  menu names on the page and in the PDF to what they show.
- **`signup-website-chris`.** The rule below says `newsletter.html` changes are
  mirrored there, but round 4's are not: the form now sends a `resource` and goes to
  `/resources/thanks.html`, which only exists on this site. Decide what that page
  should do (send people to this site's thanks page, or stay as it is) before copying
  anything across.
- **Names lost before 17 November.** Subscribers who gave a name between
  11 and 17 November 2026 are in beehiiv without one. They cannot be recovered from
  the site.

## Open questions with Chris

Raised in round 4. Dreau is checking with Chris (18 November 2026); nothing below has
been changed.

- **Privacy policy.** It says the newsletter collects your name "if you give it". The
  first name is now required on resource forms, and the site also stores resource,
  role and business type, and sends owner sign-ups to Slack.
- **Homepage "Join waitlist" panel.** It still offers "early access to the library
  when it launches". The library has launched.
- **Newsletter pop-up** still appears on the resource pages and the thanks page.
- **Footer form and homepage panel** keep the older privacy line, not the opt-in line,
  and stay email-only.
- **"$" figures** on 14 pages. Carried over from "Whether the published rates should
  be public": the Google Ads, social ads and hub pages, Referrals, seven posts (Google
  Ads, social media, virtual assistants, VA vs AI, how to get NDIS clients, key areas,
  Facebook ads guide), and new in round 4 the agency post ($1,000 a month; $30 to $50 a day), the Marketing
  Playbook page ($70 and $20 an hour, $50,400, $14,400, $720 to $1,440) and the
  Weekly Meta Ads Report example week ($600, $50, $150). The SEO page has none.
- **Lead magnets not built yet**, so their lines were left out: the NDIS advertising
  compliance checklist (hub), the hospital team referral pack (Referrals) and the
  90-day plan template (strategy post).
- **In-person workshops hero photo.** `chris-presenting-room-2025-02-02.jpg` is not in
  `img/`, so the page has a text-only hero.
- **Links to the agency post.** It has one internal link (its blog card). Candidates:
  the homepage FAQ "How do I choose an NDIS marketing agency?" and the Managed Growth
  sentence "This is the difference between an agency running a set-and-forget
  campaign and a growth partner…".
- **Leftover links to `ndis-marketing/index.html`.** The "NDIS Growth" breadcrumb on
  the 11 service pages and the footer "NDIS Growth" link (both still work).
- **Aged care page** (do-not-change in round 4). It has an "SEO"-only link to the SEO
  page and a source comment naming C02 and Chris.
- **FAQ text out of step with its JSON-LD**, live since before round 4: the Google Ads
  post, the SEO post and Marketing for business growth.
- **Breadcrumb level 3** reads differently from the JSON-LD on six service pages (for
  example "Coaching & Workshops" against "NDIS Business Coaching and Workshops").
- **CSS and JS comments** in `css/styles.css` and `js/main.js` still name Chris and
  R3-10. Round 4 only cleaned HTML comments.

Carried over from round 2:
- **Photos the round 2 content asks for that do not exist in `img/`.** None of them
  has an empty placeholder on the site: Chris on a video call with a VA (C04, C05); a
  care worker with an older client at home, with written consent (C02); Chris running
  a LinkedIn session (C03); the Support at Home price page mock-up (C02); the Loom
  library and AI settings screenshots (C04, C05).
- **Longer copy for Referrals and Sales Process.** Longer versions need Chris's
  words, not invented ones.

---

## Defaults set at go-live, 6 November 2026

Chris had not answered these, so Dreau set defaults. The first two were overtaken by
round 3's ten-service numbering and are kept here as history:

- **Aged care is in the footer only**, in every page's Services list, not the NDIS
  Growth nav. Still true.
- ~~The site says "eight channels"~~: now "ten services" (round 3).
- ~~The homepage shows six marketing channels~~: now the 01 to 10 engine cards
  (round 3).
- **C04's `datePublished` is 2024-02-01.** The content file only had "2024-02".

## Done since go-live

- **The privacy line on `newsletter.html` is mirrored into `signup-website-chris`.**
  Live 6 November 2026, commit `2d61b49` in that repo. The same commit also removed
  "Sydney" there and fixed the logo and footer links. Round 4's newsletter changes
  are not mirrored (see "To do").

---

## Decided, do not revisit without a reason

- **No stock imagery, anywhere.** Pages use real event photographs from `img/`, PDF
  covers, and hand-drawn brand SVGs in `img/blog/` (shapes and text only, no people).
  The homepage says "Not stock photography" out loud, and the posts tell providers
  to ditch stock photos.
- **URLs stay under `/ndis-marketing/`** even though the section is labelled "NDIS
  Growth". "NDIS marketing" is the hub page's own primary search term.
- **"We meet regularly, you execute, we refine" keeps its "we".** It is genuinely
  Chris and the client. Everything else on the site is first person singular.
- **The Chris whiteboard photo keeps its tight crop.** The source has two other
  people in the room who have not agreed to appear on the site.
- **First name is required only on forms that name a resource** (18 November 2026),
  so the footer and homepage forms keep working email-only.
- **The subscriber ref, name and resource never go in an address.** They ride in
  `sessionStorage` from the sign-up to the thanks page.

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
`rules.js` sometimes fails once with `ERR_CONNECTION_REFUSED` on the first page; run
it again. It only checks the pages in its own lists, which predate round 4, and the
lists in `spacing.js` and `tools/README.md` are behind too. In Git Bash, prefix any
command that passes a `/path` argument with `MSYS_NO_PATHCONV=1`, or Git Bash rewrites
it into a Windows path.

`python -m http.server` cannot run `/api/subscribe`. To test the forms locally,
serve the site with a small Node server that calls `api/subscribe.js` with beehiiv
and Slack stubbed. That is how round 4 was tested: all 12 forms, the first-name
checks, the thanks page with and without a ref, Owner against other roles, and every
download event.

Two habits worth keeping. **`compare.js` earns its place**: rendering both builds
side by side has caught copy bugs that every automated check passed clean. And
**never trust a push**: byte-compare a live asset against `git show <sha>:<path>`
before saying a change is live.
