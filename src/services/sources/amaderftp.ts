// amaderftp.net — BDIX movie index serving direct MP4/MKV files with HTTP Range (seek + resume).
// There is no JSON API, so listings are parsed from the site's HTML cards.
import { tintFor, type Title } from '../../data/types';
import { decodeEntities, getText, stripTags } from '../http';

const BASE = 'http://amaderftp.net';

export const LANGUAGE_PAGES = {
  hindi: 'all_hindi.php',
  english: 'all_english.php',
  bangla: 'all_bangla.php',
  tamil: 'all_tamil.php',
  korean: 'all_korean.php',
  japanese: 'all_japanese.php',
  russian: 'all_russian.php',
  other: 'all_other.php',
} as const;

/** Mirror IPs on the private BDIX network are unreachable outside Bangladesh ISPs; the public host serves the same files. */
function publicUrl(url: string): string {
  return url.replace(/^http:\/\/172\.200\.200\.2(?::\d+)?\//, `${BASE}/`);
}

export interface FtpFile {
  url: string;
  mirrors: string[];
  quality: string;
}

function parseCards(html: string): Title[] {
  const out: Title[] = [];
  const parts = html.split(/<div class="card" onclick="window\.location\.href='/).slice(1);
  for (const part of parts) {
    const head = /^movies\.php\?id=(\d+)&type=movie'/.exec(part);
    if (!head) continue; // series rows on this site point at unrelated files; skip them
    const name = decodeEntities(/class="movie-title">([^<]*)</.exec(part)?.[1] ?? '').trim();
    if (!name) continue;
    const year = Number(/class="movie-year">(\d{4})</.exec(part)?.[1]) || new Date().getFullYear();
    const rating = /class="movie-rating">★\s*([\d.]+)</.exec(part)?.[1];
    const poster = /<img src="([^"]+)"/.exec(part)?.[1]?.replace('/w300/', '/w500/');
    const genres = stripTags(/class="movie-genres">([\s\S]*?)<\/div>/.exec(part)?.[1] ?? '').split(',').map((g) => g.trim()).filter(Boolean);
    const runtime = Number(/(\d+)\s*min/.exec(part)?.[1]) || 0;
    const files = [...part.matchAll(/class="download-link-item"/g)].length
      ? [...part.matchAll(/<a href="(http[^"]+)"[^>]*class="download-link-item"[\s\S]*?class="quality">[\s\S]*?([\w]+)\s*<\/span>/g)].map((m) => ({ url: publicUrl(decodeEntities(m[1])), quality: m[2].trim() }))
      : [];
    if (files.length === 0) continue;
    out.push({
      id: `ft:${head[1]}`,
      source: 'amaderftp',
      ref: head[1],
      tmdbId: Number(head[1]),
      name,
      kind: 'movie',
      year,
      maturity: '13+',
      runtime,
      seasons: [],
      genres: genres.map((g) => (g === 'Science Fiction' ? 'Sci-Fi' : g)),
      synopsis: '',
      cast: [],
      creators: [],
      tint: tintFor(head[1]),
      quality: [...new Set(files.map((f) => f.quality.toUpperCase()))],
      poster,
      background: poster,
      imdbRating: rating && rating !== '0.0' ? rating : undefined,
      directUrl: files[0].url,
      detailed: false,
    });
  }
  return out;
}

export async function latest(): Promise<Title[]> {
  return parseCards(await getText(`${BASE}/`, { timeout: 20000, retries: 2 }));
}

export async function byLanguage(key: keyof typeof LANGUAGE_PAGES, page = 1): Promise<Title[]> {
  const url = `${BASE}/${LANGUAGE_PAGES[key]}${page > 1 ? `?page=${page}` : ''}`;
  return parseCards(await getText(url, { timeout: 20000, retries: 2 }));
}

