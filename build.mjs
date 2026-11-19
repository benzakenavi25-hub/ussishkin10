// node build.mjs <slug>
// Reads listings/<slug>/data.json + photos, writes the site to the repo root: index.html, assets/, og.jpg.
// Photo treatment is non-generative only: per-photo white balance, one shared grade, crop, Lanczos resize, unsharp mask.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const slug = process.argv[2];
if (!slug) { console.error('usage: node build.mjs <slug>'); process.exit(1); }
const LDIR = path.join(ROOT, 'listings', slug);
const d = JSON.parse(fs.readFileSync(path.join(LDIR, 'data.json'), 'utf8'));
const OUT_IMG = path.join(ROOT, 'assets', 'img');
const WIDTHS = [1000, 2000];
const ACCENT = '#B08A64';

/* ------------------------------------------------------------------ photos */
// Every rendered photo is a "key": the photo number, or "<n>c" for a cropped variant (details).
// P.crop[n] = [left, top, width, height] as fractions, applied to that photo everywhere it's used.
const P = d.photos || {};
const exclude = new Set(P.exclude || []);
const jobs = new Map();   // key -> { n, crop }
const use = (n, crop, key = String(n)) => {
  if (n == null) return null;
  if (exclude.has(n)) throw new Error(`photo ${n} is both used and excluded`);
  if (!jobs.has(key)) jobs.set(key, { n, crop: crop || (P.crop || {})[n] || null });
  return key;
};
const K = {
  hero: use(P.hero), view: use(P.signature), location: use(P.location),
  story: (d.story || []).map(s => use(s.photo)),
  oneLevel: ((d.oneLevel || {}).photos || []).map(n => use(n)),
  gallery: (d.gallery || []).map(g => use(g.photo)),
};
const fullscreen = new Set((P.fullscreen || [P.hero, P.signature]).map(String));

const srcFile = n => {
  const dir = path.join(LDIR, 'photos');
  const f = fs.readdirSync(dir).find(f => new RegExp(`-${n}\\.(jpe?g|png|webp)$`, 'i').test(f));
  if (!f) throw new Error(`photo ${n} not found in ${dir}`);
  return path.join(dir, f);
};

// One shared tone curve: lift shadows a touch, +5% contrast around the midpoint.
const LUT = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  let x = i / 255;
  x = x + 0.045 * Math.pow(1 - x, 3) * x * 4;          // shadow lift, fades out by the mid-tones
  x = (x - 0.5) * 1.05 + 0.5;                            // contrast +5%
  LUT[i] = Math.min(1, Math.max(0, x)) * 255;
}
const SAT = 1.04;
// Neutral-warm white target (R:G:B) for the brightest near-neutral pixels.
const WHITE = [1.0, 0.992, 0.972];

async function grade(file) {
  const { data, info } = await sharp(file).rotate().removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  const px = info.width * info.height;
  // white balance: average of bright, low-chroma pixels (the walls, ceilings, sky haze)
  let r = 0, g = 0, b = 0, c = 0;
  for (let i = 0; i < px * 3; i += 3) {
    const R = data[i], G = data[i + 1], B = data[i + 2];
    const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
    if (mx > 185 && mx < 252 && mx - mn < 28) { r += R; g += G; b += B; c++; }
  }
  let gain = [1, 1, 1];
  if (c > px * 0.01) {
    const m = [r / c, g / c, b / c], lum = (m[0] + m[1] + m[2]) / 3;
    const tl = (WHITE[0] + WHITE[1] + WHITE[2]) / 3;
    // half-strength, capped: a correction, never a look (sky haze also lands in this sample)
    gain = m.map((v, k) => Math.min(1.03, Math.max(0.97, 1 + ((lum * WHITE[k] / tl) / v - 1) * 0.5)));
  }
  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 3) {
    let R = LUT[Math.min(255, data[i] * gain[0]) | 0], G = LUT[Math.min(255, data[i + 1] * gain[1]) | 0], B = LUT[Math.min(255, data[i + 2] * gain[2]) | 0];
    const Y = 0.299 * R + 0.587 * G + 0.114 * B;
    R = Y + (R - Y) * SAT; G = Y + (G - Y) * SAT; B = Y + (B - Y) * SAT;
    out[i] = R < 0 ? 0 : R > 255 ? 255 : R; out[i + 1] = G < 0 ? 0 : G > 255 ? 255 : G; out[i + 2] = B < 0 ? 0 : B > 255 ? 255 : B;
  }
  return { buf: out, width: info.width, height: info.height, gain };
}

