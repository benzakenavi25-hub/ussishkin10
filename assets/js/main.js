/* אוסישקין 10 · scroll = one day on floor 5 · v2
   Motion vocabulary (only these three): photo push-in · text fade + 12px rise · pinned scroll-scrubbed sequences. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = !!(window.gsap && window.ScrollTrigger);
  const IMG_A = 1800 / 1110; // aspect of every converted photo

  /* ---------------- WhatsApp ---------------- */
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

  /* ---------------- section 2: full-screen window, pixel-exact ---------------- */
  const s2svg = $('.s2-window');
  let s2geo = { ox: 0, oy: 0, S: 6 };
  function buildBigWindow() {
    if (!s2svg) return;
    const w = s2svg.clientWidth || innerWidth, h = s2svg.clientHeight || innerHeight;
    const portrait = h > w;
    const hw = Math.round(w * (portrait ? 0.74 : 0.5)), hh = Math.round(h * (portrait ? 0.6 : 0.68));
    const x0 = Math.round((w - hw) / 2), y0 = Math.round((h - hh) / 2 + (portrait ? 0 : 10));
    const F = portrait ? 9 : 12, M = portrait ? 5 : 7;
    const tY = y0 + Math.round(hh * 0.18), midX = x0 + Math.round(hw / 2);
    s2svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    s2svg.innerHTML =
      `<path class="wall" fill-rule="evenodd" d="M0 0H${w}V${h}H0Z M${x0} ${y0}V${y0 + hh}H${x0 + hw}V${y0}Z"/>` +
      `<rect class="fr" x="${x0 - F}" y="${y0 - F}" width="${hw + 2 * F}" height="${F}"/>` +
      `<rect class="fr" x="${x0 - F}" y="${y0 + hh}" width="${hw + 2 * F}" height="${F}"/>` +
      `<rect class="fr" x="${x0 - F}" y="${y0}" width="${F}" height="${hh}"/>` +
      `<rect class="fr" x="${x0 + hw}" y="${y0}" width="${F}" height="${hh}"/>` +
      `<rect class="fr" x="${x0}" y="${tY - M / 2}" width="${hw}" height="${M}"/>` +
      `<rect class="fr" x="${midX - M / 2}" y="${y0}" width="${M}" height="${hh}"/>` +
      `<rect class="fr" x="${x0 + hw * .25 - M / 4}" y="${y0}" width="${M / 2}" height="${tY - y0}"/>` +
      `<rect class="fr" x="${x0 + hw * .75 - M / 4}" y="${y0}" width="${M / 2}" height="${tY - y0}"/>`;
    const pL = midX + M / 2, pR = x0 + hw, pT = tY + M / 2, pB = y0 + hh;
    const ox = (pL + pR) / 2, oy = (pT + pB) / 2, hx = (pR - pL) / 2, hy = (pB - pT) / 2;
    s2geo = { ox, oy, S: Math.max(ox / hx, (w - ox) / hx, oy / hy, (h - oy) / hy) * 1.08 };
  }
  buildBigWindow();

  /* ---------------- "קומה 5": SVG <text> filled with the terrace photo (works on iPhone Safari) ---------------- */
  const s5svg = $('.s5-svg'), patImg = $('.s5-pat-img'), pat = $('#terrPat');
  const t1 = $('.s5-t1'), t5 = $('.s5-t5');
  let fiveBox = { x: 0, y: 0 };
  function layoutWord() {
    if (!s5svg) return;
    const W = s5svg.clientWidth || innerWidth, H = s5svg.clientHeight || innerHeight;
    s5svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    [pat, patImg].forEach(el => { el.setAttribute('width', W); el.setAttribute('height', H); });
    if (W < 700) {                                   // phone: "קומה" over a very large "5"
      const f1 = 0.29 * W, f5 = Math.min(2.7 * f1, 0.6 * H);
      const block = f1 * 0.95 + f5 * 0.78, top = (H - block) / 2;
      t1.setAttribute('font-size', f1); t5.setAttribute('font-size', f5);
      [t1, t5].forEach(t => { t.setAttribute('text-anchor', 'middle'); t.setAttribute('x', W / 2); });
      t1.setAttribute('y', top + f1 * 0.78);
      t5.setAttribute('y', top + f1 * 0.95 + f5 * 0.74);
    } else {                                         // wide: one line, "5" on the left (RTL)
      const f = Math.min(0.3 * W, 340, 0.5 * H);
      // 'middle' anchors are direction-independent (a Hebrew run would flip 'start')
      [t1, t5].forEach(t => { t.setAttribute('font-size', f); t.setAttribute('text-anchor', 'middle'); t.setAttribute('y', H / 2 + f * 0.34); });
      const l1 = t1.getComputedTextLength(), l5 = t5.getComputedTextLength(), gap = f * 0.24;
      const x0 = (W - (l1 + gap + l5)) / 2;
      t5.setAttribute('x', x0 + l5 / 2); t1.setAttribute('x', x0 + l5 + gap + l1 / 2);
    }
    const b = t5.getBBox();
    fiveBox = { x: b.x + b.width * 0.42, y: b.y + b.height * 0.6 };
  }
  function setWordImage() {
    if (!patImg) return;
    const big = innerWidth * (devicePixelRatio || 1) > 1000;
    const url = `assets/img/terrace${big ? '' : '-900'}.webp`;
    patImg.setAttribute('href', url); patImg.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', url);
    s5svg.classList.add('has-img');
  }
  layoutWord();
  if (document.readyState === 'complete') setWordImage(); else addEventListener('load', setWordImage, { once: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutWord);

  /* where an image point (0..1) lands on screen for an object-fit:cover box */
  function coverMap(boxW, boxH, posX = 0.5, posY = 0.5) {
    const k = Math.max(boxW / 1800, boxH / 1110), rw = 1800 * k, rh = 1110 * k;
    const ox = (boxW - rw) * posX, oy = (boxH - rh) * posY;
    return (ix, iy) => [ox + ix * rw, oy + iy * rh];
  }

  /* ---------------- sun arc ---------------- */
  const sun = $('.sun'), sunArc = $('.sun-arc'), sunDot = $('.sun-dot');
  let arcLen = 0;
  function buildSun() {
    const w = innerWidth, h = 22;
    sun.setAttribute('viewBox', `0 0 ${w} ${h}`);
    sunArc.setAttribute('d', `M0 ${h - 1} Q${w / 2} ${-h + 2} ${w} ${h - 1}`);
    arcLen = sunArc.getTotalLength();
  }
  buildSun();
  function placeSun(min) {
    const m = ((min % 1440) + 1440) % 1440;
    const RISE = 6 * 60, SET = 19 * 60 + 30;
    const night = m < RISE || m > SET;
    sun.classList.toggle('is-night', night);
    const t = Math.min(1, Math.max(0, (m - RISE) / (SET - RISE)));
    const p = sunArc.getPointAtLength(t * arcLen);
    sunDot.setAttribute('cx', p.x.toFixed(1)); sunDot.setAttribute('cy', p.y.toFixed(1));
  }

  if (!hasGsap) { placeSun(7 * 60); return; }

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

  /* ---------------- the day: background / text / clock / sun ---------------- */
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const PAL = {
    night:   { bg: hex('#1C211B'), fg: hex('#EFE9DD'), lab: hex('#9DAA88') },
    morning: { bg: hex('#EFE9DD'), fg: hex('#1F2420'), lab: hex('#5E6B4E') },
    noon:    { bg: hex('#F6F3EE'), fg: hex('#1F2420'), lab: hex('#5E6B4E') },
    golden:  { bg: hex('#3A2E22'), fg: hex('#F2E6D3'), lab: hex('#9DAA88') }
  };
  const T = (h, m) => h * 60 + m;
  const STOPS = [
    ['#s1', 0, 'night', T(6, 58)], ['#s1', 1, 'night', T(6, 58)],
    ['#s2', 0.7, 'night', T(6, 59)],
    ['#s3', 0.0, 'night', T(7, 0)], ['#s3', 0.22, 'morning', T(7, 0)],
    ['#s4', 0.06, 'morning', T(8, 0)], ['#s4', 0.94, 'noon', T(12, 30)],
    ['#s5h', 0.3, 'noon', T(13, 0)], ['#s5', 0.84, 'noon', T(13, 30)],
    ['#s6', 0.04, 'golden', T(17, 30)], ['#ceil', 1, 'golden', T(19, 10)],
    ['#s7', 0.25, 'night', T(21, 0)], ['#index', 0, 'night', T(21, 45)],
    ['#s8', 1, 'night', T(23, 0)],                        // stays dark through the whole map
    ['#s9', 0.14, 'morning', T(32, 0)], ['#s10', 1, 'morning', T(32, 30)]
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
    const tf = smooth(Math.min(1, Math.max(0, (t - 0.38) / 0.24)));
    const bg = rgb(mix(a.pal.bg, b.pal.bg, smooth(t))), fg = rgb(mix(a.pal.fg, b.pal.fg, tf)), lab = rgb(mix(a.pal.lab, b.pal.lab, tf));
    if (bg !== last.bg) { root.style.setProperty('--bg', bg); if (meta) meta.content = bg; last.bg = bg; }
    if (fg !== last.fg) { root.style.setProperty('--fg', fg); last.fg = fg; }
    if (lab !== last.lab) { root.style.setProperty('--lab', lab); last.lab = lab; }
    const min = Math.floor(lerp(a.min, b.min, t)), m = min % 1440;
    const hh = Math.floor(m / 60), mm = m % 60;
    const time = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    if (time !== last.time) {
      clockEl.textContent = time; last.time = time;
      hH.style.transform = `rotate(${(hh % 12) * 30 + mm * 0.5}deg)`;
      hM.style.transform = `rotate(${mm * 6}deg)`;
      placeSun(m);
    }
  }

  /* ---------------- (b) text: fade + 12px rise ---------------- */
  $$('[data-fade]').forEach(el => {
    gsap.fromTo(el, { autoAlpha: 0, y: reduce ? 0 : 12 }, {
      autoAlpha: 1, y: 0, duration: 0.4, ease: 'power1.out',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true }
    });
  });

  /* sticky CTA: hidden while any section is pinned, and from the booking section on */
  const cta = $('.cta');
  let ctaHidden = true;
  function updateCta() {
    const y = scrollY;
    const pinned = ScrollTrigger.getAll().some(s => s.pin && y >= s.start - 2 && y <= s.end + 2);
    const s9 = $('#s9').getBoundingClientRect().top < innerHeight * 0.85;
    const hide = pinned || s9;
    if (hide !== ctaHidden) { ctaHidden = hide; cta.classList.toggle('is-hidden', hide); }
  }

  /* ---------------- ceiling measurement geometry (on the real photo) ---------------- */
  const ceil = $('#ceil'), ceilImg = $('.ceil-photo img'), ceilSvg = $('.ceil-measure');
  const ceilNum = $('.ceil-num'), ceilLabel = $('.ceil-label'), ceilNorm = $('.ceil-norm');
  // image coordinates on the wall just beside the full-height window: floor junction and ceiling junction
  const JAMB = { x: 0.842, floor: 0.685, ceiling: 0.19 };
  let cg = null;
  function buildCeil() {
    const w = ceil.clientWidth, h = ceil.clientHeight;
    const vis = Math.min(1, (w / h) / IMG_A);           // visible width fraction of the photo
    let posX = 0.5;
    if (vis < 1) { const left = JAMB.x - 0.86 * vis; posX = Math.min(1, Math.max(0, left / (1 - vis))); }
    ceilImg.style.objectPosition = `${(posX * 100).toFixed(2)}% 50%`;
    const map = coverMap(w, h, posX, 0.5);
    const [x, yF] = map(JAMB.x, JAMB.floor), [, yC] = map(JAMB.x, JAMB.ceiling);
    const span = yF - yC, tickY = m => yF - span * (m / 3.1), yN = tickY(2.6);
    let ticks = '';
    for (let m = 0.5; m < 3.1; m += 0.5) ticks += `<line class="m-tick" data-m="${m}" x1="${x - 7}" y1="${tickY(m)}" x2="${x + 7}" y2="${tickY(m)}"/>`;
    ceilSvg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    ceilSvg.innerHTML =
      `<g class="m-grow"><line class="m-halo" x1="${x}" y1="${yF}" x2="${x}" y2="${yC}"/><line class="m-line" x1="${x}" y1="${yF}" x2="${x}" y2="${yC}"/></g>` +
      `<line class="m-tick" x1="${x - 11}" y1="${yF}" x2="${x + 11}" y2="${yF}"/>` +
      ticks +
      `<line class="m-tick m-top" x1="${x - 11}" y1="${yC}" x2="${x + 11}" y2="${yC}"/>` +
      `<line class="m-norm" x1="${x - 34}" y1="${yN}" x2="${x + 8}" y2="${yN}"/>`;
    const right = w - x + 18;
    ceilLabel.style.right = right + 'px'; ceilNorm.style.right = (w - x + 42) + 'px';
    ceilNorm.style.top = yN + 'px';
    ceilLabel.style.top = '0px';
    cg = { x, yF, yC, span, ticks: $$('.m-tick[data-m]', ceilSvg), top: $('.m-top', ceilSvg), norm: $('.m-norm', ceilSvg) };
  }
  function drawCeil(p) {
    if (!cg) return;
    gsap.set('.m-grow', { scaleY: Math.max(0.0001, p), svgOrigin: `${cg.x} ${cg.yF}` });
    cg.ticks.forEach(t => { t.style.opacity = p >= (+t.dataset.m / 3.1) ? 1 : 0; });
    cg.top.style.opacity = p >= 0.999 ? 1 : 0;
    const showNorm = p >= 2.6 / 3.1;
    cg.norm.style.opacity = showNorm ? 1 : 0; ceilNorm.style.opacity = showNorm ? 1 : 0;
    ceilNum.textContent = (3.1 * p).toFixed(1);
    ceilLabel.style.transform = `translateY(${(cg.yF - cg.span * p) - 2}px) translateY(-100%)`;
  }

  /* ---------------- closer: zoom geometry ---------------- */
  const closers = $$('.closer').map(sec => {
    const stage = $('.closer-stage', sec);
    const [rx, ry] = sec.dataset.zoom.split(',').map(Number);
    const geo = () => {
      const bw = stage.offsetWidth, bh = stage.offsetHeight, vw = sec.clientWidth, vh = sec.clientHeight;
      const S = Math.max(vw / bw, vh / bh, 2.2);
      const fx = vw / (bw * S), fy = vh / (bh * S);
      const cx = Math.min(1 - fx / 2, Math.max(fx / 2, rx)), cy = Math.min(1 - fy / 2, Math.max(fy / 2, ry));
      return { S, x: -(cx - 0.5) * bw * S, y: -(cy - 0.5) * bh * S };
    };
    return { sec, stage, geo };
  });

  if (reduce) {
    $('.floor-num').textContent = '05';
    buildCeil(); drawCeil(1);
    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: () => { paint(); updateCta(); }, onRefresh: () => { measureStops(); paint(); updateCta(); } });
    finish();
    return;
  }

  /* ---------------- (a) photos: slow push-in 100% → 104% while in view ---------------- */
  $$('.bleed img').forEach(img => {
    gsap.fromTo(img, { scale: 1 }, { scale: 1.04, ease: 'none', scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  /* odometers roll with scroll */
  odos.forEach(o => {
    ScrollTrigger.create({ trigger: o.h, start: 'top 96%', end: 'top 38%', scrub: 0.5, onUpdate: s => setOdo(o, s.progress) });
  });

  /* ---------------- (c) 1 · street → floor 5: three real layers ---------------- */
  const s1 = $('#s1');
  // all layers scale about the same point: where the ficus meets the building, at the upper floors.
  // Each nearer layer scales more, so it always covers what the farther layer leaves behind: no invented pixels.
  const s1Origin = () => { const [x, y] = coverMap(s1.clientWidth, s1.clientHeight, 0.44, 0.5)(0.48, 0.30); return `${x}px ${y}px`; };
  const floorNum = $('.floor-num');
  let floorShown = 1;
  const tl1 = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: '#s1', start: 'top top', end: '+=170%', pin: true, scrub: 0.6, anticipatePin: 1, invalidateOnRefresh: true, refreshPriority: 10,
      onUpdate: self => {
        const f = Math.min(5, 1 + Math.floor((self.progress / 0.68) * 5));
        if (f !== floorShown) { floorShown = f; floorNum.textContent = '0' + f; }
      }
    }
  });
  tl1.fromTo('.s1-sky',  { scale: 1, yPercent: 0, transformOrigin: s1Origin }, { scale: 1.08, yPercent: 2.5, duration: 1 }, 0)
     .fromTo('.s1-bldg', { scale: 1, yPercent: 0, transformOrigin: s1Origin }, { scale: 1.26, yPercent: 2.5, duration: 1 }, 0)
     .fromTo('.s1-tree', { scale: 1, yPercent: 0, transformOrigin: s1Origin }, { scale: 1.46, yPercent: 2.5, duration: 1 }, 0)
     .fromTo('.floor-marker', { y: 0 }, { y: () => -($('.floor-track').clientHeight - 16), duration: 0.68 }, 0)
     .to('.s1-hint', { autoAlpha: 0, duration: 0.08 }, 0.02)
     .fromTo('.s1-copy', { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.1, ease: 'power1.out' }, 0.74)
     .to({}, { duration: 0.16 });

  /* ---------------- 2 · through the window ---------------- */
  gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: '#s2', start: 'top top', end: '+=150%', pin: true, scrub: 0.6, anticipatePin: 1, invalidateOnRefresh: true, refreshPriority: 9 }
  })
    .fromTo('.s2-cap', { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.12, ease: 'power1.out' }, 0.02)
    .to('.s2-cap', { autoAlpha: 0, duration: 0.1 }, 0.3)
    .fromTo('.s2-window', { scale: 1, transformOrigin: () => `${s2geo.ox}px ${s2geo.oy}px` }, { scale: () => s2geo.S, ease: 'power2.in', duration: 0.8 }, 0.1)
    .fromTo('.s2-photo img', { scale: 1.22 }, { scale: 1.04, duration: 0.9 }, 0.1)
    .to('.s2-window', { autoAlpha: 0, duration: 0.05 }, 0.88)
    .to({}, { duration: 0.1 });

  /* ---------------- 4 · one level, sideways ---------------- */
  const strip = $('.s4-strip');
  const dist = () => Math.max(0, strip.scrollWidth - strip.parentElement.clientWidth);
  const tl4 = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: '#s4', start: 'top top', end: () => '+=' + Math.max(innerHeight * 1.2, dist() * 1.25), pin: true, scrub: 0.6, anticipatePin: 1, invalidateOnRefresh: true, refreshPriority: 8 }
  });
  tl4.fromTo(strip, { x: 0 }, { x: () => dist(), duration: 1 }, 0)
     .fromTo('.s4-rule b', { scaleX: 0 }, { scaleX: 1, duration: 1 }, 0);
  $$('.s4-item img').forEach((img, i, all) => tl4.fromTo(img, { scale: 1 }, { scale: 1.04, duration: 0.5 }, i * (0.5 / Math.max(1, all.length - 1))));

  /* ---------------- 5 · "קומה 5" ---------------- */
  const fiveOrigin = () => { layoutWord(); return `${fiveBox.x}px ${fiveBox.y}px`; };
  gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: '#s5', start: 'top top', end: '+=200%', pin: true, scrub: 0.6, anticipatePin: 1, invalidateOnRefresh: true, refreshPriority: 7 }
  })
    .fromTo('.s5-svg', { scale: 1, transformOrigin: fiveOrigin }, { scale: 16, ease: 'power3.in', duration: 0.62 }, 0.06)
    .fromTo('.s5-photo', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, 0.46)
    .fromTo('.s5-photo img', { scale: 1.18 }, { scale: 1.04, duration: 0.5, ease: 'power2.out' }, 0.46)
    .to('.s5-svg', { autoAlpha: 0, duration: 0.06 }, 0.66)
    .to('.s5-scrim', { autoAlpha: 1, duration: 0.1 }, 0.72)
    .fromTo('.s5-copy', { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.1, ease: 'power1.out' }, 0.76)
    .to({}, { duration: 0.16 });

  /* ---------------- 6b · ceiling: one screen, pinned ---------------- */
  buildCeil(); drawCeil(0);
  ScrollTrigger.create({
    trigger: '#ceil', start: 'top top', end: '+=100%', pin: true, scrub: 0.4, anticipatePin: 1, refreshPriority: 6,
    onRefresh: () => { buildCeil(); },
    onUpdate: s => drawCeil(Math.min(1, s.progress / 0.85))
  });

  /* ---------------- 7 · closer: full photo → real detail → back ---------------- */
  closers.forEach((c, i) => {
    const cap = $('.closer-cap', c.sec), scr = $('.closer-scrim', c.sec);
    gsap.set(c.stage, { xPercent: -50, yPercent: -50 });
    gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: c.sec, start: 'top top', end: '+=170%', pin: true, scrub: 0.6, anticipatePin: 1, invalidateOnRefresh: true, refreshPriority: 5 - i }
    })
      .to({}, { duration: 0.1 })
      .fromTo(c.stage, { scale: 1, x: 0, y: 0 }, { scale: () => c.geo().S, x: () => c.geo().x, y: () => c.geo().y, ease: 'power2.inOut', duration: 0.36 }, 0.1)
      .fromTo(scr, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.08 }, 0.42)
      .fromTo(cap, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.08, ease: 'power1.out' }, 0.44)
      .to(cap, { autoAlpha: 0, duration: 0.06 }, 0.72)
      .to(scr, { autoAlpha: 0, duration: 0.06 }, 0.72)
      .to(c.stage, { scale: 1, x: 0, y: 0, ease: 'power2.inOut', duration: 0.24 }, 0.76);
  });

  ScrollTrigger.create({ start: 0, end: 'max', onUpdate: () => { paint(); updateCta(); } });
  ScrollTrigger.addEventListener('refresh', () => { measureStops(); paint(); updateCta(); });
  addEventListener('resize', () => { buildBigWindow(); buildSun(); layoutWord(); });
  finish();

  function finish() {
    ScrollTrigger.sort();
    ScrollTrigger.refresh();
    measureStops(); paint();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
    addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
  }
})();
