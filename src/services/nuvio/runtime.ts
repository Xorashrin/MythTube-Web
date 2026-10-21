// Nuvio plugin runtime. A provider is a bundled CommonJS script exporting
// `getStreams(tmdbId, mediaType, season, episode)`. Scripts are downloaded from the repos in
// ./repos, evaluated with a minimal `require` (cheerio, crypto-js, buffer) and called on demand.
// Provider scripts come from third-party GitHub repositories; only the repos listed in ./repos are used.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Buffer } from 'buffer';
import cheerio from 'cheerio-without-node-native';
import CryptoJS from 'crypto-js';

import { cached } from '../cache';
import { getJsonMirrored, getTextMirrored, withTimeout } from '../http';
import { proxied } from '../proxy';
import { providerDisabled } from './disabled';
import { NUVIO_REPOS, type NuvioRepo } from './repos';

export interface Scraper {
  id: string;
  name: string;
  filename: string;
  version?: string;
  supportedTypes?: string[];
  enabled?: boolean;
  contentLanguage?: string[];
}

export interface Provider {
  key: string;
  repo: NuvioRepo;
  scraper: Scraper;
}

export interface NuvioStream {
  name?: string;
  title?: string;
  url: string;
  quality?: string;
  size?: string;
  headers?: Record<string, string>;
  provider: string;
  /** `repo:scraper` key, used to learn which providers deliver real content. */
  providerKey: string;
}

type GetStreams = (tmdbId: string, mediaType: string, season?: number, episode?: number) => Promise<unknown>;

const MANIFEST_TTL = 24 * 3600 * 1000;
const RUN_TIMEOUT = 18000;
const HEALTH_KEY = 'mythtube:nuvio:health:v1';
// Public TMDB key shipped inside the vetted community plugins; used only for the plugins that ask the host for one.
const TMDB_KEY = '439c478a771f35c05022f9feabcca01c';

// ---------------------------------------------------------------- manifests

export async function loadProviders(kind: 'movie' | 'tv'): Promise<Provider[]> {
  const lists = await Promise.all(
    NUVIO_REPOS.map(async (repo) => {
      try {
        const man = await cached(`nuvio:manifest:${repo.id}`, { ttl: MANIFEST_TTL }, () =>
          getJsonMirrored<{ scrapers?: Scraper[] }>(`${repo.base}/manifest.json`, { timeout: 12000 }),
        );
        return (man.scrapers ?? [])
          .filter((s) => s.enabled !== false && s.filename && (!s.supportedTypes || s.supportedTypes.includes(kind) || (kind === 'tv' && s.supportedTypes.includes('anime'))))
          .map<Provider>((scraper) => ({ key: `${repo.id}:${scraper.id}`, repo, scraper }))
          .filter((p) => !providerDisabled(p.key));
      } catch {
        return [];
      }
    }),
  );
  return lists.flat();
}

// ---------------------------------------------------------------- health (learned ordering)

interface Health {
  ok: number;
  fail: number;
  ms: number;
}

let health: Record<string, Health> | null = null;

async function readHealth(): Promise<Record<string, Health>> {
  if (health) return health;
  try {
    health = JSON.parse((await AsyncStorage.getItem(HEALTH_KEY)) ?? '{}') as Record<string, Health>;
  } catch {
    health = {};
  }
  return health;
}

async function recordRun(key: string, ok: boolean, ms: number) {
  const h = await readHealth();
  const cur = h[key] ?? { ok: 0, fail: 0, ms: 0 };
  if (ok) {
    cur.ok += 1;
    cur.ms = cur.ms ? Math.round(cur.ms * 0.7 + ms * 0.3) : ms;
  } else {
    cur.fail += 1;
  }
  h[key] = cur;
  AsyncStorage.setItem(HEALTH_KEY, JSON.stringify(h)).catch(() => undefined);
}

/** Providers sorted by repo priority, then by observed success rate and speed. */
const ANIME_RE = /anime|kickass|anizone|pahe|animekai|hianime|allwish|anikoto|animex|tokyo|donghua|toonhub|toonstream|zoro|aniwatch|anidb|animetsu|animelok|animesalt|animedekho|animeworld|animecloud|animekhor|animedub|anichi|reanime|anineko|animecube|animeflv|jkanime|latanime|tioanime|anime4up|animewitcher|witanime|anim3rb|asyaanime/i;

export function isAnimeProvider(p: Provider): boolean {
  return ANIME_RE.test(p.scraper.id + p.scraper.name) || (p.scraper.supportedTypes ?? []).includes('anime');
}

export async function rankProviders(providers: Provider[], preferLang: NuvioRepo['lang'][] = [], opts: { anime?: boolean } = {}): Promise<Provider[]> {
  const h = await readHealth();
  const score = (p: Provider) => {
    const st = h[p.key];
    const runs = st ? st.ok + st.fail : 0;
    const rate = runs >= 2 ? st!.ok / runs : 0.5;
    const speed = st?.ms ? Math.min(st.ms / 1000, 15) : 6;
    const langBonus = p.repo.lang === 'multi' || preferLang.includes(p.repo.lang) ? 0 : 8;
    // Ad-wrapper families that frequently return promo clips run last (their output is still validated).
    const adRisk = /moviebox|adimoviebox/i.test(p.scraper.id) ? 25 : 0;
    // Anime titles try the anime-specific plugins first (KickAssAnime, AniZone, AnimePahe, HiAnime, AnimeKai, Tokyo Insider…).
    const animeBoost = opts.anime ? (isAnimeProvider(p) ? -30 : 10) : 0;
    return p.repo.priority * 0.8 + langBonus + adRisk + animeBoost + (1 - rate) * 12 + speed * 0.4;
  };
  return [...providers].sort((a, b) => score(a) - score(b));
}

