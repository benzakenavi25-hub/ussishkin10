/* Listing template · motion: photo push-in · text reveal · pinned scrubbed sequences · price odometer. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = !!(window.gsap && window.ScrollTrigger);
  if (!hasGsap) root.classList.add('rm');            // CDN failed: show everything statically
  const portrait = () => innerWidth / innerHeight < 1;

  /* ---------------- deferred photos: load a section's photos when it is ~1.5 screens away ---------------- */
  const deferred = $$('img[data-src]');
  const loadImg = im => { if (im.dataset.srcset) im.srcset = im.dataset.srcset; im.src = im.dataset.src; im.removeAttribute('data-src'); im.removeAttribute('data-srcset'); };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      $$('img[data-src]', e.target).forEach(loadImg); io.unobserve(e.target);
    }), { rootMargin: '0px 0px 150% 0px' });
    new Set(deferred.map(im => im.closest('section') || im.parentElement)).forEach(s => io.observe(s));
  } else deferred.forEach(loadImg);

  /* ---------------- lightbox (works with or without GSAP) ---------------- */
  let lenis = null;
  initGallery();

  /* ---------------- top bar + progress + wash (plain scroll listeners: cheap) ---------------- */
  const bar = $('.topbar'), prog = $('.progress i'), hero = $('#hero'), facts = $('#facts');
  let lastY = scrollY;
  function onScroll() {
    const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
    prog.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
    const pastHero = hero ? y > heroEnd() - 60 : true;
    bar.classList.toggle('is-solid', pastHero);
    if (Math.abs(y - lastY) > 6) { bar.classList.toggle('is-up', y > lastY && y > 120); lastY = y; }
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
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const smooth = t => t * t * (3 - 2 * t);
  const heroEnd = () => { const sp = hero.parentElement.classList.contains('pin-spacer') ? hero.parentElement : hero; return sp.offsetTop + sp.offsetHeight - innerHeight; };

  /* ---------------- floating pill ---------------- */
  const pill = $('.pill');
  const noPillZones = ['#hero', '#signature', '#story', '#onelevel'].map(s => $(s)).filter(Boolean);
  const visit = $('#visit');
  const guard = $$('h2, .story-line, .sig-text, .price-num, .price-sub, .extras, .loc-line, .text-link');
  let pillHidden = true;
  function updatePill() {
    if (!pill) return;
    const h = innerHeight;
    let hide = false;
    // hero not finished, or a pinned / full-screen sequence is on screen
    for (const el of noPillZones) {
      const box = el.parentElement.classList.contains('pin-spacer') ? el.parentElement : el;
      const r = box.getBoundingClientRect();
      if (r.top < h * 0.5 && r.bottom > h * 0.5) { hide = true; break; }
      if (el.id === 'hero' && r.bottom > h * 0.25) { hide = true; break; }
    }
    if (!hide && visit && visit.getBoundingClientRect().top < h) hide = true;
    if (!hide && !$('.lightbox[hidden]') && $('.lightbox')) hide = true;
    if (!hide) {
      // never on top of a headline or a key line
      const zoneTop = h - 20 - 44 - 16, half = 130, mid = innerWidth / 2;
      hide = guard.some(el => {
        const r = el.getBoundingClientRect();
        return r.height && r.bottom > zoneTop && r.top < h && r.left < mid + half && r.right > mid - half;
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
    addEventListener('resize', onScroll);
    onScroll();
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
    $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
      const t = $(a.getAttribute('href')); if (!t) return;
      e.preventDefault(); lenis.scrollTo(t, { duration: 1.6 });
    }));
  }
  addEventListener('scroll', onScroll, { passive: true });

  /* ---------------- text reveals ---------------- */
  function lines(el, delay = 0) {
    return gsap.to($$('.ln > span', el), { y: 0, yPercent: 0, duration: 0.9, stagger: 0.08, delay, ease: 'power3.out' });
  }
  const fadeIn = (el, delay = 0) => gsap.fromTo(el, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.7, delay });
  // standalone reveals (not inside pinned sequences, which drive their own)
  $$('[data-lines]').filter(el => !el.closest('.signature')).forEach(el => {
    gsap.set($$('.ln > span', el), { yPercent: 105, y: 0 });
    ScrollTrigger.create({ trigger: el, start: 'top 86%', once: true, onEnter: () => lines(el) });
  });
  $$('[data-fade]').filter(el => !el.closest('.signature')).forEach(el => {
    ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => fadeIn(el, el.matches('.slot') ? 0.06 * $$('.slot').indexOf(el) : 0.08) });
  });


  /* ---------------- 7.1 hero: intro, then the shrink ---------------- */
  if (hero) {
    const card = $('.hero-card'), himg = $('.hero-img'), title = $('.hero-title'), label = $('.hero-label'), hint = $('.hero-hint'), shade = $('.hero-shade');
    gsap.set($$('.ln > span', title), { yPercent: 105, y: 0 });
    const intro = gsap.timeline({ paused: true, onComplete: () => title.classList.add('is-open') })
      .fromTo(himg, { scale: 1.12 }, { scale: 1, duration: 1.4, ease: 'power3.out' }, 0)
      .to($$('.ln > span', title), { yPercent: 0, y: 0, duration: 0.9, stagger: 0.08 }, 0.35)
      .fromTo($('.in', label), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.7 }, 0.85)
      .fromTo($('.in', hint), { opacity: 0 }, { opacity: 0.8, duration: 0.6 }, 1.2);
    const go = () => intro.play();
    if (himg.complete) requestAnimationFrame(go); else { himg.addEventListener('load', go, { once: true }); setTimeout(go, 1600); }

    // shrink: full-bleed → centred card (~82% × 62%), title rises and scales to ~55%
    const cardInset = () => {
      const w = innerWidth, h = innerHeight;
      const x = Math.round(w * (w >= 900 ? 0.14 : 0.09)), y = Math.round(h * 0.19);
      return { x, y };
    };
    const titleTarget = () => {
      // title's right edge on the card's right edge, sitting just above the card
      const { x, y } = cardInset();
      const r = title.getBoundingClientRect(), s = 0.55;
      const right = innerWidth - r.right;           // current gap to the right edge
      return { x: -(x - right), y: (y - 14 - r.height * s) - r.top, s };
    };
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: hero, start: 'top top', end: () => '+=' + Math.round(innerHeight * 1.2), pin: true, scrub: 0.6, invalidateOnRefresh: true, anticipatePin: 1 }
    });
    tl.fromTo(card, { clipPath: 'inset(0px 0px 0px 0px round 0px)' }, { clipPath: () => { const { x, y } = cardInset(); return `inset(${y}px ${x}px ${y}px ${x}px round 4px)`; }, duration: 1 }, 0)
      .fromTo(himg, { scale: 1 }, { scale: 0.94, duration: 1, immediateRender: false }, 0)
      .to(shade, { opacity: 0.35, duration: 0.6 }, 0)
      .fromTo([label, hint], { opacity: 1 }, { opacity: 0, duration: 0.25 }, 0)
      .to(title, { x: () => titleTarget().x, y: () => titleTarget().y, scale: 0.55, duration: 1 }, 0)
      .to({}, { duration: 0.18 });
  }

  /* ---------------- photo push-in (non-pinned full-bleed photos) ---------------- */
  $$('.push').forEach(img => {
    gsap.fromTo(img, { scale: 1 }, { scale: 1.06, ease: 'none', scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  /* ---------------- 7.2 signature: pan (portrait) or push-in (landscape), line reveals ---------------- */
  const sig = $('#signature');
  if (sig) {
    const simg = $('.sig-img', sig), stitle = $('.sig-title', sig), ssub = $('.sig-sub', sig);
    gsap.set($$('.ln > span', stitle), { yPercent: 105, y: 0 });
    if (ssub) gsap.set(ssub, { opacity: 0, y: 14 });
    // created inline (not in a matchMedia callback) so pins register in page order; portrait vs landscape is resolved on every refresh
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: sig, start: 'top top', end: () => '+=' + Math.round(innerHeight * 1.5), pin: true, scrub: 0.6, invalidateOnRefresh: true, anticipatePin: 1 }
    });
    // portrait: pan the panorama right → left · landscape: slow push-in
    tl.fromTo(simg, { x: 0, scale: 1 }, { x: () => portrait() ? Math.max(0, simg.offsetWidth - innerWidth) : 0, scale: () => portrait() ? 1 : 1.06, duration: 1 }, 0)
      .to($$('.ln > span', stitle), { yPercent: 0, y: 0, duration: 0.14, stagger: 0.03, ease: 'power3.out' }, 0.32);
    if (ssub) tl.to(ssub, { opacity: 0.86, y: 0, duration: 0.12, ease: 'power3.out' }, 0.5);
  }

  /* ---------------- 7.3 story: pinned stack, clip-path wipe from the bottom ---------------- */
  const story = $('#story');
  if (story) {
    const items = $$('.story-item', story), now = $('.story-now', story), n = items.length;
    const parts = items.map(it => ({ it, img: $('.story-img', it), ghost: $('.ghost', it), line: $('.story-line', it) }));
    let cur = -1;
    const setNow = i => { if (i !== cur) { cur = i; now.textContent = String(i + 1).padStart(2, '0'); } };
    const HOLD = 0.6, WIPE = 1;
    const total = HOLD + (n - 1) * (WIPE + HOLD);
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: story, start: 'top top', end: () => '+=' + Math.round(innerHeight * total), pin: true, scrub: 0.6, invalidateOnRefresh: true, anticipatePin: 1,
        onUpdate: s => { const u = s.progress * total; setNow(Math.min(n - 1, Math.max(0, Math.floor((u - HOLD - WIPE * 0.5) / (WIPE + HOLD)) + 1))); }
      }
    });
    // first item: words rise in as the section arrives (not scrubbed: it's the entrance)
    gsap.set([parts[0].ghost, parts[0].line], { opacity: 0, y: 30 });
    ScrollTrigger.create({ trigger: story, start: 'top 60%', once: true, onEnter: () => {
      gsap.to(parts[0].ghost, { opacity: 1, y: 0, duration: 1.1 });
      gsap.to(parts[0].line, { opacity: 1, y: 0, duration: 0.8, delay: 0.15 });
    } });
    parts.forEach((p, i) => {
      const t0 = i === 0 ? 0 : HOLD + (i - 1) * (WIPE + HOLD);           // when this item starts entering
      const life = (i === 0 ? HOLD : WIPE + HOLD) + (i < n - 1 ? WIPE : 0);
      // subtle drift: ≤ 8% of width over the item's time on screen
      tl.fromTo(p.img, { xPercent: 3.5 }, { xPercent: -3.5, duration: life }, t0);
      if (i === 0) return;
      tl.fromTo(p.it, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: WIPE, ease: 'power1.inOut' }, t0)
        .to(parts[i - 1].ghost, { yPercent: -60, opacity: 0, duration: WIPE * 0.6 }, t0)
        .to(parts[i - 1].line, { opacity: 0, y: -20, duration: WIPE * 0.4 }, t0)
        .fromTo(p.ghost, { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: WIPE * 0.6 }, t0 + WIPE * 0.4)
        .fromTo(p.line, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: WIPE * 0.35 }, t0 + WIPE * 0.62);
    });
    tl.to({}, { duration: HOLD * 0.5 });
  }

  /* ---------------- 7.4 one level: pinned horizontal strip ---------------- */
  const ol = $('#onelevel');
  if (ol) {
    const strip = $('.ol-strip', ol), fill = $('.ol-fill', ol), labs = $$('.ol-label', ol), head = $('.ol-head', ol);
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
    // RTL: kitchen starts on the right; the strip moves right to bring the next rooms in from the left
    tl.to({}, { duration: 0.12 })
      .fromTo(strip, { x: 0 }, { x: () => dist(), duration: 0.8 }, 0.12)
      .fromTo(fill, { scaleX: 1 / labs.length }, { scaleX: 1, duration: 0.8 }, 0.12)
      .to({}, { duration: 0.08 });
    $$('.ol-item img', ol).forEach(img => tl.fromTo(img, { scale: 1.06 }, { scale: 1, duration: 1 }, 0));
  }

  /* ---------------- 7.5 price: odometer roll, once ---------------- */
  const price = $('#price');
  if (price) {
    digits.forEach(pd => setDigit(pd, 0));
    ScrollTrigger.create({ trigger: $('.price-num', price), start: 'top 78%', once: true, onEnter: () => {
      const tl = gsap.timeline();
      digits.forEach((pd, i) => {
        const d = +pd.dataset.d, col = $('.pd-col', pd);
        tl.fromTo(col, { yPercent: 0 }, { yPercent: -(10 + d) * 5, duration: 1.2, ease: 'power4.out' }, i * 0.06);
      });
      tl.to($$('.pc', price), { opacity: 1, duration: 0.5, ease: 'power2.out' }, '-=0.35')
        .fromTo('.price-rule', { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: 'power3.inOut' }, '-=0.2');
    } });
    // odometer columns use yPercent on the column; clear the static transform
    digits.forEach(pd => { $('.pd-col', pd).style.transform = ''; });
  }

  /* ---------------- 7.6 facts: count up once ---------------- */
  $$('.fact-num').forEach(el => {
    const raw = el.dataset.count, to = parseFloat(raw), dec = (raw.split('.')[1] || '').length;
    if (!isFinite(to)) return;
    const o = { v: 0 };
    el.textContent = (0).toFixed(dec);
    ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true, onEnter: () => gsap.to(o, { v: to, duration: 1, ease: 'power2.out', onUpdate: () => { el.textContent = o.v.toFixed(dec); } }) });
  });

  /* ---------------- refresh discipline ---------------- */
  ScrollTrigger.addEventListener('refresh', onScroll);
  ScrollTrigger.refresh();
  onScroll();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
  addEventListener('load', () => ScrollTrigger.refresh(), { once: true });

  /* ================================================================ */
  function simpleFades() {
    gsap.registerPlugin(ScrollTrigger);
    $$('[data-fade], [data-lines]').forEach(el => {
      gsap.set($$('.ln > span', el), { yPercent: 0, y: 0 });
      gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'power1.out', scrollTrigger: { trigger: el, start: 'top 92%', once: true } });
    });
  }

  function initGallery() {
    const data = $('#gallery-data'), lb = $('.lightbox'), strip = $('.gal-strip');
    if (!data || !lb || !strip) return;
    const photos = JSON.parse(data.textContent);
    const track = $('.lb-track', lb), count = $('.lb-count', lb), closeBtn = $('.lb-close', lb);
    track.innerHTML = photos.map((p, i) => `<figure class="lb-slide" data-i="${i}"><img data-src="${p.src}" alt="${p.alt.replace(/"/g, '&quot;')}" width="${p.w}" height="${p.h}" decoding="async"></figure>`).join('');
    const slides = $$('.lb-slide', track);
    let idx = 0, opener = null;
    const load = i => { const im = slides[i] && $('img', slides[i]); if (im && !im.src) im.src = im.dataset.src; };
    const setCount = i => { idx = i; count.textContent = `${i + 1} / ${photos.length}`; load(i - 1); load(i); load(i + 1); };
    const goTo = (i, smoothScroll = true) => {
      i = Math.max(0, Math.min(photos.length - 1, i));
      slides[i].scrollIntoView({ behavior: smoothScroll && !reduce ? 'smooth' : 'auto', inline: 'center', block: 'nearest' });
      setCount(i);
    };
    let raf = 0;
    track.addEventListener('scroll', () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const w = track.clientWidth, i = Math.round(Math.abs(track.scrollLeft) / w);
        if (i !== idx) setCount(i);
      });
    }, { passive: true });
    const open = (i, from) => {
      opener = from || document.activeElement;
      lb.hidden = false;
      root.classList.add('lb-open'); document.body.classList.add('lb-open');
      if (lenis) lenis.stop();
      setCount(i);
      requestAnimationFrame(() => { goTo(i, false); closeBtn.focus(); });
      updatePillSafe();
    };
    const close = () => {
      lb.hidden = true;
      root.classList.remove('lb-open'); document.body.classList.remove('lb-open');
      if (lenis) lenis.start();
      if (opener) opener.focus();
      updatePillSafe();
    };
    const updatePillSafe = () => updatePill();
    $$('.gal-item', strip).forEach(b => b.addEventListener('click', () => { if (!strip.dataset.dragged) open(+b.dataset.i, b); }));
    closeBtn.addEventListener('click', close);
    $('.lb-prev', lb).addEventListener('click', () => goTo(idx - 1));
    $('.lb-next', lb).addEventListener('click', () => goTo(idx + 1));
    lb.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowLeft') goTo(idx + 1);       // RTL: left = next
      else if (e.key === 'ArrowRight') goTo(idx - 1);
      else if (e.key === 'Tab') {
        const f = $$('button', lb).filter(b => b.offsetParent !== null);
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    // strip: arrows + mouse drag (touch stays native)
    const step = () => ($('.gal-item', strip).offsetWidth + 16);
    $$('.gal-arrow').forEach(b => b.addEventListener('click', () => strip.scrollBy({ left: (b.dataset.dir === 'next' ? -1 : 1) * step(), behavior: 'smooth' })));
    let down = null;
    strip.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; down = { x: e.clientX, s: strip.scrollLeft, moved: false }; });
    addEventListener('pointermove', e => {
      if (!down) return;
      const dx = e.clientX - down.x;
      if (!down.moved && Math.abs(dx) > 6) { down.moved = true; strip.classList.add('is-drag'); strip.dataset.dragged = '1'; }
      if (down.moved) strip.scrollLeft = down.s - dx;
    });
    addEventListener('pointerup', () => {
      if (!down) return;
      const moved = down.moved; down = null;
      if (moved) {
        const s = strip.scrollLeft, w = step();
        strip.classList.remove('is-drag');
        strip.scrollTo({ left: Math.round(s / w) * w, behavior: 'smooth' });
        setTimeout(() => { delete strip.dataset.dragged; }, 50);
      }
    });
    strip.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); strip.scrollBy({ left: -step(), behavior: 'smooth' }); }
      if (e.key === 'ArrowRight') { e.preventDefault(); strip.scrollBy({ left: step(), behavior: 'smooth' }); }
    });
  }
})();
