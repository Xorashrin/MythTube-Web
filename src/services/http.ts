// Networking primitives shared by every source adapter and resolver:
// timeouts, retry with jitter (timeouts and 5xx only), a per-host circuit breaker,
// and a Range probe that reads headers without downloading the body.

import { proxied } from './proxy';

export const UA =
  'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
  ) {
    super(`HTTP ${status}`);
  }
}

interface Breaker {
  failures: number;
  openUntil: number;
}

const breakers = new Map<string, Breaker>();
const BREAKER_LIMIT = 6;
const BREAKER_COOLDOWN = 90 * 1000;

export function hostOf(url: string): string {
  const m = /^[a-z]+:\/\/([^/:?#]+)/i.exec(url);
  return m ? m[1].toLowerCase() : '';
}

/** False while a host's breaker is open (too many consecutive failures recently). */
/** Infrastructure hosts (config, catalogs, id mapping) never trip the breaker: one hiccup must not disable every plugin. */
const BREAKER_EXEMPT = /(raw\.githubusercontent\.com|jsdelivr\.net|githack\.com|strem\.io|anilist\.co|ani\.zip|haglund\.dev|themoviedb\.org)$/i;

export function hostAvailable(url: string): boolean {
  if (BREAKER_EXEMPT.test(hostOf(url))) return true;
  const b = breakers.get(hostOf(url));
  return !b || b.failures < BREAKER_LIMIT || Date.now() > b.openUntil;
}

let lastSuccessAt = 0;

/** True when some request succeeded in the last minute (guards against treating an outage as "not available"). */
export function recentlyOnline(): boolean {
  return Date.now() - lastSuccessAt < 60000;
}

export function recordHost(url: string, ok: boolean) {
  if (BREAKER_EXEMPT.test(hostOf(url))) {
    if (ok) lastSuccessAt = Date.now();
    return;
  }
  if (ok) lastSuccessAt = Date.now();
  const host = hostOf(url);
  const b = breakers.get(host) ?? { failures: 0, openUntil: 0 };
  if (ok) {
    b.failures = 0;
  } else {
    b.failures += 1;
    if (b.failures >= BREAKER_LIMIT) b.openUntil = Date.now() + BREAKER_COOLDOWN;
  }
  breakers.set(host, b);
}

export interface RequestOptions {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
  retries?: number;
  signal?: AbortSignal;
}

export interface TextResponse {
  url: string;
  status: number;
  headers: Headers;
  text: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

async function once(url: string, opts: RequestOptions): Promise<TextResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeout ?? 15000);
  const outer = opts.signal;
  const onOuterAbort = () => controller.abort();
  outer?.addEventListener('abort', onOuterAbort);
  try {
    // Browsers cannot call these sources directly (CORS, mixed content, forbidden headers): go through the proxy.
    const { Accept, 'Content-Type': contentType, ...upstreamHeaders } = (opts.headers ?? {}) as Record<string, string>;
    const post = opts.method === 'POST';
    const res = await fetch(proxied(url, { 'User-Agent': UA, ...upstreamHeaders }), {
      method: post ? 'POST' : 'GET',
      headers: { ...(Accept ? { Accept } : {}), ...(post && contentType ? { 'Content-Type': contentType } : {}) },
      body: post ? opts.body : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    const upstreamStatus = Number(res.headers.get('x-upstream-status') ?? res.status);
    if (!res.ok || upstreamStatus >= 400) throw new HttpError(upstreamStatus || res.status, url);
    return { url: res.headers.get('x-final-url') || url, status: upstreamStatus, headers: res.headers, text };
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener('abort', onOuterAbort);
  }
}

// Per-host concurrency cap. WordPress answers 401/429 when hammered, so keep it polite.
const HOST_LIMIT: Record<string, number> = { 'southfreak.club': 3, 'southfreak.in': 2, 'amaderftp.net': 2 };
const running = new Map<string, number>();
const waiting = new Map<string, (() => void)[]>();

async function acquire(host: string): Promise<() => void> {
  const limit = HOST_LIMIT[host] ?? 6;
  while ((running.get(host) ?? 0) >= limit) {
    await new Promise<void>((resolve) => waiting.set(host, [...(waiting.get(host) ?? []), resolve]));
  }
  running.set(host, (running.get(host) ?? 0) + 1);
  return () => {
    running.set(host, (running.get(host) ?? 1) - 1);
    const next = waiting.get(host)?.shift();
    if (next) next();
  };
}

/** GET/POST returning text. Retries timeouts and 5xx with exponential backoff + jitter; never retries 403/404. */
export async function request(url: string, opts: RequestOptions = {}): Promise<TextResponse> {
  if (!hostAvailable(url)) throw new Error(`${hostOf(url)} is temporarily disabled after repeated failures`);
  const attempts = 1 + (opts.retries ?? 1);
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    if (opts.signal?.aborted) throw new Error('Aborted');
    const release = await acquire(hostOf(url));
    let retry = false;
    try {
      const res = await once(url, opts);
      recordHost(url, true);
      return res;
    } catch (e) {
      last = e;
      const retryable = !(e instanceof HttpError) || RETRYABLE.has(e.status);
      retry = retryable && i < attempts - 1 && !opts.signal?.aborted;
    } finally {
      release();
    }
    if (!retry) break;
    await sleep(400 * 2 ** i + Math.random() * 150);
  }
  recordHost(url, false);
  throw last;
}

/** GitHub raw files with CDN fallbacks: raw.githubusercontent.com is slow or blocked on some networks. */
export function githubMirrors(url: string): string[] {
  const m = /^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/(?:refs\/heads\/)?([^/]+)\/(.+)$/.exec(url);
  if (!m) return [url];
  const [, owner, repo, branch, path] = m;
  return [
    url,
    `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/${path}`,
    `https://fastly.jsdelivr.net/gh/${owner}/${repo}@${branch}/${path}`,
    `https://raw.githack.com/${owner}/${repo}/${branch}/${path}`,
  ];
}

/** Tries each mirror in turn (first one that answers wins). */
export async function getTextMirrored(url: string, opts?: RequestOptions): Promise<string> {
  let last: unknown = new Error('No mirror answered');
  for (const candidate of githubMirrors(url)) {
    try {
      return await getText(candidate, { ...opts, retries: 0 });
    } catch (e) {
      last = e;
    }
  }
  throw last;
}

export async function getJsonMirrored<T>(url: string, opts?: RequestOptions): Promise<T> {
  return JSON.parse(await getTextMirrored(url, opts)) as T;
}

export async function getText(url: string, opts?: RequestOptions): Promise<string> {
  return (await request(url, opts)).text;
}

export async function getJson<T>(url: string, opts?: RequestOptions): Promise<T> {
  const res = await request(url, { ...opts, headers: { Accept: 'application/json', ...opts?.headers } });
  return JSON.parse(res.text) as T;
}

export async function postJson<T>(url: string, body: unknown, opts?: RequestOptions): Promise<T> {
  const res = await request(url, {
    ...opts,
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...opts?.headers },
  });
  return JSON.parse(res.text) as T;
}

export interface ProbeResult {
  ok: boolean;
  status: number;
  /** Final URL after redirects. */
  url: string;
  /** Server honored the Range request (206) → seeking and download resume work. */
  seekable: boolean;
  contentType: string;
  /** Total size in bytes when the server reports it. */
  size: number;
  fileName?: string;
  /** The URL serves an HLS playlist (detected by content type, not only by extension). */
  hls: boolean;
}

/**
 * Range-probes a media URL through the media proxy. fetch() resolves as soon as the headers arrive, then the body is
 * cancelled, so a server that ignores Range never streams a whole file into the browser.
 */
export async function probe(url: string, headers: Record<string, string> = {}, timeout = 12000): Promise<ProbeResult> {
  const failed = (status = 0): ProbeResult => ({ ok: false, status, url, seekable: false, contentType: '', size: 0, hls: false });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(proxied(url, { 'User-Agent': UA, ...headers }, { media: true }), { headers: { Range: 'bytes=0-1' }, signal: controller.signal });
    const status = Number(res.headers.get('x-upstream-status') ?? res.status);
    const type = (res.headers.get('content-type') ?? '').toLowerCase();
    const range = res.headers.get('content-range') ?? '';
    const length = Number(res.headers.get('content-length') ?? 0);
    const total = Number(range.split('/')[1] ?? 0) || (status === 200 ? length : 0);
    const finalUrl = res.headers.get('x-final-url') || url;
    const disposition = res.headers.get('content-disposition') ?? '';
    const name = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)?.[1];
    controller.abort();
    const hls = /mpegurl|m3u8/.test(type);
    const isMedia = !type.startsWith('text/html') && !type.includes('json') && (!type.startsWith('text/plain') || hls || /\.(mkv|mp4|webm)(\?|$)/i.test(finalUrl));
    return {
      ok: (status === 200 || status === 206) && isMedia,
      status,
      url: finalUrl,
      seekable: status === 206,
      contentType: type,
      size: total,
      fileName: name ? safeDecode(name) : undefined,
      hls,
    };
  } catch {
    return failed();
  } finally {
    clearTimeout(timer);
  }
}

/** Runs tasks with a concurrency cap; results keep input order. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

/** Resolves with the promise, or rejects after `ms` milliseconds. */
export function withTimeout<T>(promise: Promise<T>, ms: number, label = 'Request'): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', ndash: '–', mdash: '—' };

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

export function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}
