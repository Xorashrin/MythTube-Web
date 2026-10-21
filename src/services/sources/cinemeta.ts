// Stremio Cinemeta: metadata for any movie/series (trending, search, real episode lists).
// It carries no streams — playback comes from cross-source matching and the plugin sources.
import { tintFor, type Episode, type Season, type Title } from '../../data/types';
import { getJson } from '../http';

const BASE = 'https://v3-cinemeta.strem.io';

interface Meta {
  id?: string;
  imdb_id?: string;
  name?: string;
  type?: string;
  year?: string;
  releaseInfo?: string;
  description?: string;
  genre?: string[];
  genres?: string[];
  cast?: string[];
  director?: string[] | string;
  poster?: string;
  background?: string;
  imdbRating?: string;
  runtime?: string;
  released?: string;
  moviedb_id?: number;
  videos?: Video[];
}

interface Video {
  id: string;
  season: number;
  episode?: number;
  number?: number;
  name?: string;
  title?: string;
  overview?: string;
  description?: string;
  thumbnail?: string;
  released?: string;
}

function metaToTitle(m: Meta): Title | null {
  const imdb = m.imdb_id ?? m.id;
  if (!imdb || !m.name || !/^tt\d+$/.test(imdb)) return null;
  const series = m.type === 'series';
  const year = parseInt(m.year ?? m.releaseInfo ?? '', 10) || (m.released ? new Date(m.released).getFullYear() : new Date().getFullYear());
  const runtime = parseInt(m.runtime ?? '', 10) || 0;
  const released = m.released ? Date.parse(m.released) : undefined;
  return {
    id: `cm:${imdb}`,
    source: 'cinemeta',
    ref: imdb,
    imdbId: imdb,
    tmdbId: m.moviedb_id,
    name: m.name,
    kind: series ? 'series' : 'movie',
    year,
    maturity: '13+',
    runtime,
    seasons: [],
    genres: m.genre ?? m.genres ?? [],
    synopsis: m.description ?? '',
    cast: m.cast ?? [],
    creators: Array.isArray(m.director) ? m.director : m.director ? [m.director] : [],
    tint: tintFor(imdb),
    quality: ['HD'],
    poster: m.poster || `https://images.metahub.space/poster/medium/${imdb}/img`,
    background: m.background || `https://images.metahub.space/background/medium/${imdb}/img`,
    imdbRating: m.imdbRating || undefined,
    addedAt: released && released <= Date.now() ? released : undefined,
  };
}

export async function catalog(kind: 'movie' | 'series', opts: { genre?: string; skip?: number } = {}): Promise<Title[]> {
  const extra = [opts.genre ? `genre=${encodeURIComponent(opts.genre)}` : '', opts.skip ? `skip=${opts.skip}` : ''].filter(Boolean).join('&');
  const url = `${BASE}/catalog/${kind}/top${extra ? `/${extra}` : ''}.json`;
  const data = await getJson<{ metas?: Meta[] }>(url, { timeout: 14000, retries: 2 });
  return (data.metas ?? []).map(metaToTitle).filter((t): t is Title => !!t);
}

export async function search(query: string): Promise<Title[]> {
  const q = encodeURIComponent(query.trim());
  const [movies, series] = await Promise.all([
    getJson<{ metas?: Meta[] }>(`${BASE}/catalog/movie/top/search=${q}.json`, { timeout: 10000 }).catch(() => ({ metas: [] })),
    getJson<{ metas?: Meta[] }>(`${BASE}/catalog/series/top/search=${q}.json`, { timeout: 10000 }).catch(() => ({ metas: [] })),
  ]);
  return [...(movies.metas ?? []), ...(series.metas ?? [])].map(metaToTitle).filter((t): t is Title => !!t);
}

function buildSeasons(imdb: string, videos: Video[]): Season[] {
  const bySeason = new Map<number, Episode[]>();
  for (const v of videos) {
    const number = v.episode ?? v.number ?? 0;
    if (v.season < 0 || number < 1) continue; // season 0 = specials
    const list = bySeason.get(v.season) ?? [];
    list.push({
      id: v.id || `${imdb}:${v.season}:${number}`,
      season: v.season,
      number,
      name: v.name ?? v.title ?? `Episode ${number}`,
      runtime: 0,
      synopsis: v.overview ?? v.description ?? '',
      still: v.thumbnail,
      airDate: v.released,
    });
    bySeason.set(v.season, list);
  }
  return [...bySeason.entries()]
    .sort((a, b) => (a[0] || 1e6) - (b[0] || 1e6)) // specials (season 0) last
    .map(([number, episodes]) => ({ number, episodes: episodes.sort((a, b) => a.number - b.number) }));
}

/** Full detail (cast, runtime, real season/episode list) for one title. */
export async function detail(title: Title): Promise<Title> {
  const kind = title.kind === 'series' ? 'series' : 'movie';
  const data = await getJson<{ meta?: Meta }>(`${BASE}/meta/${kind}/${title.ref}.json`, { timeout: 14000, retries: 2 });
  const fresh = data.meta ? metaToTitle(data.meta) : null;
  if (!fresh) return title;
  const seasons = buildSeasons(title.ref, data.meta?.videos ?? []);
  const now = Date.now();
  const released = seasons.flatMap((s) => s.episodes).filter((e) => !e.airDate || Date.parse(e.airDate) <= now);
  return {
    ...title,
    ...fresh,
    seasons: seasons.map((s) => ({ ...s, episodes: s.episodes.filter((e) => released.includes(e)) })).filter((s) => s.episodes.length > 0),
    runtime: fresh.runtime || title.runtime,
    detailed: true,
  };
}
