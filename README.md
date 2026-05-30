# Space Invaders — Next.js

Classic Space Invaders built with Next.js 15, TypeScript, and Tailwind CSS.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Deploy to Vercel (subdomain)

### Option 1 — Vercel CLI (fastest)
```bash
npm install -g vercel
vercel
```
Follow the prompts. Your app gets a free `*.vercel.app` URL instantly.
To use a **custom subdomain** (e.g. `game.yourdomain.com`):
1. Go to your project on vercel.com → Settings → Domains
2. Add `game.yourdomain.com`
3. Add a CNAME record at your DNS provider pointing to `cname.vercel-dns.com`

### Option 2 — GitHub + Vercel (recommended for ongoing dev)
1. Push this repo to GitHub
2. Go to vercel.com → New Project → import your repo
3. Vercel auto-detects Next.js — click Deploy
4. Add your custom subdomain under Settings → Domains

### Option 3 — Netlify
```bash
npm run build
# Upload the .next folder, or connect your GitHub repo at netlify.com
```

### Option 4 — Self-host (VPS / Docker)
```bash
npm run build
npm start          # runs on port 3000
```
Point your subdomain's A record to your server IP, then use nginx/caddy as reverse proxy.

## Controls
- Arrow keys or A/D — move
- Space — fire
- P — pause
