/* אוסישקין 10 · "בגובה הצמרות" · v3
   Motion vocabulary: hero frame opens to the edges · photo push-in · text fade + 12px rise · pinned scroll-scrubbed sequences. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = !!(window.gsap && window.ScrollTrigger);

  /* ---------------- WhatsApp: one destination, a ready message; a preferred time is a request, not a booking ---------------- */
  const WA = 'https://wa.me/972522505966?text=';
  const BASE = 'היי עמיר, ראיתי את האתר של אוסישקין 10 ואשמח לתאם ביקור בדירה.';
  $$('.slot, .contact-cta').forEach(a => {
    const pref = a.dataset.slot;
    a.href = WA + encodeURIComponent(pref ? BASE + ' זמן מועדף: ' + pref + '.' : BASE);
  });

  /* ---------------- terrace sound: only if the file exists, never autoplay ---------------- */
  const soundBtn = $('.sound');
  if (soundBtn) {
    const src = 'assets/audio/terrace.m4a';
    fetch(src, { method: 'HEAD', cache: 'no-store' }).then(r => {
      const type = r.headers.get('content-type') || '';
      if (!r.ok || type.includes('text/html')) return;
      let audio = null;
      soundBtn.disabled = false; soundBtn.removeAttribute('aria-disabled'); soundBtn.setAttribute('aria-pressed', 'false');
      soundBtn.addEventListener('click', () => {
        if (!audio) { audio = new Audio(src); audio.loop = true; }
        if (audio.paused) { audio.play(); soundBtn.setAttribute('aria-pressed', 'true'); }
        else { audio.pause(); soundBtn.setAttribute('aria-pressed', 'false'); }
      });
    }).catch(() => {});
  }

  /* ---------------- odometer hours ---------------- */
  const odos = $$('.hour').map(h => {
    const from = h.dataset.from, to = h.dataset.time;
    h.setAttribute('aria-label', to);
    const wrap = document.createElement('span'); wrap.className = 'odo'; wrap.setAttribute('aria-hidden', 'true');
    const cols = [];
    [...to].forEach((ch, i) => {
      if (ch === ':') { const s = document.createElement('span'); s.className = 'odo-sep'; s.textContent = ':'; wrap.appendChild(s); return; }
      const d = document.createElement('span'); d.className = 'odo-d';
      const col = document.createElement('span'); col.className = 'odo-col';
      col.innerHTML = Array.from({ length: 20 }, (_, k) => `<span>${k % 10}</span>`).join('');
      d.appendChild(col); wrap.appendChild(d);
      const a = +from[i], b = +ch;
      cols.push({ col, a, b: b >= a ? b : b + 10 });
    });
    h.textContent = ''; h.appendChild(wrap);
    return { h, cols };
  });
  const setOdo = (o, p) => o.cols.forEach(c => { c.col.style.transform = `translateY(${-(c.a + (c.b - c.a) * p) * 5}%)`; });
  odos.forEach(o => setOdo(o, reduce || !hasGsap ? 1 : 0));

  if (!hasGsap) return;

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  /* ---------------- Lenis ---------------- */
  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new Lenis({ duration: 1.15, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  $$('[data-scroll-to]').forEach(a => a.addEventListener('click', e => {
    const t = $(a.dataset.scrollTo); if (!t) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(t, { offset: 0, duration: 1.8 }); else t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  }));

  /* ---------------- the day: background / text colour follow the scroll ---------------- */
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const PAL = {
    night:   { bg: hex('#1D2A21'), fg: hex('#F4EFE5'), lab: hex('#A9B497') },
    morning: { bg: hex('#F4EFE5'), fg: hex('#1B231D'), lab: hex('#56634A') },
    noon:    { bg: hex('#F7F3EC'), fg: hex('#1B231D'), lab: hex('#56634A') }
  };
  const T = (h, m) => h * 60 + m;
  // forest (hero) → ivory (morning rooms, terrace) → forest (private rooms) → ivory (facts, location) → forest (contact)
  const STOPS = [
    ['#hero', 0, 'night', 0], ['#hero', 0.85, 'night', 0],
    ['#s3', 0.0, 'night', 0], ['#s3', 0.22, 'morning', 0],
    ['#s4', 0.06, 'morning', 0], ['#s4', 0.97, 'noon', 0],
    ['#private', 0.12, 'night', 0], ['#private', 0.9, 'night', 0],
    ['#spec', 0.12, 'morning', 0], ['#s8', 0.8, 'morning', 0],
    ['#s9', 0.12, 'night', 0], ['#s9', 1, 'night', 0]
  ];
  let stops = [];
  const box = el => (el.parentElement && el.parentElement.classList.contains('pin-spacer')) ? el.parentElement : el;
  function measureStops() {
    const sy = scrollY;
    stops = STOPS.map(([sel, f, pal, min]) => {
      const r = box($(sel)).getBoundingClientRect();
      return { y: r.top + sy + f * r.height, pal: PAL[pal], min };
    }).sort((a, b) => a.y - b.y);
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  const mix = (a, b, t) => a.map((v, i) => Math.round(lerp(v, b[i], t)));
  const rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`;
  const smooth = t => t * t * (3 - 2 * t);
  const meta = $('meta[name="theme-color"]');
  let last = { bg: '', fg: '', lab: '' };
  function paint() {
    if (!stops.length) return;
    const c = scrollY + innerHeight * 0.5;
    let i = 0;
    while (i < stops.length - 2 && c > stops[i + 1].y) i++;
    const a = stops[i], b = stops[i + 1];
    const t = Math.min(1, Math.max(0, (c - a.y) / Math.max(1, b.y - a.y)));
    const tf = smooth(Math.min(1, Math.max(0, (t - 0.38) / 0.24)));
    const bg = rgb(mix(a.pal.bg, b.pal.bg, smooth(t))), fg = rgb(mix(a.pal.fg, b.pal.fg, tf)), lab = rgb(mix(a.pal.lab, b.pal.lab, tf));
    if (bg !== last.bg) { root.style.setProperty('--bg', bg); if (meta) meta.content = bg; last.bg = bg; }
    if (fg !== last.fg) { root.style.setProperty('--fg', fg); last.fg = fg; }
    if (lab !== last.lab) { root.style.setProperty('--lab', lab); last.lab = lab; }
  }

  /* ---------------- (b) text: fade + 12px rise ---------------- */
  if (!reduce) $$('[data-fade]').forEach(el => {
    gsap.fromTo(el, { autoAlpha: 0, y: reduce ? 0 : 12 }, {
      autoAlpha: 1, y: 0, duration: 0.4, ease: 'power1.out',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true }
    });
  });

  /* floating visit action: never alongside the hero button; hidden while a section is pinned, and from the booking section on */
  const cta = $('.cta'), heroCta = $('.hero-cta');
  let ctaHidden = true;
  // things the floating action must never sit on: room navigation, photo captions, the last spec row, form fields
  const avoid = $$('.seq-nav, figcaption:not(.seq-cap), .spec-list > div:last-child, input, textarea, select');
  function coversContent() {
    const zoneTop = innerHeight - cta.offsetHeight - 30;     // the action's band above the bottom edge / safe area
    const half = cta.offsetWidth / 2 + 12, mid = innerWidth / 2;
    return avoid.some(el => {
      const r = el.getBoundingClientRect();
      if (!r.height || r.bottom < zoneTop || r.top > innerHeight) return false;
      return r.left < mid + half && r.right > mid - half;
    });
  }
  function updateCta() {
    const y = scrollY;
    const heroVisible = heroCta.getBoundingClientRect().bottom > $('.topbar').offsetHeight;
    const pinned = ScrollTrigger.getAll().some(s => s.pin && y >= s.start - 2 && y <= s.end + 2);
    const s9 = $('#s9').getBoundingClientRect().top < innerHeight - 60;   // contact section is on screen
    const hide = heroVisible || pinned || s9 || coversContent();
    if (hide !== ctaHidden) { ctaHidden = hide; cta.classList.toggle('is-hidden', hide); }
  }

  if (reduce) {
    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: () => { paint(); updateCta(); }, onRefresh: () => { measureStops(); paint(); updateCta(); } });
    finish();
    return;
  }

  /* ---------------- (a) photos: slow push-in 100% → 104% while in view ---------------- */
  $$('.bleed img').forEach(img => {
    gsap.fromTo(img, { scale: 1 }, { scale: 1.04, ease: 'none', scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  /* photos below the fold: one restrained reveal as each enters view */
  $$('[data-reveal]').forEach(el => {
    gsap.fromTo(el, { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
    const img = $('img', el);
    if (img) gsap.fromTo(img, { scale: 1.05 }, { scale: 1, duration: 1.1, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
  });

  /* odometers roll with scroll */
  odos.forEach(o => {
    ScrollTrigger.create({ trigger: o.h, start: 'top 96%', end: 'top 38%', scrub: 0.5, onUpdate: s => setOdo(o, s.progress) });
  });

  /* ---------------- 1 · hero: the frame opens to the screen edges as the headline leaves ----------------
     Normal page scroll (no pin). Clip widens, photo keeps its proportions, scale stays slight. */
  const heroFrame = $('.hero-frame');
  // start inset: phone = the page gutter on both sides · desktop = 24px top/bottom + gutter on the outer (left) edge
  const heroClip = () => {
    const g = parseFloat(getComputedStyle(root).getPropertyValue('--gut')) || 16;
    return innerWidth >= 900 ? `inset(24px 0px 24px ${g}px)` : `inset(0px ${g}px 0px ${g}px)`;
  };
  gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: '#hero', start: 'top top', end: () => '+=' + Math.round(innerHeight * 0.55), scrub: 0.4, invalidateOnRefresh: true }
  })
    .fromTo(heroFrame, { clipPath: heroClip }, { clipPath: 'inset(0px 0px 0px 0px)', duration: 1 }, 0)
    .fromTo('.hero-frame img', { scale: 1 }, { scale: 1.04, duration: 1 }, 0);

  /* ---------------- 4 · one level: kitchen → living → terrace ----------------
     One pinned frame, scroll-scrubbed. Units are viewport heights of scroll:
     0–.20 kitchen · .20–.70 living enters from the right · .70–.95 living · .95–1.45 terrace enters
     1.45–1.85 terrace opens to the screen edges · 1.85–2.20 terrace rests with its size, then the pin releases. */
  const seq = $('#s4'), seqStage = $('.seq-stage', seq), seqItems = $$('.seq-item', seq), seqTabs = $$('.seq-tab', seq);
  const SEQ = { total: 2.2, cut: [0.45, 1.2], go: [0.02, 0.84, 2.0] };
  let seqST = null, seqRoom = -1;
  function setRoom(i) {
    if (i === seqRoom) return; seqRoom = i;
    seqTabs.forEach((t, k) => { t.classList.toggle('is-on', k === i); if (k === i) t.setAttribute('aria-current', 'true'); else t.removeAttribute('aria-current'); });
  }
  seqTabs.forEach((t, i) => t.addEventListener('click', () => {
    if (!seqST) { seqItems[i].scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    const y = Math.round(seqST.start + (SEQ.go[i] / SEQ.total) * (seqST.end - seqST.start));
    if (lenis) lenis.scrollTo(y, { duration: 1.1 }); else scrollTo({ top: y, behavior: 'smooth' });
  }));
  gsap.matchMedia().add('(prefers-reduced-motion: no-preference) and (min-height: 520px)', () => {
    seq.classList.add('is-seq');
    const W = () => seqStage.clientWidth;
    const g = () => {
      const gut = parseFloat(getComputedStyle(root).getPropertyValue('--gut')) || 16;
      const v = Math.round(Math.max(gut, (root.clientWidth - 1120) / 2));
      seq.style.setProperty('--seq-g', v + 'px');
      return v;
    };
    const hidden = () => `inset(0px 0px 0px ${W() - g()}px)`;   // nothing visible inside the frame
    const shown = () => `inset(0px 0px 0px ${g()}px)`;          // fills the frame
    const [k, l, t] = seqItems, img = el => $('img', el);
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: seq, start: 'top top', end: () => '+=' + Math.round(innerHeight * SEQ.total),
        pin: true, scrub: 0.5, anticipatePin: 1, invalidateOnRefresh: true, refreshPriority: 8,
        onUpdate: self => { const u = self.progress * SEQ.total; setRoom(u < SEQ.cut[0] ? 0 : u < SEQ.cut[1] ? 1 : 2); }
      }
    });
    seqST = tl.scrollTrigger;
    tl.fromTo(seqStage, { clipPath: () => `inset(0px ${g()}px)` }, { clipPath: () => `inset(0px ${g()}px)`, duration: 0.001 }, 0)
      .fromTo('.seq-rule b', { scaleX: 0 }, { scaleX: 1, duration: 1.85 }, 0)
      .fromTo(img(k), { scale: 1 }, { scale: 1.03, duration: 0.95 }, 0)
      // living enters from the right; kitchen stays put underneath
      .fromTo(l, { clipPath: hidden }, { clipPath: shown, duration: 0.5, ease: 'power1.inOut' }, 0.2)
      .fromTo(img(l), { xPercent: 2.5, scale: 1.05 }, { xPercent: 0, scale: 1, duration: 0.5, ease: 'power1.out' }, 0.2)
      .to(img(l), { scale: 1.03, duration: 0.75 }, 0.7)
      // terrace enters the same way
      .fromTo(t, { clipPath: hidden }, { clipPath: shown, duration: 0.5, ease: 'power1.inOut' }, 0.95)
      .fromTo(img(t), { xPercent: 2.5, scale: 1.05 }, { xPercent: 0, scale: 1, duration: 0.5, ease: 'power1.out' }, 0.95)
      // the frame opens: terrace to the screen edges
      .to(seqStage, { clipPath: 'inset(0px 0px)', duration: 0.4, ease: 'power1.inOut' }, 1.45)
      .to(t, { clipPath: 'inset(0px 0px 0px 0px)', duration: 0.4, ease: 'power1.inOut' }, 1.45)
      .fromTo('.seq-tag', { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.12, ease: 'power1.out' }, 1.82)
      .to({}, { duration: 0.26 }, 1.94);
    return () => { seq.classList.remove('is-seq'); seq.style.removeProperty('--seq-g'); seqST = null; seqRoom = -1; setRoom(0); };
  });

  ScrollTrigger.create({ start: 0, end: 'max', onUpdate: () => { paint(); updateCta(); } });
  ScrollTrigger.addEventListener('refresh', () => { measureStops(); paint(); updateCta(); });
  finish();

  function finish() {
    ScrollTrigger.sort();
    ScrollTrigger.refresh();
    measureStops(); paint();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
    addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
  }
})();
