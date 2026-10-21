// Maps a title from any source to TMDB/IMDb ids (needed by Nuvio plugins and Stremio addons).
import type { Title } from '../data/types';
import * as anilist from './sources/anilist';
import * as cinemeta from './sources/cinemeta';

export interface Ids {
  tmdbId?: number;
  imdbId?: string;
  /** TMDB season (anime sequels). */
  season?: number;
}

const known = new Map<string, Promise<Ids>>();

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
      return { tmdbId: detailed.tmdbId ?? title.tmdbId, imdbId: title.imdbId ?? title.ref };
    }
    if (title.nsfw || title.source === 'stremio') return {};
    const results = await cinemeta.search(title.name).catch(() => [] as Title[]);
    const wantSeries = title.kind === 'series';
    const match = results.find((r) => norm(r.name) === norm(title.name) && Math.abs(r.year - title.year) <= 1 && (r.kind === 'series') === wantSeries)
      ?? results.find((r) => norm(r.name) === norm(title.name) && (r.kind === 'series') === wantSeries && title.source === 'anilist');
    if (!match) return {};
    const full = match.tmdbId ? match : await cinemeta.detail(match).catch(() => match);
    return { tmdbId: full.tmdbId, imdbId: match.imdbId };
  })();
  known.set(title.id, job);
  return job;
}
