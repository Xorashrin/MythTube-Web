// Source engine: finds every way to play a title, verifies them in parallel and auto-picks the best.
//
//   gatherers (own source, same title on other sources, BDIX servers, Nuvio plugins, Stremio addons)
//     └ servers (quality known from labels or probes)
//         └ resolve (mirror hops + Range probe, bounded by timeouts)
//             └ ranked list: highest quality first, seekable and fast preferred
//
// The player starts the top entry immediately and falls through the rest on failure, so a dead
// mirror never reaches the user. The same engine feeds the Download sheet.
import { useEffect, useMemo, useState } from 'react';

import type { Episode, Title } from '../data/types';
import { markAvailability } from './availabilityStore';
import { identify } from './identify';
import { getText, probe, withTimeout } from './http';
import type { NuvioRepo } from './nuvio/repos';
import { loadProviders, penalizeProvider, rankProviders, runProvider, type NuvioStream } from './nuvio/runtime';
import { expandLink, hostLabel, resolveMirror, type Playable } from './resolvers';
import * as amaderftp from './sources/amaderftp';
import { findAddon, STREMIFY, streams as addonStreams } from './sources/stremio';
import { getVariants, listPosts, siteFor, SOUTHFREAK, type Variant } from './sources/wordpress';

export type QualityPref = 'auto' | '1080p' | '720p' | '480p';

/** Settings language → plugin repo language tag (used to rank Nuvio providers). */
export const LANGUAGES: { label: string; lang: NuvioRepo['lang'] | null }[] = [
  { label: 'English', lang: null },
  { label: 'Hindi', lang: null },
  { label: 'Bengali', lang: 'bn' },
  { label: 'Tamil', lang: 'ta' },
  { label: 'Arabic', lang: 'ar' },
  { label: 'Turkish', lang: 'tr' },
  { label: 'Spanish', lang: 'es' },
  { label: 'Portuguese', lang: 'pt' },
];

let preferredLangs: NuvioRepo['lang'][] = ['bn'];
let dataSaver = false;

export function setDataSaver(on: boolean) {
  dataSaver = on;
}

export function setPreferredLanguage(label: string) {
  const hit = LANGUAGES.find((l) => l.label === label)?.lang;
  preferredLangs = hit ? [hit, 'bn'] : ['bn'];
}
export type Origin = 'local' | 'ftp' | 'bdix' | 'wp' | 'nuvio' | 'stremio';

export interface Server {
  id: string;
  name: string;
  detail: string;
  quality: string;
  /** 0–5: 360p=1 … 1080p=4, 4K=5. Unknown HD labels count as 3. */
  rank: number;
  origin: Origin;
  resolve?: () => Promise<Playable>;
  downloadable: boolean;
  size?: string;
  /** Nuvio provider key, so a bad result can be remembered against the plugin. */
  providerKey?: string;
}

export interface Resolved {
  server: Server;
  playable: Playable;
  ms: number;
  score: number;
}

// ---------------------------------------------------------------- helpers

export function qualityRank(label: string | number | undefined): number {
  const q = String(label ?? '').toLowerCase();
  if (/2160|4k|uhd/.test(q)) return 5;
  if (/1440/.test(q)) return 4.5;
  if (/1080|fhd|full ?hd/.test(q)) return 4;
  if (/720|\bhd\b/.test(q)) return 3;
  if (/480|\bsd\b/.test(q)) return 2;
  if (/360|240|cam|ts\b/.test(q)) return 1;
  if (/auto|adaptive|master|m3u8/.test(q)) return 3.5;
  return 2.5;
}

function rankFromHeight(h: number): number {
  return h >= 2000 ? 5 : h >= 1300 ? 4.5 : h >= 1000 ? 4 : h >= 700 ? 3 : h >= 450 ? 2 : 1;
}

// ---------------------------------------------------------------- content validation
// Promo clips (e.g. MovieBox ads), the wrong title and truncated files are rejected before and during
// playback, so the user never sees them.

interface Ctx {
  title: Title;
  episode?: Episode;
}

