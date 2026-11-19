// node build.mjs <slug>
// Reads listings/<slug>/data.json + photos, writes the site to the repo root: index.html, assets/, og.jpg.
// Photo treatment is non-generative only: per-photo white balance, one shared grade, Lanczos resize, unsharp mask.
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

/* ------------------------------------------------------------------ photos */
const P = d.photos || {};
const exclude = new Set(P.exclude || []);
const used = new Set([P.hero, P.signature, P.location, ...(d.story || []).map(s => s.photo), ...((d.oneLevel || {}).photos || []), ...(P.gallery || [])].filter(n => n != null));
for (const n of used) if (exclude.has(n)) throw new Error(`photo ${n} is both used and excluded`);
const fullscreen = new Set(P.fullscreen || [P.hero, P.signature, ...(d.story || []).map(s => s.photo)]);

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

const IMG = {};   // n -> { w, h, src: {1000: url, 2000: url} }
const hash = crypto.createHash('sha1');
async function processPhotos() {
  fs.rmSync(OUT_IMG, { recursive: true, force: true });
  fs.mkdirSync(OUT_IMG, { recursive: true });
  const graded = {};
  for (const n of [...used].sort((a, b) => a - b)) {
    const g = await grade(srcFile(n));
    graded[n] = g;
    IMG[n] = { w: g.width, h: g.height, src: {} };
    for (const W of WIDTHS) {
      const H = Math.round(W * g.height / g.width);
      let s = sharp(g.buf, { raw: { width: g.width, height: g.height, channels: 3 } }).resize(W, H, { kernel: 'lanczos3' });
      if (fullscreen.has(n) && W > g.width) s = s.sharpen({ sigma: 0.9, m1: 0.6, m2: 1.2 });
      const buf = await s.webp({ quality: 80, effort: 5 }).toBuffer();
      const name = `p${n}-${W}.webp`;
      fs.writeFileSync(path.join(OUT_IMG, name), buf);
      hash.update(buf);
      IMG[n].src[W] = `assets/img/${name}`;
    }
    console.log(`photo ${n}  wb ${g.gain.map(v => v.toFixed(3)).join('/')}`);
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

/* ------------------------------------------------------------------ html helpers */
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// numbers (and runs like 3.1 or 5,990,000) stay LTR inside RTL text
const nums = s => esc(s).replace(/(\d[\d.,]*)/g, '<bdi>$1</bdi>');
const alt = n => esc(((P.alt || {})[n]) || d.title);
const focus = n => ((P.focus || {})[n]) || '50% 50%';
const srcset = n => WIDTHS.map(W => `${IMG[n].src[W]} ${W}w`).join(', ');
// cover images: the rendered width is max(viewport width, viewport height × aspect)
const coverSizes = n => `max(100vw, ${Math.ceil(100 * IMG[n].w / IMG[n].h)}svh)`;
// defer: photos inside pinned, stacked sections. The browser's lazy-loading would fetch them all at once (they share one spot),
// so main.js swaps data-src in when the section is about a screen away.
function img(n, { cls = '', sizes, eager = false, cover = true, defer = false } = {}) {
  const i = IMG[n], a = defer ? 'data-' : '';
  return `<img${cls ? ` class="${cls}"` : ''} ${a}src="${i.src[1000]}" ${a}srcset="${srcset(n)}" sizes="${sizes || (cover ? coverSizes(n) : '100vw')}" width="${i.w}" height="${i.h}" alt="${alt(n)}"${cover ? ` style="object-position:${focus(n)}"` : ''}${eager ? ' fetchpriority="high" decoding="async"' : ' loading="lazy" decoding="async"'}>`;
}
const waLink = (msg) => `https://wa.me/${d.agent.whatsapp}?text=${encodeURIComponent(msg)}`;
const telLink = () => `tel:${String(d.agent.phone).replace(/[^\d+]/g, '').replace(/^0/, '+972')}`;
const fmtPrice = p => '₪' + Number(p).toLocaleString('en-US');

/* ------------------------------------------------------------------ sections */
function sections() {
  const S = {};
  const words = s => s.split(' ').map(w => `<span class="ln"><span>${nums(w)}</span></span>`).join(' ');

  S.hero = `
<section class="hero" id="hero" aria-label="${esc(d.title)}">
  <div class="hero-card">${img(P.hero, { eager: true, cls: 'hero-img' })}<div class="hero-shade"></div></div>
  <div class="hero-text">
    <p class="label hero-label"><span class="in">${esc(d.type)} · ${esc(d.area)}</span></p>
    <h1 class="hero-title"><span class="ln"><span>${esc(d.title.split(' ')[0])}</span></span> <span class="ln"><span><bdi>${esc(d.title.split(' ').slice(1).join(' '))}</bdi></span></span></h1>
  </div>
  <div class="hero-hint" aria-hidden="true"><div class="in"><span>גלול</span><i></i></div></div>
</section>`;

  S.signature = d.signature ? `
<section class="signature" id="signature" aria-label="${esc(d.signature)}">
  <div class="sig-frame">${img(P.signature, { cls: 'sig-img', defer: true })}</div>
  <div class="sig-shade"></div>
  <div class="sig-text">
    <h2 class="t-section sig-title" data-lines>${words(d.signature)}</h2>
    ${d.signatureSub ? `<p class="sig-sub" data-fade>${nums(d.signatureSub)}</p>` : ''}
  </div>
</section>` : '';

  const st = d.story || [];
  S.story = st.length ? `
<section class="story" id="story" aria-label="החדרים">
  ${st.map((s, i) => `<article class="story-item" style="z-index:${i + 1}">
    <div class="story-photo">${img(s.photo, { cls: 'story-img', defer: true })}</div>
    <div class="story-shade"></div>
    <p class="ghost" aria-hidden="true" lang="en">${esc(s.word)}</p>
    <p class="story-line"><i class="hair"></i><span>${nums(s.line)}</span></p>
  </article>`).join('\n  ')}
  <p class="story-count" aria-hidden="true"><b class="story-now">01</b> / ${String(st.length).padStart(2, '0')}</p>
</section>` : '';

  const ol = d.oneLevel;
  S.oneLevel = ol ? `
<section class="onelevel" id="onelevel" aria-label="${esc(ol.title)}">
  <div class="ol-head">
    <h2 class="t-section" data-lines>${words(ol.title)}</h2>
    ${ol.sub ? `<p class="ol-sub" data-fade>${nums(ol.sub)}</p>` : ''}
  </div>
  <div class="ol-viewport">
    <div class="ol-strip">
      ${ol.photos.map((n, i) => `<figure class="ol-item">${img(n, { cover: true, sizes: '(min-width: 900px) 60vw, 85vw', defer: true })}<figcaption class="visually-hidden">${esc(ol.labels[i] || '')}</figcaption></figure>`).join('\n      ')}
    </div>
  </div>
  <div class="ol-labels" aria-hidden="true">
    <div class="ol-track"><b class="ol-fill"></b></div>
    ${ol.labels.map((l, i) => `<span class="ol-label${i === 0 ? ' is-on' : ''}">${esc(l)}</span>`).join('')}
  </div>
</section>` : '';

  S.price = d.price != null ? `
<section class="price" id="price" aria-label="מחיר מבוקש">
  <p class="label label-brass" data-fade>מחיר מבוקש</p>
  <p class="price-num" aria-label="${fmtPrice(d.price)}" dir="ltr">${[...fmtPrice(d.price)].map(ch => /\d/.test(ch)
      ? `<span class="pd" data-d="${ch}"><span class="pd-col">${Array.from({ length: 20 }, (_, k) => `<span>${k % 10}</span>`).join('')}</span></span>`
      : `<span class="pc">${ch}</span>`).join('')}</p>
  <i class="price-rule" aria-hidden="true"></i>
  <p class="price-sub" data-fade>${esc(d.type)} · ${nums(d.summary || '')} · ${esc(d.area)}</p>
</section>` : '';

  const facts = (d.facts || []).filter(f => f.value);
  S.facts = facts.length ? `
<section class="facts" id="facts" aria-label="הדירה במספרים">
  <h2 class="t-section" data-lines>${words('הדירה, במספרים.')}</h2>
  <dl class="facts-grid">
    ${facts.map(f => `<div class="fact" data-fade>
      <dt class="fact-label">${nums(f.label)}</dt>
      <dd class="fact-val"><bdi class="fact-num" data-count="${esc(f.value)}">${esc(f.value)}</bdi>${f.unit ? `<span class="fact-unit">${esc(f.unit)}</span>` : ''}</dd>
    </div>`).join('\n    ')}
  </dl>
  ${(d.extras || []).length ? `<p class="extras" data-fade>${d.extras.map(e => `<span class="nw">${esc(e)}</span>`).join(' · ')}</p>` : ''}
</section>` : '';

  const gal = P.gallery || [];
  S.gallery = gal.length ? `
<section class="gallery" id="gallery" aria-label="כל התמונות">
  <div class="gal-head">
    <h2 class="t-section" data-lines>${words('כל התמונות')}</h2>
    <p class="label gal-count" data-fade><bdi>${gal.length}</bdi> תמונות</p>
  </div>
  <div class="gal-strip" tabindex="0" aria-label="גלריה, החליקו לצדדים">
    ${gal.map((n, i) => `<button class="gal-item" type="button" data-i="${i}" aria-label="פתיחת תמונה ${i + 1}: ${alt(n)}">${img(n, { cover: true, sizes: '(min-width: 900px) 46vw, 78vw' })}</button>`).join('\n    ')}
  </div>
  <div class="gal-nav">
    <button class="gal-arrow" type="button" data-dir="prev" aria-label="התמונה הקודמת"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>
    <button class="gal-arrow" type="button" data-dir="next" aria-label="התמונה הבאה"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button>
  </div>
</section>
<div class="lightbox" role="dialog" aria-modal="true" aria-label="תמונות הדירה" hidden>
  <button class="lb-close" type="button" aria-label="סגירה"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
  <div class="lb-track"></div>
  <p class="lb-count label" dir="ltr"></p>
  <button class="lb-arrow lb-prev" type="button" aria-label="התמונה הקודמת"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>
  <button class="lb-arrow lb-next" type="button" aria-label="התמונה הבאה"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button>
</div>
<script type="application/json" id="gallery-data">${JSON.stringify(gal.map(n => ({ src: IMG[n].src[2000], small: IMG[n].src[1000], alt: (P.alt || {})[n] || d.title, w: IMG[n].w, h: IMG[n].h })))}</script>` : '';

  const loc = d.location;
  S.location = loc && P.location ? `
<section class="location" id="location" aria-label="מיקום">
  <div class="loc-photo">${img(P.location, { cls: 'push' })}</div>
  <div class="loc-text">
    <h2 class="t-section" data-lines>${words(loc.title || d.title)}</h2>
    ${loc.line ? `<p class="loc-line" data-fade>${nums(loc.line)}</p>` : ''}
    ${loc.mapsQuery ? `<a class="text-link" data-fade href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(loc.mapsQuery)}" target="_blank" rel="noopener">פתיחה במפה <span aria-hidden="true">↗</span></a>` : ''}
  </div>
</section>` : '';

  const v = d.visit, a = d.agent;
  S.visit = v && a ? `
<section class="visit" id="visit" aria-label="תיאום ביקור">
  <h2 class="t-section" data-lines>${words(v.title)}</h2>
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
    <a class="agent-phone" href="${telLink()}" dir="ltr">${esc(a.phone)}</a>
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
const S = sections();
const ver = hash.update(fs.readFileSync(path.join(ROOT, 'template', 'styles.css'))).update(fs.readFileSync(path.join(ROOT, 'template', 'main.js'))).digest('hex').slice(0, 8);
const pageTitle = `${d.title} · ${d.type} ב${d.area}`;
const heroN = P.hero;
const vars = {
  lang: 'he', title: esc(pageTitle), description: esc(d.ogDescription || ''),
  url: esc(d.url || ''), og: esc((d.url || '') + 'og.jpg'),
  robots: d.indexable ? '' : '<meta name="robots" content="noindex, nofollow">',
  preload: `<link rel="preload" as="image" imagesrcset="${srcset(heroN)}" imagesizes="${coverSizes(heroN)}" fetchpriority="high">`,
  brand: esc(d.title), brandSub: `${esc(d.type)} · ${esc(d.area)}`,
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
console.log(`built ${slug}: index.html, ${used.size} photos × ${WIDTHS.length}, og.jpg (v ${ver})`);