const IMG = {};   // key -> { n, w, h, src: {1000: url, 2000?: url} }
const hash = crypto.createHash('sha1');
async function processPhotos() {
  fs.rmSync(OUT_IMG, { recursive: true, force: true });
  fs.mkdirSync(OUT_IMG, { recursive: true });
  const graded = {};
  for (const [key, { n, crop }] of [...jobs].sort((a, b) => a[1].n - b[1].n)) {
    const g = graded[n] || (graded[n] = await grade(srcFile(n)));
    let base = sharp(g.buf, { raw: { width: g.width, height: g.height, channels: 3 } });
    let w = g.width, h = g.height;
    if (crop) {
      const [l, t, cw, ch] = crop;
      const box = { left: Math.round(l * g.width), top: Math.round(t * g.height), width: Math.round(cw * g.width), height: Math.round(ch * g.height) };
      box.width = Math.min(box.width, g.width - box.left); box.height = Math.min(box.height, g.height - box.top);
      const raw = await base.extract(box).raw().toBuffer();
      w = box.width; h = box.height;
      base = sharp(raw, { raw: { width: w, height: h, channels: 3 } });
    }
    const buf0 = await base.raw().toBuffer();
    IMG[key] = { n, w, h, src: {} };
    // never upscale more than 2× (small crops get the 1000 px file only)
    for (const W of WIDTHS.filter(W => W === WIDTHS[0] || W <= w * 2)) {
      const H = Math.round(W * h / w);
      let s = sharp(buf0, { raw: { width: w, height: h, channels: 3 } }).resize(W, H, { kernel: 'lanczos3' });
      if ((fullscreen.has(key) || crop) && W > w) s = s.sharpen({ sigma: 0.9, m1: 0.6, m2: 1.2 });
      const buf = await s.webp({ quality: 80, effort: 5 }).toBuffer();
      const name = `p${key}-${W}.webp`;
      fs.writeFileSync(path.join(OUT_IMG, name), buf);
      hash.update(buf);
      IMG[key].src[W] = `assets/img/${name}`;
    }
    console.log(`photo ${key.padEnd(4)} ${w}×${h}${crop ? ' (crop)' : ''}  wb ${g.gain.map(v => v.toFixed(3)).join('/')}`);
  }
  // og.jpg: 1200x630 crop of the hero, respecting its focal point
  const h = graded[P.hero];
  const [fx, fy] = ((P.focus || {})[P.hero] || '50% 50%').split(' ').map(v => parseFloat(v) / 100);
  const scale = Math.max(1200 / h.width, 630 / h.height), W = Math.round(h.width * scale), H = Math.round(h.height * scale);
  const left = Math.max(0, Math.min(W - 1200, Math.round(W * fx - 600)));
  const top = Math.max(0, Math.min(H - 630, Math.round(H * fy - 315)));
  await sharp(h.buf, { raw: { width: h.width, height: h.height, channels: 3 } })
    .resize(W, H, { kernel: 'lanczos3' }).extract({ left, top, width: 1200, height: 630 })
    .jpeg({ quality: 85, mozjpeg: true }).toFile(path.join(ROOT, 'og.jpg'));
}

