// Minimal Stremio addon client (catalog / stream over plain HTTP). Only addons that return direct
// HTTP(S) streams are useful here; debrid-only addons (Torrentio, Comet, MediaFusion) are not used.
import { tintFor, type Title } from '../../data/types';
import { getJson } from '../http';

export interface Addon {
  id: string;
  name: string;
  base: string;
  nsfw: boolean;
}

/** Verified live 2026-10-21. */
export const ONLYPORN: Addon = { id: 'onlyporn', name: 'OnlyPorn', base: 'https://07b88951aaab-jaxxx-v2.baby-beamup.club', nsfw: true };
export const STREMIFY: Addon = { id: 'stremify', name: 'Stremify', base: 'https://stremify.hayd.uk', nsfw: false };

export const ONLYPORN_CATALOGS: { id: string; name: string }[] = [
  { id: 'eporner', name: 'Eporner' },
  { id: 'xhamster.hd+', name: 'xHamster HD+' },
  { id: 'xhamster.4k', name: 'xHamster 4K' },
  { id: 'porntrex.top-rated', name: 'Porntrex Top Rated' },
  { id: 'spankbang', name: 'SpankBang' },
  { id: 'missav', name: 'MissAV' },
];

interface Meta {
  id: string;
  name?: string;
  poster?: string;
  background?: string;
  description?: string;
  releaseInfo?: string;
  genres?: string[];
}

export interface AddonStream {
  url?: string;
  name?: string;
  title?: string;
  behaviorHints?: { proxyHeaders?: { request?: Record<string, string> } };
}

const enc = encodeURIComponent;

function toTitle(addon: Addon, m: Meta): Title {
  return {
    id: `sx:${addon.id}:${m.id}`,
    source: 'stremio',
    ref: m.id,
    addon: addon.id,
    name: (m.name ?? 'Untitled').trim(),
    kind: 'movie',
    year: parseInt(m.releaseInfo ?? '', 10) || new Date().getFullYear(),
    maturity: addon.nsfw ? '18+' : '13+',
    runtime: 0,
    seasons: [],
    genres: m.genres ?? [],
    synopsis: m.description ?? '',
    cast: [],
    creators: [],
    tint: tintFor(m.id),
    quality: ['HD'],
    poster: m.poster,
    background: m.background ?? m.poster,
    nsfw: addon.nsfw,
    detailed: true,
  };
}

export async function catalog(addon: Addon, catalogId: string, opts: { skip?: number; search?: string } = {}): Promise<Title[]> {
  const extra = [opts.search ? `search=${enc(opts.search)}` : '', opts.skip ? `skip=${opts.skip}` : ''].filter(Boolean).join('&');
  const url = `${addon.base}/catalog/movie/${enc(catalogId)}${extra ? `/${extra}` : ''}.json`;
  const data = await getJson<{ metas?: Meta[] }>(url, { timeout: 25000, retries: 1 });
  return (data.metas ?? []).filter((m) => m.id && m.name).map((m) => toTitle(addon, m));
}

export async function streams(addon: Addon, type: 'movie' | 'series', id: string): Promise<AddonStream[]> {
  const data = await getJson<{ streams?: AddonStream[] }>(`${addon.base}/stream/${type}/${enc(id)}.json`, { timeout: 25000, retries: 1 });
  return (data.streams ?? []).filter((s) => typeof s.url === 'string' && /^https?:\/\//i.test(s.url));
}

export function findAddon(id?: string): Addon | undefined {
  return [ONLYPORN, STREMIFY].find((a) => a.id === id);
}
