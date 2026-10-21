// File-host resolvers: mirror page → playable/downloadable bytes.
// Ranking reflects what was measured live: HubCloud, GDFlix and MultiCloudLinks hand out
// Range-capable (HTTP 206) URLs, so seeking and download resume work; direct-dl.lol plays
// but ignores Range, so it is ranked below them.
import { decodeEntities, getText, hostOf, probe, request, type ProbeResult } from './http';

export interface Playable {
  url: string;
  headers?: Record<string, string>;
  seekable: boolean;
  size: number;
  host: string;
  fileName?: string;
  hls: boolean;
  /** Real picture height when known (HLS master playlist). */
  height?: number;
}

interface HostRule {
  match: RegExp;
  label: string;
  score: number;
}

const HOSTS: HostRule[] = [
  { match: /hubcloud\./, label: 'HubCloud', score: 100 },
  { match: /gdflix\./, label: 'GDFlix', score: 95 },
  { match: /multicloudlinks\.com/, label: 'MultiCloud', score: 90 },
  { match: /direct-dl\.lol/, label: 'Direct-DL', score: 70 },
  { match: /gdxshare\.com/, label: 'GDXShare', score: 50 },
  { match: /filebee\.xyz|filepress\./, label: 'FileBee', score: 30 },
  { match: /drive\.google\.com|drive\.usercontent\.google\.com/, label: 'Google Drive', score: 60 },
];

/** Premium/captcha lockers that cannot be resolved without a browser session. */
const UNSUPPORTED = /1fichier|rapidgator|ddownload|megaup|multiup|send\.now|hexload|vikingfile|voe\.sx|yourupload|buzzheavier|gofile/;

const AD_HOSTS = /winexch|jaya9|1xbet|bet365|melbet|baji|parimatch|mostbet|bit\.ly|tinyurl|bonuscaf|adsboosters|a-ads|google\.com\/search|t\.me\/|one\.one\.one\.one/;

// Mirror health observed during this session; nudges ranking toward hosts that are working now.
const stats = new Map<string, { ok: number; fail: number }>();

function rule(url: string): HostRule | undefined {
  const host = hostOf(url);
  return HOSTS.find((h) => h.match.test(host));
}

export function hostLabel(url: string): string {
  return rule(url)?.label ?? hostOf(url).replace(/^www\./, '');
}

export function isSupportedMirror(url: string): boolean {
  return /^https?:\/\//.test(url) && !UNSUPPORTED.test(hostOf(url)) && !AD_HOSTS.test(url);
}

export function rankMirrors(urls: string[]): string[] {
  const score = (u: string) => {
    const base = rule(u)?.score ?? 10;
    const s = stats.get(hostLabel(u));
    const total = s ? s.ok + s.fail : 0;
    const rate = total ? s!.ok / total : 0.5;
    return base * (0.5 + rate);
  };
  return [...new Set(urls.filter(isSupportedMirror))].sort((a, b) => score(b) - score(a));
}

function record(url: string, ok: boolean) {
  const key = hostLabel(url);
  const s = stats.get(key) ?? { ok: 0, fail: 0 };
  if (ok) s.ok++;
  else s.fail++;
  stats.set(key, s);
}

