/* אוסישקין 10 · scroll = one day on floor 5 */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = !!(window.gsap && window.ScrollTrigger);
  const SVGNS = 'http://www.w3.org/2000/svg';

  /* ---------------- WhatsApp slots (work without any JS lib) ---------------- */
  const WA = 'https://wa.me/972522505966?text=';
  $$('.slot').forEach(a => {
    const slot = a.dataset.slot;
    const msg = slot
      ? `היי עמיר, ראיתי את האתר של אוסישקין 10. אשמח לתאם סיור ב-${slot}.`
      : 'היי עמיר, ראיתי את האתר של אוסישקין 10. אשמח לתאם סיור בשעה אחרת.';
    a.href = WA + encodeURIComponent(msg);
  });
  const agentWa = $('.agent .btn');
  if (agentWa) agentWa.href = WA + encodeURIComponent('היי עמיר, ראיתי את האתר של אוסישקין 10.');

  /* ---------------- hotspots ---------------- */
  $$('.hotspot').forEach(b => {
    b.setAttribute('aria-label', b.querySelector('.hs-label').textContent);
    b.addEventListener('click', () => {
      const open = b.getAttribute('aria-expanded') !== 'true';
      $$('.hotspot').forEach(o => o.setAttribute('aria-expanded', 'false'));
      b.setAttribute('aria-expanded', String(open));
    });
  });

  /* ---------------- terrace sound: only if the file exists, never autoplay ---------------- */
  const soundBtn = $('.sound');
  if (soundBtn) {
    const src = 'assets/audio/terrace.m4a';
    fetch(src, { method: 'HEAD', cache: 'no-store' }).then(r => {
      const type = r.headers.get('content-type') || '';
      if (!r.ok || type.includes('text/html')) return;
      let audio = null;
      soundBtn.disabled = false; soundBtn.removeAttribute('aria-disabled');
      soundBtn.setAttribute('aria-pressed', 'false');
      soundBtn.addEventListener('click', () => {
        if (!audio) { audio = new Audio(src); audio.loop = true; }
        if (audio.paused) { audio.play(); soundBtn.classList.add('is-playing'); soundBtn.setAttribute('aria-pressed', 'true'); }
        else { audio.pause(); soundBtn.classList.remove('is-playing'); soundBtn.setAttribute('aria-pressed', 'false'); }
      });
    }).catch(() => {});
  }

  /* ---------------- window frames (SVG mullions) on every framed photo ---------------- */
  $$('.win').forEach(fig => {
    const panes = +(fig.dataset.panes || 2);
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('class', 'mullions');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    let html = '<rect x="0" y="0" width="100" height="100"/>';
    html += '<line x1="0" y1="17" x2="100" y2="17"/>';               // transom, like the real windows
    for (let i = 1; i < panes; i++) { const x = (100 / panes) * i; html += `<line x1="${x}" y1="0" x2="${x}" y2="100"/>`; }
    svg.innerHTML = html;
    fig.appendChild(svg);
    if (!reduce) { const sh = document.createElement('div'); sh.className = 'shutter'; fig.appendChild(sh); }
  });

  /* ---------------- full-screen window for section 2 (pixel-exact, rebuilt on resize) ---------------- */
  const s2svg = $('.s2-window');
  let s2geo = { ox: 0, oy: 0, S: 6 };
  function buildBigWindow() {
    if (!s2svg) return;
    const w = s2svg.clientWidth || innerWidth, h = s2svg.clientHeight || innerHeight;
    const portrait = h > w;
    const hw = Math.round(w * (portrait ? 0.74 : 0.5));
    const hh = Math.round(h * (portrait ? 0.6 : 0.68));
    const x0 = Math.round((w - hw) / 2), y0 = Math.round((h - hh) / 2 + (portrait ? 0 : 10));
    const F = portrait ? 9 : 12;          // outer frame
    const M = portrait ? 5 : 7;           // mullions
    const tY = y0 + Math.round(hh * 0.18); // transom
    const midX = x0 + Math.round(hw / 2);
    s2svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const wall = `M0 0H${w}V${h}H0Z M${x0} ${y0}V${y0 + hh}H${x0 + hw}V${y0}Z`;
    s2svg.innerHTML =
      `<path class="wall" fill-rule="evenodd" d="${wall}"/>` +
      `<rect class="fr" x="${x0 - F}" y="${y0 - F}" width="${hw + 2 * F}" height="${F}"/>` +
      `<rect class="fr" x="${x0 - F}" y="${y0 + hh}" width="${hw + 2 * F}" height="${F}"/>` +
      `<rect class="fr" x="${x0 - F}" y="${y0}" width="${F}" height="${hh}"/>` +
      `<rect class="fr" x="${x0 + hw}" y="${y0}" width="${F}" height="${hh}"/>` +
      `<rect class="fr" x="${x0}" y="${tY - M / 2}" width="${hw}" height="${M}"/>` +
      `<rect class="fr" x="${midX - M / 2}" y="${y0}" width="${M}" height="${hh}"/>` +
      `<rect class="fr" x="${x0 + hw * .25 - M / 4}" y="${y0}" width="${M / 2}" height="${tY - y0}"/>` +
      `<rect class="fr" x="${x0 + hw * .75 - M / 4}" y="${y0}" width="${M / 2}" height="${tY - y0}"/>`;
    // we pass through the lower-right pane: scale about its centre until it covers the screen
    const pL = midX + M / 2, pR = x0 + hw, pT = tY + M / 2, pB = y0 + hh;
    const ox = (pL + pR) / 2, oy = (pT + pB) / 2, hx = (pR - pL) / 2, hy = (pB - pT) / 2;
    const S = Math.max(ox / hx, (w - ox) / hx, oy / hy, (h - oy) / hy) * 1.08;
    s2geo = { ox, oy, S };
  }
  buildBigWindow();

  /* ---------------- terrace photo inside the letters ---------------- */
  const word = $('.s5-word');
  function setWordImage() {
    if (!word) return;
    const big = innerWidth * (devicePixelRatio || 1) > 1000;
    word.style.backgroundImage = `url(assets/img/terrace${big ? '' : '-900'}.webp)`;
    word.classList.add('has-img');
  }
  if (document.readyState === 'complete') setWordImage(); else addEventListener('load', setWordImage, { once: true });

  /* ---------------- counters ---------------- */
  function runCounter(el) {
    const end = parseFloat(el.dataset.count), dec = +(el.dataset.decimals || 0);
    if (reduce || !hasGsap) { el.textContent = end.toFixed(dec); return; }
    const o = { v: 0 };
    gsap.to(o, { v: end, duration: 1.4, ease: 'power2.out', onUpdate: () => { el.textContent = o.v.toFixed(dec); } });
  }

  if (!hasGsap) { $$('.stat-num').forEach(runCounter); return; }

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  /* ---------------- Lenis smooth scroll ---------------- */
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

  /* ---------------- the day: background / text / clock driven by scroll ---------------- */
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const PAL = {
    night:   { bg: hex('#1C211B'), fg: hex('#EFE9DD'), lab: hex('#9DAA88') },
    morning: { bg: hex('#EFE9DD'), fg: hex('#1F2420'), lab: hex('#5E6B4E') },
    noon:    { bg: hex('#F6F3EE'), fg: hex('#1F2420'), lab: hex('#5E6B4E') },
    golden:  { bg: hex('#3A2E22'), fg: hex('#F2E6D3'), lab: hex('#9DAA88') }
  };
  const T = (h, m) => h * 60 + m;
  // [section, fraction of its scroll length, palette, clock minutes]
  const STOPS = [
    ['#s1', 0,    'night',   T(6, 58)],
    ['#s1', 1,    'night',   T(6, 58)],
    ['#s2', 0.7,  'night',   T(6, 59)],
    ['#s3', 0.02, 'night',   T(7, 0)],
    ['#s3', 0.62, 'morning', T(7, 0)],
    ['#s4', 0.06, 'morning', T(8, 0)],
    ['#s4', 0.94, 'noon',    T(12, 30)],
    ['#s5', 0.04, 'noon',    T(13, 0)],
    ['#s5', 0.84, 'noon',    T(13, 30)],
    ['#s6', 0.06, 'golden',  T(17, 30)],
    ['#s6', 0.9,  'golden',  T(19, 0)],
    ['#s7', 0.08, 'night',   T(21, 0)],
    ['#s7', 0.95, 'night',   T(21, 45)],
    ['#s8', 0.6,  'night',   T(22, 30)],
    ['#s9', 0.05, 'morning', T(32, 0)],   // next morning, 08:00
    ['#s10', 1,   'morning', T(32, 30)]
  ];
  let stops = [];
  const box = el => (el.parentElement && el.parentElement.classList.contains('pin-spacer')) ? el.parentElement : el;
  function measureStops() {
    const sy = scrollY;
    stops = STOPS.map(([sel, f, pal, min]) => {
      const el = $(sel); const r = box(el).getBoundingClientRect();
      return { y: r.top + sy + f * r.height, pal: PAL[pal], min };
    }).sort((a, b) => a.y - b.y);
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  const mix = (a, b, t) => a.map((v, i) => Math.round(lerp(v, b[i], t)));
  const rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`;
  const smooth = t => t * t * (3 - 2 * t);
  const clockEl = $('.clock-time'), hH = $('.clock-h'), hM = $('.clock-m');
  const meta = $('meta[name="theme-color"]');
  let last = { bg: '', fg: '', lab: '', time: '' };

  function paint() {
    if (!stops.length) return;
    const c = scrollY + innerHeight * 0.5;
    let i = 0;
    while (i < stops.length - 2 && c > stops[i + 1].y) i++;
    const a = stops[i], b = stops[i + 1];
    const t = Math.min(1, Math.max(0, (c - a.y) / Math.max(1, b.y - a.y)));
    const tb = smooth(t);
    // text flips quickly around the middle of a light/dark change, so it never sits grey-on-grey
    const tf = smooth(Math.min(1, Math.max(0, (t - 0.38) / 0.24)));
    const bg = rgb(mix(a.pal.bg, b.pal.bg, tb)), fg = rgb(mix(a.pal.fg, b.pal.fg, tf)), lab = rgb(mix(a.pal.lab, b.pal.lab, tf));
    if (bg !== last.bg) { root.style.setProperty('--bg', bg); if (meta) meta.content = bg; last.bg = bg; }
    if (fg !== last.fg) { root.style.setProperty('--fg', fg); last.fg = fg; }
    if (lab !== last.lab) { root.style.setProperty('--lab', lab); last.lab = lab; }
    const m = Math.floor(lerp(a.min, b.min, t)) % (24 * 60);
    const hh = Math.floor(m / 60), mm = m % 60;
    const time = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    if (time !== last.time) {
      clockEl.textContent = time; last.time = time;
      hH.style.transform = `rotate(${(hh % 12) * 30 + mm * 0.5}deg)`;
      hM.style.transform = `rotate(${mm * 6}deg)`;
    }
  }

  /* ---------------- generic text: fade + 12px rise, 0.4s ease-out ---------------- */
  $$('[data-fade]').forEach(el => {
    gsap.fromTo(el, { autoAlpha: 0, y: reduce ? 0 : 12 }, {
      autoAlpha: 1, y: 0, duration: 0.4, ease: 'power1.out',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true }
    });
  });

  /* counters when in view */
  $$('.stat-num').forEach(el => {
    el.textContent = reduce ? el.dataset.count : (0).toFixed(+(el.dataset.decimals || 0));
    ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true, onEnter: () => runCounter(el) });
  });

  /* sticky CTA steps aside once the booking section is on screen */
  const cta = $('.cta');
  ScrollTrigger.create({ trigger: '#s9', start: 'top 85%', onEnter: () => cta.classList.add('is-hidden'), onLeaveBack: () => cta.classList.remove('is-hidden') });

  if (reduce) {
    // static end states, fades only
    $('.floor-num').textContent = '05';
    gsap.set('.floor-marker', { y: () => -$('.floor-track').clientHeight + 18 });
    gsap.set('.s2-window', { autoAlpha: 0.0 });
    $$('.s1-copy, .s5-copy, .s2-cap').forEach(el => gsap.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, scrollTrigger: { trigger: el, start: 'top 90%', once: true } }));
    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: paint, onRefresh: () => { measureStops(); paint(); } });
    finish();
    return;
  }

  /* ---------------- photos: shutter reveal + slow push-in 100% → 104% ---------------- */
  $$('.win').forEach(fig => {
    const img = fig.querySelector('img'), sh = fig.querySelector('.shutter');
    if (sh) gsap.fromTo(sh, { scaleY: 1 }, { scaleY: 0, duration: 1.1, ease: 'power3.inOut', scrollTrigger: { trigger: fig, start: 'top 82%', once: true } });
    if (!fig.closest('.s4')) gsap.fromTo(img, { scale: 1 }, { scale: 1.04, ease: 'none', scrollTrigger: { trigger: fig, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  /* ---------------- 1 · street → floor 5 ---------------- */
  const floorNum = $('.floor-num');
  let floorShown = 1;
  const tl1 = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: '#s1', start: 'top top', end: '+=170%', pin: true, scrub: 0.6, anticipatePin: 1, refreshPriority: 4,
      onUpdate: self => {
        const f = Math.min(5, 1 + Math.floor((self.progress / 0.68) * 5));
        if (f !== floorShown) { floorShown = f; floorNum.textContent = '0' + f; }
      }
    }
  });
  tl1.fromTo('.s1-base', { scale: 1, yPercent: 0 }, { scale: 1.34, yPercent: 7, duration: 1 }, 0)
     .fromTo('.s1-tree', { scale: 1, yPercent: 0 }, { scale: 1.52, yPercent: 17, duration: 1 }, 0)
     .fromTo('.floor-marker', { y: 0 }, { y: () => -($('.floor-track').clientHeight - 16), duration: 0.68 }, 0)
     .to('.s1-hint', { autoAlpha: 0, duration: 0.08 }, 0.02)
     .fromTo('.s1-copy', { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.1, ease: 'power1.out' }, 0.74)
     .to({}, { duration: 0.16 });
  gsap.set('.s1-copy', { autoAlpha: 0 });

  /* ---------------- 2 · through the window ---------------- */
  const tl2 = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: '#s2', start: 'top top', end: '+=150%', pin: true, scrub: 0.6, anticipatePin: 1, invalidateOnRefresh: true, refreshPriority: 3 }
  });
  tl2.fromTo('.s2-cap', { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.12, ease: 'power1.out' }, 0.02)
     .to('.s2-cap', { autoAlpha: 0, duration: 0.1 }, 0.3)
     .fromTo('.s2-window', { scale: 1, transformOrigin: () => `${s2geo.ox}px ${s2geo.oy}px` },
             { scale: () => s2geo.S, ease: 'power2.in', duration: 0.8 }, 0.1)
     .fromTo('.s2-photo img', { scale: 1.22 }, { scale: 1.04, duration: 0.9 }, 0.1)
     .to('.s2-window', { autoAlpha: 0, duration: 0.05 }, 0.88)
     .to({}, { duration: 0.1 });

  /* ---------------- 4 · one level, sideways ---------------- */
  const strip = $('.s4-strip');
  const dist = () => Math.max(0, strip.scrollWidth - strip.parentElement.clientWidth);
  const tl4 = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: '#s4', start: 'top top', end: () => '+=' + Math.max(innerHeight * 1.2, dist() * 1.25), pin: true, scrub: 0.6, anticipatePin: 1, invalidateOnRefresh: true, refreshPriority: 2 }
  });
  tl4.fromTo(strip, { x: 0 }, { x: () => dist(), duration: 1 }, 0)        // RTL: strip slides right, revealing what lies to the left
     .fromTo('.s4-rule b', { scaleX: 0 }, { scaleX: 1, duration: 1 }, 0);
  $$('.s4-item img').forEach((img, i, all) => {
    tl4.fromTo(img, { scale: 1 }, { scale: 1.04, duration: 0.5 }, i * (0.5 / Math.max(1, all.length - 1)));
  });

  /* ---------------- 5 · "קומה 5", the photo inside the letters ---------------- */
  const five = $('.s5-five');
  const fiveOrigin = () => {
    const t = $('.s5-text');
    const x = t.offsetLeft + five.offsetLeft + five.offsetWidth * 0.42;
    const y = t.offsetTop + five.offsetTop + five.offsetHeight * 0.6;
    return `${x}px ${y}px`;
  };
  const tl5 = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: '#s5', start: 'top top', end: '+=220%', pin: true, scrub: 0.6, anticipatePin: 1, invalidateOnRefresh: true, refreshPriority: 1 }
  });
  tl5.to('.s5-kicker', { autoAlpha: 0, duration: 0.1 }, 0.08)
     .fromTo('.s5-word', { scale: 1, transformOrigin: fiveOrigin }, { scale: 16, ease: 'power3.in', duration: 0.62 }, 0.06)
     .fromTo('.s5-photo', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, 0.46)
     .fromTo('.s5-photo img', { scale: 1.18 }, { scale: 1.04, duration: 0.5, ease: 'power2.out' }, 0.46)
     .to('.s5-word', { autoAlpha: 0, duration: 0.06 }, 0.66)
     .to('.s5-scrim', { autoAlpha: 1, duration: 0.1 }, 0.72)
     .fromTo('.s5-copy', { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.1, ease: 'power1.out' }, 0.76)
     .to({}, { duration: 0.16 });

  /* ---------------- 6 · ceiling line grows to full viewport height ---------------- */
  gsap.fromTo('.ceiling-line', { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: '.ceiling', start: 'top top', end: '+=90%', pin: true, scrub: 0.4, anticipatePin: 1, refreshPriority: 0.5 } });

  /* ---------------- 8 · map lines draw out from the building ---------------- */
  const mapTl = gsap.timeline({ scrollTrigger: { trigger: '.map', start: 'top 75%', once: true } });
  $$('.map-lines line').forEach((ln, i) => {
    mapTl.fromTo(ln, { scale: 0, svgOrigin: '210 190' }, { scale: 1, duration: 0.7, ease: 'power2.out' }, i * 0.18)
         .fromTo($$('.map-pt')[i], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, ease: 'power1.out' }, i * 0.18 + 0.45);
  });
  gsap.fromTo('.map-halo', { scale: 0.6, svgOrigin: '0 0', autoAlpha: 0.9 }, { scale: 1.6, autoAlpha: 0, duration: 2.2, repeat: -1, ease: 'power1.out' });

  ScrollTrigger.create({ start: 0, end: 'max', onUpdate: paint });
  ScrollTrigger.addEventListener('refresh', () => { measureStops(); paint(); });
  addEventListener('resize', () => { buildBigWindow(); });
  finish();

  function finish() {
    // pinned sections first (top to bottom), so every later trigger sees the added pin spacing
    ScrollTrigger.sort();
    ScrollTrigger.refresh();
    measureStops(); paint();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
    addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
  }
})();
