// Two-level cache (memory + AsyncStorage). Feeds use stale-while-revalidate: the last good
// result is shown instantly and also serves as the fallback when every live source fails.
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Entry<T> {
  at: number;
  value: T;
}

const PREFIX = 'mythtube:cache:';
const memory = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export async function readCache<T>(key: string): Promise<Entry<T> | null> {
  const hit = memory.get(key) as Entry<T> | undefined;
  if (hit) return hit;
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Entry<T>;
    memory.set(key, entry);
    return entry;
  } catch {
    return null;
  }
}

export async function writeCache<T>(key: string, value: T, persist = true): Promise<void> {
  const entry = { at: Date.now(), value };
  memory.set(key, entry);
  if (persist) await AsyncStorage.setItem(PREFIX + key, JSON.stringify(entry)).catch(() => undefined);
}

export interface CachedOptions {
  /** Fresh for this long (ms); older entries trigger a refetch. */
  ttl: number;
  /** Persist to AsyncStorage (default true). */
  persist?: boolean;
  /** Ignore the cache and refetch. */
  force?: boolean;
}

/**
 * Returns a fresh cached value, otherwise fetches. Concurrent callers share one in-flight request.
 * When the fetch fails or returns nothing, the last stored value (any age) is returned instead.
 */
export async function cached<T>(key: string, opts: CachedOptions, fetcher: () => Promise<T>): Promise<T> {
  const entry = await readCache<T>(key);
  if (!opts.force && entry && Date.now() - entry.at < opts.ttl) return entry.value;
  const running = inflight.get(key) as Promise<T> | undefined;
  if (running) return running;
  const job = (async () => {
    try {
      const value = await fetcher();
      const empty = Array.isArray(value) && value.length === 0;
      if (empty && entry) return entry.value;
      if (!empty) await writeCache(key, value, opts.persist ?? true);
      return value;
    } catch (e) {
      if (entry) return entry.value;
      throw e;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, job);
  return job;
}

export async function clearPersistentCache(): Promise<void> {
  memory.clear();
  try {
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith(PREFIX)));
  } catch {
    // nothing to clear
  }
}