/** Expected running time in minutes (0 when unknown). */
export function expectedMinutes({ title, episode }: Ctx): number {
  return episode?.runtime || title.runtime || 0;
}

const MB = 1024 * 1024;

function minBytes(ctx: Ctx): number {
  const exp = expectedMinutes(ctx);
  const movie = ctx.title.kind === 'movie';
  return Math.max(movie ? 60 * MB : 25 * MB, exp * (movie ? 1.0 : 0.6) * MB);
}

function checkSize(bytes: number, ctx: Ctx) {
  if (bytes > 0 && bytes < minBytes(ctx)) throw new Error('Too small to be the full video (promo or preview clip)');
}

/** Is a measured duration (seconds) believable for what was requested? */
export function durationPlausible(seconds: number, ctx: Ctx): boolean {
  if (!Number.isFinite(seconds) || seconds <= 0) return false;
  const exp = expectedMinutes(ctx);
  const movie = ctx.title.kind === 'movie';
  const floor = Math.max(movie ? 20 : 8, exp ? exp * (movie ? 0.72 : 0.5) : 0) * 60;
  const ceiling = exp ? (exp * 1.9 + 25) * 60 : Infinity;
  return seconds >= floor && seconds <= ceiling;
}

/** Name/URL sanity: wrong season/episode, wrong release year, or a file clearly named after something else. */
function labelOk(label: string, ctx: Ctx): boolean {
  const text = safeDecodeText(label);
  const se = /s(\d{1,2})[\s._-]*e(\d{1,3})/i.exec(text) ?? /\b(\d{1,2})x(\d{2,3})\b/.exec(text);
  if (ctx.episode && se && (Number(se[1]) !== ctx.episode.season || Number(se[2]) !== ctx.episode.number)) return false;
  if (ctx.title.kind === 'movie' && ctx.title.year) {
    const years = [...text.matchAll(/(?:^|[^0-9])((?:19|20)\d{2})(?![0-9])/g)].map((m) => Number(m[1]));
    if (years.length > 0 && !years.some((y) => Math.abs(y - ctx.title.year) <= 1)) return false;
  }
  const base = text.split(/[?#]/)[0].split('/').pop() ?? '';
  const words = base.toLowerCase().replace(/\.[a-z0-9]{2,4}$/, '').split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !/^(\d+p?|x26[45]|hevc|web|dl|rip|bluray|hdrip|h264|h265|aac|ac3|dts|dual|audio|esub|esubs|hindi|english|bengali|hdr|uhd|mkv|mp4|amzn|nf|netflix|www|com)$/.test(w));
  const wanted = ctx.title.name.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && w !== 'the');
  if (words.length >= 3 && wanted.length > 0 && !wanted.some((w) => words.includes(w))) return false;
  return true;
}

