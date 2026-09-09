# Regenerates the nav and the footer across every page that carries them.
# Generated rather than hand-edited: there are 13 copies now, and the last
# time these were edited by hand they drifted (two blog excerpts, and a
# channel order that disagreed with itself).
import io, os, re, glob

# Repo root, derived from this file's location so it runs on either machine
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# The canonical channel order. One source of truth for the nav panel, the
# footer service list, and (checked separately) the on-page card grids.
MARKETING = [
    ('01', 'seo.html',        'NDIS SEO',              'Long-term visibility built for the searches your participants actually type.'),
    ('02', 'ads.html',        'NDIS Google Ads',       'Paid search aimed at people looking for a provider this week.'),
    ('03', 'social-ads.html', 'NDIS Social Media Ads', 'Meta campaigns that reach families before they start searching.'),
    ('04', 'email.html',      'Email Marketing',       'Straight-talking sequences that keep your provider top of mind.'),
    ('05', 'social.html',     'Social &amp; Content',  'Real stories from your team, built for the people deciding on you.'),
]
GROWTH = [
    ('06', 'referrals.html',     'Referrals &amp; Partnerships', 'Coordinator and allied health relationships that refer without ad spend.'),
    ('07', 'sales-process.html', 'Sales &amp; Enquiry Process',  'What happens after the phone rings, and why it decides the outcome.'),
]
TIER = ('&#43;', 'managed.html', 'Managed Growth', 'Every channel and both engines, run as one plan by one person.')

LINKEDIN = 'https://www.linkedin.com/in/christopher-lapa-36108055/'
BRAND = ('<span class="brand-mark">CL</span> <span class="brand-word">'
         '<span>Growth</span> <span>Academy</span></span>')
TICK = ('<svg class="form-tick" viewBox="0 0 24 24" width="20" height="20" fill="none" '
        'stroke="currentColor" stroke-width="2.5" stroke-linecap="round" '
        'stroke-linejoin="round" aria-hidden="true" focusable="false">')


def panel_link(num, href, title, desc, ch, extra=''):
    return (f'              <a href="{ch}{href}"{extra}>\n'
            f'                <span class="nav-panel-num">{num}</span>\n'
            f'                <span><span class="nav-panel-title">{title}</span>'
            f'<span class="nav-panel-desc">{desc}</span></span>\n'
            f'              </a>\n')


def build_nav(root, ch, current):
    """root: '' or '../'   ch: path prefix to the channel dir   current: page key"""
    def cur(key, attr=' aria-current="page"'):
        return attr if current == key else ''

    # An article under blog/ is not blog.html, so it must not claim
    # aria-current="page" (two elements claiming it is the duplicate bug that
    # was fixed once already). It gets "true" instead, the same section-marker
    # treatment the NDIS Growth dropdown trigger gets below, which is what
    # initNavIndicator's [aria-current]:not(.nav-cta) rests the bar on.
    blog_attr = (' aria-current="page"' if current == 'blog.html'
                 else ' aria-current="true"' if current == 'blog-child'
                 else '')

    # The reading-progress bar lives inside the sticky header so it travels
    # with it and needs no stacking context of its own. Emitted here rather
    # than hand-added, because the header is generated on every page.
    progress = ('  <div class="article-progress" aria-hidden="true"><span></span></div>\n'
                if current == 'blog-child' else '')

    marketing = ''.join(panel_link(n, h, t, d, ch, cur(h)) for n, h, t, d in MARKETING)
    growth = ''.join(panel_link(n, h, t, d, ch, cur(h)) for n, h, t, d in GROWTH)
    tier = panel_link(*TIER[:1], TIER[1], TIER[2], TIER[3], ch, cur(TIER[1]))

    # The dropdown trigger is "current" on any page inside the channel dir
    in_channels = current in [h for _, h, _, _ in MARKETING + GROWTH] + [TIER[1], 'hub']

    return f'''<header class="site-header">
  <nav class="nav" aria-label="Main">
    <a href="{root}index.html" class="brand">{BRAND}</a>
    <button class="nav-toggle" type="button" aria-label="Toggle menu" aria-expanded="false" aria-controls="nav-links">&#9776;</button>
    <div class="nav-links" id="nav-links">
      <a href="{root}how-we-help.html"{cur('how-we-help.html')}>How We Help</a>
      <div class="nav-sub">
        <button class="nav-sub-trigger" type="button" aria-expanded="false" aria-haspopup="true" aria-controls="nav-ndis"{' aria-current="true"' if in_channels else ''}>
          NDIS Growth
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div class="nav-panel" id="nav-ndis">
          <a class="nav-panel-overview" href="{ch}index.html"{cur('hub')}>
            <span class="nav-panel-num">&rarr;</span>
            <span><span class="nav-panel-title">NDIS Growth</span><span class="nav-panel-desc">Two engines, and how they fit together.</span></span>
          </a>
          <div class="nav-panel-cols">
            <div class="nav-panel-col">
              <span class="nav-panel-group">Marketing</span>
{marketing}            </div>
            <div class="nav-panel-col">
              <span class="nav-panel-group">Growth</span>
{growth}              <span class="nav-panel-group">All of it</span>
{tier}            </div>
          </div>
        </div>
      </div>
      <a href="{root}blog.html"{blog_attr}>Blog</a>
      <a href="{root}contact.html" class="btn btn-mustard nav-cta"{cur('contact.html')}>Get In Touch</a>
      <span class="nav-indicator" aria-hidden="true"></span>
    </div>
  </nav>
{progress}</header>

'''


