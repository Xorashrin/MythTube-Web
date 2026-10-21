// AniList GraphQL: anime metadata, trending and the airing schedule ("upcoming").
// Requires Content-Type: application/json (form posts return 400).
import { tintFor, type Episode, type Title } from '../../data/types';
import { getJson, postJson } from '../http';

const URL = 'https://graphql.anilist.co';

interface Media {
  id: number;
  idMal?: number;
  title: { romaji?: string; english?: string };
  coverImage?: { extraLarge?: string; large?: string; color?: string };
  bannerImage?: string;
  description?: string;
  genres?: string[];
  averageScore?: number;
  episodes?: number;
  duration?: number;
  status?: string;
  seasonYear?: number;
  format?: string;
  studios?: { nodes?: { name: string }[] };
  nextAiringEpisode?: { airingAt: number; episode: number } | null;
  startDate?: { year?: number };
}

const FIELDS = `id idMal title { romaji english } coverImage { extraLarge large color } bannerImage description(asHtml: false)
  genres averageScore episodes duration status seasonYear format studios(isMain: true) { nodes { name } }
  nextAiringEpisode { airingAt episode }`;

function toTitle(m: Media): Title {
  const name = m.title.english || m.title.romaji || `Anime ${m.id}`;
  const synopsis = (m.description ?? '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const movie = m.format === 'MOVIE';
  const year = m.seasonYear ?? m.startDate?.year ?? new Date().getFullYear();
  const airing = m.nextAiringEpisode ? { episode: m.nextAiringEpisode.episode, at: m.nextAiringEpisode.airingAt * 1000 } : undefined;
  return {
    id: `al:${m.id}`,
    source: 'anilist',
    ref: String(m.id),
    name,
    kind: movie ? 'movie' : 'series',
    year,
    maturity: '13+',
    runtime: m.duration ?? 0,
    seasons: [],
    genres: m.genres ?? [],
    synopsis,
    cast: [],
    creators: (m.studios?.nodes ?? []).map((s) => s.name),
    tint: m.coverImage?.color ?? tintFor(String(m.id)),
    quality: ['Anime'],
    poster: m.coverImage?.extraLarge ?? m.coverImage?.large,
    background: m.bannerImage ?? m.coverImage?.extraLarge,
    imdbRating: m.averageScore ? (m.averageScore / 10).toFixed(1) : undefined,
    airing,
    badge: airing ? 'airing' : undefined,
  };
}

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await postJson<{ data: T }>(URL, { query, variables }, { timeout: 14000, retries: 2 });
  return res.data;
}

export async function trending(page = 1, perPage = 24): Promise<Title[]> {
  const d = await gql<{ Page: { media: Media[] } }>(
    `query($p:Int,$n:Int){ Page(page:$p, perPage:$n){ media(type:ANIME, sort:TRENDING_DESC, isAdult:false){ ${FIELDS} } } }`,
    { p: page, n: perPage },
  );
  return d.Page.media.map(toTitle);
}

export async function popularAiring(perPage = 24): Promise<Title[]> {
  const d = await gql<{ Page: { media: Media[] } }>(
    `query($n:Int){ Page(page:1, perPage:$n){ media(type:ANIME, status:RELEASING, sort:POPULARITY_DESC, isAdult:false){ ${FIELDS} } } }`,
    { n: perPage },
  );
  return d.Page.media.map(toTitle);
}

/** Episodes airing in the next `days` days, soonest first. */
export async function upcoming(days = 7, perPage = 40): Promise<Title[]> {
  const now = Math.floor(Date.now() / 1000);
  const d = await gql<{ Page: { airingSchedules: { airingAt: number; episode: number; media: Media }[] } }>(
    `query($from:Int,$to:Int,$n:Int){ Page(page:1, perPage:$n){ airingSchedules(airingAt_greater:$from, airingAt_lesser:$to, sort:TIME){ airingAt episode media { ${FIELDS} } } } }`,
    { from: now, to: now + days * 86400, n: perPage },
  );
  const seen = new Set<number>();
  const out: Title[] = [];
  for (const s of d.Page.airingSchedules) {
    if (seen.has(s.media.id)) continue;
    seen.add(s.media.id);
    out.push(toTitle({ ...s.media, nextAiringEpisode: { airingAt: s.airingAt, episode: s.episode } }));
  }
  return out;
}

export async function search(query: string): Promise<Title[]> {
  const d = await gql<{ Page: { media: Media[] } }>(
    `query($q:String){ Page(page:1, perPage:12){ media(type:ANIME, search:$q, sort:POPULARITY_DESC, isAdult:false){ ${FIELDS} } } }`,
    { q: query },
  );
  return d.Page.media.map(toTitle);
}

export type AnimeSeason = 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL';

