// southfreak.club (and its 18+ sibling southfreak.in) via the public WordPress REST API.
// Layer 1: posts + excerpt metadata. Layer 2: `emd_dl` download buttons → link protector → mirrors.
import { tintFor, type Title } from '../../data/types';
import { decodeEntities, getJson, getText, stripTags } from '../http';

export interface WpSite {
  id: 'southfreak' | 'sfadult';
  base: string;
  nsfw: boolean;
}

export const SOUTHFREAK: WpSite = { id: 'southfreak', base: 'https://southfreak.club', nsfw: false };
export const SOUTHFREAK_18: WpSite = { id: 'sfadult', base: 'https://southfreak.in', nsfw: true };

/** Category ids on southfreak.club (stable, from /wp-json/wp/v2/categories). */
export const CATEGORY = {
  hollywood: 3701,
  bollywood: 4,
  hindiDubbed: 820,
  dualAudio: 819,
  telugu: 303,
  tamil: 208,
  malayalam: 69,
  bengali: 653,
  banglaSub: 35,
  korean: 4006,
  animation: 6983,
  horror: 29372,
  scifi: 1887,
  upcoming: 12223,
  banglaDubbed: 37531,
  natok: 37146,
} as const;

interface WpPost {
  id: number;
  date: string;
  modified?: string;
  link: string;
  title: { rendered: string };
  excerpt?: { rendered: string };
  content?: { rendered: string };
  categories?: number[];
}

export interface Variant {
  label: string;
  quality: string;
  size: string;
  /** Link protector (TechZed) or a mirror URL. */
  url: string;
}

const LIST_FIELDS = 'id,date,link,title,excerpt,content,categories';
const FIELD_RE =
  /(IMDb?\s*Ratings?|Genres?|Languages?|Movie Quality|Quality|File Size|Size|Directed|Director|Writers?|Film Stars|Stars?|Released Date|Storyline)\s*:\s*(.+?)(?=\s+(?:IMDb?\s*Ratings?|Genres?|Languages?|Movie Quality|Quality|File Size|Size|Directed|Director|Writers?|Film Stars|Stars?|Released Date|Storyline)\s*:|$)/gis;

const KEY_ALIAS: Record<string, string> = {
  'imdb rating': 'imdb',
  'imdb ratings': 'imdb',
  'movie quality': 'quality',
  'file size': 'size',
  'film stars': 'stars',
  directed: 'director',
};

export function parseExcerpt(html: string): Record<string, string> {
  const text = stripTags(html).replace(/\[…\]|\[&hellip;\]/g, '').trim();
  const out: Record<string, string> = {};
  for (const m of text.matchAll(FIELD_RE)) {
    const raw = m[1].toLowerCase().replace(/\s+/g, ' ');
    out[KEY_ALIAS[raw] ?? raw.replace(/s$/, '')] = m[2].trim();
  }
  return out;
}

const QUALITY_RE = /\b(2160p|1080p|720p|480p|360p|4K)\b/i;
const SIZE_RE = /([\d.]+\s*[KMG]B)/i;
const TAG_RE = /\b(WEB-?DL|WEBRip|BluRay|BRRip|HDRip|HDTC|HDCAM|DVDRip|HEVC|x265|x264|ESubs?|HC-ESub|Dual Audio|Hindi|ORG|Cleaned|Multi Audio)\b/gi;

