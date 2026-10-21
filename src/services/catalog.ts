// Catalog: every row on every screen is loaded here, live, from the source adapters.
// Feeds are cached (stale-while-revalidate) so the app opens instantly and still shows
// the last good content when a source is down.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { isListed, useAvailabilityVersion } from './availabilityStore';
import { verifyLater } from './availability';

import { tintFor, type Title } from '../data/types';
import { cached } from './cache';
import * as amaderftp from './sources/amaderftp';
import * as anilist from './sources/anilist';
import * as cinemeta from './sources/cinemeta';
import * as stremio from './sources/stremio';
import { CATEGORY, listPosts, SOUTHFREAK, SOUTHFREAK_18 } from './sources/wordpress';

const NEW_WINDOW = 72 * 3600 * 1000;
const FEED_TTL = 12 * 60 * 1000;
const SAVED_KEY = 'mythtube:titles:v1';

// ---------------------------------------------------------------- title registry

const registry = new Map<string, Title>();

export function register(titles: Title[]): Title[] {
  const now = Date.now();
  return titles.map((t) => {
    const prev = registry.get(t.id);
    const merged = prev?.detailed && !t.detailed ? { ...t, ...prev, badge: undefined } : t;
    const fresh = merged.addedAt !== undefined && now - merged.addedAt < NEW_WINDOW;
    const final: Title = { ...merged, badge: merged.airing ? 'airing' : fresh ? 'new' : undefined };
    registry.set(t.id, final);
    return final;
  });
}

function stub(id: string): Title {
  return {
    id, source: 'cinemeta', ref: id, name: 'Unavailable title', kind: 'movie', year: new Date().getFullYear(), maturity: '13+',
    runtime: 0, seasons: [], genres: [], synopsis: '', cast: [], creators: [], tint: tintFor(id), quality: [],
  };
}

/** Synchronous lookup. Titles that were never loaded this session (or restored from storage) resolve to a stub. */
export function resolveTitle(id: string): Title {
  return registry.get(id) ?? stub(id);
}

/** Titles seen this session or restored from storage: feeds the search suggestions. */
export function registeredNames(): string[] {
  return [...new Set([...registry.values()].map((t) => t.name))];
}

export function hasTitle(id: string): boolean {
  return registry.has(id);
}

/** Restore titles saved for My List, progress and downloads so they survive restarts and offline. */
export async function loadSavedTitles(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(SAVED_KEY);
    if (raw) for (const t of JSON.parse(raw) as Title[]) if (!registry.has(t.id)) registry.set(t.id, t);
  } catch {
    // first run
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
export function saveTitles(ids: string[]) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const list = [...new Set(ids)].map((id) => registry.get(id)).filter((t): t is Title => !!t).map((t) => ({ ...t, seasons: t.seasons.length > 40 ? [] : t.seasons }));
    AsyncStorage.setItem(SAVED_KEY, JSON.stringify(list)).catch(() => undefined);
  }, 800);
}

// ---------------------------------------------------------------- detail

const detailJobs = new Map<string, Promise<Title>>();

/** Fills in cast, runtime and real episode lists. Safe to call repeatedly. */
export function loadDetail(id: string): Promise<Title> {
  const base = registry.get(id);
  if (!base) return Promise.resolve(stub(id));
  if (base.detailed) return Promise.resolve(base);
  const running = detailJobs.get(id);
  if (running) return running;
  const job = (async () => {
    try {
      const fresh =
        base.source === 'cinemeta' ? await cinemeta.detail(base)
        : base.source === 'anilist' ? await anilist.detail(base)
        : base.source === 'amaderftp' ? await amaderftp.detail(base)
        : { ...base, detailed: true };
      return register([fresh])[0];
    } catch {
      return base;
    } finally {
      detailJobs.delete(id);
    }
  })();
  detailJobs.set(id, job);
  return job;
}

// ---------------------------------------------------------------- feeds

export interface RowDef {
  key: string;
  title: string;
  load: (force?: boolean) => Promise<Title[]>;
  nsfw?: boolean;
}

const feed = (key: string, load: () => Promise<Title[]>, ttl = FEED_TTL) => async (force?: boolean) =>
  register(await cached(`feed:${key}`, { ttl, force }, load));

function wp(key: string, category: number | undefined, perPage = 20): RowDef['load'] {
  return feed(`sf:${key}`, () => listPosts(SOUTHFREAK, { category, perPage }));
}

const byDateDesc = (a: Title, b: Title) => (b.addedAt ?? 0) - (a.addedAt ?? 0);

