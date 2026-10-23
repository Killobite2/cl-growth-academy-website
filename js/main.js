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

    /* [aria-current], not [aria-current="page"]: the dropdown trigger is a
       section marker carrying aria-current="true" (it is not itself a page),
       and it is what the bar should rest under on any channel page. DOM order
       puts it before the panel's own current link, which is hidden anyway. */
    var current = links.querySelector('[aria-current]:not(.nav-cta)');
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

    // The article pages' reading-progress bar rides this listener rather than
    // registering a second one. Queried once here, so the pages without a bar
    // pay one null check at boot and nothing per frame. Skipped entirely under
    // reduced motion, where §30 hides it anyway.
    var bar = reduceMotion ? null : document.querySelector('.article-progress span');
    var ticking = false;

    function update() {
      header.classList.toggle('is-scrolled', window.scrollY > 24);

      if (bar) {
        var max = document.documentElement.scrollHeight - window.innerHeight;
        var pct = max > 0 ? Math.min(1, window.scrollY / max) : 0;
        // scaleX rather than width, so this never triggers layout
        bar.style.transform = 'scaleX(' + pct + ')';
      }

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

  /* ---------------- Client wall ----------------

     The logo wall used to feed a testimonial panel keyed off a CLIENTS map,
     with a click on a tile swapping in that provider's quote. Every quote
     was still unwritten, so the panel was pulled from the markup and the
     tiles went back to being plain divs. The map, the panel's wiring and
     its CSS are removed here rather than left dormant: they were 90 lines
     that nothing could reach, and a placeholder state for quotes that were
     never coming reads as a promise. Reinstating it means real quotes
     first, then markup, then the code. Both live in git.

     Note the wall itself is deliberately its own function. It used to
     share one guarded by `if (!track || !panel) return`, which meant
     removing the panel also silently killed the marquee's cloning, and
     with it the seamless loop. */

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

  /* ---------------- Waitlist and enquiry forms ----------------

     Two kinds of form share the .js-waitlist class, and they are sent
     differently.

     NEWSLETTER (Beehiiv). A plain cross-origin POST would navigate the
     visitor away to Beehiiv's own confirmation page, so the on-page
     success copy would never show. Intercept submit, fire the POST via a
     no-cors fetch instead (the response is opaque, so this optimistically
     assumes success once the request is sent), then morph the pill.

     ENQUIRY (Web3Forms): the consult dialog and contact.html. Web3Forms
     answers CORS and returns JSON, so these sends are CONFIRMED, not
     assumed: the success state only shows once Web3Forms says
     {success: true}, and a failure shows an error with Chris's direct
     email and phone instead. Submissions are emailed to the recipient set
     in the Web3Forms dashboard (chris@thegrowthacademy.com.au), not to an
     address written here.

     The access key is public by design. It only lets someone send TO
     that inbox, never read from it, which is why Web3Forms documents it
     for client-side use. The botcheck checkbox is Web3Forms' honeypot:
     hidden from people, so a submission with it ticked is a bot and
     Web3Forms drops it.

     The placeholder guard stays. A form whose action is still
     YOUR_FORM_ID is left entirely alone and reported to the console,
     because showing a success state for a submission that reached nobody
     is worse than letting the POST fail where the visitor can see it. */

  var W3F_ENDPOINT = 'https://api.web3forms.com/submit';
  var W3F_KEY = '20e51297-6939-43ef-94fe-527c33d09703';

  function lockForm(form) {
    // Nothing left to resubmit once the fields have faded out.
    // textarea and select are in this list because the enquiry forms have
    // one of each; without them the message and the "How did you find me?"
    // answer stay editable after the form completes.
    form.querySelectorAll('input, select, textarea, button').forEach(function (el) {
      el.disabled = true;
    });
  }

  /* ---- "How did you find me?" ----

     Two follow-up questions that only exist for their own answer. Hiding them
     is not enough on its own: a hidden `required` control still takes part in
     native constraint validation, and the browser then refuses to submit while
     showing nothing at all, because it cannot focus the control to hang the
     validation bubble off. Disabling it exempts it from validation AND drops
     it from FormData, so an irrelevant question never reaches the email
     either. The `required` attribute can therefore stay in the markup.

     Bound off the select rather than the page, because the two forms arrive
     differently: contact.html ships it in the markup, the consult dialog
     builds it at first open. */

  function initSourceField(form) {
    var select = form.querySelector('select[name="source"]');
    if (!select) return;
    var extras = form.querySelectorAll('.js-source-extra');

    function sync() {
      extras.forEach(function (wrap) {
        var show = wrap.dataset.source === select.value;
        wrap.hidden = !show;
        wrap.querySelectorAll('input').forEach(function (field) {
          field.disabled = !show;
          if (!show) field.value = '';
        });
      });
    }

    select.addEventListener('change', sync);
    sync(); // a back/forward restore hands the select back already answered
  }

  var THANK_YOU = '/thank-you';

  /* Reports a confirmed enquiry, then moves the visitor on.

     Only ever called from the success branch below, after Web3Forms has
     said the send went through, so a failed enquiry reports nothing and
     the visitor stays on the page with the error line.

     The GA4 event and the dataLayer push carry the same payload on
     purpose: gtag reaches the GA4 property directly, the push is what GTM
     can build its own tags off, and having them agree means the two never
     tell different stories about the same enquiry.

     The short wait before leaving is doing real work. gtag sends on a
     beacon that survives navigation, but a GTM tag listening for the
     dataLayer push has no such guarantee, and the success tick is worth
     showing before the page changes under the reader. */
  function reportLead(form) {
    var name = form.getAttribute('data-lead-name') || 'enquiry';
    var picked = form.querySelector('select[name="source"]');
    var source = picked && picked.value ? picked.value : 'not answered';

    if (typeof window.gtag === 'function') {
      window.gtag('event', 'generate_lead', { form_name: name, lead_source: source });
    }
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: 'generate_lead', form_name: name, lead_source: source });

    window.setTimeout(function () {
      window.location.assign(THANK_YOU);
    }, 700);
  }

  function sendEnquiry(form, pill) {
    var btn = form.querySelector('button[type="submit"]');
    var err = form.querySelector('.form-error');
    if (err) err.hidden = true;
    if (form.dataset.sending) return;
    form.dataset.sending = '1';

    var label = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Sending…';
    }

    var data = Object.fromEntries(new FormData(form));
    if (!data.access_key) data.access_key = W3F_KEY;
    // Which page the enquiry came from, so Chris can see what prompted it
    data.page = window.location.href;

    fetch(W3F_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(data)
    })
      .then(function (res) {
        return res.json().then(function (json) {
          if (!res.ok || !json.success) throw new Error(json.message || res.status);
        });
      })
      .then(function () {
        if (pill) pill.classList.add('is-submitted');
        lockForm(form);
        reportLead(form);
      })
      .catch(function (e) {
        console.warn('Enquiry did not send:', e);
        delete form.dataset.sending;
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = label;
        }
        if (err) err.hidden = false;
      });
  }

  function bindWaitlistForm(form) {
    if (form.dataset.bound) return;
    form.dataset.bound = '1';

    // Before the YOUR_FORM_ID bail below: the conditional fields are plain UI
    // and should work even on a form that is not wired up to send.
    initSourceField(form);

    if (form.action.indexOf('YOUR_FORM_ID') !== -1) {
      console.warn(
        'Form not wired up: its action is still the Formspree ' +
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

      if (form.action.indexOf('api.web3forms.com') !== -1) {
        sendEnquiry(form, pill);
        return;
      }

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
        lockForm(form);
      });
  }

  function initWaitlistForms() {
    document.querySelectorAll('.js-waitlist').forEach(bindWaitlistForm);
  }

  /* ---------------- Consult dialog ----------------

     Built here rather than in the markup because it is identical on every
     page: eleven hand-maintained copies is exactly how the nav drifted.
     Injected once, on first open.

     Nothing in the HTML changes either. A delegated click intercepts
     anchors to contact.html that are .btn CTAs, so the buttons open the
     box while footer and prose links still navigate. The href stays a real
     fallback, and contact.html stays a real page. */

  var CONSULT_ACTION = W3F_ENDPOINT;

  function buildConsultDialog() {
    var dlg = document.createElement('dialog');
    dlg.className = 'consult';
    dlg.innerHTML =
      /* Outside .consult-grid on purpose. Inside .consult-form it scrolled
         with the form, and on a phone .consult-visual is ordered above the
         form, so the close button began its life off-screen — invisible at
         the exact moment someone wants it. Anchored to the dialog it stays
         pinned to the top-right corner at every width. */
      '<button class="consult-close" type="button" aria-label="Close">&times;</button>' +
      '<div class="consult-grid">' +
        '<div class="consult-form">' +
          '<span class="eyebrow">Free growth audit</span>' +
          '<h2>Straight to me.</h2>' +
          '<p class="consult-sub">Tell me what you are trying to grow. I will tell you straight whether I can help.</p>' +
          '<form class="js-waitlist" data-lead-name="growth_audit_popup" ' +
          'action="' + CONSULT_ACTION + '" method="POST">' +
            '<input type="hidden" name="access_key" value="' + W3F_KEY + '">' +
            '<input type="hidden" name="subject" value="New Free Growth Audit request">' +
            '<input type="hidden" name="from_name" value="The Growth Academy Website">' +
            '<input type="hidden" name="form" value="Free growth audit (popup)">' +
            '<input type="checkbox" name="botcheck" class="form-botcheck" tabindex="-1" autocomplete="off" aria-hidden="true">' +
            '<div class="form-row stack">' +
              '<div><label for="c-name">Name</label>' +
              '<input id="c-name" type="text" name="name" autocomplete="name" required></div>' +
              '<div><label for="c-email">Email</label>' +
              '<input id="c-email" type="email" name="email" autocomplete="email" required></div>' +
              '<div><label for="c-phone">Phone (optional)</label>' +
              '<input id="c-phone" type="tel" name="phone" autocomplete="tel"></div>' +
              '<div><label for="c-source">How did you find me?</label>' +
              '<div class="form-select"><select id="c-source" name="source" required>' +
                '<option value="" selected disabled>Please choose</option>' +
                '<option>Google search</option>' +
                '<option>LinkedIn</option>' +
                '<option>Instagram</option>' +
                '<option>Facebook</option>' +
                '<option>Referral (someone sent me)</option>' +
                '<option>Event or workshop</option>' +
                '<option>Podcast</option>' +
                '<option>Newsletter</option>' +
                '<option>Other</option>' +
              '</select></div></div>' +
              /* Same two follow-ups as contact.html, same names so both forms
                 produce the same email. initSourceField() is reached through
                 bindWaitlistForm() at the bottom of this function, which runs
                 after the dialog is in the document. */
              '<div class="js-source-extra" data-source="Referral (someone sent me)" hidden>' +
              '<label for="c-referred-by">Who sent you?</label>' +
              '<input id="c-referred-by" type="text" name="referred_by" autocomplete="off" required disabled></div>' +
              '<div class="js-source-extra" data-source="Other" hidden>' +
              '<label for="c-source-other">Where did you hear about me?</label>' +
              '<input id="c-source-other" type="text" name="source_other" autocomplete="off" required disabled></div>' +
              '<div><label for="c-msg">What is going on with your marketing?</label>' +
              '<textarea id="c-msg" name="message" rows="4" required></textarea></div>' +
              '<div>' +
                '<div class="form-pill form-pill-compact"><div class="form-pill-fields">' +
                '<button type="submit" class="btn btn-mustard">Send it &rarr;</button>' +
                '</div>' +
                /* Web3Forms confirms the send, so this only shows on a
                   real success. Kept to two words with the tick, same as
                   contact.html: the success line is absolutely positioned
                   inside the compact pill, and the longer sentence with
                   the email address overflowed it in a broken stack.

                   The address below is @thegrowthacademy.com.au, NOT
                   @clgrowthacademy.com.au. The latter has no MX records and
                   resolves to a link-local address, so mail to it bounces.
                   Do not switch domains until clgrowthacademy.com.au has
                   working mail. */
                '<p class="form-pill-success" role="status">' +
                '<svg class="form-tick" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
                '<circle cx="12" cy="12" r="10" opacity="0.35"/>' +
                '<path class="form-tick-path" d="M7.5 12.5l3 3 6-6.5"/>' +
                '</svg>' +
                'Message sent.</p></div>' +
                '<p class="form-error" role="alert" hidden>That did not send. ' +
                'Please reach me directly on ' +
                '<a href="mailto:chris@thegrowthacademy.com.au">chris@thegrowthacademy.com.au</a>' +
                ' or <a href="tel:+61431584725">+61 431 584 725</a>.</p>' +
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
           would commit him to something he has not said. */
        '<div class="consult-visual">' +
          '<p class="consult-visual-copy">Fifteen years of sales<br>' +
          '<span class="script">and marketing.</span></p>' +
          '<ul class="consult-visual-points">' +
            '<li>I read this myself. Not an inbox someone else screens.</li>' +
            '<li>No lock-in contracts, ever.</li>' +
            '<li>If I can&rsquo;t help, I&rsquo;ll say so.</li>' +
          '</ul>' +
          '<p class="consult-visual-meta">NDIS &amp; aged care marketing</p>' +
        '</div>' +
      '</div>';
    document.body.appendChild(dlg);

    // Built after initWaitlistForms() has already run, so it has to be
    // bound here or its submit would fall through to a plain POST
    bindWaitlistForm(dlg.querySelector('form'));

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

  /* ---------------- Newsletter nudge ----------------

     Slides in ten seconds after load. Built here rather than in the markup
     for the same reason as the consult dialog: it is identical on every
     page, and eleven hand-maintained copies is how the nav drifted.

     Deliberately NOT a dialog and it never takes focus. It arrives
     unprompted, so moving the caret would interrupt someone mid-sentence
     in the consult form. Escape dismisses it only when focus is not
     inside something else that wants Escape.

     The link is root-relative, not the vercel.app URL: same destination,
     and it keeps working when the domain changes, so this never becomes
     part of the temporary-URL problem. */

  var NUDGE_KEY = 'cl-nudge-dismissed';
  var NUDGE_DELAY = 10000;

  /* sessionStorage, not localStorage, and deliberately so: dismissing it
     should hold for the current browsing session and no longer, so the
     newsletter gets offered again on a later visit. sessionStorage expires
     itself when the session ends, which is exactly that rule, with no
     timestamp arithmetic to get wrong.

     Worth knowing it is scoped per tab, so opening the site in a second tab
     counts as a second session and offers again. That is the trade for
     asking every session rather than once a month. */

  function nudgeDismissed() {
    // Storage throws in some privacy modes; a missing record just means show
    try {
      return !!window.sessionStorage.getItem(NUDGE_KEY);
    } catch (e) {
      return false;
    }
  }

  function rememberNudgeDismissed() {
    try {
      window.sessionStorage.setItem(NUDGE_KEY, '1');
    } catch (e) { /* nothing to do; it reappears next page view at worst */ }
  }

  function initNewsletterNudge() {
    // Pointless on the page it is advertising
    if (document.body.classList.contains('newsletter-page')) return;
    if (nudgeDismissed()) return;

    window.setTimeout(function () {
      if (document.querySelector('.nudge')) return;

      var el = document.createElement('aside');
      el.className = 'nudge';
      el.setAttribute('aria-label', 'Free weekly newsletter');
      el.innerHTML =
        '<button class="nudge-close" type="button" aria-label="Dismiss">&times;</button>' +
        '<p class="nudge-eyebrow">Free &middot; Weekly</p>' +
        '<p class="nudge-title">Free weekly newsletter</p>' +
        '<p class="nudge-body">Marketing, sales, and one thing to do each week. ' +
        'Written for NDIS and aged care providers.</p>' +
        '<a class="nudge-cta" href="/newsletter.html">Subscribe &rarr;</a>';

      document.body.appendChild(el);

      // Next frame, so the transition has a start state to move from
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () { el.classList.add('is-open'); });
      });

      function dismiss() {
        el.classList.remove('is-open');
        rememberNudgeDismissed();
        // Remove only once it has finished travelling, or it vanishes
        window.setTimeout(function () {
          if (el.parentNode) el.parentNode.removeChild(el);
        }, reduceMotion ? 0 : 500);
      }

      el.querySelector('.nudge-close').addEventListener('click', dismiss);

      document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        // The consult dialog and the nav own Escape while they are open
        if (document.querySelector('dialog[open]')) return;
        if (!el.parentNode) return;
        dismiss();
      });
    }, NUDGE_DELAY);
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

      /* Focus the first field on a pointer-and-keyboard machine, where it
         saves a click. NOT on a touch device: it raises the soft keyboard
         immediately, which eats half the viewport before the reader has
         seen what the box is, and scrolls the heading out of view.
         showModal() has already moved focus into the dialog, so the
         keyboard path is intact either way. */
      if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        var first = dlg.querySelector('input');
        if (first) first.focus();
      }
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
    initLogoWall();
    initHeroVideo();
    initPhotoHeroVideo();
    initWaitlistForms();
    initConsultDialog();
    initNewsletterNudge();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
