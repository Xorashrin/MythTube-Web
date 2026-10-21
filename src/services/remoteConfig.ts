// Source list that updates without an app update. On every start the cached copy is applied at once and a
// fresh copy of config/sources.json (from this repository) is fetched in the background, so new plugin
// repositories, new BDIX servers and kill-switches for bad providers reach every install within hours.
import { cached } from './cache';
import { getJson } from './http';
import { setDisabled } from './nuvio/disabled';
import { loadProviders, prefetchScripts, rankProviders } from './nuvio/runtime';
import { NUVIO_REPOS, type NuvioRepo } from './nuvio/repos';
import { BDIX_SERVERS, type FtpServer } from './sources/bdix';

const CONFIG_URL = 'https://raw.githubusercontent.com/Xorashrin/MythTube/main/config/sources.json';
const CONFIG_TTL = 3 * 3600 * 1000;

export interface RemoteConfig {
  version: number;
  nuvioRepos?: NuvioRepo[];
  disabledRepos?: string[];
  disabledProviders?: string[];
  bdixServers?: FtpServer[];
  disabledBdix?: string[];
}

function apply(cfg: RemoteConfig) {
  setDisabled(cfg.disabledProviders, cfg.disabledRepos);
  for (const repo of cfg.nuvioRepos ?? []) {
    if (!repo.id || !repo.base) continue;
    const i = NUVIO_REPOS.findIndex((r) => r.id === repo.id);
    if (i >= 0) NUVIO_REPOS[i] = { ...NUVIO_REPOS[i], ...repo };
    else NUVIO_REPOS.push(repo);
  }
  for (const server of cfg.bdixServers ?? []) {
    if (!server.id || !server.base) continue;
    const i = BDIX_SERVERS.findIndex((s) => s.id === server.id);
    if (i >= 0) BDIX_SERVERS[i] = { ...BDIX_SERVERS[i], ...server };
    else BDIX_SERVERS.push(server);
  }
  if (cfg.disabledBdix?.length) {
    const drop = new Set(cfg.disabledBdix);
    for (let i = BDIX_SERVERS.length - 1; i >= 0; i--) if (drop.has(BDIX_SERVERS[i].id)) BDIX_SERVERS.splice(i, 1);
  }
}

let started = false;

/** Call once at startup; never throws and never blocks the UI. */
export async function initRemoteConfig(): Promise<void> {
  if (started) return;
  started = true;
  try {
    // 1. Whatever we had last time, instantly.
    const cachedCfg = await cached<RemoteConfig | null>('remote-config', { ttl: Infinity }, async () => null).catch(() => null);
    if (cachedCfg) apply(cachedCfg);
    // 2. A fresh copy, in the background.
    const fresh = await cached<RemoteConfig>('remote-config', { ttl: CONFIG_TTL, force: true }, () => getJson<RemoteConfig>(CONFIG_URL, { timeout: 8000, retries: 1 }));
    if (fresh) apply(fresh);
  } catch {
    // offline or the file is unreachable: bundled defaults stay in effect
  }
  warmSources();
}

/** Loads every manifest and downloads the best-ranked plugin scripts so the first Play is fast. */
export function warmSources() {
  setTimeout(async () => {
    try {
      const [movie, tv] = await Promise.all([loadProviders('movie'), loadProviders('tv')]);
      const ranked = await rankProviders([...new Map([...movie, ...tv].map((p) => [p.key, p])).values()], []);
      await prefetchScripts(ranked.slice(0, 12));
    } catch {
      // warming is best-effort
    }
  }, 2500);
}