const URL_RE = /https?:\/\/[^\s"'<>\\)]+/g;

/** Every absolute URL in a page. href attributes come first and keep their spaces (encoded). */
function links(html: string): string[] {
  const text = decodeEntities(html);
  const hrefs = [...text.matchAll(/href\s*=\s*["'](https?:\/\/[^"']+)["']/gi)].map((m) => m[1].trim().replace(/ /g, '%20'));
  const loose = (text.match(URL_RE) ?? [])
    .map((u) => u.replace(/[.,;]+$/, ''))
    .filter((u) => !hrefs.some((h) => h !== u && h.startsWith(u)));
  return [...new Set([...hrefs, ...loose])];
}

function toPlayable(p: ProbeResult, host: string, headers?: Record<string, string>): Playable {
  return { url: p.url, headers, seekable: p.seekable, size: p.size, host, fileName: p.fileName, hls: p.hls || /\.m3u8(\?|$)/i.test(p.url) };
}

/** Probes candidate media URLs in order and returns the first that really serves media. */
async function firstPlayable(candidates: string[], host: string, headers?: Record<string, string>): Promise<Playable> {
  for (const c of candidates) {
    if (/\.m3u8(\?|$)/i.test(c)) return { url: c, headers, seekable: true, size: 0, host, hls: true };
    const p = await probe(c, headers);
    if (p.ok) return toPlayable(p, host, headers);
  }
  throw new Error(`${host}: no playable link`);
}

// ---------------------------------------------------------------- hosts

async function hubcloud(url: string): Promise<Playable> {
  const page = await getText(url, { timeout: 12000 });
  const bounce = /https:\/\/[a-z0-9.-]+\/hubcloud\.php\?[^"'\s<>]+/i.exec(decodeEntities(page))?.[0];
  if (!bounce) throw new Error('HubCloud: resolver link missing');
  const html = await getText(bounce, { timeout: 15000, headers: { Referer: url } });
  const all = links(html).filter((u) => !AD_HOSTS.test(u) && !/hubcloud\.|\.js(\?|$)|\.css|\.png|\.gif|favicon/.test(u));
  const prefer = (u: string) =>
    /workers\.dev|r2\.dev|googleusercontent|pixeldrain|\.mkv|\.mp4|\.m3u8/i.test(u) ? 0 : /gofile/.test(u) ? 9 : 5;
  const candidates = all.filter((u) => prefer(u) < 9).sort((a, b) => prefer(a) - prefer(b));
  return firstPlayable(candidates, 'HubCloud');
}

async function directDl(url: string): Promise<Playable> {
  const res = await request(url, { timeout: 15000 });
  const fromUrl = /[?&]link=([^&]+)/.exec(res.url)?.[1];
  const fromBody = /https:\/\/lh3\.googleusercontent\.com\/[^\s"'<>\\]+/.exec(res.text)?.[0];
  const target = fromUrl ? decodeURIComponent(fromUrl) : fromBody;
  if (!target) throw new Error('Direct-DL: link not generated');
  return firstPlayable([target], 'Direct-DL');
}

async function gdflix(url: string): Promise<Playable> {
  const html = await getText(url, { timeout: 15000 });
  const all = links(html);
  const wrapped = all
    .map((u) => /[?&]url=([^&]+)/.exec(u)?.[1])
    .filter((u): u is string => !!u)
    .map((u) => decodeURIComponent(u));
  const rank = (u: string) => (/r2\.dev/.test(u) ? 0 : /indexserver|workers\.dev/.test(u) ? 1 : /googleusercontent/.test(u) ? 2 : 9);
  const candidates = [...new Set([...all, ...wrapped])].filter((u) => rank(u) < 9).sort((a, b) => rank(a) - rank(b));
  return firstPlayable(candidates, 'GDFlix');
}

async function multicloud(url: string): Promise<Playable> {
  const html = await getText(url, { timeout: 15000 });
  const candidates = links(html).filter((u) => /multidownload\.[a-z]+\/d\//.test(u));
  return firstPlayable(candidates, 'MultiCloud');
}

async function gdxshare(url: string): Promise<Playable> {
  const page = await getText(url, { timeout: 15000 });
  const r2 = links(page).find((u) => /gdxshare\.com\/file\/r2\//.test(u));
  if (!r2) throw new Error('GDXShare: no direct option');
  const r2Page = await getText(r2, { timeout: 15000, headers: { Referer: url } });
  const statusUrl = /fetch\('(https:\/\/gdxshare\.com\/file\/r2\/[^']+\/status)'/.exec(r2Page)?.[1];
  const completion = /completionUrl\s*=\s*"([^"]+)"/.exec(r2Page)?.[1];
  if (!statusUrl || !completion) throw new Error('GDXShare: unexpected page');
  // The host copies the file to its CDN first; wait a bounded time, then give up so the next mirror runs.
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    const res = await request(statusUrl, { headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' }, timeout: 8000, retries: 0 });
    const data = JSON.parse(res.text) as { status?: string; download_url?: string };
    if (data.status === 'completed' || data.status === 'active') return firstPlayable([data.download_url || completion], 'GDXShare');
    await new Promise((r) => setTimeout(r, 2500));
  }
  throw new Error('GDXShare: file still being prepared');
}

async function googleDrive(url: string): Promise<Playable> {
  const id = /\/d\/([\w-]{20,})/.exec(url)?.[1] ?? /[?&]id=([\w-]{20,})/.exec(url)?.[1];
  if (!id) throw new Error('Drive: no file id');
  return firstPlayable([`https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`], 'Google Drive');
}

async function generic(url: string): Promise<Playable> {
  const res = await request(url, { timeout: 15000 });
  const rank = (u: string) =>
    /googleusercontent/.test(u) ? 0 : /r2\.dev|workers\.dev/.test(u) ? 1 : /\.(mkv|mp4|m3u8)(\?|$)/i.test(u) ? 2 : 9;
  const candidates = links(res.text)
    .filter((u) => !AD_HOSTS.test(u) && rank(u) < 9)
    .sort((a, b) => rank(a) - rank(b));
  return firstPlayable(candidates, hostLabel(url));
}

/** Mirror page → verified playable URL. Throws when the mirror cannot be resolved. */
export async function resolveMirror(url: string): Promise<Playable> {
  const host = hostOf(url);
  const run = /hubcloud\./.test(host)
    ? hubcloud
    : /direct-dl\.lol/.test(host)
      ? directDl
      : /gdflix\./.test(host)
        ? gdflix
        : /multicloudlinks/.test(host)
          ? multicloud
          : /gdxshare/.test(host)
            ? gdxshare
            : /drive\.google|drive\.usercontent/.test(host)
              ? googleDrive
              : generic;
  try {
    const playable = await run(url);
    record(url, true);
    return playable;
  } catch (e) {
    record(url, false);
    throw e;
  }
}

/** TechZed link protector → mirror URLs (plain text in the page, no JS needed). */
export async function resolveTechzed(url: string): Promise<string[]> {
  const html = await getText(url, { timeout: 15000 });
  return rankMirrors(links(html).filter((u) => !/techzed\.|tailwind|southfreak\./.test(hostOf(u))));
}

/** A link from a post: either a link protector (expands to mirrors) or a mirror itself. */
export async function expandLink(url: string): Promise<string[]> {
  if (/techzed\./.test(hostOf(url))) return resolveTechzed(url);
  return rankMirrors([url]);
}