function cleanName(raw: string): { name: string; year: number } {
  const t = stripTags(raw);
  const m = /^(.*?)[\s(]+((?:19|20)\d{2})\b/.exec(t);
  const name = (m ? m[1] : t.split(/\s+(?:\d{3,4}p|WEB|HDRip|BluRay)/i)[0]).replace(/[-–|:\s]+$/, '').trim();
  return { name: name || t, year: m ? Number(m[2]) : new Date().getFullYear() };
}

function firstImage(html: string): string | undefined {
  const imgs = [...html.matchAll(/<img[^>]+src="([^"]+)"/gi)].map((m) => m[1]);
  return (
    imgs.find((u) => /m\.media-amazon|image\.tmdb|tmdb\.org|imdb|metahub/i.test(u)) ??
    imgs.find((u) => /\.(jpe?g|png|webp)(\?|$)/i.test(u) && !/gif|End%2BLine|blogspot/i.test(u))
  );
}

function genresOf(meta: Record<string, string>): string[] {
  return (meta.genre ?? '')
    .split(/[,/]/)
    .map((g) => g.trim())
    .filter(Boolean)
    .map((g) => (/^sci-?fi/i.test(g) ? 'Sci-Fi' : g));
}

export function postToTitle(site: WpSite, p: WpPost): Title {
  const { name, year } = cleanName(p.title.rendered);
  const meta = parseExcerpt(p.excerpt?.rendered ?? '');
  const rawTitle = stripTags(p.title.rendered);
  const quality = [...new Set([...(rawTitle.match(QUALITY_RE) ? [rawTitle.match(QUALITY_RE)![1].toUpperCase()] : []), ...(rawTitle.match(TAG_RE) ?? []).map((t) => t.replace(/^esubs?$/i, 'ESubs'))])].slice(0, 4);
  const poster = firstImage(p.content?.rendered ?? '');
  const rating = /([\d.]+)\s*\/\s*10/.exec(meta.imdb ?? '')?.[1];
  const stars = (meta.stars ?? meta.star ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const addedAt = Date.parse(p.date + 'Z') || undefined;
  return {
    id: `${site.id}:${p.id}`,
    source: site.id,
    ref: p.link,
    name,
    kind: 'movie',
    year,
    maturity: site.nsfw ? '18+' : /horror|crime|thriller|action/i.test(meta.genre ?? '') ? '16+' : '13+',
    runtime: 0,
    seasons: [],
    genres: genresOf(meta),
    synopsis: decodeEntities(meta.storyline ?? '').replace(/\s*\[?…\]?$/, '…') || rawTitle,
    cast: stars,
    creators: (meta.director ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    tint: tintFor(String(p.id)),
    quality,
    language: meta.language,
    poster,
    background: poster,
    imdbRating: rating && rating !== 'x' ? rating : undefined,
    addedAt,
    nsfw: site.nsfw,
  };
}

function query(params: Record<string, string | number | undefined>): string {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&');
}

export async function listPosts(
  site: WpSite,
  opts: { search?: string; category?: number; page?: number; perPage?: number; orderBy?: 'date' | 'relevance' } = {},
): Promise<Title[]> {
  const qs = query({
    search: opts.search,
    categories: opts.category,
    page: opts.page ?? 1,
    per_page: opts.perPage ?? 20,
    orderby: opts.orderBy ?? (opts.search ? 'relevance' : 'date'),
    order: 'desc',
    _fields: LIST_FIELDS,
  });
  const posts = await getJson<WpPost[]>(`${site.base}/wp-json/wp/v2/posts?${qs}`, { timeout: 14000, retries: 2 });
  return posts.map((p) => postToTitle(site, p)).filter((t) => t.name);
}

/** Posts newer than `since` (ISO). The polite way to keep the feed current. */
export async function postsSince(site: WpSite, since: string, perPage = 40): Promise<Title[]> {
  const qs = query({ after: since, per_page: perPage, orderby: 'date', order: 'desc', _fields: LIST_FIELDS });
  const posts = await getJson<WpPost[]>(`${site.base}/wp-json/wp/v2/posts?${qs}`, { timeout: 14000, retries: 2 });
  return posts.map((p) => postToTitle(site, p));
}

const variantCache = new Map<string, Variant[]>();

/** Download variants (quality + size + resolver link) for a post. Uses the REST `content` field, falls back to the HTML page. */
export async function getVariants(site: WpSite, postLink: string): Promise<Variant[]> {
  const hit = variantCache.get(postLink);
  if (hit) return hit;
  const slug = postLink.replace(/\/+$/, '').split('/').pop() ?? '';
  let body = '';
  try {
    const arr = await getJson<{ content?: { rendered: string } }[]>(`${site.base}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&_fields=content`, { timeout: 12000 });
    body = arr[0]?.content?.rendered ?? '';
  } catch {
    // fall through to the page
  }
  if (!/emd_dl/.test(body)) {
    body = await getText(postLink, { timeout: 15000 });
  }
  const variants: Variant[] = [];
  for (const m of body.matchAll(/<a\s[^>]*class="[^"]*emd_dl[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = stripTags(m[2]);
    variants.push({
      label,
      quality: (QUALITY_RE.exec(label)?.[1] ?? 'SD').toUpperCase(),
      size: SIZE_RE.exec(label)?.[1] ?? '',
      url: decodeEntities(m[1]),
    });
  }
  if (variants.length > 0) variantCache.set(postLink, variants);
  return variants;
}

export function siteFor(source: string): WpSite {
  return source === 'sfadult' ? SOUTHFREAK_18 : SOUTHFREAK;
}
