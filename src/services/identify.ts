// Maps a title from any source to TMDB/IMDb ids (needed by Nuvio plugins and Stremio addons).
import type { Title } from '../data/types';
import * as anilist from './sources/anilist';
import { getJson } from './http';
import { TMDB_KEY } from './nuvio/runtime';
import * as cinemeta from './sources/cinemeta';

export interface Ids {
  tmdbId?: number;
  imdbId?: string;
  /** TMDB season (anime sequels). */
  season?: number;
}

const known = new Map<string, Promise<Ids>>();

/** TMDB lookups with the community key the plugins ship with: IMDb id → TMDB id, or title (+year) → TMDB id. */
async function tmdbFind(imdbId: string, series: boolean): Promise<number | undefined> {
  try {
    const r = await getJson<{ movie_results?: { id: number }[]; tv_results?: { id: number }[] }>(
      `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_KEY}&external_source=imdb_id`,
      { timeout: 9000, retries: 1 },
    );
    return (series ? r.tv_results?.[0]?.id : r.movie_results?.[0]?.id) ?? r.tv_results?.[0]?.id ?? r.movie_results?.[0]?.id;
  } catch {
    return undefined;
  }
}

async function tmdbSearch(title: Title): Promise<number | undefined> {
  try {
    const kind = title.kind === 'series' ? 'tv' : 'movie';
    const yearParam = title.kind === 'series' ? 'first_air_date_year' : 'year';
    const r = await getJson<{ results?: { id: number; name?: string; title?: string }[] }>(
      `https://api.themoviedb.org/3/search/${kind}?api_key=${TMDB_KEY}&query=${encodeURIComponent(title.name)}&${yearParam}=${title.year}`,
      { timeout: 9000, retries: 1 },
    );
    return r.results?.find((x) => norm(x.name ?? x.title ?? '') === norm(title.name))?.id ?? r.results?.[0]?.id;
  } catch {
    return undefined;
  }
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function identify(title: Title): Promise<Ids> {
  if (title.tmdbId && title.imdbId) return Promise.resolve({ tmdbId: title.tmdbId, imdbId: title.imdbId });
  const hit = known.get(title.id);
  if (hit) return hit;
  const job = (async (): Promise<Ids> => {
    if (title.source === 'anilist') {
      const mapped = await anilist.mapIds(title);
      return { tmdbId: mapped.tmdbId, imdbId: mapped.imdbId, season: mapped.season };
    }
    if (title.source === 'cinemeta') {
      const detailed = await cinemeta.detail(title).catch(() => title);
      const imdbId = title.imdbId ?? title.ref;
      const tmdbId = detailed.tmdbId ?? title.tmdbId ?? (await tmdbFind(imdbId, title.kind === 'series'));
      return { tmdbId, imdbId };
    }
    if (title.nsfw || title.source === 'stremio') return {};
    const results = await cinemeta.search(title.name).catch(() => [] as Title[]);
    const wantSeries = title.kind === 'series';
    const match = results.find((r) => norm(r.name) === norm(title.name) && Math.abs(r.year - title.year) <= 1 && (r.kind === 'series') === wantSeries)
      ?? results.find((r) => norm(r.name) === norm(title.name) && (r.kind === 'series') === wantSeries && title.source === 'anilist');
    if (!match) return { tmdbId: await tmdbSearch(title) };
    const full = match.tmdbId ? match : await cinemeta.detail(match).catch(() => match);
    return { tmdbId: full.tmdbId ?? (await tmdbFind(match.imdbId ?? '', title.kind === 'series')), imdbId: match.imdbId };
  })();
  known.set(title.id, job);
  return job;
}