/* ------------------------------------------------------------------ tree rings (element 3) */
// Concentric closed paths, each a circle perturbed by low-frequency noise. Neighbouring rings share
// slowly drifting phases so they stay roughly parallel, like real growth rings; spacing grows outward.
function rng(seed) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }
function ringPath(cx, cy, r, ph, amp, pts) {
  const Q = [];
  for (let k = 0; k < pts; k++) {
    const a = (k / pts) * Math.PI * 2;
    const m = 1 + amp * (0.55 * Math.sin(2 * a + ph[0]) + 0.3 * Math.sin(3 * a + ph[1]) + 0.15 * Math.sin(5 * a + ph[2]));
    Q.push([cx + r * m * Math.cos(a), cy + r * m * Math.sin(a)]);
  }
  const f = v => Math.round(v);
  let s = `M${f(Q[0][0])} ${f(Q[0][1])}`;
  for (let i = 0; i < pts; i++) {   // closed Catmull-Rom → cubic Bézier
    const p0 = Q[(i - 1 + pts) % pts], p1 = Q[i], p2 = Q[(i + 1) % pts], p3 = Q[(i + 2) % pts];
    s += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return s + 'Z';
}
function rings({ cx, cy, n, r0, r1, seed, pts }) {
  const R = rng(seed), base = [R() * 6.28, R() * 6.28, R() * 6.28], out = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const r = (r0 + (r1 - r0) * Math.pow(t, 1.5)) * (1 + (R() - 0.5) * 0.05);
    const ph = base.map(b => b + (R() - 0.5) * 0.45 + t * 0.9);
    out.push(ringPath(cx, cy, r, ph, 0.022 + R() * 0.028, pts));
  }
  return out;
}
function writeRings() {
  // page background: centre off-screen right, mid-height of a tall layer (main.js scrolls it at 10%)
  const bg = rings({ cx: 1090, cy: 1500, n: 16, r0: 70, r1: 1750, seed: 10, pts: 44 });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 3000" preserveAspectRatio="xMaxYMid slice"><g fill="none" stroke="${ACCENT}" stroke-width="0.7">${bg.map(p => `<path d="${p}"/>`).join('')}</g></svg>`;
  fs.writeFileSync(path.join(OUT_IMG, 'rings.svg'), svg);
  hash.update(svg);
}
// price: a second instance centred behind the number, drawn in with stroke-dashoffset
const priceRings = () => `<svg class="price-rings" viewBox="-500 -500 1000 1000" aria-hidden="true" focusable="false">${rings({ cx: 0, cy: 0, n: 15, r0: 34, r1: 490, seed: 7, pts: 30 }).map(p => `<path d="${p}" pathLength="1"/>`).join('')}</svg>`;

/* ------------------------------------------------------------------ html helpers */
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// numbers (and runs like 3.1 or 5,990,000) stay LTR inside RTL text, and take the Latin face
const nums = s => esc(s).replace(/(\d[\d.,]*)/g, '<bdi>$1</bdi>');
const alt = k => esc(((P.alt || {})[IMG[k].n]) || d.title);
const focus = k => ((P.focus || {})[k]) || '50% 50%';
const srcset = k => Object.entries(IMG[k].src).map(([W, u]) => `${u} ${W}w`).join(', ');
// cover images: the rendered width is max(viewport width, viewport height × aspect)
const coverSizes = k => `max(100vw, ${Math.ceil(100 * IMG[k].w / IMG[k].h)}svh)`;
// defer: photos inside pinned, stacked sections. The browser's lazy-loading would fetch them all at once (they share one spot),
// so main.js swaps data-src in when the section is about a screen away.
function img(k, { cls = '', sizes, eager = false, cover = true, defer = false } = {}) {
  const i = IMG[k], a = defer ? 'data-' : '';
  return `<img${cls ? ` class="${cls}"` : ''} ${a}src="${i.src[1000]}" ${a}srcset="${srcset(k)}" sizes="${sizes || (cover ? coverSizes(k) : '100vw')}" width="${i.w}" height="${i.h}" alt="${alt(k)}"${cover ? ` style="object-position:${focus(k)}"` : ''}${eager ? ' fetchpriority="high" decoding="async"' : ' loading="lazy" decoding="async"'}>`;
}
const waLink = (msg) => `https://wa.me/${d.agent.whatsapp}?text=${encodeURIComponent(msg)}`;
const telLink = () => `tel:${String(d.agent.phone).replace(/[^\d+]/g, '').replace(/^0/, '+972')}`;
const fmtPrice = p => '₪' + Number(p).toLocaleString('en-US');
const words = s => s.split(' ').map(w => `<span class="ln"><span>${nums(w)}</span></span>`).join(' ');

