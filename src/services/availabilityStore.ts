// Remembered answers to "is there any way to play this?". Titles from catalogs that carry no streams of their own (Cinemeta, AniList)
// are checked in the background with a quick source search; titles that have none are hidden from the lists.
// Results are remembered, so each title is checked at most once every few hours.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import type { Title } from '../data/types';

type State = 'yes' | 'no';
interface Entry {
  s: State;
  at: number;
}

const KEY = 'mythtube:availability:v1';
const YES_TTL = 12 * 3600 * 1000;
const NO_TTL = 4 * 3600 * 1000;
const MAX_ENTRIES = 800;

const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();
let loaded: Promise<void> | null = null;
let version = 0;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let enabled = true;

/** Titles whose source already lists real links never need checking. */
const SELF_CONTAINED = new Set(['southfreak', 'sfadult', 'amaderftp', 'bdix', 'stremio']);

export function loadAvailability(): Promise<void> {
  loaded ??= AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (!raw) return;
      for (const [id, e] of Object.entries(JSON.parse(raw) as Record<string, Entry>)) entries.set(id, e);
      version++;
      listeners.forEach((l) => l());
    })
    .catch(() => undefined);
  return loaded;
}

function persist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const recent = [...entries.entries()].sort((a, b) => b[1].at - a[1].at).slice(0, MAX_ENTRIES);
    AsyncStorage.setItem(KEY, JSON.stringify(Object.fromEntries(recent))).catch(() => undefined);
  }, 1500);
}

export function setAvailabilityChecks(on: boolean) {
  enabled = on;
}

export function checksEnabled(): boolean {
  return enabled;
}

export function availabilityOf(t: Title): State | 'unknown' {
  if (SELF_CONTAINED.has(t.source)) return 'yes';
  const e = entries.get(t.id);
  if (!e) return 'unknown';
  if (Date.now() - e.at > (e.s === 'yes' ? YES_TTL : NO_TTL)) return 'unknown';
  return e.s;
}

/** False only when a check found no playable source. Unknown titles stay visible. */
export function isListed(t: Title): boolean {
  return availabilityOf(t) !== 'no';
}

export function markAvailability(id: string, ok: boolean) {
  const prev = entries.get(id);
  if (prev?.s === (ok ? 'yes' : 'no') && Date.now() - prev.at < 60000) return;
  entries.set(id, { s: ok ? 'yes' : 'no', at: Date.now() });
  version++;
  listeners.forEach((l) => l());
  persist();
}

/** Re-render trigger for lists that filter on availability. */
export function useAvailabilityVersion(): number {
  const [v, setV] = useState(version);
  useEffect(() => {
    loadAvailability();
    const l = () => setV(version);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return v;
}
