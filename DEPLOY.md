# Deploying MythTube Web

You need one place that serves the static site **and** one proxy. Vercel can do both; Cloudflare can do both; or split them (recommended for video): site on Vercel, media proxy on a Cloudflare Worker.

## 0. Environment variables

| Name | Where | Meaning |
|---|---|---|
| `EXPO_PUBLIC_PROXY_URL` | build time | Proxy for API traffic. Default `/api/proxy` (same domain). |
| `EXPO_PUBLIC_MEDIA_PROXY` | build time | Proxy for video bytes. Default = `EXPO_PUBLIC_PROXY_URL`. Set to your Worker URL to move video traffic off Vercel. |
| `ALLOWED_ORIGINS` | runtime (proxy) | Comma-separated list of sites allowed to use your proxy, e.g. `https://mythtube.vercel.app,https://watch.example.com`. `*.example.com` also works. **Set this** or anyone can use your proxy. |

`EXPO_PUBLIC_*` values are compiled into the JavaScript at build time: change them, then redeploy.

## 1. Vercel (site + API proxy)

1. Push this repository to GitHub (already done if you are reading this there).
2. Vercel → **Add New → Project** → import the repository.
3. Framework preset **Other**. `vercel.json` already sets the install command, build command (`expo export -p web`, plus icon-font shrinking) and output directory `dist` — do not override them.
4. **Environment Variables**: add `ALLOWED_ORIGINS` = your final site URL(s). Add `EXPO_PUBLIC_MEDIA_PROXY` if you use the Cloudflare Worker (step 2).
5. Deploy. The Edge function `api/proxy.js` is picked up automatically.
6. Custom domain: Project → Settings → Domains. Add the new domain to `ALLOWED_ORIGINS` and redeploy.

Vercel notes: video through the proxy counts against bandwidth, and the Hobby plan is meant for non-commercial use with fair-use limits. For anything beyond personal use, serve media from Cloudflare (step 2).

## 2. Cloudflare Worker (media proxy, recommended)

```bash
cd worker
npx wrangler login
npx wrangler deploy                       # prints https://mythtube-proxy.<account>.workers.dev
npx wrangler secret put ALLOWED_ORIGINS   # or edit [vars] in wrangler.toml; e.g. https://mythtube.vercel.app
```

Then in Vercel set `EXPO_PUBLIC_MEDIA_PROXY=https://mythtube-proxy.<account>.workers.dev` and redeploy. Workers are free up to 100k requests/day with no bandwidth charge; HLS uses many small requests (one per segment), so watch the request count or use a paid plan if you share the app widely.

Dashboard alternative: Workers & Pages → Create → Worker → paste `proxy/core.js` and `worker/index.js` (bundled), add the variable `ALLOWED_ORIGINS`.

## 3. Cloudflare Pages (site + proxy, instead of Vercel)

1. Workers & Pages → Create → Pages → connect the repository.
2. Build command: `pip install fonttools; python3 tools/subset_icon_fonts.py; npx expo install --fix && npx expo export -p web` · Output directory: `dist`.
3. Settings → Environment variables: `ALLOWED_ORIGINS`, and `NODE_VERSION=22`.
4. `functions/api/proxy.js` becomes `/api/proxy`; `public/_headers` and `public/_redirects` handle caching and the single-page fallback.

## 4. Put Cloudflare in front of Vercel (optional)

Add your domain to Cloudflare (DNS), point it at Vercel with a CNAME (`cname.vercel-dns.com`), set the proxy status to **DNS only** while Vercel issues the certificate, then enable the orange cloud if you want Cloudflare's CDN/firewall. SSL/TLS mode must be **Full (strict)**. Keep `/api/*` uncached (the proxy already sends the right headers).

## 5. Install the app

- **Android / Chrome / Edge / Samsung Internet**: open the site → menu → *Install app* (or the install banner).
- **iPhone / iPad (Safari)**: Share → **Add to Home Screen** → Add. It then opens full screen like an app. (Safari only; other iOS browsers can add via their share menu on iOS 16.4+.)
- **Windows / macOS / Linux (Chrome, Edge)**: address bar install icon, or menu → *Install MythTube*.

Updates arrive automatically: the service worker fetches the new version in the background and uses it on the next launch.

## 6. Local development

The proxy runs on Vercel/Cloudflare, not under `expo start`. Easiest options:

- Point the dev build at your deployed proxy: `EXPO_PUBLIC_PROXY_URL=https://your-site.vercel.app/api/proxy npm start` and add `http://localhost:8081` to `ALLOWED_ORIGINS` (or leave `ALLOWED_ORIGINS` empty while testing).
- Or run `npx vercel dev` (serves the Edge function locally) in one terminal and set `EXPO_PUBLIC_PROXY_URL=http://localhost:3000/api/proxy`.

## 7. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Lists empty, "Check Sources" shows 0 online | The proxy is unreachable or blocks your origin. Open `/api/proxy?url=https://graphql.anilist.co` in the browser; a 403 means `ALLOWED_ORIGINS` does not include the site you are on. |
| Video never starts, then switches servers | The stream host blocks datacenter IPs or serves MKV (Safari cannot play MKV). The app skips these automatically; another server is chosen. |
| Works on desktop, not on iPhone | iPhone Safari before iOS 17.1 has no hls.js support and falls back to native HLS through the proxy (`rewrite=1`); make sure the media proxy is HTTPS and reachable. |
| No "Install" prompt | Must be served over HTTPS, and `manifest.webmanifest` + icons must load (open them directly). Visit twice or interact with the page first. |
| Old version after a deploy | Close all tabs/app windows and reopen once; the new service worker activates on the next launch. |

## 8. Security

The proxy is an open relay unless you set `ALLOWED_ORIGINS`. It only accepts `GET`/`HEAD` (and `POST` to AniList, or to any public host only when an allow-list is set), refuses `localhost` and private/link-local addresses, strips cookies and never forwards your users' headers upstream except `Range`. Do not remove those checks. Consider Cloudflare rate-limiting rules on `/api/proxy`.