// Element 1 · the section header: Latin label, Hebrew headline, 48px hairline
function head(label, title, { tag = 'h2', cls = '', titleHtml } = {}) {
  return `<header class="sh${cls ? ' ' + cls : ''}">
    ${label ? `<p class="sh-label" lang="en">${esc(label)}</p>` : ''}
    ${titleHtml || (title ? `<${tag} class="sh-title" data-lines>${words(title)}</${tag}>` : '')}
    <i class="sh-rule" aria-hidden="true"></i>
  </header>`;
}
// Element 2 · the frame: 1px accent line floating 10px outside the photo
const LINES = '<span class="fr fr-t"></span><span class="fr fr-l"></span><span class="fr fr-b"></span><span class="fr fr-r"></span>';
const frame = (inner, { cls = '', reveal = true } = {}) =>
  `<div class="frame${cls ? ' ' + cls : ''}"${reveal ? ' data-reveal' : ''}><span class="fr-lines" aria-hidden="true">${LINES}</span><div class="frame-in">${inner}</div></div>`;

/* ------------------------------------------------------------------ sections */
function sections() {
  const S = {}, L = d.labels || {};

  // the elevator: two doors, a floor display counting up to this listing's floor, then the doors open on the hero
  const floor = Math.max(1, Math.min(99, Number(d.floor) || 1)), pad2 = n => String(n).padStart(2, '0');
  S.intro = `<div class="intro" aria-hidden="true">
  <div class="door door-l"></div>
  <div class="door door-r"></div>
  <i class="door-seam"></i>
  <div class="floor">
    <p class="floor-label" lang="en">FLOOR</p>
    <p class="floor-num"><span class="floor-col">${Array.from({ length: floor }, (_, k) => `<span>${pad2(k + 1)}</span>`).join('')}</span></p>
  </div>
</div>`;

  // the menu: one link per section that exists
  const M = d.menu || {};
  const menuItems = [['view', '#view', K.view], ['story', '#story', (d.story || []).length], ['oneLevel', '#onelevel', d.oneLevel], ['price', '#price', d.price != null],
    ['gallery', '#gallery', K.gallery.length], ['location', '#location', d.location && K.location], ['visit', '#visit', d.visit && d.agent]]
    .filter(([k, , on]) => on && L[k] && M[k]);
  S.menu = `<div class="menu" id="menu" role="dialog" aria-modal="true" aria-label="תפריט" hidden>
  <button class="menu-close" type="button">סגירה <span aria-hidden="true">✕</span></button>
  <nav class="menu-nav" aria-label="ניווט באתר"><ul>
    ${menuItems.map(([k, href]) => `<li><a class="menu-link" href="${href}"><span class="menu-en" lang="en">${esc(L[k])}</span><span class="menu-he">${esc(M[k])}</span></a></li>`).join('\n    ')}
  </ul></nav>
</div>`;

  // hero: website chrome around the framed photo 27; scrolling grows it back to full screen and into the view (one pinned section, main.js)
  const H = d.hero || {};
  const dot = '<i class="dot" aria-hidden="true"></i>';
  S.hero = `
<section class="hero" id="hero" aria-label="${esc(d.title)}">
  <div class="hero-clip">
    <div class="hero-card">${img(K.hero, { eager: true, cls: 'hero-img' })}<div class="hero-shade"></div></div>
    ${K.view ? `<div class="view" id="view">
      <div class="view-pan">${img(K.view, { cls: 'view-img', defer: true, cover: false, sizes: coverSizes(K.view) })}</div>
      <div class="view-shade"></div>
      <div class="view-text">
        ${head(L.view, d.signature)}
        ${d.signatureSub ? `<p class="view-sub">${nums(d.signatureSub)}</p>` : ''}
      </div>
    </div>` : ''}
  </div>
  <div class="hero-frame" aria-hidden="true">${LINES}</div>
  <div class="hero-head">
    <p class="hero-label label-en" lang="en">${esc(L.hero || `${d.type} · ${d.area}`)}</p>
    <h1 class="hero-title">${nums(d.title)}</h1>
    ${(H.meta || []).length ? `<p class="hero-meta">${H.meta.map(m => `<span class="nw">${nums(m)}</span>`).join(dot)}</p>` : ''}
    ${d.price != null ? `<p class="hero-price"><span class="hero-price-label">${esc(H.priceLabel || 'מחיר מבוקש')}</span><span class="hero-price-num num" dir="ltr">${fmtPrice(d.price)}</span></p>` : ''}
    <i class="hero-rule" aria-hidden="true"></i>
  </div>
  ${H.caption ? `<p class="hero-cap" aria-hidden="true"><span class="hero-cap-in"><b class="num">${pad2(floor)}</b> · ${esc(H.caption)}</span></p>` : ''}
  <div class="hero-bottom"><div class="hero-bottom-in">
    ${K.view ? `<a class="hero-tour" href="#view"><i aria-hidden="true"></i>${esc(H.tour || 'לסיור בבית')} <span aria-hidden="true">↓</span></a>` : '<span></span>'}
    ${H.note ? `<p class="hero-note">${esc(H.note)}</p>` : ''}
  </div></div>
</section>`;

  const st = d.story || [];
  S.story = st.length ? `
<section class="story" id="story" aria-label="החדרים">
  <div class="story-head">${head(L.story, '')}</div>
  <p class="story-count" aria-hidden="true"><b class="story-now">01</b><span class="story-of"> / ${String(st.length).padStart(2, '0')}</span></p>
  <div class="story-stage">
  ${st.map((s, i) => `<article class="story-item">
    <p class="story-word" lang="en" aria-hidden="true"><span class="fit">${esc(s.word)}</span></p>
    ${frame(img(K.story[i], { defer: true, sizes: '(min-width: 900px) 64vw, calc(100vw - 48px)' }), { cls: 'story-frame', reveal: false })}
    <p class="story-line">${nums(s.line)}</p>
  </article>`).join('\n  ')}
  </div>
</section>` : '';

  const ol = d.oneLevel;
  S.oneLevel = ol ? `
<section class="onelevel" id="onelevel" aria-label="${esc(ol.title)}">
  <div class="ol-head">
    ${head(L.oneLevel, ol.title)}
    ${ol.sub ? `<p class="ol-sub" data-fade>${nums(ol.sub)}</p>` : ''}
  </div>
  <div class="ol-viewport">
    <div class="ol-strip">
      ${ol.photos.map((n, i) => `<figure class="ol-item">${frame(img(K.oneLevel[i], { sizes: '(min-width: 900px) 60vw, 85vw', defer: true }), { reveal: false })}<figcaption class="visually-hidden">${esc(ol.labels[i] || '')}</figcaption></figure>`).join('\n      ')}
    </div>
  </div>
  <div class="ol-labels" aria-hidden="true">
    <div class="ol-track"><b class="ol-fill"></b></div>
    ${ol.labels.map((l, i) => `<span class="ol-label${i === 0 ? ' is-on' : ''}">${esc(l)}</span>`).join('')}
  </div>
</section>` : '';

  S.price = d.price != null ? `
<section class="price" id="price" aria-label="מחיר מבוקש">
  ${priceRings()}
  ${head(L.price, '', { cls: 'sh-c', titleHtml: `<p class="price-num" aria-label="${fmtPrice(d.price)}" dir="ltr">${[...fmtPrice(d.price)].map(ch => /\d/.test(ch)
      ? `<span class="pd" data-d="${ch}"><span class="pd-col">${Array.from({ length: 20 }, (_, k) => `<span>${k % 10}</span>`).join('')}</span></span>`
      : `<span class="pc${ch === '₪' ? ' cur' : ''}">${ch}</span>`).join('')}</p>` })}
  <p class="price-sub" data-fade>${nums(d.priceLine || `${d.summary || ''}`)}</p>
</section>` : '';

  const facts = (d.facts || []).filter(f => f.value);
  S.facts = facts.length ? `
<section class="facts" id="facts" aria-label="הדירה במספרים">
  ${head(L.facts, d.factsTitle || 'הדירה, במספרים.')}
  <dl class="facts-grid">
    ${facts.map(f => `<div class="fact" data-fade>
      <dt class="fact-label">${nums(f.label)}</dt>
      <dd class="fact-val"><span class="fact-num num" data-count="${esc(f.value)}" dir="ltr">${esc(f.value)}</span>${f.unit ? `<span class="fact-unit">${esc(f.unit)}</span>` : ''}</dd>
    </div>`).join('\n    ')}
  </dl>
  ${(d.extras || []).length ? `<p class="extras" data-fade>${d.extras.map(e => `<span class="nw">${esc(e)}</span>`).join(' · ')}</p>` : ''}
</section>` : '';

  // gallery: a framed coverflow. The track is laid out LTR so a swipe to the left brings the next photo (main.js drives the look)
  const gal = K.gallery, GI = d.gallery || [], tot = pad2(gal.length);
  const L_ARR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>', R_ARR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
  S.gallery = gal.length ? `
<section class="gallery" id="gallery" aria-label="כל התמונות">
  <div class="gal-head">${head(L.gallery, 'כל התמונות')}</div>
  <div class="cf">
    <div class="cf-track" dir="ltr" tabindex="0" aria-roledescription="carousel" aria-label="גלריה, החליקו לצדדים">
      ${gal.map((k, i) => `<div class="cf-slide${i === 0 ? ' is-on' : ''}" data-i="${i}"><button class="cf-card" type="button" aria-label="${esc(GI[i].he)}: ${alt(k)}">${frame(img(k, { sizes: '(min-width: 900px) 46vw, 72vw' }) + '<span class="cf-dim"></span>', { reveal: false })}</button></div>`).join('\n      ')}
    </div>
    <button class="cf-arrow cf-prev" type="button" aria-label="התמונה הקודמת">${L_ARR}</button>
    <button class="cf-arrow cf-next" type="button" aria-label="התמונה הבאה">${R_ARR}</button>
  </div>
  <div class="cf-meta">
    <div class="cf-cap"><p class="cf-en label-en" lang="en">${esc(GI[0].latin)}</p><p class="cf-he">${esc(GI[0].he)}</p></div>
    <p class="cf-count" dir="ltr"><b class="cf-now">01</b><span class="cf-of"> / ${tot}</span></p>
  </div>
  <div class="cf-bar" dir="ltr">
    ${gal.map((k, i) => `<button class="cf-seg${i === 0 ? ' is-on' : ''}" type="button" data-i="${i}" aria-label="תמונה ${i + 1} מתוך ${gal.length}"><i></i></button>`).join('')}
  </div>
</section>
<div class="lightbox" role="dialog" aria-modal="true" aria-label="תמונות הדירה" hidden>
  <button class="lb-close" type="button" aria-label="סגירה"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
  <div class="lb-track" dir="ltr"></div>
  <p class="lb-count num" dir="ltr"></p>
  <button class="lb-arrow lb-prev" type="button" aria-label="התמונה הקודמת">${L_ARR}</button>
  <button class="lb-arrow lb-next" type="button" aria-label="התמונה הבאה">${R_ARR}</button>
</div>
<script type="application/json" id="gallery-data">${JSON.stringify(gal.map((k, i) => ({ src: IMG[k].src[2000] || IMG[k].src[1000], alt: (P.alt || {})[IMG[k].n] || d.title, w: IMG[k].w, h: IMG[k].h, latin: GI[i].latin || '', he: GI[i].he || '' })))}</script>` : '';

  const loc = d.location;
  S.location = loc && K.location ? `
<section class="location" id="location" aria-label="מיקום">
  ${head(L.location, loc.title || d.title)}
  ${frame(img(K.location, { sizes: '(min-width: 900px) 88vw, calc(100vw - 48px)' }), { cls: 'loc-frame' })}
  <div class="loc-text">
    ${loc.line ? `<p class="loc-line" data-fade>${nums(loc.line)}</p>` : ''}
    ${loc.mapsQuery ? `<a class="text-link" data-fade href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(loc.mapsQuery)}" target="_blank" rel="noopener">פתיחה במפה <span aria-hidden="true">↗</span></a>` : ''}
  </div>
