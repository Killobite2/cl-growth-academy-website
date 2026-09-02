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

    // Escape closes and returns focus to the trigger
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close(true);
    });

    // Clicking outside the nav closes it
    document.addEventListener('click', function (e) {
      if (isOpen() && !links.contains(e.target) && e.target !== toggle) close(false);
    });

    // Following a link closes the drawer
    links.addEventListener('click', function (e) {
      if (e.target.closest('a')) close(false);
    });

    // Leaving the mobile breakpoint resets state
    window.matchMedia('(min-width: 801px)').addEventListener('change', function (e) {
      if (e.matches) close(false);
    });
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

  function initClients() {
    var track = document.getElementById('logo-track');
    var panel = document.getElementById('testimonial-panel');
    if (!track || !panel) return;

    var quoteEl = document.getElementById('tp-quote');
    var logoEl = document.getElementById('tp-logo');
    var whoEl = document.getElementById('tp-who');

    function select(slug, tile) {
      var c = CLIENTS[slug];
      if (!c) return;

      var hasQuote = !!c.quote;
      panel.classList.toggle('is-placeholder', !hasQuote);
      quoteEl.textContent = hasQuote
        ? '“' + c.quote + '”'
        : '[TESTIMONIAL — ' + c.name + '. Paste their quote here.]';
      whoEl.textContent = hasQuote && c.who ? c.who + ' — ' + c.name : c.name;
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

    // Seed the panel so it is never empty on load
    var first = track.querySelector('.logo-tile');
    if (first) select(first.dataset.client, first);

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

  /* ---------------- Newsletter forms ----------------

     A plain cross-origin POST to Beehiiv would navigate the visitor
     away to Beehiiv's own confirmation page, so the on-page success
     copy would never show. Intercept submit, fire the POST via a
     no-cors fetch instead (the response is opaque, so this
     optimistically assumes success once the request is sent), then
     swap the form for the adjacent .form-success message. */

  function initNewsletterForms() {
    var forms = document.querySelectorAll('.newsletter-form');
    if (!forms.length) return;

    forms.forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();

        var email = form.querySelector('input[name="email"]').value;

        fetch(form.action, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'email=' + encodeURIComponent(email)
        }).catch(function () {});

        form.classList.add('is-submitted');
        var success = form.parentElement.querySelector('.form-success');
        if (success) success.classList.add('is-visible');
      });
    });
  }

  /* ---------------- Boot ---------------- */

  function init() {
    initNav();
    initHeader();
    initReveals();
    initClients();
    initNewsletterForms();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