export const HOME_ROWS: RowDef[] = [
  // Bangladeshi content always comes first.
  {
    key: 'bd-bangla',
    title: 'Bangladeshi & Bangla',
    load: feed('bd:bangla', async () => {
      const lists = await Promise.all([
        listPosts(SOUTHFREAK, { category: CATEGORY.bengali, perPage: 14 }).catch(() => []),
        listPosts(SOUTHFREAK, { category: CATEGORY.banglaSub, perPage: 10 }).catch(() => []),
        listPosts(SOUTHFREAK, { category: CATEGORY.banglaDubbed, perPage: 8 }).catch(() => []),
        listPosts(SOUTHFREAK, { category: CATEGORY.natok, perPage: 8 }).catch(() => []),
        amaderftp.byLanguage('bangla').catch(() => []),
      ]);
      const unique = new Map<string, Title>();
      for (const t of lists.flat()) unique.set(t.id, t);
      return [...unique.values()].sort(byDateDesc);
    }),
  },
  { key: 'sf-latest', title: 'Just Added', load: wp('latest', undefined, 24) },
  { key: 'cm-movies', title: 'Trending Movies', load: feed('cm:movie', () => cinemeta.catalog('movie')) },
  { key: 'cm-series', title: 'Trending Series', load: feed('cm:series', () => cinemeta.catalog('series')) },
  { key: 'ft-latest', title: 'BDIX Fast Server', load: feed('ft:latest', () => amaderftp.latest()) },
  { key: 'sf-hindi', title: 'Hindi Dubbed', load: wp('hindi', CATEGORY.hindiDubbed) },
  { key: 'sf-hollywood', title: 'Hollywood', load: wp('hollywood', CATEGORY.hollywood) },
  { key: 'sf-bollywood', title: 'Bollywood', load: wp('bollywood', CATEGORY.bollywood) },
  { key: 'sf-south', title: 'South Indian', load: feed('sf:south', async () => (await Promise.all([CATEGORY.telugu, CATEGORY.tamil, CATEGORY.malayalam].map((c) => listPosts(SOUTHFREAK, { category: c, perPage: 10 }).catch(() => [])))).flat().sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0))) },
  { key: 'sf-korean', title: 'Korean', load: wp('korean', CATEGORY.korean) },
  { key: 'al-trending', title: 'Trending Anime', load: feed('al:trending', () => anilist.trending()) },
  { key: 'sf-scifi', title: 'Sci-Fi', load: wp('scifi', CATEGORY.scifi) },
  { key: 'sf-horror', title: 'Horror', load: wp('horror', CATEGORY.horror) },
  { key: 'sf-animation', title: 'Animation', load: wp('animation', CATEGORY.animation) },
];

const anime = (key: string, title: string, o: anilist.BrowseOptions, ttl = FEED_TTL): RowDef => ({
  key,
  title,
  load: feed(`al:${key}`, () => anilist.browse(o), ttl),
});

const THIS_SEASON = anilist.currentSeason();
const NEXT_SEASON = anilist.nextSeason();

export const ANIME_GENRES = ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Mecha', 'Music', 'Mystery', 'Psychological', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural', 'Thriller'];

/** Rows of the Anime tab: AniList discovery (new episodes, seasons, rankings, genres). */
export const ANIME_ROWS: RowDef[] = [
  { key: 'an-schedule', title: 'Airing This Week', load: feed('al:schedule', () => anilist.upcoming(7), 30 * 60 * 1000) },
  anime('an-trending', 'Trending Now', { sort: 'TRENDING_DESC' }),
  anime('an-season', 'This Season', { sort: 'POPULARITY_DESC', season: THIS_SEASON.season, seasonYear: THIS_SEASON.year }),
  anime('an-airing', 'Currently Airing', { sort: 'POPULARITY_DESC', status: 'RELEASING' }),
  anime('an-popular', 'All-Time Popular', { sort: 'POPULARITY_DESC' }, 6 * 3600 * 1000),
  anime('an-top', 'Top Rated', { sort: 'SCORE_DESC' }, 6 * 3600 * 1000),
  anime('an-movies', 'Anime Movies', { sort: 'POPULARITY_DESC', format: ['MOVIE'] }, 6 * 3600 * 1000),
  anime('an-next', 'Coming Next Season', { sort: 'POPULARITY_DESC', season: NEXT_SEASON.season, seasonYear: NEXT_SEASON.year }, 6 * 3600 * 1000),
  anime('an-action', 'Action', { sort: 'POPULARITY_DESC', genre: 'Action' }, 6 * 3600 * 1000),
  anime('an-romance', 'Romance', { sort: 'POPULARITY_DESC', genre: 'Romance' }, 6 * 3600 * 1000),
  anime('an-fantasy', 'Fantasy', { sort: 'POPULARITY_DESC', genre: 'Fantasy' }, 6 * 3600 * 1000),
  anime('an-comedy', 'Comedy', { sort: 'POPULARITY_DESC', genre: 'Comedy' }, 6 * 3600 * 1000),
  anime('an-scifi', 'Sci-Fi', { sort: 'POPULARITY_DESC', genre: 'Sci-Fi' }, 6 * 3600 * 1000),
];

export async function loadAnimeGenre(genre: string, page: number): Promise<Title[]> {
  return register(await anilist.browse({ sort: 'POPULARITY_DESC', genre, page, perPage: 30 }));
}

export const ADULT_ROWS: RowDef[] = stremio.ONLYPORN_CATALOGS.map((c) => ({
  key: `sx-${c.id}`,
  title: c.name,
  load: feed(`sx:${c.id}`, () => stremio.catalog(stremio.ONLYPORN, c.id)),
  nsfw: true,
}));