</section>` : '';

  const v = d.visit, a = d.agent;
  S.visit = v && a ? `
<section class="visit" id="visit" aria-label="תיאום ביקור">
  ${head(L.visit, v.title)}
  ${v.sub ? `<p class="visit-sub" data-fade>${nums(v.sub)}</p>` : ''}
  <div class="slots">
    ${(v.slots || []).map(s => `<a class="slot" data-fade href="${esc(waLink(v.message.replace('{slot}', s)))}" target="_blank" rel="noopener"><span>${esc(s)}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg></a>`).join('\n    ')}
  </div>
  <a class="btn-brass" data-fade href="${telLink()}">לשיחה עם ${esc(a.firstName || a.name)}</a>
</section>` : '';

  S.agent = a ? `
<section class="agent" id="agent" aria-label="סוכן">
  <p class="agent-name">${esc(a.name)}</p>
  <p class="agent-meta">${[esc(a.office), a.license ? `רישיון <bdi>${esc(a.license)}</bdi>` : '', a.exclusive ? '<span class="brass">בבלעדיות</span>' : ''].filter(Boolean).join(' · ')}</p>
  <div class="agent-actions">
    <a class="agent-phone num" href="${telLink()}" dir="ltr">${esc(a.phone)}</a>
    <a class="btn-outline" href="${esc(waLink(d.visit ? d.visit.message.replace(' מועד נוח לי: {slot}.', '') : ''))}" target="_blank" rel="noopener">${WA_ICON}<span>וואטסאפ</span></a>
  </div>