def build_footer(root, ch):
    services = ''.join(f'          <li><a href="{ch}{h}">{t}</a></li>\n'
                       for _, h, t, _ in MARKETING + GROWTH)
    services += f'          <li><a href="{ch}{TIER[1]}">{TIER[2]}</a></li>\n'

    return f'''<footer class="site-footer">
  <div class="wrap">
    <div class="footer-grid">
      <div>
        <div class="brand">{BRAND}</div>
        <p class="footer-tagline">NDIS &amp; Aged Care Growth. Founder-led.</p>
      </div>
      <nav aria-label="Services">
        <div class="footer-label">Services</div>
        <ul>
{services}        </ul>
      </nav>
      <nav aria-label="Company">
        <div class="footer-label">Company</div>
        <ul>
          <li><a href="{root}index.html">Home</a></li>
          <li><a href="{root}how-we-help.html">How We Help</a></li>
          <li><a href="{ch}index.html">NDIS Growth</a></li>
          <li><a href="{root}blog.html">Blog</a></li>
          <li><a href="{root}contact.html">Get In Touch</a></li>
        </ul>
      </nav>
      <div>
        <div class="footer-label">Contact</div>
        <ul>
          <li><a href="mailto:chris@thegrowthacademy.com.au">chris@thegrowthacademy.com.au</a></li>
          <li><a href="tel:+61431584725">+61 431 584 725</a></li>
          <li><a href="{LINKEDIN}" target="_blank" rel="noopener">LinkedIn<span class="sr-only"> (opens in a new tab)</span></a></li>
          <li>Australia</li>
        </ul>
      </div>
    </div>

    <!-- The lower-commitment step, for people who have read the page and are
         not ready to book. Posts to the same Beehiiv list as newsletter.html
         and the homepage panel, so initWaitlistForms intercepts it and it
         genuinely submits. -->
    <div class="footer-signup">
      <div>
        <p class="footer-signup-title">Get the weekly note</p>
        <p class="note">One short read for NDIS and aged care providers, and one thing to do before next week.</p>
      </div>
      <form class="js-waitlist" action="https://clgrowth.beehiiv.com/subscribe" method="POST">
        <label class="sr-only" for="footer-email">Your email address</label>
        <div class="form-pill">
          <div class="form-pill-fields">
            <input id="footer-email" type="email" name="email" autocomplete="email" placeholder="you@yourprovider.com.au" required>
            <button type="submit" class="btn btn-mustard">Subscribe</button>
          </div>
          <p class="form-pill-success" role="status">
            {TICK}
              <circle cx="12" cy="12" r="10" opacity="0.35"/>
              <path class="form-tick-path" d="M7.5 12.5l3 3 6-6.5"/>
            </svg>
            You're in. Watch your inbox.
          </p>
        </div>
        <p class="form-note">Free. Weekly. You can leave any time.</p>
      </form>
    </div>

    <div class="footer-bottom">\u00a9 2026 CL Growth Academy.</div>
  </div>
</footer>

'''


# Which page is which, for aria-current
PAGES = {
    'index.html':                    ('',     'ndis-marketing/', 'home'),
    'how-we-help.html':              ('',     'ndis-marketing/', 'how-we-help.html'),
    'blog.html':                     ('',     'ndis-marketing/', 'blog.html'),
    'contact.html':                  ('',     'ndis-marketing/', 'contact.html'),
    'ndis-marketing/index.html':     ('../',  '',                'hub'),
    'ndis-marketing/seo.html':       ('../',  '',                'seo.html'),
    'ndis-marketing/ads.html':       ('../',  '',                'ads.html'),
    'ndis-marketing/social-ads.html':('../',  '',                'social-ads.html'),
    'ndis-marketing/email.html':     ('../',  '',                'email.html'),
    'ndis-marketing/social.html':    ('../',  '',                'social.html'),
    'ndis-marketing/referrals.html': ('../',  '',                'referrals.html'),
    'ndis-marketing/sales-process.html': ('../', '',             'sales-process.html'),
    'ndis-marketing/managed.html':   ('../',  '',                'managed.html'),

    # Appended last on purpose. The loop below rewrites by string index and
    # raises on the first file missing an anchor, having already rewritten
    # every file before it. Keeping the newest files at the end means a typo
    # in one of them cannot leave the thirteen known-good pages half-written.
    'blog/ndis-digital-marketing-strategy.html':           ('../', '../ndis-marketing/', 'blog-child'),
    'blog/attract-ndis-participants-with-google-ads.html': ('../', '../ndis-marketing/', 'blog-child'),
    'blog/marketing-for-business-growth.html':             ('../', '../ndis-marketing/', 'blog-child'),
    'blog/how-can-seo-grow-my-business.html':              ('../', '../ndis-marketing/', 'blog-child'),
}

for path, (root, ch, key) in PAGES.items():
    s = io.open(path, encoding='utf-8').read()

    # --- nav ---
    a = s.index('<header class="site-header">')
    b = s.index('<main id="main">')
    s = s[:a] + build_nav(root, ch, key) + s[b:]

    # --- footer ---
    a = s.index('<footer class="site-footer">')
    b = s.index('</footer>') + len('</footer>\n\n')
    s = s[:a] + build_footer(root, ch) + s[b:]

    io.open(path, 'w', encoding='utf-8', newline='').write(s)
    print(f'  {path}')

print(f'\n  {len(PAGES)} pages regenerated')
