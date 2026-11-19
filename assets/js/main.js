/* Listing template · motion: elevator intro · hero card → view · menu · framed reveals · pinned story / strip · price odometer + rings. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = !!(window.gsap && window.ScrollTrigger);
  if (!hasGsap) { root.classList.add('rm'); root.classList.remove('has-intro'); }   // CDN failed: show everything statically
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const smooth = t => t * t * (3 - 2 * t);

  /* ---------------- deferred photos: load a section's photos when it is ~1.5 screens away ---------------- */
  const deferred = $$('img[data-src]');
  const loadImg = im => { if (!im.dataset.src) return; if (im.dataset.srcset) im.srcset = im.dataset.srcset; im.src = im.dataset.src; im.removeAttribute('data-src'); im.removeAttribute('data-srcset'); };
  const inHero = deferred.filter(im => im.closest('#hero'));
  const rest = deferred.filter(im => !im.closest('#hero'));
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      $$('img[data-src]', e.target).forEach(loadImg); io.unobserve(e.target);
    }), { rootMargin: '0px 0px 150% 0px' });
    new Set(rest.map(im => im.closest('section') || im.parentElement)).forEach(s => io.observe(s));
  } else rest.forEach(loadImg);
  // the view photo shares the first screen with the hero: fetch it only after the hero is in
  const loadHeroRest = () => inHero.forEach(loadImg);
  if (document.readyState === 'complete') loadHeroRest(); else addEventListener('load', loadHeroRest, { once: true });
  addEventListener('scroll', loadHeroRest, { once: true, passive: true });
  setTimeout(loadHeroRest, 2500);

  /* ---------------- English words never cut off: scale to fit the width ---------------- */
  function fitAll() {
    $$('.fit').forEach(el => {
      el.style.fontSize = '';
      const box = el.parentElement.clientWidth, w = el.scrollWidth;
      if (box > 0 && w > box) el.style.fontSize = (parseFloat(getComputedStyle(el).fontSize) * box / w * 0.98).toFixed(1) + 'px';
    });
  }
  fitAll();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitAll);

  /* ---------------- in-page navigation · menu · gallery (work with or without GSAP) ---------------- */
  let lenis = null, heroST = null;
  const VIEW_AT = 0.62;   // where "the view" headline is fully in, as a fraction of the hero pin
  const pad2 = n => String(n).padStart(2, '0');
  function scrollToHash(hash) {
    const t = hash && hash.length > 1 && $(hash);
    if (!t) return false;
    let y;
    if (hash === '#hero') y = 0;
    else if (hash === '#view' && heroST) y = heroST.start + (heroST.end - heroST.start) * VIEW_AT;
    else { const box = t.parentElement && t.parentElement.classList.contains('pin-spacer') ? t.parentElement : t; y = box.getBoundingClientRect().top + scrollY; }
    if (lenis) lenis.scrollTo(y, { duration: 1.6 }); else scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
    return true;
  }
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || a.closest('.menu')) return;
    if (scrollToHash(a.getAttribute('href'))) e.preventDefault();
  });
  initMenu();
  initGallery();

  /* ---------------- top bar · progress · light wash · rings parallax (plain scroll listeners: cheap) ---------------- */
  const bar = $('.topbar'), prog = $('.progress i'), hero = $('#hero'), facts = $('#facts'), ringsEl = $('.rings');
  let lastY = scrollY;
  const sizeRings = () => {
    if (!ringsEl) return;
    const max = Math.max(0, root.scrollHeight - innerHeight);
    ringsEl.style.height = Math.ceil(innerHeight + max * 0.1 + 2) + 'px';
  };
  function onScroll() {
    const y = scrollY, max = root.scrollHeight - innerHeight;
    prog.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
    if (ringsEl && !reduce) ringsEl.style.transform = `translate3d(0, ${(-y * 0.1).toFixed(1)}px, 0)`;
    const pastHero = hero ? y > heroEnd() - 60 : true;
    bar.classList.toggle('is-solid', y > 40);
    if (Math.abs(y - lastY) > 6) { bar.classList.toggle('is-up', y > lastY && y > 120 && pastHero); lastY = y; }
    if (facts) {
      // light section: crossfade in over its first ~30%, back out over its last ~25%
      const r = facts.getBoundingClientRect(), h = innerHeight;
      const inP = clamp01((h - r.top) / (r.height * 0.3));
      const outP = clamp01((h * 0.55 - r.bottom) / (h * 0.45));
      const w = r.top > h ? 0 : smooth(inP) * (1 - smooth(outP));
      root.style.setProperty('--wash', w.toFixed(3));
    }
    updatePill();
  }
  const heroEnd = () => { const sp = hero.parentElement.classList.contains('pin-spacer') ? hero.parentElement : hero; return sp.offsetTop + sp.offsetHeight - innerHeight; };

  /* ---------------- floating pill: never in pinned sequences, never on a headline or a framed photo's centre ---------------- */
  const pill = $('.pill');
  const noPillZones = ['#hero', '#story', '#onelevel'].map(s => $(s)).filter(Boolean);
  const visit = $('#visit');
  const guard = $$('.sh, .story-line, .price-sub, .extras, .loc-line, .text-link, .ol-sub, .cf-meta, .cf-bar');
  const frames = $$('.frame').filter(f => !f.closest('#story, #onelevel'));
  let pillHidden = true;
  function updatePill() {
    if (!pill) return;
    const h = innerHeight, vw = innerWidth;
    let hide = false;
    for (const el of noPillZones) {
      const box = el.parentElement.classList.contains('pin-spacer') ? el.parentElement : el;
      const r = box.getBoundingClientRect();
      if (r.top < h * 0.6 && r.bottom > h * 0.4) { hide = true; break; }
      if (el.id === 'hero' && r.bottom > h * 0.25) { hide = true; break; }
    }
    if (!hide && visit && visit.getBoundingClientRect().top < h) hide = true;
    if (!hide && $('.lightbox') && !$('.lightbox[hidden]')) hide = true;
    if (!hide) {
      const zoneTop = h - 20 - 44 - 16, half = 130, mid = vw / 2;
      hide = guard.some(el => {
        const r = el.getBoundingClientRect();
        return r.height && r.bottom > zoneTop && r.top < h && r.left < mid + half && r.right > mid - half;
      }) || frames.some(el => {
        const r = el.getBoundingClientRect();
        if (!r.height || r.right < 0 || r.left > vw) return false;
        const cy = (r.top + r.bottom) / 2, band = Math.min(120, r.height * 0.3);
        return cy + band > zoneTop && cy - band < h;
      });
    }
    if (hide !== pillHidden) { pillHidden = hide; pill.classList.toggle('is-hidden', hide); }
  }

  /* ---------------- price odometer (layout set up regardless; animation below) ---------------- */
  const digits = $$('.pd');
  const setDigit = (pd, v) => { $('.pd-col', pd).style.transform = `translateY(${-v * 5}%)`; };

  if (!hasGsap || reduce) {
    digits.forEach(pd => setDigit(pd, +pd.dataset.d));
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', () => { fitAll(); sizeRings(); onScroll(); });
    sizeRings(); onScroll();
    if (hasGsap) simpleFades();
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  gsap.defaults({ ease: 'power3.out' });

  /* ---------------- Lenis, wired to ScrollTrigger the standard way ---------------- */
  if (window.Lenis) {
    lenis = new Lenis({ duration: 1.1, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)), touchMultiplier: 1.2 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  addEventListener('scroll', onScroll, { passive: true });

  /* ---------------- element 1: header reveal (label, headline lines, hairline from the right) ---------------- */
  function revealHead(sh) {
    const tl = gsap.timeline(), lab = $('.sh-label', sh), lns = $$('.ln > span', sh), rule = $('.sh-rule', sh);
    if (lab) tl.fromTo(lab, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.7 }, 0);
    if (lns.length) tl.fromTo(lns, { yPercent: 105, y: 0 }, { yPercent: 0, duration: 0.9, stagger: 0.08 }, 0.1);
    if (rule) tl.fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: 'power2.inOut' }, 0.25);
    return tl;
  }
  $$('.sh').filter(sh => !sh.closest('#hero')).forEach(sh => {
    ScrollTrigger.create({ trigger: sh, start: 'top 86%', once: true, onEnter: () => revealHead(sh) });
  });
  const fadeIn = (el, delay = 0) => gsap.fromTo(el, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.7, delay });
  $$('[data-fade]').forEach(el => {
    ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => fadeIn(el, el.matches('.slot') ? 0.06 * $$('.slot').indexOf(el) : 0.08) });
  });

  /* ---------------- element 2: the frame draws (top-right, counter-clockwise), then the photo rises in ---------------- */
  const edges = el => ['t', 'l', 'b', 'r'].map(k => $('.fr-' + k, el));
  function hideFrame(el, inner) {
    const [t, l, b, r] = edges(el);
    gsap.set([t, b], { scaleX: 0 }); gsap.set([l, r], { scaleY: 0 });
    if (inner) gsap.set(inner, { clipPath: 'inset(100% 0% 0% 0%)' });
  }
  // constant drawing speed: each edge's share of the time follows its length
  function drawFrame(tl, el, at, dur, w, h) {
    const [t, l, b, r] = edges(el), per = dur / (2 * (w + h));
    tl.fromTo(t, { scaleX: 0 }, { scaleX: 1, duration: w * per, ease: 'none' }, at)
      .fromTo(l, { scaleY: 0 }, { scaleY: 1, duration: h * per, ease: 'none' }, at + w * per)
      .fromTo(b, { scaleX: 0 }, { scaleX: 1, duration: w * per, ease: 'none' }, at + (w + h) * per)
      .fromTo(r, { scaleY: 0 }, { scaleY: 1, duration: h * per, ease: 'none' }, at + (2 * w + h) * per);
    return tl;
  }
  const risePhoto = (tl, inner, at, dur) => tl.fromTo(inner, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: dur, ease: 'power2.inOut' }, at);
  $$('.frame[data-reveal]').forEach(fr => {
    const inner = $('.frame-in', fr), im = $('img', fr);
    ScrollTrigger.create({ trigger: fr, start: 'top 80%', once: true, onEnter: () => {
      const tl = gsap.timeline();
      drawFrame(tl, fr, 0, 0.9, fr.offsetWidth, fr.offsetHeight);
      risePhoto(tl, inner, 0.9, 0.9);
    } });
    // slow push-in while it stays in view
    gsap.fromTo(im, { scale: 1 }, { scale: 1.05, ease: 'none', scrollTrigger: { trigger: fr, start: 'top 80%', end: 'bottom top', scrub: true } });
  });

  /* ---------------- signature moments: the elevator, then the hero card → the view ---------------- */
  if (hero) {
    const clip = $('.hero-clip', hero), hcard = $('.hero-card', hero), himg = $('.hero-img', hero), hshade = $('.hero-shade', hero);
    const hhead = $('.hero-head', hero), hframe = $('.hero-frame', hero), hcap = $('.hero-cap', hero), hbottom = $('.hero-bottom', hero);
    const view = $('.view', hero), vimg = $('.view-img', hero), vshade = $('.view-shade', hero), vsub = $('.view-sub', hero);
    const vsh = view && $('.view-text .sh', view);

    // the card: framed, between the hero texts and the bottom row (tall on phones, the photo's ratio on wide screens)
    const rect = () => {
      const vw = hero.clientWidth, H = hero.offsetHeight, wide = vw >= 900 && vw > innerHeight;
      const top = hhead.offsetTop + hhead.offsetHeight + (wide ? 34 : 24);
      const bottom = (hbottom ? hbottom.offsetTop : H - 44) - (wide ? 30 : 20);
      const avail = Math.max(120, bottom - top);
      let w = wide ? Math.min(vw * 0.52, 980) : vw - 48;
      let h = wide ? w * 1000 / 1622 : Math.min(avail, w * 1.6);
      if (h > avail) { h = avail; if (wide) w = h * 1622 / 1000; }
      return { x: (vw - w) / 2, y: top + (avail - h) / 2, w, h, vw, H };
    };
    const cardClip = () => { const r = rect(); return `inset(${r.y}px ${r.vw - r.x - r.w}px ${r.H - r.y - r.h}px ${r.x}px)`; };
    // the photo is shrunk with the card (around the card's centre) but always still covers it
    const imgScale = () => { const r = rect(), cy = r.y + r.h / 2; return Math.min(1, Math.max(r.w / r.vw, r.h / 2 / cy, r.h / 2 / (r.H - cy)) * 1.04); };
    const place = () => {
      const r = rect(), origin = `${r.vw / 2}px ${r.y + r.h / 2}px`;
      gsap.set(hframe, { left: r.x - 10, top: r.y - 10, width: r.w + 20, height: r.h + 20 });
      gsap.set([himg, hcard], { transformOrigin: origin });
      if (hcap) gsap.set(hcap, { top: r.y + 14, right: r.vw - r.x - r.w + 14 });
    };
    place();
    ScrollTrigger.addEventListener('refreshInit', place);
    gsap.set(hshade, { opacity: 0 });

    // scroll: the card grows back to full screen and 27 crossfades into 28 (you stood up and looked out), then the view pans
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: hero, start: 'top top', end: () => '+=' + Math.round(innerHeight * 2.5), pin: true, scrub: 0.6, invalidateOnRefresh: true, anticipatePin: 1 }
    });
    heroST = tl.scrollTrigger;
    tl.fromTo(hframe, { opacity: 1 }, { opacity: 0, duration: 0.2 }, 0)
      .fromTo([hcap, hbottom].filter(Boolean), { opacity: 1 }, { opacity: 0, duration: 0.2 }, 0)
      .fromTo(hhead, { opacity: 1, y: 0 }, { opacity: 0, y: -40, duration: 0.4 }, 0)
      .fromTo(clip, { clipPath: () => cardClip() }, { clipPath: 'inset(0px 0px 0px 0px)', duration: 1, ease: 'power1.inOut' }, 0)
      .fromTo(himg, { scale: () => imgScale() }, { scale: 1.04, duration: 1, ease: 'power1.inOut' }, 0);
    if (view) {
      // the view: pan right → left over the treetops, headline at the bottom
      tl.fromTo(view, { opacity: 0 }, { opacity: 1, duration: 0.7 }, 0.15)
        .fromTo(vimg, { x: 0 }, { x: () => Math.max(0, vimg.offsetWidth - innerWidth), duration: 2.3 }, 0.1)
        .fromTo(vshade, { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0.85);
      if (vsh) {
        const lab = $('.sh-label', vsh), lns = $$('.ln > span', vsh), rule = $('.sh-rule', vsh);
        tl.fromTo(lab, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out' }, 0.95)
          .fromTo(lns, { yPercent: 105, y: 0 }, { yPercent: 0, duration: 0.3, stagger: 0.06, ease: 'power3.out' }, 1.0)
          .fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 0.3, ease: 'power2.inOut' }, 1.15);
      }
      if (vsub) tl.fromTo(vsub, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }, 1.3);
    }
    tl.to({}, { duration: 0.25 }, 2.4);

    // the hero arriving: frame draws around 27 while it settles (1.06 → 1), then the texts cascade in reading order
    const heroIn = (t, at) => {
      const r = rect(), k = at + 0.4, S = 0.08;
      hideFrame(hframe);
      drawFrame(t, hframe, at, 0.6, r.w + 20, r.h + 20);
      t.fromTo(hcard, { scale: 1.06 }, { scale: 1, duration: 0.9, ease: 'power2.out' }, at);
      const rise = (els, i) => { els = [].concat(els).filter(Boolean); if (els.length) t.fromTo(els, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, k + i * S); };
      const draw = (el, i) => { if (el) t.fromTo(el, { scaleX: 0 }, { scaleX: 1, duration: 0.55, ease: 'power2.inOut' }, k + i * S); };
      rise([$('.brand', bar), $('.menu-btn', bar)], 0); draw($('.topbar-line', bar), 0);
      rise($('.hero-label', hero), 1); rise($('.hero-title', hero), 2); rise($('.hero-meta', hero), 3); rise($('.hero-price', hero), 4);
      draw($('.hero-rule', hero), 5); rise($('.hero-bottom-in', hero), 6);
      if (hcap) t.fromTo($('.hero-cap-in', hcap), { opacity: 0 }, { opacity: 1, duration: 0.5 }, at + 0.45);
    };

    const intro = $('div.intro');
    if (root.classList.contains('has-intro') && intro) {
      intro.style.animation = 'none';
      const fl = $('.floor', intro), col = $('.floor-col', intro), seam = $('.door-seam', intro);
      const n = $$('.floor-col > span', intro).length, steps = n - 1;
      let done = false;
      const evs = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
      const skip = () => { if (!done) itl.progress(1); };
      const end = () => { if (done) return; done = true; evs.forEach(e => removeEventListener(e, skip)); root.classList.remove('has-intro'); intro.remove(); };
      const itl = gsap.timeline({ onComplete: end });
      // 0–0.4 doors closed, the display lights · 0.4–1.4 the floor counts up, slowing on the last step
      itl.fromTo(fl, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power1.out' }, 0.05);
      let at = 0.4;
      for (let k = 1; k <= steps; k++) {
        const last = k === steps, dur = steps === 1 ? 1 : last ? 0.36 : 0.64 / (steps - 1);
        itl.to(col, { yPercent: -100 * k / n, duration: dur, ease: last ? 'power3.out' : 'power2.inOut' }, at);
        at += dur;
      }
      // it lands: the seam brightens · 1.4–2.0 the doors part
      itl.to(seam, { opacity: 1, duration: 0.08, ease: 'none' }, 1.38)
        .to(seam, { opacity: 0, duration: 0.2, ease: 'power1.in' }, 1.5)
        .to(fl, { opacity: 0, duration: 0.25, ease: 'power1.in' }, 1.4)
        .to($('.door-l', intro), { xPercent: -100, duration: 0.6, ease: 'power3.inOut' }, 1.4)
        .to($('.door-r', intro), { xPercent: 100, duration: 0.6, ease: 'power3.inOut' }, 1.4);
      heroIn(itl, 1.4);
      evs.forEach(e => addEventListener(e, skip, { passive: true }));
    } else {
      if (intro) intro.remove();
      heroIn(gsap.timeline(), 0.1);
    }
  }

  /* ---------------- the home: pinned; the framed photo rises away while the next frame draws ---------------- */
  const story = $('#story');
  if (story) {
    const items = $$('.story-item', story), now = $('.story-now', story), n = items.length;
    const parts = items.map(it => ({ it, word: $('.story-word', it), fr: $('.frame', it), inner: $('.frame-in', it), img: $('.frame-in img', it), line: $('.story-line', it) }));
    parts.forEach(p => { hideFrame(p.fr, p.inner); gsap.set([p.word, p.line], { opacity: 0, y: 30 }); });
    let cur = -1;
    const setNow = i => { if (i !== cur) { cur = i; now.textContent = String(i + 1).padStart(2, '0'); } };
    const HOLD = 0.6, TRANS = 1.3, STEP = TRANS + HOLD;
    const total = HOLD + (n - 1) * STEP + 0.3;
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: story, start: 'top top', end: () => '+=' + Math.round(innerHeight * total * 0.75), pin: true, scrub: 0.6, invalidateOnRefresh: true, anticipatePin: 1,
        onUpdate: s => { const u = s.progress * total; setNow(Math.min(n - 1, Math.max(0, Math.floor((u - HOLD - TRANS * 0.5) / STEP) + 1))); }
      }
    });
    // first item: arrives as the section comes in (time-based: it's the entrance)
    ScrollTrigger.create({ trigger: story, start: 'top 55%', once: true, onEnter: () => {
      const p = parts[0], t = gsap.timeline();
      t.to(p.word, { opacity: 1, y: 0, duration: 0.9 }, 0);
      drawFrame(t, p.fr, 0.15, 0.9, p.fr.offsetWidth, p.fr.offsetHeight);
      risePhoto(t, p.inner, 1.0, 0.9);
      t.to(p.line, { opacity: 1, y: 0, duration: 0.7 }, 1.3);
    } });
    parts.forEach((p, i) => {
      const t0 = i === 0 ? 0 : HOLD + (i - 1) * STEP;
      tl.fromTo(p.img, { scale: 1 }, { scale: 1.05, duration: (i === 0 ? HOLD : STEP) + (i < n - 1 ? TRANS * 0.5 : 0.3) }, t0);
      if (i === 0) return;
      tl.to(parts[i - 1].it, { y: -90, opacity: 0, duration: 0.55, ease: 'power1.in' }, t0)
        .fromTo(p.word, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' }, t0 + 0.35);
      drawFrame(tl, p.fr, t0 + 0.25, 0.6, p.fr.offsetWidth || 1, p.fr.offsetHeight || 1);
      risePhoto(tl, p.inner, t0 + 0.7, 0.55);
      tl.fromTo(p.line, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' }, t0 + 0.95);
    });
    tl.to({}, { duration: 0.3 }, total - 0.3);
  }

  /* ---------------- one level: pinned horizontal strip of framed photos ---------------- */
  const ol = $('#onelevel');
  if (ol) {
    const strip = $('.ol-strip', ol), fill = $('.ol-fill', ol), labs = $$('.ol-label', ol);
    const dist = () => Math.max(0, strip.scrollWidth - strip.parentElement.clientWidth);
    let on = 0;
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: ol, start: 'top top', end: () => '+=' + Math.round(dist() * 1.15 + innerHeight * 0.35), pin: true, scrub: 0.6, invalidateOnRefresh: true, anticipatePin: 1,
        onUpdate: s => {
          const p = clamp01((s.progress - 0.12) / 0.8), i = Math.min(labs.length - 1, Math.round(p * (labs.length - 1)));
          if (i !== on) { labs[on].classList.remove('is-on'); labs[i].classList.add('is-on'); on = i; }
        }
      }
    });
    // RTL: the first room starts on the right; the strip moves right to bring the next rooms in from the left
    tl.to({}, { duration: 0.12 })
      .fromTo(strip, { x: 0 }, { x: () => dist(), duration: 0.8 }, 0.12)
      .fromTo(fill, { scaleX: 1 / labs.length }, { scaleX: 1, duration: 0.8 }, 0.12)
      .to({}, { duration: 0.08 });
    $$('.ol-item img', ol).forEach(img => tl.fromTo(img, { scale: 1.05 }, { scale: 1, duration: 1 }, 0));
  }

  /* ---------------- the price: odometer roll + rings drawing in, once ---------------- */
  const price = $('#price');
  if (price) {
    digits.forEach(pd => { $('.pd-col', pd).style.transform = ''; });
    const ringPaths = $$('.price-rings path', price);
    ScrollTrigger.create({ trigger: $('.price-num', price), start: 'top 78%', once: true, onEnter: () => {
      const tl = gsap.timeline();
      tl.to(ringPaths, { strokeDashoffset: 0, duration: 2.4, stagger: 0.07, ease: 'power2.out' }, 0);
      digits.forEach((pd, i) => {
        const d = +pd.dataset.d, col = $('.pd-col', pd);
        tl.fromTo(col, { yPercent: 0 }, { yPercent: -(10 + d) * 5, duration: 1.2, ease: 'power4.out' }, 0.1 + i * 0.06);
      });
      tl.to($$('.pc', price), { opacity: 1, duration: 0.5, ease: 'power2.out' }, 0.9);
    } });
  }

  /* ---------------- in numbers: count up once ---------------- */
  $$('.fact-num').forEach(el => {
    const raw = el.dataset.count, to = parseFloat(raw), dec = (raw.split('.')[1] || '').length;
    if (!isFinite(to)) return;
    const o = { v: 0 };
    el.textContent = (0).toFixed(dec);
    ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true, onEnter: () => gsap.to(o, { v: to, duration: 1, ease: 'power2.out', onUpdate: () => { el.textContent = o.v.toFixed(dec); } }) });
  });

  /* ---------------- refresh discipline ---------------- */
  ScrollTrigger.addEventListener('refreshInit', fitAll);
  ScrollTrigger.addEventListener('refresh', () => { sizeRings(); onScroll(); });
  ScrollTrigger.refresh();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
  addEventListener('load', () => ScrollTrigger.refresh(), { once: true });

  /* ================================================================ */
  function simpleFades() {
    gsap.registerPlugin(ScrollTrigger);
    $$('[data-fade], [data-lines], .sh').forEach(el => {
      gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'power1.out', scrollTrigger: { trigger: el, start: 'top 92%', once: true } });
    });
  }

  function initMenu() {
    const menu = $('#menu'), btn = $('.menu-btn');
    if (!menu || !btn) return;
    const closeBtn = $('.menu-close', menu), links = $$('.menu-link', menu);
    const anim = () => !!window.gsap && !reduce;
    let isOpen = false;
    const open = () => {
      if (isOpen) return; isOpen = true;
      menu.hidden = false; btn.setAttribute('aria-expanded', 'true');
      root.classList.add('menu-open'); if (lenis) lenis.stop();
      if (anim()) {
        gsap.fromTo(menu, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'power2.out' });
        gsap.fromTo(links, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.55, stagger: 0.05, ease: 'power3.out', delay: 0.08 });
      }
      closeBtn.focus();
    };
    const close = then => {
      if (!isOpen) return; isOpen = false;
      btn.setAttribute('aria-expanded', 'false');
      const done = () => { menu.hidden = true; root.classList.remove('menu-open'); if (lenis) lenis.start(); if (then) then(); else btn.focus(); };
      if (anim()) gsap.to(menu, { opacity: 0, duration: 0.25, ease: 'power2.in', onComplete: done }); else done();
    };
    btn.addEventListener('click', open);
    closeBtn.addEventListener('click', () => close());
    links.forEach(a => a.addEventListener('click', e => { e.preventDefault(); const h = a.getAttribute('href'); close(() => scrollToHash(h)); }));
    menu.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'Tab') {
        const f = [closeBtn, ...links], first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  function initGallery() {
    const data = $('#gallery-data'), lb = $('.lightbox'), cf = $('.cf');
    if (!data || !lb || !cf) return;
    const photos = JSON.parse(data.textContent);

    /* ---- the carousel: native scroll-snap (momentum on iPhone), the coverflow look follows the scroll position ---- */
    const track = $('.cf-track', cf), slides = $$('.cf-slide', track);
    const cards = slides.map(sl => $('.cf-card', sl)), dims = slides.map(sl => $('.cf-dim', sl));
    const segs = $$('.cf-seg'), now = $('.cf-now'), en = $('.cf-en'), he = $('.cf-he'), cap = $('.cf-cap');
    const last = slides.length - 1;
    let W = 1, active = 0, ticking = 0;
    const prevA = slides.map(() => -1);
    const measure = () => { W = slides[0].offsetWidth || 1; };
    const setActive = i => {
      if (i === active) return;
      slides[active].classList.remove('is-on'); if (segs[active]) segs[active].classList.remove('is-on');
      active = i;
      slides[i].classList.add('is-on'); if (segs[i]) segs[i].classList.add('is-on');
      now.textContent = pad2(i + 1); en.textContent = photos[i].latin; he.textContent = photos[i].he;
      if (!reduce && cap.animate) cap.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 450, easing: 'cubic-bezier(.22,.9,.3,1)' });
    };
    const render = () => {
      ticking = 0;
      const p = track.scrollLeft / W;
      for (let i = 0; i <= last; i++) {
        const d = i - p, a = Math.min(1, Math.abs(d));
        if (a === 1 && prevA[i] === 1) continue;
        prevA[i] = a;
        const sc = 1 - 0.22 * a, tx = -Math.sign(d) * a * W * 0.05;   // neighbours: 78%, 35%, pulled in a touch so they peek
        cards[i].style.transform = `translate3d(${tx.toFixed(1)}px,0,0) scale(${sc.toFixed(4)})`;
        cards[i].style.opacity = (1 - 0.65 * a).toFixed(3);
        dims[i].style.opacity = (0.4 * a).toFixed(3);
      }
      setActive(Math.max(0, Math.min(last, Math.round(p))));
    };
    const go = (i, smooth = true) => { i = Math.max(0, Math.min(last, i)); track.scrollTo({ left: i * W, behavior: smooth && !reduce ? 'smooth' : 'auto' }); };
    track.addEventListener('scroll', () => { if (!ticking) ticking = requestAnimationFrame(render); }, { passive: true });
    addEventListener('resize', () => { measure(); prevA.fill(-1); go(active, false); render(); });
    measure(); render();

    cards.forEach((c, i) => c.addEventListener('click', () => {
      if (track.dataset.dragged) return;
      if (i === active) openLb(i, c); else go(i);
    }));
    segs.forEach((b, i) => b.addEventListener('click', () => go(i)));
    $('.cf-prev', cf).addEventListener('click', () => go(active - 1));
    $('.cf-next', cf).addEventListener('click', () => go(active + 1));
    track.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(active + 1); }   // laid out LTR: the next photo is on the right
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(active - 1); }
      else if (e.key === 'Enter' && e.target === track) openLb(active, cards[active]);
    });
    // mouse drag on desktop (touch stays native)
    let down = null;
    track.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' || e.button !== 0) return; down = { x: e.clientX, s: track.scrollLeft, moved: false, v: 0, lx: e.clientX, lt: performance.now() }; });
    addEventListener('pointermove', e => {
      if (!down) return;
      const dx = e.clientX - down.x, t = performance.now();
      if (!down.moved && Math.abs(dx) > 6) { down.moved = true; track.classList.add('is-drag'); track.dataset.dragged = '1'; }
      if (down.moved) { track.scrollLeft = down.s - dx; down.v = (e.clientX - down.lx) / Math.max(1, t - down.lt); down.lx = e.clientX; down.lt = t; }
    });
    addEventListener('pointerup', () => {
      if (!down) return;
      const d = down; down = null;
      if (!d.moved) return;
      track.classList.remove('is-drag');
      go(Math.round((track.scrollLeft - d.v * 220) / W));
      setTimeout(() => { delete track.dataset.dragged; }, 50);
    });

    /* ---- the full-screen lightbox ---- */
    const lbTrack = $('.lb-track', lb), count = $('.lb-count', lb), closeBtn = $('.lb-close', lb);
    lbTrack.innerHTML = photos.map((p, i) => `<figure class="lb-slide" data-i="${i}"><img data-src="${p.src}" alt="${p.alt.replace(/"/g, '&quot;')}" width="${p.w}" height="${p.h}" decoding="async"></figure>`).join('');
    const lbSlides = $$('.lb-slide', lbTrack);
    let idx = 0, opener = null, raf = 0;
    const load = i => { const im = lbSlides[i] && $('img', lbSlides[i]); if (im && !im.src) im.src = im.dataset.src; };
    const setCount = i => { idx = i; count.textContent = `${pad2(i + 1)} / ${pad2(photos.length)}`; load(i - 1); load(i); load(i + 1); };
    const lbGo = (i, smoothScroll = true) => {
      i = Math.max(0, Math.min(photos.length - 1, i));
      lbTrack.scrollTo({ left: i * lbTrack.clientWidth, behavior: smoothScroll && !reduce ? 'smooth' : 'auto' });
      setCount(i);
    };
    lbTrack.addEventListener('scroll', () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { const i = Math.round(lbTrack.scrollLeft / lbTrack.clientWidth); if (i !== idx) setCount(i); });
    }, { passive: true });
    function openLb(i, from) {
      opener = from || document.activeElement;
      lb.hidden = false;
      root.classList.add('lb-open'); document.body.classList.add('lb-open');
      if (lenis) lenis.stop();
      setCount(i);
      requestAnimationFrame(() => { lbGo(i, false); closeBtn.focus(); });
      updatePill();
    }
    const closeLb = () => {
      lb.hidden = true;
      root.classList.remove('lb-open'); document.body.classList.remove('lb-open');
      if (lenis) lenis.start();
      go(idx, false);   // the carousel follows to where the lightbox was left
      if (cards[idx]) cards[idx].focus({ preventScroll: true }); else if (opener) opener.focus();
      updatePill();
    };
    closeBtn.addEventListener('click', closeLb);
    $('.lb-prev', lb).addEventListener('click', () => lbGo(idx - 1));
    $('.lb-next', lb).addEventListener('click', () => lbGo(idx + 1));
    lb.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); closeLb(); }
      else if (e.key === 'ArrowRight') lbGo(idx + 1);
      else if (e.key === 'ArrowLeft') lbGo(idx - 1);
      else if (e.key === 'Tab') {
        const f = $$('button', lb).filter(b => b.offsetParent !== null);
        const first = f[0], lastB = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastB.focus(); }
        else if (!e.shiftKey && document.activeElement === lastB) { e.preventDefault(); first.focus(); }
      }
    });
  }
})();