function filesFrom(html: string, fallback?: string): FtpFile[] {
  const found = new Map<string, FtpFile>();
  for (const m of html.matchAll(/playVideo\('(http[^']+)',\s*'([^']*)'\)/g)) {
    const url = publicUrl(decodeEntities(m[1]));
    found.set(url, { url, mirrors: [url, url.replace(BASE, 'http://172.200.200.2:91')], quality: m[2] || 'HD' });
  }
  for (const m of html.matchAll(/href="(http[^"]+\.(?:mp4|mkv)[^"]*)"/gi)) {
    const url = publicUrl(decodeEntities(m[1]));
    if (!found.has(url)) found.set(url, { url, mirrors: [url], quality: /(\d{3,4}p)/i.exec(url)?.[1] ?? 'HD' });
  }
  if (found.size === 0 && fallback) found.set(fallback, { url: fallback, mirrors: [fallback], quality: 'HD' });
  return [...found.values()];
}

/** Files hosted for a TMDB id (movies.php is keyed by TMDB id). Empty when the title is not on the server. */
export async function filesByTmdb(tmdbId: number | string): Promise<FtpFile[]> {
  try {
    return filesFrom(await getText(`${BASE}/movies.php?id=${tmdbId}&type=movie`, { timeout: 15000, retries: 1 }));
  } catch {
    return [];
  }
}

/** The site search resolves a name to a TMDB id; only titles that really have files are returned. */
export async function search(query: string): Promise<Title[]> {
  const q = query.trim();
  if (!q) return [];
  const html = await getText(`${BASE}/?search=${encodeURIComponent(q)}&search_type=movie`, { timeout: 20000, retries: 1 });
  const tmdb = /name="tmdb_id" value="(\d+)"/.exec(html)?.[1];
  const needle = q.toLowerCase();
  const local = parseCards(html).filter((t) => t.name.toLowerCase().includes(needle));
  if (!tmdb || local.some((t) => t.ref === tmdb)) return local;
  const page = await getText(`${BASE}/movies.php?id=${tmdb}&type=movie`, { timeout: 15000 }).catch(() => '');
  const files = filesFrom(page);
  if (files.length === 0) return local;
  const name = decodeEntities(/name="title" value="([^"]*)"/.exec(html)?.[1] ?? q);
  const poster = /name="poster_path" value="([^"]+)"/.exec(html)?.[1];
  const hit: Title = {
    id: `ft:${tmdb}`, source: 'amaderftp', ref: tmdb, tmdbId: Number(tmdb), name, kind: 'movie',
    year: Number(/name="release_date" value="(\d{4})/.exec(html)?.[1]) || new Date().getFullYear(),
    maturity: '13+', runtime: 0, seasons: [], genres: [], synopsis: '', cast: [], creators: [], tint: tintFor(tmdb),
    quality: [...new Set(files.map((f) => f.quality.toUpperCase()))],
    poster: poster ? `https://image.tmdb.org/t/p/w500${poster}` : undefined, directUrl: files[0].url,
  };
  return [hit, ...local];
}

/** Direct files for a title (all qualities). */
export async function getFiles(title: Title): Promise<FtpFile[]> {
  const files = await filesByTmdb(title.tmdbId ?? title.ref);
  if (files.length === 0 && title.directUrl) return [{ url: title.directUrl, mirrors: [title.directUrl], quality: title.quality[0] ?? 'HD' }];
  return files;
}

export async function detail(title: Title): Promise<Title> {
  try {
    const html = await getText(`${BASE}/movies.php?id=${title.tmdbId ?? title.ref}&type=movie`, { timeout: 15000 });
    const synopsis = decodeEntities(/class="banner-description">([\s\S]*?)<\/p>/.exec(html)?.[1] ?? '').trim();
    const cast = [...html.matchAll(/class="cast-name">([^<]+)</g)].slice(0, 8).map((m) => decodeEntities(m[1]).trim());
    return { ...title, synopsis: synopsis || title.synopsis, cast: cast.length ? cast : title.cast, detailed: true };
  } catch {
    return { ...title, detailed: true };
  }
}