export async function loadAdultPage(page: number): Promise<Title[]> {
  return register(await listPosts(SOUTHFREAK_18, { page, perPage: 30 }));
}

// ---------------------------------------------------------------- search

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function score(t: Title, q: string): number {
  const n = norm(t.name);
  // Bangladeshi content wins ties.
  const bonus = /beng|bangla|bangladesh/i.test(`${t.language ?? ''} ${t.genres.join(' ')}`) ? 12 : 0;
  if (n === q) return 100 + bonus;
  if (n.startsWith(q)) return 80 + bonus;
  if (n.includes(q)) return 60 + bonus;
  return (q.split(' ').every((w) => n.includes(w)) ? 40 : 10) + bonus;
}

/** Fans out to every source in parallel; a slow or dead source never blocks the others. */
export async function searchAll(query: string, includeAdult = false): Promise<Title[]> {
  const q = norm(query);
  if (q.length < 2) return [];
  const key = `search:${q}:${includeAdult ? 1 : 0}`;
  const jobs: Promise<Title[]>[] = [
    cinemeta.search(query),
    listPosts(SOUTHFREAK, { search: query, perPage: 15 }),
    anilist.search(query),
    amaderftp.search(query),
  ];
  if (includeAdult) {
    jobs.push(listPosts(SOUTHFREAK_18, { search: query, perPage: 15 }));
    jobs.push(stremio.catalog(stremio.ONLYPORN, 'eporner', { search: query }));
  }
  const settled = await Promise.allSettled(jobs.map((j) => Promise.race([j, new Promise<Title[]>((_, rej) => setTimeout(() => rej(new Error('timeout')), 12000))])));
  const results = settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  if (results.length === 0) {
    // every source failed: serve the last good result for this query
    return (await cached<Title[]>(key, { ttl: Infinity }, async () => [])).map((t) => registry.get(t.id) ?? t);
  }
  const unique = new Map<string, Title>();
  for (const t of register(results)) unique.set(t.id, t);
  const sorted = [...unique.values()].filter(isListed).sort((a, b) => score(b, q) - score(a, q));
  verifyLater(sorted.slice(0, 8));
  await cached<Title[]>(key, { ttl: 0, force: true }, async () => sorted.slice(0, 40));
  return sorted;
}

// ---------------------------------------------------------------- hooks

export interface RowState {
  def: RowDef;
  items: Title[];
  loading: boolean;
  error: boolean;
}

/**
 * Loads rows independently (each shows as soon as it arrives) and refreshes them when the app
 * returns to the foreground after a while, so new uploads appear without a restart.
 */
export function useRows(defs: RowDef[], enabled = true) {
  const [rows, setRows] = useState<RowState[]>(() => defs.map((def) => ({ def, items: [], loading: true, error: false })));
  const [refreshing, setRefreshing] = useState(false);
  const lastLoad = useRef(0);
  const availability = useAvailabilityVersion();
  const stable = useRef(new Map<string, { src: Title[]; out: Title[]; v: number }>()).current;

  // Staggered loading: three feeds at a time keeps the first screen fast and the data use low.
  const load = useCallback(
    async (force: boolean) => {
      lastLoad.current = Date.now();
      let next = 0;
      const worker = async () => {
        while (next < defs.length) {
          const def = defs[next++];
          try {
            const items = await def.load(force);
            setRows((prev) => prev.map((r) => (r.def.key === def.key ? { ...r, items: items.length ? items : r.items, loading: false, error: false } : r)));
          } catch {
            setRows((prev) => prev.map((r) => (r.def.key === def.key ? { ...r, loading: false, error: r.items.length === 0 } : r)));
          }
        }
      };
      await Promise.all(Array.from({ length: 3 }, worker));
    },
    [defs],
  );

  useEffect(() => {
    if (!enabled) return;
    load(false);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && Date.now() - lastLoad.current > FEED_TTL) load(true);
    });
    return () => sub.remove();
  }, [enabled, load]);

  // Titles with no playable source are hidden; unchecked ones are verified quietly in the background.
  useEffect(() => {
    if (!enabled) return;
    const pending = rows.flatMap((r) => r.items.slice(0, 8)).filter((t) => t.source === 'cinemeta' || t.source === 'anilist');
    if (pending.length > 0) verifyLater(pending);
  }, [rows, enabled]);

  const visible = useMemo(
    () =>
      rows.map((r) => {
        const hit = stable.get(r.def.key);
        if (hit && hit.src === r.items && hit.v === availability) return r.items === hit.out ? r : { ...r, items: hit.out };
        const out = r.items.filter(isListed);
        const reuse = hit && hit.out.length === out.length && hit.out.every((t, i) => t === out[i]) ? hit.out : out;
        stable.set(r.def.key, { src: r.items, out: reuse, v: availability });
        return { ...r, items: reuse };
      }),
    [rows, availability, stable],
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }, [load]);

  return { rows: visible, refresh, refreshing };
}

export function titleById(rows: RowState[], key: string): Title[] {
  return rows.find((r) => r.def.key === key)?.items ?? [];
}
