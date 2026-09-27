# Paisa Dost web demo

Static one-page demo (concept for Fold): pick a fictional spender and a persona, get their month roasted in Hinglish. Plain HTML/CSS/JS, no build step, no network calls beyond its own files.

- Preview: `npx serve .` or `python3 -m http.server 8000` from `demo-web/`
- Check data: `node scripts/validate.mjs` (schema + every number in a roast exists in `data/profiles.json`)
- Regenerate link preview: `python3 scripts/make_og.py` (needs Pillow)
- Deploy: `vercel deploy --prod` from `demo-web/`, then set absolute `og:image`/`twitter:image` URLs in `index.html`
