// Search helpers: query parsing ("bachelor point season 1 ep 10"), saved history and title suggestions.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { registeredNames } from './catalog';
import * as cinemeta from './sources/cinemeta';

export interface ParsedQuery {
  /** Title part with the season/episode words removed. */
  text: string;
  season?: number;
  episode?: number;
}

const SEASON_EPISODE = [
  /\bs(?:eason)?\s*0*(\d{1,2})\s*[-_. ]*\s*e(?:p(?:isode)?)?\s*0*(\d{1,3})\b/i, // s1e10, s01 e10, season 1 ep 10
  /\b0*(\d{1,2})\s*x\s*0*(\d{1,3})\b/i, // 1x10
];
const SEASON_ONLY = /\b(?:s|season|saison|sezon)\s*0*(\d{1,2})\b/i;
const EPISODE_ONLY = /\b(?:e|ep|episode|eps)\s*\.?\s*0*(\d{1,3})\b/i;

/** Splits "Bachelor Point season 1 ep 10" into the title and the wanted season/episode. */
export function parseQuery(raw: string): ParsedQuery {
  let text = ` ${raw.trim()} `;
  for (const re of SEASON_EPISODE) {
    const m = re.exec(text);
    if (m) return { text: text.replace(re, ' ').replace(/\s+/g, ' ').trim(), season: Number(m[1]), episode: Number(m[2]) };
  }
  let season: number | undefined;
  let episode: number | undefined;
  const s = SEASON_ONLY.exec(text);
  if (s) {
    season = Number(s[1]);
    text = text.replace(SEASON_ONLY, ' ');
  }
  const e = EPISODE_ONLY.exec(text);
  if (e) {
    episode = Number(e[1]);
    text = text.replace(EPISODE_ONLY, ' ');
  }
  return { text: text.replace(/\s+/g, ' ').trim(), season, episode };
}

// ---------------------------------------------------------------- history

const HISTORY_KEY = 'mythtube:search-history:v1';
const MAX_HISTORY = 25;

export async function getHistory(): Promise<string[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(HISTORY_KEY)) ?? '[]') as string[];
  } catch {
    return [];
  }
}

export async function addHistory(query: string): Promise<string[]> {
  const q = query.trim();
  if (q.length < 2) return getHistory();
  const next = [q, ...(await getHistory()).filter((h) => h.toLowerCase() !== q.toLowerCase())].slice(0, MAX_HISTORY);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next)).catch(() => undefined);
  return next;
}

export async function removeHistory(query: string): Promise<string[]> {
  const next = (await getHistory()).filter((h) => h !== query);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next)).catch(() => undefined);
  return next;
}

export async function clearHistory(): Promise<void> {
  await AsyncStorage.removeItem(HISTORY_KEY).catch(() => undefined);
}

// ---------------------------------------------------------------- suggestions

export interface Suggestion {
  text: string;
  kind: 'history' | 'title';
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9ঀ-৿]+/g, ' ').trim();

/** Local matches first (history, titles already seen), then Cinemeta, completing to full titles. */
export async function suggest(input: string, history: string[]): Promise<Suggestion[]> {
  const { text } = parseQuery(input);
  const q = norm(text);
  if (q.length < 2) return [];
  const words = q.split(' ');
  const last = words[words.length - 1];
  const out: Suggestion[] = [];
  const seen = new Set<string>();
  const push = (s: Suggestion) => {
    const k = norm(s.text);
    if (k && !seen.has(k) && k !== q) {
      seen.add(k);
      out.push(s);
    }
  };
  history.filter((h) => norm(h).startsWith(q)).slice(0, 3).forEach((h) => push({ text: h, kind: 'history' }));
  const local = registeredNames()
    .filter((n) => {
      const nn = norm(n);
      return nn.startsWith(q) || (words.length > 1 ? nn.includes(q) : nn.split(' ').some((w) => w.startsWith(last)));
    })
    .sort((a, b) => Number(norm(b).startsWith(q)) - Number(norm(a).startsWith(q)) || a.length - b.length)
    .slice(0, 6);
  local.forEach((n) => push({ text: n, kind: 'title' }));
  if (out.length < 6 && q.length >= 3) {
    const remote = await cinemeta.search(text).catch(() => []);
    remote.slice(0, 8).forEach((t) => push({ text: t.name, kind: 'title' }));
  }
  return out.slice(0, 8);
}
