# Fold Unfiltered — web demo

Static one-page concept for Fold: a phone lock screen where three notifications roast a fictional spender's month in Hinglish, each with one fix. Pick a voice, cycle spenders, share or save a notification as an image. Plain HTML/CSS/JS, no build step, no network calls beyond its own files.

- Preview: `npx serve .` or `python3 -m http.server 8000` from `demo-web/`
- Check data: `node scripts/validate.mjs` (roasts + `data/moments.json`; every number must exist in `data/profiles.json`)
- Regenerate link preview: `python3 scripts/make_og.py` (needs Pillow)
- Deploy: `vercel deploy --prod` from `demo-web/`, then set absolute `og:image`/`twitter:image` URLs in `index.html`