// ---------------------------------------------------------------- script loading

const compiled = new Map<string, Promise<GetStreams>>();

function requireShim(name: string): unknown {
  switch (name) {
    case 'cheerio-without-node-native':
    case 'cheerio':
      return cheerio;
    case 'crypto-js':
      return CryptoJS;
    case 'buffer':
      return { Buffer };
    default:
      throw new Error(`Module "${name}" is not available in the plugin runtime`);
  }
}

const scripts = new Map<string, string>();

/** Plugin scripts are fetched through the proxy once per session; the browser/CDN HTTP cache keeps them across sessions. */
async function readScript(p: Provider): Promise<string> {
  const key = `${p.key}@${p.scraper.version ?? '0'}`;
  const hit = scripts.get(key);
  if (hit) return hit;
  const code = await getTextMirrored(`${p.repo.base}/${p.scraper.filename}`, { timeout: 20000 });
  scripts.set(key, code);
  return code;
}

/** `fetch` handed to plugin scripts: every request goes through the proxy, which adds CORS and the headers a page may not set. */
function pluginFetch(input: unknown, init: RequestInit = {}): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : String((input as { url?: string }).url ?? input);
  const headers: Record<string, string> = {};
  const raw = init.headers;
  if (raw instanceof Headers) raw.forEach((v, k) => (headers[k] = v));
  else if (Array.isArray(raw)) raw.forEach(([k, v]) => (headers[k] = v));
  else if (raw) Object.assign(headers, raw);
  const contentType = headers['Content-Type'] ?? headers['content-type'];
  const method = (init.method ?? 'GET').toUpperCase();
  return fetch(proxied(url, headers), {
    method: method === 'POST' ? 'POST' : 'GET',
    body: method === 'POST' ? (init.body as BodyInit | undefined) : undefined,
    headers: contentType && method === 'POST' ? { 'Content-Type': contentType } : undefined,
    signal: init.signal ?? undefined,
  });
}

/** Downloads scripts into the session cache without running them. */
export async function prefetchScripts(providers: Provider[]): Promise<void> {
  for (const p of providers) await readScript(p).catch(() => undefined);
}

function compile(p: Provider): Promise<GetStreams> {
  const hit = compiled.get(p.key);
  if (hit) return hit;
  const job = (async () => {
    const code = await readScript(p);
    const module: { exports: { getStreams?: GetStreams } } = { exports: {} };
    const g = globalThis as { Buffer?: unknown; SCRAPER_SETTINGS?: unknown };
    if (!g.Buffer) g.Buffer = Buffer;
    if (!g.SCRAPER_SETTINGS) g.SCRAPER_SETTINGS = {};
    // Several repos (the BDIX ones) expect the host to inject a TMDB key as a global, like Nuvio does.
    if (!(g as { TMDB_API_KEY?: string }).TMDB_API_KEY) (g as { TMDB_API_KEY?: string }).TMDB_API_KEY = TMDB_KEY;
    // eslint-disable-next-line no-new-func
    const run = new Function('module', 'exports', 'require', 'fetch', `${code}\n//# sourceURL=nuvio/${p.key}.js`);
    run(module, module.exports, requireShim, pluginFetch);
    const fn = module.exports.getStreams ?? (globalThis as { getStreams?: GetStreams }).getStreams;
    if (typeof fn !== 'function') throw new Error('Provider does not export getStreams');
    return fn;
  })();
  compiled.set(p.key, job);
  job.catch(() => compiled.delete(p.key));
  return job;
}

// ---------------------------------------------------------------- running

function normalize(raw: unknown, provider: string, providerKey: string): NuvioStream[] {
  if (!Array.isArray(raw)) return [];
  const out: NuvioStream[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const s = item as Record<string, unknown>;
    const url = typeof s.url === 'string' ? s.url.trim() : '';
    if (!/^https?:\/\//i.test(url)) continue;
    out.push({
      url,
      provider,
      providerKey,
      name: typeof s.name === 'string' ? s.name : undefined,
      title: typeof s.title === 'string' ? s.title : undefined,
      quality: typeof s.quality === 'string' || typeof s.quality === 'number' ? String(s.quality) : undefined,
      size: typeof s.size === 'string' ? s.size : undefined,
      headers: s.headers && typeof s.headers === 'object' ? (s.headers as Record<string, string>) : undefined,
    });
  }
  return out;
}

/** Marks a provider's last result as bad (promo clip, wrong title, truncated). Repeated penalties push it down the order. */
export function penalizeProvider(key: string) {
  recordRun(key, false, 0);
  recordRun(key, false, 0);
}

export async function runProvider(p: Provider, tmdbId: string, mediaType: 'movie' | 'tv', season?: number, episode?: number): Promise<NuvioStream[]> {
  const started = Date.now();
  try {
    const getStreams = await compile(p);
    const raw = await withTimeout(Promise.resolve(getStreams(tmdbId, mediaType, season, episode)), RUN_TIMEOUT, p.scraper.name);
    const streams = normalize(raw, p.scraper.name, p.key);
    recordRun(p.key, streams.length > 0, Date.now() - started);
    return streams;
  } catch (e) {
    recordRun(p.key, false, Date.now() - started);
    throw e;
  }
}