function safeDecodeText(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Alternative search names: "Arcane: League of Legends" also finds "Arcane". */
export function altNames(title: Title): string[] {
  const full = title.name.trim();
  const short = full.split(/\s*[:–—]\s+|\s+-\s+/)[0].trim();
  const noArticle = full.replace(/^(the|a|an)\s+/i, '');
  return [...new Set([full, short, noArticle].filter((n) => n.length >= 3))];
}

const ORIGIN_BONUS: Record<Origin, number> = { local: 200, ftp: 30, bdix: 25, wp: 10, nuvio: 0, stremio: 0 };
const ORIGIN_TIER: Record<Origin, number> = { local: 0, ftp: 1, bdix: 1, wp: 2, nuvio: 3, stremio: 3 };

function score(server: Server, p: Playable, ms: number, downloadOnly: boolean): number {
  // Data saver keeps streams at 720p or below.
  const rank = Math.min(p.height ? rankFromHeight(p.height) : server.rank, dataSaver ? 3 : 9);
  const seek = p.seekable ? (downloadOnly ? 80 : 35) : 0;
  return rank * 100 + seek + ORIGIN_BONUS[server.origin] - Math.min(ms / 60, 40) - (p.hls ? 5 : 0);
}

// Browsers cannot play every container: MKV works in Chromium/Firefox only, never in Safari/iOS. Unplayable results are dropped.
const mkvPlayable = typeof document !== 'undefined' && document.createElement('video').canPlayType('video/x-matroska') !== '';

function playableOnWeb(p: Playable): boolean {
  if (p.hls) return true;
  const isMkv = /\.mkv(\?|$)/i.test(p.fileName ?? p.url);
  return mkvPlayable || !isMkv;
}

const RESOLVE_TTL = 4 * 60 * 1000;
const resolved = new Map<string, { at: number; value: Playable }>();

async function resolveOnce(key: string, run: () => Promise<Playable>): Promise<Playable> {
  const hit = resolved.get(key);
  if (hit && Date.now() - hit.at < RESOLVE_TTL) return hit.value;
  const value = await run();
  resolved.set(key, { at: Date.now(), value });
  return value;
}

// ---------------------------------------------------------------- server builders

/** Reads an HLS playlist: confirms it is real, finds the best picture height and the total running time. */
async function probeHls(url: string, headers?: Record<string, string>): Promise<{ height: number; duration: number }> {
  const text = await getText(url, { headers, timeout: 9000, retries: 0 });
  if (!text.includes('#EXTM3U')) throw new Error('Not an HLS playlist');
  let height = 0;
  let best: { bw: number; uri: string } | null = null;
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const info = /#EXT-X-STREAM-INF:(.*)/.exec(lines[i]);
    if (!info) continue;
    const res = /RESOLUTION=\d+x(\d+)/.exec(info[1]);
    const bw = Number(/BANDWIDTH=(\d+)/.exec(info[1])?.[1] ?? 0);
    if (res) height = Math.max(height, Number(res[1]));
    const uri = lines[i + 1]?.trim();
    if (uri && !uri.startsWith('#') && (!best || bw > best.bw)) best = { bw, uri };
  }
  let media = text;
  if (best) {
    // Master playlist: read one variant to learn the real running time.
    try {
      media = await getText(new URL(best.uri, url).href, { headers, timeout: 9000, retries: 0 });
    } catch {
      media = '';
    }
  }
  let duration = 0;
  for (const m of media.matchAll(/#EXTINF:([\d.]+)/g)) duration += Number(m[1]);
  // Without an end marker the playlist is live or incomplete, so its length says nothing.
  if (!/#EXT-X-ENDLIST/.test(media)) duration = 0;
  return { height, duration };
}

async function resolveVariant(v: Variant): Promise<Playable> {
  return resolveOnce(v.url, async () => {
    const mirrors = await withTimeout(expandLink(v.url), 15000, 'Link page');
    if (mirrors.length === 0) throw new Error('No mirrors');
    let last: unknown = new Error('No mirrors');
    for (const m of mirrors.slice(0, 5)) {
      try {
        return await withTimeout(resolveMirror(m), 30000, hostLabel(m));
      } catch (e) {
        last = e;
      }
    }
    throw last;
  });
}

function wpServers(ctx: Ctx, post: Title, variants: Variant[], prefix = ''): Server[] {
  return variants.map((v, i) => ({
    id: `${prefix}wp:${post.id}:${i}`,
    name: `Southfreak • ${v.quality}`,
    detail: v.size ? `${v.size} • multi-mirror` : 'multi-mirror',
    quality: v.quality,
    rank: qualityRank(v.quality),
    origin: 'wp' as const,
    resolve: async () => {
      const playable = await resolveVariant(v);
      checkSize(playable.size, ctx);
      if (playable.fileName && !labelOk(playable.fileName, ctx)) throw new Error('File name does not match this title');
      return playable;
    },
    downloadable: true,
    size: v.size,
  }));
}

function fileServer(ctx: Ctx, id: string, name: string, url: string, urls: string[], label: string, origin: 'ftp' | 'bdix'): Server {
  const quality = /(2160p|1080p|720p|480p|4k)/i.exec(label)?.[1].toUpperCase() ?? (label || 'HD');
  return {
    id,
    name: `${name} • ${quality}`,
    detail: 'direct file • seek & resume',
    quality,
    rank: qualityRank(quality),
    origin,
    downloadable: true,
    resolve: () =>
      resolveOnce(url, async () => {
        if (!labelOk(label, ctx) || !labelOk(url, ctx)) throw new Error('File does not match this title');
        for (const candidate of urls) {
          const p = await probe(candidate);
          if (!p.ok) continue;
          checkSize(p.size, ctx);
          return { url: p.url, seekable: p.seekable, size: p.size, host: name, fileName: p.fileName, hls: p.hls };
        }
        throw new Error(`${name} file unreachable`);
      }),
  };
}

function ftpServers(ctx: Ctx, files: amaderftp.FtpFile[], prefix = ''): Server[] {
  return files.map((f) => fileServer(ctx, `${prefix}ft:${f.url}`, 'BDIX Fast', f.url, f.mirrors, f.quality, 'ftp'));
}

interface StreamLike {
  url: string;
  quality?: string;
  title?: string;
  name?: string;
  size?: string;
  headers?: Record<string, string>;
  provider: string;
  providerKey?: string;
}

/** One builder for plugin and addon streams: validates name, size and (for HLS) running time before they can be picked. */
function streamServers(ctx: Ctx, streams: StreamLike[], origin: 'nuvio' | 'stremio'): Server[] {
  const out: Server[] = [];
  for (const s of streams) {
    const text = `${s.quality ?? ''} ${s.title ?? ''} ${s.name ?? ''}`;
    if (!labelOk(`${s.title ?? ''} ${s.name ?? ''}`, ctx) || !labelOk(s.url, ctx)) continue;
    const hlsHint = /\.m3u8(\?|$)/i.test(s.url) || /m3u8|hls/i.test(s.quality ?? '');
    const quality = /(2160p|4k|1080p|720p|480p|360p)/i.exec(text)?.[1].toUpperCase() ?? (hlsHint ? 'Auto' : 'HD');
    out.push({
      id: `${origin}:${s.url}`,
      name: `${s.provider} • ${quality}`,
      detail: hlsHint ? 'adaptive stream' : 'direct file',
      quality,
      rank: qualityRank(quality),
      origin,
      downloadable: !hlsHint,
      size: s.size,
      providerKey: s.providerKey,
      resolve: () =>
        resolveOnce(s.url + JSON.stringify(s.headers ?? {}), async () => {
          if (hlsHint) {
            const { height, duration } = await probeHls(s.url, s.headers);
            if (duration > 0 && !durationPlausible(duration, ctx)) throw new Error('Playlist length does not match this title');
            return { url: s.url, headers: s.headers, seekable: true, size: 0, host: s.provider, hls: true, height: height || undefined };
          }
          const p = await probe(s.url, s.headers);
          if (!p.ok) throw new Error('Stream unreachable');
          if (p.hls) {
            const { height, duration } = await probeHls(p.url, s.headers);
            if (duration > 0 && !durationPlausible(duration, ctx)) throw new Error('Playlist length does not match this title');
            return { url: p.url, headers: s.headers, seekable: true, size: 0, host: s.provider, hls: true, height: height || undefined };
          }
          checkSize(p.size, ctx);
          return { url: p.url, headers: s.headers, seekable: p.seekable, size: p.size, host: s.provider, fileName: p.fileName, hls: false };
        }),
    });
  }
  return out;
}

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function sameTitle(a: Title, b: Title): boolean {
  return norm(a.name) === norm(b.name) && (!a.year || !b.year || Math.abs(a.year - b.year) <= 1);
}

// ---------------------------------------------------------------- engine

interface Gatherer {
  /** Early gatherers are cheap direct sources; late ones (plugins, web players) wait for them. */
  early: boolean;
  run: (add: (servers: Server[]) => void, engine: SourceSearch) => Promise<void>;
}

const PARALLEL_RESOLVES = 8;
const GRACE_MS = 2500;
const HARD_CAP_MS = 90000;
const QUICK_CAP_MS = 30000;

export class SourceSearch {
  readonly servers: Server[] = [];
  readonly results: Resolved[] = [];
  readonly startedAt = Date.now();
  done = false;
  private seen = new Set<string>();
  private rejected = new Set<string>();
  private queue: Server[] = [];
  private active = 0;
  private gatherersLeft = 0;
  earlyLeft = 0;
  private listeners = new Set<() => void>();
  private failures = 0;

  constructor(
    readonly title: Title,
    readonly episode: Episode | undefined,
    /** Quick mode (availability checks): fewer plugins, shorter budget. */
    readonly quick = false,
  ) {
    // Wait for screen transitions to finish so the search never competes with navigation animations.
    setTimeout(() => this.start(), 320);
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  private add = (servers: Server[]) => {
    const key = (s: Server) => s.id.replace(/^x:/, '');
    const fresh = servers.filter((s) => !this.seen.has(key(s)));
    if (fresh.length === 0) return;
    fresh.forEach((s) => this.seen.add(key(s)));
    this.servers.push(...fresh);
    for (const s of fresh) if (s.resolve && !this.rejected.has(s.id)) this.queue.push(s);
    this.queue.sort((a, b) => ORIGIN_TIER[a.origin] - ORIGIN_TIER[b.origin] || b.rank - a.rank);
    this.pump();
    this.emit();
  };

  private pump() {
    while (this.active < PARALLEL_RESOLVES && this.queue.length > 0) {
      const server = this.queue.shift()!;
      this.active++;
      const t0 = Date.now();
      withTimeout(server.resolve!(), 40000, server.name)
        .then((playable) => {
          if (this.rejected.has(server.id) || !playableOnWeb(playable)) return;
          const ms = Date.now() - t0;
          this.results.push({ server, playable, ms, score: score(server, playable, ms, false) });
          this.results.sort((a, b) => b.score - a.score);
          markAvailability(this.title.id, true);
        })
        .catch(() => {
          this.failures++;
        })
        .finally(() => {
          this.active--;
          this.pump();
          this.checkDone();
          this.emit();
        });
    }
  }

  private checkDone() {
    if (!this.done && this.gatherersLeft === 0 && this.active === 0 && this.queue.length === 0) {
      this.done = true;
    }
  }

  private start() {
    const gatherers = buildGatherers(this.title, this.episode, this.quick);
    this.gatherersLeft = gatherers.length;
    this.earlyLeft = gatherers.filter((g) => g.early).length;
    for (const g of gatherers) {
      g.run(this.add, this)
        .catch(() => undefined)
        .finally(() => {
          this.gatherersLeft--;
          if (g.early) this.earlyLeft--;
          this.checkDone();
          this.emit();
        });
    }
    setTimeout(() => {
      if (!this.done) {
        this.done = true;
        this.emit();
      }
    }, this.quick ? QUICK_CAP_MS : HARD_CAP_MS);
  }

  /** true as soon as any verified stream exists, false when the search ended empty, undefined on timeout. */
  firstResult(timeoutMs: number): Promise<boolean | undefined> {
    return new Promise((resolve) => {
      let finished = false;
      const finish = (v: boolean | undefined) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        unsubscribe();
        resolve(v);
      };
      const check = () => {
        if (this.results.length > 0) finish(true);
        else if (this.done) finish(false);
      };
      const timer = setTimeout(() => finish(undefined), timeoutMs);
      const unsubscribe = this.subscribe(check);
      check();
    });
  }

  /** A verified, seekable 1080p+ stream exists: nothing else is worth fetching. */
  get hasTop(): boolean {
    return this.results.some((r) => r.server.rank >= 4 && r.playable.seekable);
  }

  /** The player or downloader found this server delivers the wrong thing: drop it for good. */
  reject(serverId: string) {
    this.rejected.add(serverId);
    const hit = this.results.find((r) => r.server.id === serverId);
    const key = hit?.server.providerKey ?? this.servers.find((s) => s.id === serverId)?.providerKey;
    if (key) penalizeProvider(key);
    const i = this.results.findIndex((r) => r.server.id === serverId);
    if (i >= 0) this.results.splice(i, 1);
    this.emit();
  }

  /** Verified results ranked for the given purpose. */
  ranked(downloadOnly = false): Resolved[] {
    const pool = downloadOnly ? this.results.filter((r) => r.server.downloadable && !r.playable.hls) : this.results;
    return downloadOnly ? [...pool].map((r) => ({ ...r, score: score(r.server, r.playable, r.ms, true) })).sort((a, b) => b.score - a.score) : pool;
  }

  /** Any server (verified or not) that can be downloaded — used to enable/disable the Download button. */
  get downloadable(): Server[] {
    return this.servers.filter((s) => s.downloadable);
  }

  /**
   * Resolves with the best verified server. Waits for a short grace window after the first success so a
   * faster/higher-quality sibling can win, but returns instantly for a seekable 1080p+ stream.
   */
  best(downloadOnly = false): Promise<Resolved | null> {
    return new Promise((resolve) => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      let firstSeen = 0;
      let finished = false;
      const finish = (r: Resolved | null) => {
        if (finished) return;
        finished = true;
        if (timer) clearTimeout(timer);
        unsubscribe();
        resolve(r);
      };
      const check = () => {
        if (finished) return;
        const pool = this.ranked(downloadOnly);
        if (pool.length > 0) {
          if (!firstSeen) firstSeen = Date.now();
          const top = pool[0];
          const instant = top.server.rank >= 4 && top.playable.seekable;
          if (instant || this.done || Date.now() - firstSeen >= GRACE_MS) return finish(top);
          if (!timer) timer = setTimeout(() => { timer = null; check(); }, GRACE_MS - (Date.now() - firstSeen) + 20);
        } else if (this.done) {
          finish(null);
        }
      };
      const unsubscribe = this.subscribe(check);
      check();
    });
  }
}

// ---------------------------------------------------------------- gatherers

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function buildGatherers(title: Title, episode: Episode | undefined, quick: boolean): Gatherer[] {
  const list: Gatherer[] = [];
  const ctx: Ctx = { title, episode };
  const early = (run: Gatherer['run']) => list.push({ early: true, run });
  const late = (run: Gatherer['run']) => list.push({ early: false, run });

  // 1. The title's own source.
  early(async (add) => {
    if (title.source === 'southfreak' || title.source === 'sfadult') {
      add(wpServers(ctx, title, await getVariants(siteFor(title.source), title.ref)));
    } else if (title.source === 'amaderftp') {
      add(ftpServers(ctx, await amaderftp.getFiles(title)));
    } else if (title.source === 'bdix' && title.files) {
      add(title.files.map((f, i) => fileServer(ctx, `bx:${title.id}:${i}`, 'BDIX', f.url, [f.url], f.label, 'bdix')));
    } else if (title.source === 'stremio') {
      const addon = findAddon(title.addon);
      if (!addon) return;
      const streams = await addonStreams(addon, 'movie', title.ref);
      add(streamServers(ctx, streams.map((s) => ({ url: s.url!, quality: s.name ?? s.title, provider: addon.name })), 'stremio'));
    }
  });

  const mainstream = !title.nsfw && title.source !== 'stremio';

  // 2. The same movie on other direct sources (every alternative spelling of the name is tried).
  if (mainstream && title.kind === 'movie') {
    const names = altNames(title);
    if (title.source !== 'amaderftp') {
      early(async (add) => {
        if (title.tmdbId) return add(ftpServers(ctx, await amaderftp.filesByTmdb(title.tmdbId), 'x:'));
        for (const name of names) {
          const hits = (await amaderftp.search(name)).filter((t) => sameTitle(title, t));
          if (hits.length) return add(ftpServers(ctx, await amaderftp.getFiles(hits[0]), 'x:'));
        }
      });
    }
    if (title.source !== 'southfreak') {
      early(async (add) => {
        for (const name of names) {
          const hits = (await listPosts(SOUTHFREAK, { search: name, perPage: 8 })).filter((t) => sameTitle(title, t));
          for (const h of hits.slice(0, 2)) add(wpServers(ctx, h, await getVariants(SOUTHFREAK, h.ref), 'x:'));
          if (hits.length) return;
        }
      });
    }
  }

  // 3. Nuvio plugins and Stremio streams (need TMDB/IMDb ids). They are heavier, so they only start when the
  //    direct sources did not already produce a seekable 1080p+ stream; if nothing at all is found they keep
  //    widening the search through every remaining plugin.
  if (mainstream) {
    late(async (add, engine) => {
      const ids = await identify(title);
      if (!ids.tmdbId && !ids.imdbId) return;
      const waitedFrom = Date.now();
      while (engine.earlyLeft > 0 && !engine.hasTop && Date.now() - waitedFrom < 4000) await sleep(200);
      if (engine.hasTop) return;

      const kind = title.kind === 'series' ? 'tv' : 'movie';
      // AniList sequels are separate entries: the mapped TMDB season wins over the entry's own "season 1".
      const season = ids.season ?? episode?.season ?? (kind === 'tv' ? 1 : undefined);
      const number = episode?.number ?? (kind === 'tv' ? 1 : undefined);

      const tasks: Promise<void>[] = [];
      if (ids.imdbId) {
        const sid = kind === 'tv' ? `${ids.imdbId}:${season}:${number}` : ids.imdbId;
        tasks.push(
          addonStreams(STREMIFY, kind === 'tv' ? 'series' : 'movie', sid)
            .then((streams) => add(streamServers(ctx, streams.map((s) => ({ url: s.url!, quality: s.name ?? s.title, provider: STREMIFY.name, headers: s.behaviorHints?.proxyHeaders?.request })), 'stremio')))
            .catch(() => undefined),
        );
      }
      if (ids.tmdbId) {
        const tmdb = String(ids.tmdbId);
        const providers = await rankProviders(await loadProviders(kind), preferredLangs, { anime: title.source === 'anilist' });
        const runBatch = async (batch: typeof providers) => {
          let next = 0;
          const worker = async () => {
            while (next < batch.length && !engine.done && !engine.hasTop) {
              const p = batch[next++];
              try {
                add(streamServers(ctx, await runProvider(p, tmdb, kind, season, number), 'nuvio'));
              } catch {
                // provider failed or timed out: the next one takes over
              }
            }
          };
          await Promise.all(Array.from({ length: 8 }, worker));
        };
        tasks.push(
          (async () => {
            await runBatch(providers.slice(0, quick ? 8 : 16));
            if (quick) return;
            if (engine.results.length === 0) await runBatch(providers.slice(16, 50));
            if (engine.results.length === 0) await runBatch(providers.slice(50));
          })(),
        );
      }
      await Promise.all(tasks);
    });
  }
  return list;
}

// ---------------------------------------------------------------- shared instances + hooks

const ENGINE_TTL = 5 * 60 * 1000;
const engines = new Map<string, SourceSearch>();

/** One engine per title/episode, shared by Title screen, Player and Download sheet. */
export function getSearch(title: Title, episode?: Episode, quick = false): SourceSearch {
  const key = `${title.id}|${episode?.id ?? ''}|${quick ? 'q' : 'f'}`;
  const hit = engines.get(key);
  if (hit && Date.now() - hit.startedAt < ENGINE_TTL && !(hit.done && hit.results.length === 0 && Date.now() - hit.startedAt > 20000)) return hit;
  const engine = new SourceSearch(title, episode, quick);
  engines.set(key, engine);
  if (engines.size > 12) engines.delete(engines.keys().next().value as string);
  return engine;
}

/** Start looking for sources before the user presses Play (Title screen, hero, search results). */
export function warmUp(title: Title, episode?: Episode) {
  if (dataSaver) return;
  try {
    getSearch(title, episode);
  } catch {
    // warming is best-effort
  }
}

/** Re-renders when the engine finds or verifies servers. */
export function useSourceSearch(title: Title, episode?: Episode): { engine: SourceSearch; version: number } {
  const engine = useMemo(() => getSearch(title, episode), [title.id, episode?.id]);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    setVersion((v) => v + 1);
    return engine.subscribe(() => setVersion((v) => v + 1));
  }, [engine]);
  return { engine, version };
}
