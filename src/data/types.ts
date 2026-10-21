// Shared catalog types. Every Title comes from a live source adapter (src/services/sources).

export type Kind = 'series' | 'movie';
export type Maturity = 'ALL' | '7+' | '13+' | '16+' | '18+';
export type Badge = 'new' | 'new-episode' | 'airing';

/** Where a title came from. Decides how it is played, downloaded and refreshed. */
export type SourceId = 'southfreak' | 'sfadult' | 'amaderftp' | 'bdix' | 'stremio' | 'cinemeta' | 'anilist';

export interface Episode {
  id: string;
  season: number;
  number: number;
  name: string;
  runtime: number;
  synopsis: string;
  still?: string;
  airDate?: string;
}

export interface Season {
  number: number;
  episodes: Episode[];
}

export interface Title {
  id: string;
  source: SourceId;
  /** Provider-specific reference: post link, IMDb id, AniList id or detail page id. */
  ref: string;
  name: string;
  kind: Kind;
  year: number;
  maturity: Maturity;
  /** Minutes; 0 when unknown. */
  runtime: number;
  seasons: Season[];
  genres: string[];
  synopsis: string;
  cast: string[];
  creators: string[];
  tint: string;
  /** Labels such as 1080p, WEB-DL, Dual Audio. */
  quality: string[];
  language?: string;
  poster?: string;
  background?: string;
  imdbRating?: string;
  imdbId?: string;
  tmdbId?: number;
  /** TMDB season this entry maps to (anime sequels are separate AniList entries). */
  tmdbSeason?: number;
  /** When the source published the title (ms since epoch). Drives "New" badges. */
  addedAt?: number;
  badge?: Badge;
  /** Next airing episode for ongoing anime. */
  airing?: { episode: number; at: number };
  /** Direct file URL known up front (BDIX/FTP sources). */
  directUrl?: string;
  /** All direct files known up front (BDIX index servers). */
  files?: { url: string; label: string }[];
  /** Stremio addon that owns this title (adult catalogs). */
  addon?: string;
  nsfw?: boolean;
  /** True once the detail fetch (episodes, cast, full synopsis) has completed. */
  detailed?: boolean;
}

export interface Profile {
  id: string;
  name: string;
  color: string;
  kids?: boolean;
}

export const MAIN_PROFILE_ID = 'main';
export const PROFILE_COLOR = '#2D6CDF';

export const GENRES = [
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 'Drama', 'Family',
  'Fantasy', 'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller',
];

export function findEpisode(title: Title, episodeId?: string): { season: Season; episode: Episode } | null {
  for (const season of title.seasons) {
    for (const episode of season.episodes) {
      if (!episodeId || episode.id === episodeId) return { season, episode };
    }
  }
  return null;
}

export function nextEpisode(title: Title, episodeId: string): Episode | null {
  const all = title.seasons.flatMap((s) => s.episodes);
  const i = all.findIndex((e) => e.id === episodeId);
  return i >= 0 && i + 1 < all.length ? all[i + 1] : null;
}

const TINTS = ['#4A1030', '#0D4D4A', '#2E1F4F', '#103C5A', '#5A4A1F', '#1E3320', '#6B2A1A', '#1B2F6B', '#3A1B4A', '#2A3A3F'];

export function tintFor(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return TINTS[(h >>> 0) % TINTS.length];
}
