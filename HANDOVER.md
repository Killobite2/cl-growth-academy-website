# Handover — 8 September 2026

Where the site stands, what is decided, and what is waiting on whom.

---

## Read this first: two things need a decision

### 1. This commit is on the wrong branch

`wire-up-lead-forms` was created off `main` at `f3ef7e3` and left checked out, so
commit `4bb913d` ("Third pass on the feedback doc, and a dead email address") landed
there rather than on `main`. Nothing is lost and nothing is pushed.

| | |
|---|---|
| `main` | `f3ef7e3` — this is what is live |
| `wire-up-lead-forms` | `f3ef7e3` + one commit, local only, not on GitHub |

**Decide:** merge it to `main` and push (it deploys in about 15 seconds), or push the
branch and review it alongside the lead-form work the branch name suggests.

```
# option A — ship it
git checkout main && git merge wire-up-lead-forms && git push origin main

# option B — keep it separate
git push -u origin wire-up-lead-forms
```

### 2. `chris@clgrowthacademy.com.au` does not work

`clgrowthacademy.com.au` has **no MX records** and resolves to `fe80::1`, a
link-local address. Mail to that domain bounces. `thegrowthacademy.com.au` has five
Google Workspace MX records and works.

Commit `4bb913d` moved all 33 contact points to `@thegrowthacademy.com.au`. Until
`clgrowthacademy.com.au` has working mail, **do not switch back** — there is a note
in `js/main.js` saying so.

The worst instance was the consult dialog: it says "This form is not connected yet.
Reach me directly:" and then gave the dead address. The honest fallback did not work.

---

## Waiting on Chris

- **A Formspree form ID.** `contact.html` and `js/main.js` both carry
  `YOUR_FORM_ID`, so 22 "Get a free growth audit" buttons open a dialog that says it
  is not connected and offers email and phone instead. One ID from formspree.io
  fixes every form at once. The site deliberately shows no submit button rather than
  faking a success state.
- **Copy for Referrals and Sales Process.** Both sit at roughly 520 words against
  their siblings' 900 to 1,600, because the feedback doc gives them four sections and
  no FAQ. Longer versions need his words, not invented ones.
- **Whether the published rates should be public.** The rewrites put real numbers on
  the site: `$1,500 to $3,000` per month ad spend, `$50 to $150` per qualified lead,
  `$1,500 to $2,500` SEO retainer, a `$96` lead against a `$200,000` agreement. All
  are his own figures from the doc, but once live they are a rate card competitors
  can read.

## Waiting on Dreau

- **DNS for `thegrowthacademy.com.au`.** The domain is attached to the Vercel project
  but served by nginx, still showing the old WordPress site. Parked deliberately
  until the copy is signed off and the forms work.
- **Nothing else.** Vercel Git is connected and auto-deploys on push, confirmed by a
  push that went live in 15 seconds.

## Decided, do not revisit without a reason

- **Blog posts stay on thegrowthacademy.com.au.** Republishing them here without
  redirects on the old site would put the two copies in competition for the same
  terms. The excerpts already match the doc's rewrites and the cards say they open
  off-site.
- **URLs stay under `/ndis-marketing/`** even though the section is labelled "NDIS
  Growth". "NDIS marketing" is the hub page's own primary search term.
- **"We meet regularly, you execute, we refine" keeps its "we".** It is genuinely
  Chris and the client, and the doc lists it under do-not-touch. Everything else on
  the site is first person singular.

---

## The repos

| Repo | Deploys to | Note |
|---|---|---|
| `cl-growth-academy-website` | `cl-growth-academy-website.vercel.app` | the site |
| `signup-website-chris` | `signup-website-chris.vercel.app` | the standalone newsletter page, Git-connected |
| `website-sign-up` | nothing | **superseded**, older copy of the same page, no Vercel project |

`newsletter.html` exists in all three. A change to it needs mirroring into
`signup-website-chris`, where only that repo's `canonical` and `og:url` differ. Those
three shared files are straight copies, not trimmed — trimming them is what left
`website-sign-up` with eight classes live and no CSS behind them.

## Checks before pushing

`tools/` holds them, and `tools/README.md` explains each. From the repo root with
`python3 -m http.server 3000` running:

```
cd tools && npm install playwright-core   # first time only
node rules.js     # no rendered em-dash, no dead link. Must exit 0.
node audit.js     # overflow + tap targets, four phone widths
node dlgcheck.js  # the consult dialog, which no crawler reaches
node compare.js   # live vs local, side by side
```

`rules.js` and the others take `BASE=https://…` to run against production instead.

Two habits worth keeping. **`compare.js` earns its place** — rendering both builds
side by side has caught three copy bugs that every automated check passed clean.
And **never trust a push**: byte-compare a live asset against
`git show <sha>:<path>`, because this project has reported healthy while four
commits behind.
