(() => {
  const doc = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const HAS_GSAP = !!(window.gsap && window.ScrollTrigger);
  const MOTION = !RM && HAS_GSAP;

  window.__eckles = true;
  doc.classList.add(MOTION ? 'has-motion' : 'no-motion');

  if (HAS_GSAP) gsap.registerPlugin(ScrollTrigger);

  /* ---------------- Smooth scroll ---------------- */
  let lenis = null;
  if (MOTION && window.Lenis) {
    lenis = new Lenis({ lerp: 0.095, wheelMultiplier: 0.95 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  const lockScroll = (on) => {
    if (lenis) on ? lenis.stop() : lenis.start();
    document.body.style.overflow = on ? 'hidden' : '';
  };

  /* ---------------- Nav ---------------- */
  const nav = $('[data-nav]');
  const toggle = $('.nav__toggle');
  const menu = $('#menu');
  let menuOpen = false;
  let lastY = window.scrollY;

  const onScroll = (y) => {
    nav.classList.toggle('is-scrolled', y > 40);
    const delta = y - lastY;
    if (Math.abs(delta) > 6) {
      const holdsFocus = nav.contains(document.activeElement);
      nav.classList.toggle('is-hidden', delta > 0 && y > window.innerHeight * 1.1 && !menuOpen && !holdsFocus);
      lastY = y;
    }
  };
  if (lenis) lenis.on('scroll', (e) => onScroll(e.scroll));
  else window.addEventListener('scroll', () => onScroll(window.scrollY), { passive: true });
  onScroll(window.scrollY);

  // current-section indicator
  const navLinks = $$('.nav__link');
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      navLinks.forEach((a) => a.classList.toggle('is-current', a.getAttribute('href') === '#' + en.target.id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  navLinks.forEach((a) => { const t = $(a.getAttribute('href')); if (t) sectionObserver.observe(t); });

  /* ---------------- Mobile menu (disclosure; the rest of the page is inert while open) ---------------- */
  const outside = [$('main'), $('footer'), $('.brand'), $('.nav__cta')];
  const setMenu = (open, restoreFocus = true) => {
    menuOpen = open;
    toggle.setAttribute('aria-expanded', String(open));
    $('.nav__toggle-text', toggle).textContent = open ? 'Close' : 'Menu';
    outside.forEach((el) => { el.inert = open; });
    if (open) {
      menu.hidden = false;
      void menu.offsetHeight;
      menu.classList.add('is-open');
      nav.classList.remove('is-hidden');
      lockScroll(true);
      $('a', menu).focus({ preventScroll: true });
    } else {
      menu.classList.remove('is-open');
      lockScroll(false);
      setTimeout(() => { if (!menuOpen) menu.hidden = true; }, 450);
      if (restoreFocus) toggle.focus({ preventScroll: true });
    }
  };
  toggle.addEventListener('click', () => setMenu(!menuOpen));
  document.addEventListener('keydown', (e) => {
    if (!menuOpen) return;
    if (e.key === 'Escape') setMenu(false);
    if (e.key === 'Tab') {
      const items = [toggle, ...$$('a, button', menu)];
      const i = items.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
      else if (!e.shiftKey && i === items.length - 1) { e.preventDefault(); items[0].focus(); }
    }
  });

  /* ---------------- In-page anchors ---------------- */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    const target = id === '#top' ? $('#top') : $(id);
    if (!target) return;
    e.preventDefault();
    if (menuOpen) setMenu(false, false);
    const focusTarget = () => {
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    };
    if (lenis) {
      // long trips jump most of the way, then glide the last viewport
      const dest = id === '#top' ? 0 : target.getBoundingClientRect().top + window.scrollY;
      const gap = dest - window.scrollY;
      if (Math.abs(gap) > window.innerHeight * 2) lenis.scrollTo(dest - Math.sign(gap) * window.innerHeight, { immediate: true });
      lenis.scrollTo(dest, { duration: 0.8, onComplete: focusTarget });
    } else { target.scrollIntoView({ behavior: RM ? 'auto' : 'smooth' }); focusTarget(); }
    history.replaceState(null, '', id);
  });

  /* ---------------- Enquiry dialog ---------------- */
  const dlg = $('#enquire-dialog');
  let opener = null;
  const closeDlg = () => {
    if (!dlg.open || dlg.classList.contains('is-closing')) return;
    if (RM) { dlg.close(); return; }
    dlg.classList.add('is-closing');
    setTimeout(() => { dlg.classList.remove('is-closing'); dlg.close(); }, 180);
  };
  $$('[data-enquire]').forEach((b) => b.addEventListener('click', () => {
    opener = b;
    if (menuOpen) setMenu(false, false);
    dlg.showModal();
    lockScroll(true);
  }));
  $('[data-close]', dlg).addEventListener('click', closeDlg);
  dlg.addEventListener('click', (e) => { if (e.target === dlg) closeDlg(); });
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); closeDlg(); });
  dlg.addEventListener('close', () => {
    lockScroll(false);
    if (opener) (opener.closest('#menu') ? toggle : opener).focus({ preventScroll: true });
  });
  $$('.option', dlg).forEach((o) => o.addEventListener('click', () => setTimeout(closeDlg, 150)));

  /* ---------------- Text splitting ---------------- */
  const splitWords = (el, masked) => {
    const out = [];
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === 3) {
          const parts = child.textContent.split(/([ \n\t\r]+)/);
          const frag = document.createDocumentFragment();
          parts.forEach((p) => {
            if (!p) return;
            if (/^[ \n\t\r]+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.className = masked ? 'w' : 'ww';
            if (masked) {
              const wi = document.createElement('span');
              wi.className = 'wi';
              wi.textContent = p;
              w.appendChild(wi);
              out.push(wi);
            } else {
              w.textContent = p;
              out.push(w);
            }
            frag.appendChild(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1) {
          if (child.classList.contains('pill-img')) out.push(child);
          else walk(child);
        }
      });
    };
    walk(el);
    return out;
  };

  /* ---------------- Reveals (IntersectionObserver) ---------------- */
  if (!RM) {
    const revealSel = [
      '.strip__list li', '.intro__copy > *', '.weddings__copy > *', '.lambeth__copy > *',
      '.celebrations__lede', '.celebrations__head .btn', '.jesse__copy > p', '.taste__intro',
      '.taste__sub', '.index li', '.flavours', '.voice__more > *', '.voice__main figcaption',
      '.finale__paths .path', '.finale__note', '.footer__grid > div', '.gram__head > p',
      '.gram__handle', '.process__head .eyebrow', '.collection__lede', '.collection__hint',
    ].join(',');
    const reveal = (el) => {
      const sibs = [...el.parentElement.children].filter((c) => c.hasAttribute('data-reveal') || c.classList.contains('clip-reveal'));
      el.style.transitionDelay = Math.min(Math.max(0, sibs.indexOf(el)) * 0.08, 0.4) + 's';
      el.classList.add('is-in');
      setTimeout(() => { el.style.transitionDelay = ''; }, 1800);
    };
    $$(revealSel).forEach((el) => el.setAttribute('data-reveal', ''));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        reveal(en.target);
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    $$('[data-reveal]').forEach((el) => io.observe(el));

    // clipped elements have zero visible area, which IntersectionObserver ignores — use geometry instead
    if (HAS_GSAP) {
      $$('.intro__detail, .arch, .tile img, .wfig--detail img, .wfig--moment img, .jesse__clip, .gram__item, .wfig__clip').forEach((el) => {
        el.classList.add('clip-reveal');
        ScrollTrigger.create({ trigger: el, start: 'top 92%', once: true, onEnter: () => reveal(el) });
      });
    }
  }

  /* ---------------- Hover preview (taster & workshop index) ---------------- */
  const preview = $('.preview');
  if (FINE && !RM && preview && HAS_GSAP) {
    const pImg = $('.preview__img', preview);
    gsap.set(preview, { xPercent: -50, yPercent: -108, scale: 0.85, transformOrigin: '50% 100%' });
    const xTo = gsap.quickTo(preview, 'x', { duration: 0.7, ease: 'power3' });
    const yTo = gsap.quickTo(preview, 'y', { duration: 0.7, ease: 'power3' });
    let warmed = false;
    const rows = $$('[data-preview]');
    $('.taste').addEventListener('pointermove', (e) => { xTo(e.clientX); yTo(e.clientY); });
    rows.forEach((r) => {
      r.addEventListener('pointerenter', (e) => {
        if (!warmed) { rows.forEach((x) => { const i = new Image(); i.src = x.dataset.preview; }); warmed = true; }
        if (!preview.classList.contains('is-on')) { gsap.set(preview, { x: e.clientX, y: e.clientY }); }
        pImg.style.backgroundImage = `url("${r.dataset.preview}")`;
        preview.classList.add('is-on');
        gsap.to(preview, { scale: 1, rotate: gsap.utils.random(-5, 5), duration: 0.8, ease: 'expo.out' });
      });
      r.addEventListener('pointerleave', () => {
        preview.classList.remove('is-on');
        gsap.to(preview, { scale: 0.85, duration: 0.6, ease: 'expo.out' });
      });
    });
  }

  /* ---------------- Magnetic buttons ---------------- */
  if (FINE && MOTION) {
    $$('[data-magnetic]').forEach((el) => {
      gsap.set(el, { '--mx': '0px', '--my': '0px' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) * 0.22;
        const dy = (e.clientY - (r.top + r.height / 2)) * 0.32;
        gsap.to(el, { '--mx': dx + 'px', '--my': dy + 'px', duration: 0.5, ease: 'power3.out' });
      });
      el.addEventListener('pointerleave', () => {
        gsap.to(el, { '--mx': '0px', '--my': '0px', duration: 0.6, ease: 'power3.out' });
      });
    });
  }

  /* ---------------- Lambeth: the image moves inside the letters ---------------- */
  const lambeth = $('#lambeth');
  if (FINE && !RM && lambeth) {
    const word = $('[data-lambeth]', lambeth);
    lambeth.addEventListener('pointermove', (e) => {
      const r = word.getBoundingClientRect();
      const px = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1);
      const py = Math.min(Math.max((e.clientY - r.top) / r.height, 0), 1);
      word.style.setProperty('--bx', (30 + px * 40).toFixed(1) + '%');
      word.style.setProperty('--by', (30 + py * 32).toFixed(1) + '%');
    });
  }

  if (!MOTION) return;

  /* ====================================================================
     GSAP choreography
     ==================================================================== */

  /* ---------- Hero intro ---------- */
  const hero = $('.hero');
  const heroWin = $('.hero__window', hero);
  const heroImg = $('.hero__img', hero);
  const heroMedia = $('.hero__media', hero);
  const heroLines = $$('.hl__in', hero);

  gsap.timeline({ delay: 0.05 })
    .to(heroWin, { '--rt': '0svh', duration: 1.1, ease: 'expo.inOut' }, 0)
    .fromTo(heroImg, { scale: 1.3 }, { scale: 1, duration: 1.6, ease: 'expo.out' }, 0.1)
    .to(heroLines, { y: 0, duration: 1, ease: 'expo.out', stagger: (i) => (i % 3) * 0.07 }, 0.3)
    .to(['.hero__intro', '.hero__proof'], { opacity: 1, y: 0, duration: 0.8, ease: 'expo.out', stagger: 0.08 }, 0.5);

  const mm = gsap.matchMedia();

  /* ---------- Hero: arch window opens to full-bleed ---------- */
  mm.add({ desktop: '(min-width: 961px)', mobile: '(max-width: 960px)' }, (ctx) => {
    const { desktop } = ctx.conditions;
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: desktop ? '+=115%' : '+=75%',
        pin: true,
        scrub: lenis ? true : 0.5,
        anticipatePin: 1,
        refreshPriority: 3,
        invalidateOnRefresh: true,
      },
    });
    // the arch-sized photo scales (GPU only) so its edges track the opening arch, ending centred and covering the viewport
    const cover = () => Math.max(window.innerWidth / heroMedia.offsetWidth, window.innerHeight / heroMedia.offsetHeight);
    const centre = () => window.innerHeight / 2 - (heroMedia.offsetTop + heroMedia.offsetHeight / 2);
    tl.to(hero, { '--t': '0svh', '--s': '0vw', '--b': '0svh', '--r': '0vw', ease: 'none' }, 0)
      .fromTo(heroMedia, { scale: 1, y: 0 }, { scale: cover, y: centre, ease: 'none' }, 0)
      .to('.hero__foot', { opacity: 0, y: -40, ease: 'power1.in', duration: 0.35 }, 0)
      .to($$('.hl--1', hero), { xPercent: -5, ease: 'none' }, 0)
      .to($$('.hl--2', hero), { xPercent: 5, ease: 'none' }, 0)
      .to($$('.hl--3', hero), { yPercent: -12, ease: 'none' }, 0)
      .fromTo('.hero__shade', { '--dim': 0 }, { '--dim': 1, ease: 'power1.in' }, 0);
    return () => { hero.style.removeProperty('--t'); };
  });

  /* ---------- Split headline reveals ---------- */
  $$('[data-split]').forEach((el) => {
    const words = splitWords(el, true);
    gsap.from(words, {
      yPercent: 115,
      duration: 1.4,
      ease: 'expo.out',
      stagger: 0.07,
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });
  });

  /* ---------- Scrubbed word illumination ---------- */
  $$('[data-words]').forEach((el) => {
    const words = splitWords(el, false);
    gsap.fromTo(words, { opacity: 0.14 }, {
      opacity: 1,
      ease: 'none',
      stagger: 0.12,
      scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 52%', scrub: 0.6 },
    });
  });

  /* ---------- Collection: horizontal editorial scroll ---------- */
  const track = $('[data-track]');
  const pinEl = $('.collection__pin');
  const bar = $('.collection__bar');
  ScrollTrigger.create({
    trigger: '.collection',
    start: 'top bottom+=50%',
    once: true,
    onEnter: () => $$('img', track).forEach((i) => { i.loading = 'eager'; }),
  });
  mm.add('(min-width: 961px)', () => {
    const dist = () => track.scrollWidth - window.innerWidth;
    const tween = gsap.to(track, {
      x: () => -dist(),
      ease: 'none',
      scrollTrigger: {
        trigger: pinEl,
        start: 'top top',
        end: () => '+=' + dist(),
        pin: true,
        scrub: lenis ? true : 0.5,
        invalidateOnRefresh: true,
        refreshPriority: 2,
        onUpdate: (self) => { bar.style.transform = `scaleX(${self.progress})`; },
      },
    });
    // keyboard focus inside the transformed track: scroll the page to where that item is on screen
    const onFocus = (e) => {
      const st = tween.scrollTrigger;
      pinEl.scrollLeft = 0;
      const p =Math.min(1, Math.max(0, (e.target.offsetLeft - window.innerWidth * 0.3) / dist()));
      if (lenis) lenis.scrollTo(st.start + p * (st.end - st.start), { immediate: true });
      else window.scrollTo(0, st.start + p * (st.end - st.start));
    };
    track.addEventListener('focusin', onFocus);
    $$('.piece__media img', track).forEach((img) => {
      gsap.fromTo(img, { xPercent: -7 }, {
        xPercent: 7,
        ease: 'none',
        scrollTrigger: { trigger: img.parentElement, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true },
      });
    });
    $$('.piece figcaption', track).forEach((cap) => {
      gsap.from(cap.children, {
        y: 24, opacity: 0, duration: 0.8, ease: 'expo.out', stagger: 0.06,
        scrollTrigger: { trigger: cap, containerAnimation: tween, start: 'left 85%' },
      });
    });
    return () => track.removeEventListener('focusin', onFocus);
  });

  /* ---------- Process: pinned chapters + piped garland ---------- */
  const garland = $('.garland');
  const steps = $$('.steps > .step');
  const count = $('[data-step-count]');
  gsap.set(garland, { '--draw': 1 });
  mm.add({ desktop: '(min-width: 961px)', mobile: '(max-width: 960px)' }, (ctx) => {
    if (ctx.conditions.mobile) {
      gsap.to(garland, { '--draw': 0, ease: 'none', scrollTrigger: { trigger: garland, start: 'top 95%', end: 'top 45%', scrub: true } });
      return;
    }
    let current = 0;
    const setStep = (i) => {
      if (i === current) return;
      steps.forEach((s, k) => {
        s.classList.toggle('is-prev', k === current);
        s.classList.toggle('is-active', k === i);
      });
      current = i;
      count.textContent = String(i + 1).padStart(2, '0');
    };
    ScrollTrigger.create({
      trigger: '.process__pin',
      start: 'top top',
      end: () => '+=' + window.innerHeight * steps.length * 0.85,
      pin: true,
      refreshPriority: 1,
      onUpdate: (self) => {
        setStep(Math.min(steps.length - 1, Math.floor(self.progress * steps.length)));
        garland.style.setProperty('--draw', String(1 - self.progress));
      },
    });
    return () => {
      steps.forEach((s, k) => { s.classList.toggle('is-active', k === 0); s.classList.remove('is-prev'); });
      count.textContent = '01';
    };
  });

  /* ---------- Parallax ---------- */
  $$('[data-speed]').forEach((el) => {
    const s = parseFloat(el.dataset.speed) || 0;
    gsap.fromTo(el, { y: () => -s * window.innerHeight * 0.5 }, {
      y: () => s * window.innerHeight * 0.5,
      ease: 'none',
      scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true },
    });
  });
  $$('[data-inner]').forEach((img) => {
    gsap.fromTo(img, { yPercent: -10 }, {
      yPercent: 0,
      ease: 'none',
      scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });
  gsap.fromTo('.finale__bg', { yPercent: -6 }, {
    yPercent: 6, ease: 'none',
    scrollTrigger: { trigger: '.finale', start: 'top bottom', end: 'bottom top', scrub: true },
  });

  /* ---------- Lambeth word rises ---------- */
  gsap.from('.lambeth__fill', {
    yPercent: 30, opacity: 0, duration: 1.2, ease: 'expo.out',
    scrollTrigger: { trigger: '.lambeth__word', start: 'top 85%', once: true },
  });

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
