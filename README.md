# Fold Unfiltered — web demo

Static one-page concept for Fold: a phone lock screen where three notifications roast a fictional spender's month in Hinglish, each with one fix. Tap one to open it, pick a voice, cycle spenders. Fits one screen with no page scroll. Plain HTML/CSS/JS, no build step, no network calls beyond its own files.

- Preview: `npx serve .` or `python3 -m http.server 8000` from `demo-web/`
- Check data: `node scripts/validate.mjs` (roasts + `data/moments.json`; every number must exist in `data/profiles.json`)
- Regenerate link preview: `python3 scripts/make_og.py` (needs Pillow)
- Live: https://fold-unfiltered.vercel.app (Vercel deploys every push to main)
