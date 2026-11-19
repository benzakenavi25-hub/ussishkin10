# Listing microsite template

One property per page, built from data. Plain HTML/CSS/JS. GSAP, ScrollTrigger and Lenis load from a CDN.

```
template/              page.html, styles.css, main.js, favicon.svg  (shared)
listings/<slug>/       data.json + photos/ (originals, named <anything>-<n>.JPG)
build.mjs              node build.mjs <slug>  →  index.html, assets/, og.jpg at the repo root
```

## The next listing in 5 steps

1. **Copy** the repo (or copy `listings/ussishkin-10` to `listings/<new-slug>`).
2. **Photos:** put the agent's photos in `listings/<new-slug>/photos/`, named `<name>-1.JPG`, `<name>-2.JPG` …
3. **Edit `data.json`:** texts, facts, price, agent, and photo numbers (`hero`, `signature`, `location`, `story`, `oneLevel`, `gallery`, `exclude`). Add `focus` (CSS object-position) for full-screen photos and a short Hebrew `alt` for every photo used. Empty fields don't render; `"price": null` removes the price section.
4. **Build:** `npm install` (once, installs sharp), then `node build.mjs <new-slug>`.
5. **Publish:** commit + push. Then paste the link into a WhatsApp chat to check the preview card (title, price line, photo).

## Rules the build keeps

- Real photos only. The build only corrects white balance, applies one shared subtle grade, resizes (Lanczos) and lightly sharpens the full-screen photos. No generative edits.
- Every photo is exported as WebP at 1000 and 2000 px. `og.jpg` is a 1200×630 crop of the hero.
- `indexable: false` adds `noindex`.
- Set `url` in `data.json` to the live address: the OG image needs an absolute URL.
