# MythTube Web

The web edition of MythTube: movies, series, anime and live TV in an installable app (PWA) that works in any modern browser on **Android, iOS/iPadOS, Windows, macOS and Linux**. It shares the catalog, source engine and plugin runtime of the Android app (separate repository), minus sign-in and downloads.

| | Android app | Web app (this repo) |
|---|---|---|
| Sign-up / login (Firebase) | yes | **removed** — opens straight into the catalog |
| Downloads | yes | **removed** |
| Auto best-server pick, fallbacks, ad/short-clip/wrong-title rejection | yes | yes |
| Anime tab, Bangladeshi-first Home, scoped search with history and suggestions | yes | yes |
| Nuvio plugins, Stremio addons, southfreak, amaderftp | yes | yes (through the proxy) |
| BDIX / private-network FTP servers | yes | no — browsers in the cloud cannot reach LAN-only servers |
| Install to home screen / dock | APK | yes (PWA, including iOS "Add to Home Screen") |

## How it works

```
Browser (React Native Web, PWA)
   │  /api/proxy?url=…&h=…        JSON, HTML, plugin scripts, AniList
   │  <MEDIA_PROXY>?url=…         video bytes, HLS playlists and segments
   ▼
Proxy (Vercel Edge function  or  Cloudflare Worker / Pages Function — same code in proxy/core.js)
   ▼
Movie / anime sources
```

Browsers cannot call most sources directly (no CORS, `http://` content blocked on `https://` pages, headers like `Referer` forbidden). The proxy adds CORS, forwards `Range` so seeking works, sets the headers a source needs and refuses private addresses. HLS streams are played with hls.js; plain `https` files that need nothing are played directly to save proxy bandwidth.

Everything else (source engine, validation, plugins, remote source updates) is the same code as the app, so the web app picks up new plugin repositories and servers from `config/sources.json` of the Android repository automatically.

## Deploy

See **[DEPLOY.md](DEPLOY.md)** for step-by-step Vercel and Cloudflare instructions, environment variables and how to install the app on iOS, Android and desktop.

Short version (Vercel): import this repository, leave the settings that `vercel.json` provides, set `ALLOWED_ORIGINS` to your domain. For video-heavy use, deploy `worker/` to Cloudflare and set `EXPO_PUBLIC_MEDIA_PROXY` to the Worker URL.

## Develop

```bash
npm install
npx expo install --fix
cp .env.example .env.local     # optional
npm start                      # http://localhost:8081  (needs the proxy: see DEPLOY.md, "Local development")
npm run build                  # static site in dist/
```

CI (`.github/workflows/ci.yml`) type-checks and exports the site on every push and uploads `dist` as an artifact.

## Layout

```
api/proxy.js            Vercel Edge function
functions/api/proxy.js  Cloudflare Pages Function
worker/                 Cloudflare Worker (+ wrangler.toml)
proxy/core.js           shared proxy logic (CORS, Range, SSRF guard, HLS rewrite)
public/                 manifest, service worker, icons, Cloudflare _headers/_redirects
web/index.html          HTML shell (PWA + iOS meta tags)
src/services            sources, plugin runtime, source engine, catalog
src/components/WebVideo.tsx   <video> + hls.js
src/screens             UI (Home, Anime, Live TV, Search, Title, Player …)
config/sources.json     bundled copy of the remote source list
```

## Legal

The app indexes publicly accessible content and does not host any media. You are responsible for the copyright rules in your jurisdiction. Nuvio plugin scripts are third-party code from the repositories listed in `src/services/nuvio/repos.ts`.