</section>
<footer class="footer">
  ${d.trustLine ? `<p class="trust">${esc(d.trustLine)}</p>` : ''}
  ${d.credit ? `<p class="credit" lang="en">${esc(d.credit)}</p>` : ''}
</footer>` : '';
  return S;
}
const WA_ICON = '<svg class="wa" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2a9.8 9.8 0 0 0-8.4 14.8L2.2 21.8l4.9-1.3A9.8 9.8 0 1 0 12 2.2zm0 17.9a8.1 8.1 0 0 1-4.1-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A8.1 8.1 0 1 1 12 20.1zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3z"/></svg>';

/* ------------------------------------------------------------------ build */
await processPhotos();
writeRings();
const S = sections();
const ver = hash.update(fs.readFileSync(path.join(ROOT, 'template', 'styles.css'))).update(fs.readFileSync(path.join(ROOT, 'template', 'main.js'))).digest('hex').slice(0, 8);
const pageTitle = `${d.title} · ${d.type} ב${d.area}`;
const vars = {
  lang: 'he', title: esc(pageTitle), description: esc(d.ogDescription || ''),
  url: esc(d.url || ''), og: esc((d.url || '') + 'og.jpg'),
  robots: d.indexable ? '' : '<meta name="robots" content="noindex, nofollow">',
  preload: `<link rel="preload" as="image" imagesrcset="${srcset(K.hero)}" imagesizes="${coverSizes(K.hero)}" fetchpriority="high">`,
  brand: esc(d.title),
  cta: d.agent && d.visit ? `<a class="pill is-hidden" href="${esc(waLink(d.visit.message.replace(' מועד נוח לי: {slot}.', '')))}" target="_blank" rel="noopener">${WA_ICON}<span>לתיאום ביקור</span></a>` : '',
  v: ver,
  ...Object.fromEntries(Object.entries(S).map(([k, v]) => ['section_' + k, v]))
};
let html = fs.readFileSync(path.join(ROOT, 'template', 'page.html'), 'utf8');
html = html.replace(/\{\{(\w+)\}\}/g, (m, k) => { if (!(k in vars)) throw new Error('missing template var ' + k); return vars[k]; });
fs.writeFileSync(path.join(ROOT, 'index.html'), html);
fs.mkdirSync(path.join(ROOT, 'assets', 'css'), { recursive: true });
fs.mkdirSync(path.join(ROOT, 'assets', 'js'), { recursive: true });
fs.rmSync(path.join(ROOT, 'assets', 'css', 'style.css'), { force: true });
fs.copyFileSync(path.join(ROOT, 'template', 'styles.css'), path.join(ROOT, 'assets', 'css', 'styles.css'));
fs.copyFileSync(path.join(ROOT, 'template', 'main.js'), path.join(ROOT, 'assets', 'js', 'main.js'));
fs.copyFileSync(path.join(ROOT, 'template', 'favicon.svg'), path.join(ROOT, 'favicon.svg'));
console.log(`built ${slug}: index.html, ${jobs.size} photos, og.jpg (v ${ver})`);
