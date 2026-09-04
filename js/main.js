/* CL Growth Academy — site behaviour
   Mobile nav, scroll reveals, sticky-header state. No dependencies. */

(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- Mobile nav ---------------- */

  function initNav() {
    var toggle = document.querySelector('.nav-toggle');
    var links = document.querySelector('.nav-links');
    if (!toggle || !links) return;

    function isOpen() {
      return links.classList.contains('open');
    }

    function setOpen(open) {
      links.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    function close(returnFocus) {
      if (!isOpen()) return;
      setOpen(false);
      if (returnFocus) toggle.focus();
    }

    setOpen(false);

    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      setOpen(!isOpen());
    });

    /* ---- Dropdown ----
       A second dismissible layer inside the same nav, so it shares the
       Escape and outside-click handlers below rather than registering
       competing ones. Escape closes the dropdown FIRST and only falls
       through to the drawer when no dropdown is open — otherwise one key
       press would collapse both and lose the visitor's place. */

    var subTrigger = links.querySelector('.nav-sub-trigger');
    var subPanel = links.querySelector('.nav-panel');
    var hoverTimer = null;
    var desktop = window.matchMedia('(min-width: 801px)');

    function subIsOpen() {
      return !!subPanel && subPanel.classList.contains('open');
    }

    function setSubOpen(open) {
      if (!subPanel || !subTrigger) return;
      subPanel.classList.toggle('open', open);
      subTrigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    function closeSub(returnFocus) {
      if (!subIsOpen()) return;
      setSubOpen(false);
      if (returnFocus) subTrigger.focus();
    }

    if (subTrigger && subPanel) {
      setSubOpen(false);

      subTrigger.addEventListener('click', function (e) {
        e.stopPropagation();
        setSubOpen(!subIsOpen());
      });

      // Hover opens on desktop only. The close is delayed so a diagonal
      // path from trigger to panel does not dismiss it mid-travel; the
      // ::before bridge in the CSS covers the gap itself.
      var sub = subTrigger.parentElement;
      sub.addEventListener('mouseenter', function () {
        if (!desktop.matches) return;
        window.clearTimeout(hoverTimer);
        setSubOpen(true);
      });

      sub.addEventListener('mouseleave', function () {
        if (!desktop.matches) return;
        hoverTimer = window.setTimeout(function () { setSubOpen(false); }, 120);
      });

      // Tabbing out of the panel closes it
      sub.addEventListener('focusout', function (e) {
        if (!sub.contains(e.relatedTarget)) closeSub(false);
      });

      // Arrow keys walk the panel once it is open
      subPanel.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        e.preventDefault();
        var items = Array.prototype.slice.call(subPanel.querySelectorAll('a'));
        var i = items.indexOf(document.activeElement);
        var next = e.key === 'ArrowDown' ? i + 1 : i - 1;
        if (next < 0) next = items.length - 1;
        if (next >= items.length) next = 0;
        items[next].focus();
      });

      subTrigger.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowDown') return;
        e.preventDefault();
        setSubOpen(true);
        var first = subPanel.querySelector('a');
        if (first) first.focus();
      });
    }

    // Escape closes and returns focus to the trigger
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      // The consult dialog handles its own Escape natively, and the keydown
      // still bubbles here — without this, one press would dismiss the
      // dialog AND collapse the drawer behind it.
      if (document.querySelector('dialog[open]')) return;
      if (subIsOpen()) {
        closeSub(true);
        return;
      }
      close(true);
    });

    // Clicking outside the nav closes it
    document.addEventListener('click', function (e) {
      if (subIsOpen() && !links.contains(e.target)) closeSub(false);
      if (isOpen() && !links.contains(e.target) && e.target !== toggle) close(false);
    });

    // Following a link closes the drawer
    links.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        closeSub(false);
        close(false);
      }
    });

    // Leaving the mobile breakpoint resets state
    desktop.addEventListener('change', function (e) {
      if (e.matches) close(false);
      closeSub(false);
    });

    initNavIndicator(links, desktop);
  }

  /* ---------------- Sliding nav indicator ----------------

     Positioned from each item's live offsetLeft/offsetWidth rather than
     given a per-item pseudo-element, so the bar travels between items
     instead of cross-fading. Desktop only — inside the mobile drawer the
     items are stacked full width and the left-bar marker reads better. */

  function initNavIndicator(links, desktop) {
    var bar = links.querySelector('.nav-indicator');
    if (!bar) return;

    // The CTA is a filled button; underlining it would read as a mistake
    var items = Array.prototype.slice.call(
      links.querySelectorAll('a:not(.nav-cta), .nav-sub-trigger')
    );
    if (!items.length) return;

    var current = links.querySelector('[aria-current="page"]:not(.nav-cta)');
    var resting = current || null;

    /* Measured with getBoundingClientRect against the list, not offsetLeft.
       offsetLeft is relative to the nearest positioned ancestor, and the
       dropdown trigger's is .nav-sub — so it reported 0 and parked the bar
       at the far left of the nav instead of under the trigger. */
    function moveTo(el) {
      if (!el || !desktop.matches) {
        bar.classList.remove('is-visible');
        return;
      }
      var base = links.getBoundingClientRect();
      var box = el.getBoundingClientRect();
      bar.style.transform = 'translateX(' + (box.left - base.left) + 'px)';
      bar.style.width = box.width + 'px';
      bar.classList.add('is-visible');
    }

    items.forEach(function (el) {
      el.addEventListener('mouseenter', function () { moveTo(el); });
      el.addEventListener('focus', function () { moveTo(el); });
    });

    links.addEventListener('mouseleave', function () { moveTo(resting); });
    links.addEventListener('focusout', function (e) {
      if (!links.contains(e.relatedTarget)) moveTo(resting);
    });

    // Re-measure on resize, rAF-throttled the same way initHeader does
    var ticking = false;
    window.addEventListener('resize', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        moveTo(resting);
        ticking = false;
      });
    }, { passive: true });

    moveTo(resting);
  }

  /* ---------------- Sticky header state ---------------- */

  function initHeader() {
    var header = document.querySelector('.site-header');
    if (!header) return;

    var ticking = false;

    function update() {
      header.classList.toggle('is-scrolled', window.scrollY > 24);
      ticking = false;
    }

    window.addEventListener('scroll', function () {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    }, { passive: true });

    update();
  }

  /* ---------------- Scroll reveals ---------------- */

  function initReveals() {
    var targets = document.querySelectorAll('.reveal');
    if (!targets.length) return;

    // Reduced motion or no observer support: show everything immediately
    if (reduceMotion || !('IntersectionObserver' in window)) {
      for (var i = 0; i < targets.length; i++) {
        targets[i].classList.add('is-visible');
      }
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });

    targets.forEach(function (el) { observer.observe(el); });
  }

  /* ---------------- Client wall + testimonials ----------------

     Chris: to add a real testimonial, replace the `quote` for that
     client below and set `who` to the person's name and role.
     A null quote renders the visibly-unfinished placeholder state. */

  var CLIENTS = {
    'tania-gomez-consulting':     { name: 'Tania Gomez Consulting',          quote: null, who: null },
    'auscare-2':                  { name: 'Auscare Group',                   quote: null, who: null },
    'independent-living-victoria':{ name: 'Independent Living Victoria',     quote: null, who: null },
    'nourished-not-deprived-2':   { name: 'Nourished Not Deprived',          quote: null, who: null },
    'pure-living':                { name: 'Pure Living Accommodation & Care',quote: null, who: null },
    'journey-with-cares':         { name: 'Journey With Carers',             quote: null, who: null },
    'able-mind-services':         { name: 'Able Mind Services',              quote: null, who: null },
    'astute-living-care':         { name: 'Astute Living Care',              quote: null, who: null },
    'zoomly-2':                   { name: 'Zoomly NDIS Transport',           quote: null, who: null },
    'all-about-caring':           { name: 'All About Caring NDIS',           quote: null, who: null },
    'care-bpo':                   { name: 'Care BPO',                        quote: null, who: null },
    'resolv':                     { name: 'Resolv',                          quote: null, who: null },
    'disbranded':                 { name: 'Disbranded',                      quote: null, who: null }
  };

  /* The looping wall and the testimonial panel are separate concerns and
     must stay that way. They used to share one function guarded by
     `if (!track || !panel) return`, which meant removing the panel also
     silently killed the marquee's cloning, and with it the seamless loop.
     The panel is currently out of the markup — every quote is still
     unwritten, so inviting a click would only disappoint — but the wall
     still runs. */

  function initClients() {
    initLogoWall();
    initTestimonialPanel();
  }

  function initLogoWall() {
    var track = document.getElementById('logo-track');
    if (!track) return;

    // Duplicate the set so translateX(-50%) loops seamlessly. Skipped
    // under reduced motion, which leaves the static wrapping wall.
    if (!reduceMotion) {
      var originals = Array.prototype.slice.call(track.children);
      originals.forEach(function (node) {
        var copy = node.cloneNode(true);
        // Decorative duplicate: keep it out of the a11y tree and the
        // tab order so logos aren't announced or tabbed to twice
        copy.setAttribute('aria-hidden', 'true');
        copy.setAttribute('tabindex', '-1');
        track.appendChild(copy);
      });
      track.classList.add('is-animating');
    }
  }

  /* Dormant until Chris supplies real quotes. Restoring it means putting
     the #testimonial-panel figure back in the markup and making the tiles
     buttons again; this code then wires itself up with no changes. */
  function initTestimonialPanel() {
    var track = document.getElementById('logo-track');
    var panel = document.getElementById('testimonial-panel');
    if (!track || !panel) return;

    var quoteEl = document.getElementById('tp-quote');
    var logoEl = document.getElementById('tp-logo');
    var whoEl = document.getElementById('tp-who');

    function select(slug, tile) {
      var c = CLIENTS[slug];
      if (!c || !c.quote) return;

      quoteEl.textContent = '“' + c.quote + '”';
      whoEl.textContent = c.who ? c.who + ', ' + c.name : c.name;
      logoEl.src = 'img/clients/' + slug + '.jpg';
      logoEl.alt = c.name + ' logo';

      // Only one tile reads as pressed, including across the cloned set
      var all = track.querySelectorAll('.logo-tile');
      for (var i = 0; i < all.length; i++) {
        all[i].setAttribute('aria-pressed', all[i].dataset.client === slug ? 'true' : 'false');
      }
      if (tile) tile.setAttribute('aria-pressed', 'true');
    }

    track.addEventListener('click', function (e) {
      var tile = e.target.closest('.logo-tile');
      if (tile && tile.dataset.client) select(tile.dataset.client, tile);
    });

    var first = track.querySelector('.logo-tile');
    if (first) select(first.dataset.client, first);
  }

  /* ---------------- Hero video ----------------

     Decorative background motion. Under reduced motion, never start it —
     a video that has not played shows its poster, which is exactly the
     still fallback we want. CSS can't pause a video, and display:none
     would take the poster with it, so this has to be done here.

     `autoplay` stays in the markup so the video still works with JS
     off; this only takes it away from people who asked for less motion. */

  function initHeroVideo() {
    if (!reduceMotion) return;
    var video = document.querySelector('.hero-video');
    if (!video) return;
    video.removeAttribute('autoplay');
    video.pause();
  }

  /* ---------------- Homepage hero video ----------------

     Layered OVER the photo hero, never instead of it: the <picture> below
     stays the base layer, the poster and the fallback, so if this is
     skipped or fails to load there is no visible gap.

     Built here rather than in the markup on purpose. A <video> in the HTML
     is fetched even when CSS hides it, and preload is only a hint, so the
     only way to guarantee a phone downloads nothing is to not create the
     element. That also leaves no-JS visitors on the photo, which is the
     right fallback rather than a broken one.

     The source is 1600x598, authored for the newsletter's short wide band.
     In a full-viewport portrait window only about 17% of its width would be
     visible, upscaled 2.8x, for 2.89MB — twenty times the photo it would be
     covering. So: wide viewports only. */

  var HERO_VIDEO_SRC = 'video/newsletter-hero.mp4';

  function heroVideoWanted() {
    if (reduceMotion) return false;
    if (!window.matchMedia('(min-width: 701px)').matches) return false;

    // Respect an explicit data-saving preference where the browser exposes
    // one. Absent support is treated as "no objection", not as a blocker.
    var c = navigator.connection;
    if (c) {
      if (c.saveData) return false;
      if (c.effectiveType === '2g' || c.effectiveType === 'slow-2g') return false;
    }
    return true;
  }

  function initPhotoHeroVideo() {
    var frame = document.querySelector('body.photo-hero .photo-frame');
    if (!frame || frame.querySelector('video')) return;
    if (!heroVideoWanted()) return;

    var v = document.createElement('video');
    // muted and playsinline are both load-bearing: without either, mobile
    // browsers refuse to autoplay. Decorative, so it stays out of the
    // accessibility tree and, having no controls, out of the tab order.
    v.muted = true;
    v.loop = true;
    v.autoplay = true;
    v.playsInline = true;
    v.preload = 'metadata';
    v.setAttribute('aria-hidden', 'true');
    v.setAttribute('tabindex', '-1');
    v.src = HERO_VIDEO_SRC;

    // Only reveal once there are frames to show, or the fade would cross
    // from the photo to a black box.
    v.addEventListener('canplay', function () {
      v.classList.add('is-ready');
    });

    // If it cannot play, leave the photo showing and take the element back
    // out rather than stacking an empty layer over the hero.
    v.addEventListener('error', function () {
      if (v.parentNode) v.parentNode.removeChild(v);
    });

    // Insert before the content div so it sits above the picture and below
    // the scrim, keeping every contrast measurement valid.
    var content = frame.querySelector('.photo-hero-content');
    frame.insertBefore(v, content || null);

    var playing = v.play();
    if (playing && typeof playing.catch === 'function') {
      // Autoplay refusal is not an error worth surfacing; the poster photo
      // is already the intended still state.
      playing.catch(function () {});
    }
  }

  /* ---------------- Waitlist forms ----------------

     A plain cross-origin POST to Beehiiv would navigate the visitor away
     to Beehiiv's own confirmation page, so the on-page success copy would
     never show. Intercept submit, fire the POST via a no-cors fetch
     instead (the response is opaque, so this optimistically assumes
     success once the request is sent), then morph the pill in place.

     The endpoint guard below is the important part. Two of this site's
     forms still point at a Formspree placeholder that was never filled
     in. Intercepting one of those would show "You're on the list" for a
     submission that reached nobody, which is worse than letting the POST
     fail where the visitor can see it. So a placeholder action is left
     entirely alone and reported to the console instead. */

  function initWaitlistForms() {
    var forms = document.querySelectorAll('.js-waitlist');
    if (!forms.length) return;

    forms.forEach(function (form) {
      if (form.action.indexOf('YOUR_FORM_ID') !== -1) {
        console.warn(
          'Waitlist form not wired up: its action is still the Formspree ' +
          'placeholder, so submissions go nowhere. Left un-intercepted on ' +
          'purpose. A success message here would be a lie.', form
        );
        return;
      }

      form.addEventListener('submit', function (e) {
        e.preventDefault();

        // Native constraint validation has already passed by the time a
        // submit event fires, so there is nothing to re-check here
        var pill = form.querySelector('.form-pill');

        // Serialise the WHOLE form. This used to hardcode
        // 'email=' + the email input, which was fine while the only
        // consumer was the single-field newsletter — but the consult
        // dialog reuses this same .js-waitlist handler with name, phone
        // and message fields, and those were being silently dropped.
        // URLSearchParams keeps the body application/x-www-form-urlencoded,
        // the content type the newsletter endpoint already accepts, and
        // sets that header itself — so do not set it manually here.
        fetch(form.action, {
          method: 'POST',
          mode: 'no-cors',
          body: new URLSearchParams(new FormData(form))
        }).catch(function () {});

        // Known limitation, stated rather than hidden: no-cors makes the
        // response opaque, so success here is assumed, not confirmed — a
        // failed send still shows the success state. Tolerable for a
        // newsletter; for the consult enquiry it is why that success
        // message keeps Chris's email and phone visible, so a silent
        // failure still leaves the reader a way through.

        // The pill carries the state, not the form: the form has to stay
        // in the layout for the morph to happen in place
        if (pill) pill.classList.add('is-submitted');

        // Nothing left to resubmit once the fields have faded out.
        // textarea is in this list because the consult dialog has one;
        // without it the message stays editable after the form completes.
        form.querySelectorAll('input, textarea, button').forEach(function (el) {
          el.disabled = true;
        });
      });
    });
  }

  /* ---------------- Journey rail ----------------

     Standard tablist behaviour over the five journey stages. Panels are
     only hidden once this runs, so with JS off all five stay visible and
     stacked rather than collapsing to one — the data matters more than
     the interaction. */

  function initJourneyRail() {
    var rail = document.querySelector('.rail[role="tablist"]');
    if (!rail) return;

    var tabs = Array.prototype.slice.call(rail.querySelectorAll('[role="tab"]'));
    if (!tabs.length) return;

    function panelFor(tab) {
      return document.getElementById(tab.getAttribute('aria-controls'));
    }

    function select(tab, moveFocus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        // Roving tabindex: one stop for the whole rail, arrows move within
        t.tabIndex = on ? 0 : -1;
        var panel = panelFor(t);
        if (panel) panel.hidden = !on;
      });
      if (moveFocus) tab.focus();
    }

    rail.addEventListener('click', function (e) {
      var tab = e.target.closest('[role="tab"]');
      if (tab) select(tab, false);
    });

    rail.addEventListener('keydown', function (e) {
      var i = tabs.indexOf(document.activeElement);
      if (i === -1) return;
      var next = null;
      if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
      else if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
      else if (e.key === 'Home') next = tabs[0];
      else if (e.key === 'End') next = tabs[tabs.length - 1];
      if (!next) return;
      e.preventDefault();
      select(next, true);
    });

    select(tabs[0], false);
  }

  /* ---------------- Consult dialog ----------------

     Built here rather than in the markup because it is identical on every
     page: eleven hand-maintained copies is exactly how the nav drifted.
     Injected once, on first open.

     Nothing in the HTML changes either. A delegated click intercepts
     anchors to contact.html that are .btn CTAs, so the buttons open the
     box while footer and prose links still navigate. The href stays a real
     fallback, and contact.html stays a real page. */

  var CONSULT_ACTION = 'https://formspree.io/f/YOUR_FORM_ID';

  function buildConsultDialog() {
    var wired = CONSULT_ACTION.indexOf('YOUR_FORM_ID') === -1;
    var dlg = document.createElement('dialog');
    dlg.className = 'consult';
    dlg.innerHTML =
      '<div class="consult-grid">' +
        '<div class="consult-form">' +
          '<button class="consult-close" type="button" aria-label="Close">&times;</button>' +
          '<span class="eyebrow">Book a free consult</span>' +
          '<h2>Straight to Chris.</h2>' +
          '<p class="consult-sub">Tell him what is not working. He will tell you straight whether he can fix it.</p>' +
          '<form class="js-waitlist" action="' + CONSULT_ACTION + '" method="POST">' +
            '<div class="form-row stack">' +
              '<div><label for="c-name">Name</label>' +
              '<input id="c-name" type="text" name="name" autocomplete="name" required></div>' +
              '<div><label for="c-email">Email</label>' +
              '<input id="c-email" type="email" name="email" autocomplete="email" required></div>' +
              '<div><label for="c-phone">Phone (optional)</label>' +
              '<input id="c-phone" type="tel" name="phone" autocomplete="tel"></div>' +
              '<div><label for="c-msg">What is going on with your marketing?</label>' +
              '<textarea id="c-msg" name="message" rows="4" required></textarea></div>' +
              '<div>' +
                (wired
                  ? '<div class="form-pill form-pill-compact"><div class="form-pill-fields">' +
                    '<button type="submit" class="btn btn-mustard">Send it &rarr;</button>' +
                    '</div>' +
                    /* The send is fire-and-forget (see the no-cors note in
                       the submit handler), so this keeps the direct routes
                       on screen: if the post quietly failed, the reader is
                       not left believing a message arrived with no way back. */
                    '<p class="form-pill-success" role="status">Message sent. ' +
                    'If you would rather not wait, Chris is on ' +
                    '<a href="mailto:chris@clgrowthacademy.com.au">chris@clgrowthacademy.com.au</a>' +
                    '.</p></div>'
                  /* Un-wired: no submit button at all. A disabled-looking
                     button people still click, on a form that posts to a
                     dead URL, is worse than saying so and handing them the
                     two routes that do work. */
                  : '<p class="consult-notice">This form is not connected yet. ' +
                    'Reach Chris directly:</p>' +
                    '<p class="consult-direct">' +
                    '<a href="mailto:chris@clgrowthacademy.com.au">chris@clgrowthacademy.com.au</a><br>' +
                    '<a href="tel:+61431584725">+61 431 584 725</a></p>') +
              '</div>' +
            '</div>' +
          '</form>' +
        '</div>' +
        /* The fifteen years are SALES AND MARKETING, not sector tenure —
           this headline used to read "Fifteen years. / One sector." and the
           juxtaposition claimed fifteen years in NDIS and aged care, which
           is not true. Keep the two ideas attached to the right things.

           Each point below restates a claim already made elsewhere on the
           site (contact.html's "not an inbox someone else screens", the FAQ
           on lock-in contracts, this dialog's own subhead). Deliberately no
           response-time promise: the site states none, and inventing one
           would commit Chris to something he has not said. */
        '<div class="consult-visual">' +
          '<p class="consult-visual-copy">Fifteen years of sales<br>' +
          '<span class="script">and marketing.</span></p>' +
          '<ul class="consult-visual-points">' +
            '<li>Chris reads this himself. Not an inbox someone else screens.</li>' +
            '<li>No lock-in contracts, ever.</li>' +
            '<li>If he can&rsquo;t help, he&rsquo;ll say so.</li>' +
          '</ul>' +
          '<p class="consult-visual-meta">NDIS &amp; aged care marketing &middot; Sydney</p>' +
        '</div>' +
      '</div>';
    document.body.appendChild(dlg);

    dlg.querySelector('.consult-close').addEventListener('click', function () {
      dlg.close();
    });

    // Clicking the backdrop closes. The dialog element itself is the full
    // viewport, so a click landing on it rather than on .consult-grid is
    // by definition outside the box.
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg) dlg.close();
    });

    return dlg;
  }

  function initConsultDialog() {
    if (typeof HTMLDialogElement === 'undefined') return; // no dialog: links navigate
    var dlg = null;
    var opener = null;

    document.addEventListener('click', function (e) {
      var a = e.target.closest('a.btn');
      if (!a) return;
      var href = a.getAttribute('href') || '';
      if (!/(^|\/)contact\.html$/.test(href)) return;

      e.preventDefault();
      opener = a;
      if (!dlg) dlg = buildConsultDialog();
      dlg.showModal();
      var first = dlg.querySelector('input');
      if (first) first.focus();
    });

    // Focus back to whichever CTA opened it
    document.addEventListener('close', function (e) {
      if (dlg && e.target === dlg && opener) {
        opener.focus();
        opener = null;
      }
    }, true);
  }

  /* ---------------- Boot ---------------- */

  function init() {
    initNav();
    initHeader();
    initReveals();
    initClients();
    initHeroVideo();
    initPhotoHeroVideo();
    initWaitlistForms();
    initJourneyRail();
    initConsultDialog();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