export interface BrowseOptions {
  sort: string;
  status?: 'RELEASING' | 'FINISHED' | 'NOT_YET_RELEASED';
  format?: string[];
  genre?: string;
  season?: AnimeSeason;
  seasonYear?: number;
  page?: number;
  perPage?: number;
}

export function currentSeason(date = new Date()): { season: AnimeSeason; year: number } {
  const m = date.getMonth();
  return { season: m < 3 ? 'WINTER' : m < 6 ? 'SPRING' : m < 9 ? 'SUMMER' : 'FALL', year: date.getFullYear() };
}

export function nextSeason(date = new Date()): { season: AnimeSeason; year: number } {
  const cur = currentSeason(date);
  const order: AnimeSeason[] = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
  const i = order.indexOf(cur.season);
  return i === 3 ? { season: 'WINTER', year: cur.year + 1 } : { season: order[i + 1], year: cur.year };
}

/** Any AniList listing: trending, popular, top rated, this season, genres, upcoming… */
export async function browse(o: BrowseOptions): Promise<Title[]> {
  const d = await gql<{ Page: { media: Media[] } }>(
    `query($p:Int,$n:Int,$sort:[MediaSort],$status:MediaStatus,$format:[MediaFormat],$genre:String,$season:MediaSeason,$year:Int){
      Page(page:$p, perPage:$n){ media(type:ANIME, sort:$sort, status:$status, format_in:$format, genre:$genre, season:$season, seasonYear:$year, isAdult:false){ ${FIELDS} } } }`,
    { p: o.page ?? 1, n: o.perPage ?? 24, sort: [o.sort], status: o.status ?? null, format: o.format ?? null, genre: o.genre ?? null, season: o.season ?? null, year: o.seasonYear ?? null },
  );
  return d.Page.media.map(toTitle);
}

interface ArmIds {
  themoviedb?: number | null;
  'themoviedb-season'?: number | null;
  imdb?: string | null;
  myanimelist?: number | null;
  media?: string | null;
}

/** AniList entry → TMDB/IMDb ids and the TMDB season it corresponds to (needed by stream plugins). */
export async function mapIds(title: Title): Promise<{ tmdbId?: number; imdbId?: string; season?: number; malId?: number }> {
  try {
    const ids = await getJson<ArmIds>(`https://arm.haglund.dev/api/v2/ids?source=anilist&id=${title.ref}`, { timeout: 9000, retries: 1 });
    return {
      tmdbId: ids.themoviedb ?? undefined,
      imdbId: ids.imdb ?? undefined,
      season: ids['themoviedb-season'] ?? undefined,
      malId: ids.myanimelist ?? undefined,
    };
  } catch {
    return {};
  }
}

interface ZipEpisode {
  episode?: string;
  title?: { en?: string; 'x-jat'?: string };
  image?: string;
  overview?: string;
  runtime?: number;
  airdate?: string;
}

export async function detail(title: Title): Promise<Title> {
  const [d, zip, ids] = await Promise.all([
    gql<{ Media: Media }>(`query($id:Int){ Media(id:$id){ ${FIELDS} } }`, { id: Number(title.ref) }),
    getJson<{ episodes?: Record<string, ZipEpisode> }>(`https://api.ani.zip/mappings?anilist_id=${title.ref}`, { timeout: 9000, retries: 1 }).catch(() => ({ episodes: {} as Record<string, ZipEpisode> })),
    mapIds(title),
  ]);
  const fresh = toTitle(d.Media);
  const zipEpisodes = zip.episodes ?? {};
  const numbered = Object.keys(zipEpisodes).filter((k) => /^\d+$/.test(k)).map(Number);
  const aired = d.Media.nextAiringEpisode ? d.Media.nextAiringEpisode.episode - 1 : (d.Media.episodes ?? (numbered.length ? Math.max(...numbered) : 0));
  const count = fresh.kind === 'movie' ? 0 : Math.max(0, aired);
  const episodes: Episode[] = Array.from({ length: count }, (_, i) => {
    const z = zipEpisodes[String(i + 1)];
    return {
      id: `al:${title.ref}:1:${i + 1}`,
      season: 1,
      number: i + 1,
      name: z?.title?.en || z?.title?.['x-jat'] || `Episode ${i + 1}`,
      runtime: z?.runtime ?? fresh.runtime,
      synopsis: (z?.overview ?? '').replace(/<[^>]+>/g, ''),
      still: z?.image ?? fresh.background,
      airDate: z?.airdate,
    };
  });
  return {
    ...title,
    ...fresh,
    tmdbId: ids.tmdbId,
    tmdbSeason: ids.season,
    imdbId: ids.imdbId,
    seasons: episodes.length ? [{ number: 1, episodes }] : [],
    detailed: true,
  };
}
