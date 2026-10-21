// Background verification: titles from catalogs that carry no streams of their own (Cinemeta, AniList) are checked
// with a quick source search, at most two at a time, and titles without any playable source disappear from lists.
import type { Episode, Title } from '../data/types';
import { availabilityOf, checksEnabled, loadAvailability, markAvailability } from './availabilityStore';
import { recentlyOnline } from './http';
import { getSearch } from './playback';

const queue: Title[] = [];
const queued = new Set<string>();
let running = 0;
const CONCURRENCY = 2;

/** A representative episode so a series check looks for S1E1 (anime: the mapped season). */
function sampleEpisode(t: Title): Episode | undefined {
  return t.kind === 'series' ? { id: `check:${t.id}`, season: t.tmdbSeason ?? 1, number: 1, name: 'Episode 1', runtime: t.runtime, synopsis: '' } : undefined;
}

// If most checks come back empty something systemic is wrong (outage, blocked network): stop hiding titles.
const recent: boolean[] = [];

async function verify(t: Title): Promise<void> {
  const engine = getSearch(t, sampleEpisode(t), true);
  const found = await engine.firstResult(30000);
  if (found === undefined) return;
  recent.push(found);
  if (recent.length > 10) recent.shift();
  if (found) return markAvailability(t.id, true);
  const mostlyEmpty = recent.length >= 6 && recent.filter((r) => !r).length / recent.length > 0.8;
  if (recentlyOnline() && !mostlyEmpty) markAvailability(t.id, false);
}

function pump() {
  while (running < CONCURRENCY && queue.length > 0) {
    const t = queue.shift()!;
    running++;
    verify(t)
      .catch(() => undefined)
      .finally(() => {
        running--;
        queued.delete(t.id);
        setTimeout(pump, 150);
      });
  }
}

/** Queue titles for a quick check (only those whose availability is unknown). */
export function verifyLater(titles: Title[]) {
  if (!checksEnabled()) return;
  loadAvailability().then(() => {
    for (const t of titles) {
      if (availabilityOf(t) !== 'unknown' || queued.has(t.id) || t.nsfw) continue;
      queued.add(t.id);
      queue.push(t);
    }
    pump();
  });
}

