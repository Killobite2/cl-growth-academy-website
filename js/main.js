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

  /* ---------------- Boot ---------------- */

  function init() {
    initNav();
    initHeader();
    initReveals();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
