// BDIX / FTP movie servers (Bangladesh). Most answer only from Bangladeshi ISPs, so every request
// uses a short timeout and the per-host circuit breaker keeps unreachable servers from slowing anything.
import { tintFor, type Title } from '../../data/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { cached } from '../cache';
import { decodeEntities, getJson, getText, hostAvailable, hostOf, mapLimit, withTimeout } from '../http';

export interface FtpServer {
  id: string;
  name: string;
  type: 'index' | 'circle';
  base: string;
  /** Sub-paths to search first (movie folders). */
  paths?: string[];
}

/** Public servers from docs/BACKEND.md (doc 06). Private-range hosts stay in the list: they work on that ISP's LAN. */
/** Mutable: remote config can add or drop servers without an app update. */
export const BDIX_SERVERS: FtpServer[] = [
  { id: 'circle', name: 'CircleFTP', type: 'circle', base: 'http://new.circleftp.net:5000' },
  { id: 'ftpbd', name: 'FTPBD', type: 'index', base: 'http://media.ftpbd.net' },
  { id: 'samftp', name: 'SamFTP', type: 'index', base: 'https://samftp.com' },
  { id: 'discovery', name: 'Discovery FTP', type: 'index', base: 'http://movies.discoveryftp.net' },
  { id: 'khulnaflix', name: 'Khulnaflix', type: 'index', base: 'http://khulnaflix.net' },
  { id: 'naturalbd', name: 'NaturalBD', type: 'index', base: 'http://www.naturalbd.com' },
  { id: 'ctgmovies', name: 'CTG Movies', type: 'index', base: 'http://ctgmovies.com' },
  { id: 'showtime', name: 'Showtime BD', type: 'index', base: 'http://showtimebd.com' },
  { id: 'dflix', name: 'Dflix', type: 'index', base: 'http://fs1.dflix.live' },
  { id: 'timepass', name: 'TimepassBD', type: 'index', base: 'http://www.timepassbd.live' },
  { id: 'ihub', name: 'iHub', type: 'index', base: 'http://ihub.live' },
  { id: 'moviehaat', name: 'MovieHaat', type: 'index', base: 'http://moviehaat.net' },
  { id: 'ebox', name: 'E-Box', type: 'index', base: 'http://fileserver.ebox.live', paths: ['/movies/'] },
  { id: 'dnet', name: 'D-Net', type: 'index', base: 'https://dnetdrive.com' },
  { id: 'c1', name: 'Cloudone', type: 'index', base: 'http://www.c1movies.com' },
  { id: 'bdmovies', name: 'BDMovies', type: 'index', base: 'http://bdmovies.net' },
  { id: 'moviemela', name: 'Moviemela', type: 'index', base: 'http://www.moviemela.live' },
  { id: 'pollyflix', name: 'Pollyflix', type: 'index', base: 'http://pollyflix.com' },
  { id: 'amrbd', name: 'AmrBD', type: 'index', base: 'http://fs.amrbd.com' },
  { id: 'khulnaflix2', name: 'Khulnaflix Files', type: 'index', base: 'https://file.khulnaflix.net' },
  { id: 'bdflix', name: 'BDFlix Live', type: 'index', base: 'https://bdflixlive.com' },
  { id: 'mojar', name: 'MojarFTP', type: 'index', base: 'https://www.mojarftp.com' },
  { id: 'bolmovies', name: 'BolMovies', type: 'index', base: 'https://www.bolmovies.com' },
  { id: 'timepass2', name: 'TimepassBD (com)', type: 'index', base: 'https://timepassbd.com' },
  { id: 'moviebazar', name: 'MyMovieBazar', type: 'index', base: 'https://mymoviebazar.com' },
  { id: 'pandaclub', name: 'PandaClub', type: 'index', base: 'https://pandaclubbd.com' },
  { id: 'dhakaftp', name: 'DhakaFTP', type: 'index', base: 'https://dhakaftp.com' },
  { id: 'cinemacity', name: 'CinemaCity', type: 'index', base: 'https://cinemacity.live' },
  { id: 'ftpcombd', name: 'FTP.com.bd', type: 'index', base: 'https://ftp.com.bd' },
  { id: 'abcmovies', name: 'ABC Movies', type: 'index', base: 'https://abcmoviesbd.com' },
  { id: 'ctgoz', name: 'CTGOZ', type: 'index', base: 'https://ctgoz.com' },
  { id: 'roar', name: 'RoarMediaZone', type: 'index', base: 'https://roarmediazone.com' },
  { id: 'movieboxbd', name: 'MovieBoxBD', type: 'index', base: 'https://movieboxbd.com' },
  { id: 'sunplex', name: 'SunPlex', type: 'index', base: 'http://sunplex.net' },
  { id: 'abcflixbdcom', name: 'Abcflixbd', type: 'index', base: 'http://abcflixbd.com' },
  { id: 'aliflailabdcom', name: 'Aliflailabd', type: 'index', base: 'http://aliflailabd.com' },
  { id: 'asianftpcom', name: 'Asianftp', type: 'index', base: 'http://asianftp.com' },
  { id: 'candybdnet', name: 'Candybd', type: 'index', base: 'http://candybd.net' },
  { id: 'cdnroarmediazo', name: 'Cdn Roarmediazone', type: 'index', base: 'http://cdn.roarmediazone.com' },
  { id: 'circleftpnet', name: 'Circleftp', type: 'index', base: 'http://circleftp.net' },
  { id: 'crazyctgcom', name: 'Crazyctg', type: 'index', base: 'http://crazyctg.com' },
  { id: 'filetajpatacom', name: 'File Tajpata', type: 'index', base: 'http://file.tajpata.com' },
  { id: 'fileaddressebo', name: 'Fileaddress Ebox', type: 'index', base: 'http://fileaddress.ebox.live' },
  { id: 'fsrangdhanuliv', name: 'Fs Rangdhanu', type: 'index', base: 'http://fs.rangdhanu.live' },
  { id: 'ftp1aliflailab', name: 'Ftp1 Aliflailabd', type: 'index', base: 'http://ftp1.aliflailabd.com' },
  { id: 'ftpbdnet', name: 'Ftpbd', type: 'index', base: 'http://ftpbd.net' },
  { id: 'khulnaplexnet', name: 'Khulnaplex', type: 'index', base: 'http://khulnaplex.net' },
  { id: 'mathanostotop', name: 'Mathanosto', type: 'index', base: 'http://mathanosto.top' },
  { id: 'mediadfnbdnet', name: 'Media Dfnbd', type: 'index', base: 'http://media.dfnbd.net' },
  { id: 'medianetmatrix', name: 'Media Netmatrixbd', type: 'index', base: 'http://media.netmatrixbd.com' },
  { id: 'medialink24net', name: 'Medialink24', type: 'index', base: 'http://medialink24.net' },
  { id: 'mojalossnet', name: 'Mojaloss', type: 'index', base: 'http://mojaloss.net' },
  { id: 'mybdplexcom', name: 'Mybdplex', type: 'index', base: 'http://mybdplex.com' },
  { id: 'nagordolacombd', name: 'Nagordola', type: 'index', base: 'http://nagordola.com.bd' },
  { id: 'quickonlineftp', name: 'Quickonlineftp', type: 'index', base: 'http://quickonlineftp.com' },
  { id: 'vdomelacom', name: 'Vdomela', type: 'index', base: 'http://vdomela.com' },
  { id: 'beeflixbiz', name: 'Beeflix', type: 'index', base: 'http://www.beeflix.biz' },
  { id: 'cinebioscopeco', name: 'Cinebioscope', type: 'index', base: 'http://www.cinebioscope.com' },
  { id: 'kalponiknetbd', name: 'Kalponik', type: 'index', base: 'http://www.kalponik.net.bd' },
  { id: 'movieaddressne', name: 'Movieaddress', type: 'index', base: 'http://www.movieaddress.net' },
  { id: 'bdlannet', name: 'Bdlan', type: 'index', base: 'https://bdlan.net' },
  { id: 'bongobdcom', name: 'Bongobd', type: 'index', base: 'https://bongobd.com' },
  { id: 'elaachcom', name: 'Elaach', type: 'index', base: 'https://elaach.com' },
  { id: 'infolinkbdcom', name: 'Infolinkbd', type: 'index', base: 'https://infolinkbd.com' },
  { id: 'roarzoneinfo', name: 'Roarzone', type: 'index', base: 'https://roarzone.info' },
  { id: 'tajpatacom', name: 'Tajpata', type: 'index', base: 'https://tajpata.com' },
  { id: 'dotinternetbdc', name: 'Dotinternetbd', type: 'index', base: 'https://www.dotinternetbd.com' },
  { id: 'mazedanetworks', name: 'Mazedanetworks', type: 'index', base: 'https://www.mazedanetworks.net' },
  { id: 'netathomebdcom', name: 'Netathomebd', type: 'index', base: 'https://www.netathomebd.com' },
  { id: '1031131646', name: '103.113.16.46', type: 'index', base: 'http://103.113.16.46' },
  { id: '1031352082', name: '103.135.208.2', type: 'index', base: 'http://103.135.208.2' },
  { id: '10322220150', name: '103.222.20.150', type: 'index', base: 'http://103.222.20.150' },
  { id: '1032259427', name: '103.225.94.27', type: 'index', base: 'http://103.225.94.27', paths: ['/mediaserver/'] },
  { id: '10385235254', name: '103.85.235.254', type: 'index', base: 'http://103.85.235.254' },
  { id: '1038721246', name: '103.87.212.46', type: 'index', base: 'http://103.87.212.46' },
  { id: '16212215254', name: '162.12.215.254', type: 'index', base: 'http://162.12.215.254' },
  { id: '20383177225', name: '203.83.177.225', type: 'index', base: 'http://203.83.177.225' },
  { id: '17216504', name: '172.16.50.4', type: 'index', base: 'http://172.16.50.4' },
  { id: '17216507', name: '172.16.50.7', type: 'index', base: 'http://172.16.50.7' },
  { id: '172272783', name: '172.27.27.83', type: 'index', base: 'http://172.27.27.83' },
  { id: '1722222100', name: '172.22.22.100', type: 'index', base: 'http://172.22.22.100' },
  { id: '1016100244', name: '10.16.100.244', type: 'index', base: 'http://10.16.100.244' },
  { id: '202496121', name: '202.4.96.121', type: 'index', base: 'http://202.4.96.121' },
  { id: '11817922351', name: '118.179.223.51', type: 'index', base: 'http://118.179.223.51' },
  { id: '103153175254', name: '103.153.175.254', type: 'index', base: 'http://103.153.175.254' },
  { id: '1034314868', name: '103.43.148.68', type: 'index', base: 'http://103.43.148.68' },
  { id: '10377252113', name: '103.77.252.113', type: 'index', base: 'http://103.77.252.113' },
  { id: '10320036250', name: '103.200.36.250', type: 'index', base: 'http://103.200.36.250' },
  { id: '10320424470', name: '103.204.244.70', type: 'index', base: 'http://103.204.244.70' },
  { id: '59152101198', name: '59.152.101.198', type: 'index', base: 'http://59.152.101.198' },
  { id: '10349168107', name: '103.49.168.107', type: 'index', base: 'http://103.49.168.107' },
  { id: '10310623874', name: '103.106.238.74', type: 'index', base: 'http://103.106.238.74' },
  { id: '1037619690', name: '103.76.196.90', type: 'index', base: 'http://103.76.196.90' },
  { id: '12112', name: '12.1.1.2', type: 'index', base: 'http://12.1.1.2' },
  { id: '15111', name: '15.1.1.1', type: 'index', base: 'http://15.1.1.1' },
  { id: '1610100244', name: '16.10.100.244', type: 'index', base: 'http://16.10.100.244' },
  { id: 'dhaka14', name: 'DhakaFlix 14', type: 'index', base: 'http://172.16.50.14', paths: ['/DHAKA-FLIX-14/English%20Movies%20(1080p)/', '/DHAKA-FLIX-14/Hindi%20Movies/', '/DHAKA-FLIX-14/SOUTH%20INDIAN%20MOVIES/Hindi%20Dubbed/', '/DHAKA-FLIX-14/Animation%20Movies%20(1080p)/'] },
  { id: 'dhaka12', name: 'DhakaFlix 12', type: 'index', base: 'http://172.16.50.12', paths: ['/DHAKA-FLIX-12/TV-WEB-Series/'] },
];

const MEDIA = /\.(mkv|mp4|avi|webm|m4v)$/i;
const SKIP_NAME = /sample|trailer|\bextras?\b|behind the scenes|subs?$/i;
const STEP_TIMEOUT = 6000;

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

const norm = (s: string) => safeDecode(s).toLowerCase().replace(/[._\-()[\]]+/g, ' ').replace(/[^a-z0-9 ]+/g, '').replace(/\s+/g, ' ').trim();

function matches(name: string, tokens: string[]): boolean {
  const n = norm(name);
  return tokens.every((t) => n.includes(t));
}

interface Entry {
  href: string;
  name: string;
  dir: boolean;
}

function parseIndex(html: string, pageUrl: string): Entry[] {
  const out: Entry[] = [];
  const dirUrl = pageUrl.endsWith('/') ? pageUrl : pageUrl.replace(/[^/]*$/, '');
  for (const m of html.matchAll(/<a\s[^>]*href="([^"?#]+)"[^>]*>([^<]*)</gi)) {
    const href = decodeEntities(m[1]);
    if (href.startsWith('.') || /^(mailto|javascript):/i.test(href) || /parent directory/i.test(m[2])) continue;
    let abs: string;
    try {
      abs = new URL(href, pageUrl).href;
    } catch {
      continue;
    }
    // Only children of this folder: skips the parent link, sort links and external ads.
    if (!abs.startsWith(dirUrl) || abs === pageUrl || abs === dirUrl) continue;
    const name = decodeEntities(m[2]).trim() || safeDecode(href.replace(/\/$/, '').split('/').pop() ?? '');
    if (!name) continue;
    out.push({ href: abs, name, dir: abs.endsWith('/') });
  }
  return out;
}

async function crawl(server: FtpServer, tokens: string[], deadline: number): Promise<{ url: string; label: string }[]> {
  const found: { url: string; label: string }[] = [];
  let reached = false;
  const roots = (server.paths ?? ['/']).map((p) => server.base.replace(/\/$/, '') + p);
  const queue: { url: string; depth: number; matched: boolean }[] = roots.map((url) => ({ url, depth: 0, matched: false }));
  while (queue.length > 0 && Date.now() < deadline && found.length < 12) {
    const { url, depth, matched } = queue.shift()!;
    let html: string;
    try {
      html = await withTimeout(getText(url, { timeout: STEP_TIMEOUT, retries: 0 }), STEP_TIMEOUT + 500, 'index');
    } catch {
      continue;
    }
    reached = true;
    for (const e of parseIndex(html, url)) {
      if (SKIP_NAME.test(e.name)) continue;
      if (e.dir) {
        const hit = matches(e.name, tokens);
        // Follow folders that match the title; browse one level of un-matched folders from the root (A-Z / year / category layouts).
        if (hit && depth < 3) queue.unshift({ url: e.href, depth: depth + 1, matched: true });
        else if (!matched && depth < 1) queue.push({ url: e.href, depth: depth + 1, matched: false });
      } else if (MEDIA.test(e.name) && (matched || matches(e.name, tokens))) {
        found.push({ url: e.href, label: safeDecode(e.name) });
      }
    }
  }
  if (!reached) throw new Error('unreachable');
  return found;
}

const DIRECTORY_URL = 'https://bdix.app/servers';

/** Movie servers listed on bdix.app (names, IPs and domains), refreshed daily. */
async function directoryServers(): Promise<FtpServer[]> {
  try {
    return await cached('bdix:directory', { ttl: 24 * 3600 * 1000 }, async () => {
      const out: FtpServer[] = [];
      // ftpserverbd.com: curated movie servers (updated monthly).
      try {
        const page = await getText('https://ftpserverbd.com/ftp-movie-server', { timeout: 12000, retries: 1 });
        const seenHosts = new Set<string>();
        for (const m of page.matchAll(/https?:\/\/[^\s"'<>)]+/g)) {
          const url = m[0].replace(/[.,;]+$/, '');
          const host = hostOf(url);
          if (!host || seenHosts.has(host) || /ftpserverbd|google|facebook|youtube|w3\.org|cloudflare|twitter|schema|gstatic|jsdelivr|bdix\.app|wa\.me|t\.me|linkedin|profitableratecpmnetwork/.test(host) || /\.(js|css|png|jpg|svg|ico)(\?|$)/.test(url)) continue;
          seenHosts.add(host);
          out.push({ id: `fsb:${host}`, name: host.replace(/^www\./, ''), type: 'index', base: url.replace(/\/$/, '') });
        }
      } catch {
        // the other directory may still work
      }
      const html = await getText(DIRECTORY_URL, { timeout: 12000, retries: 1 }).catch(() => '');
      for (const row of html.match(/<tr>[\s\S]*?<\/tr>/g) ?? []) {
        const cell = (label: string) => {
          const m = new RegExp(`data-label="${label}"[^>]*>([\\s\\S]*?)</td>`).exec(row);
          return m ? decodeEntities(m[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim() : '';
        };
        const name = (/<a[^>]*>([^<]+)<\/a>/.exec(row)?.[1] ?? '').trim();
        const addr = cell('IP / Domain').split(' ')[0];
        const content = cell('Content');
        if (!name || !addr || !/movie|mixed|media|tv/i.test(content)) continue;
        out.push({ id: `dir:${addr}`, name, type: 'index', base: /^https?:/.test(addr) ? addr : `http://${addr}` });
      }
      return out;
    });
  } catch {
    return [];
  }
}

interface Reach {
  ok: number;
  fail: number;
  at: number;
}

const REACH_KEY = 'mythtube:bdix:reach:v1';
let reach: Record<string, Reach> | null = null;

async function readReach(): Promise<Record<string, Reach>> {
  if (reach) return reach;
  try {
    reach = JSON.parse((await AsyncStorage.getItem(REACH_KEY)) ?? '{}') as Record<string, Reach>;
  } catch {
    reach = {};
  }
  return reach;
}

function noteReach(host: string, ok: boolean) {
  const r = (reach ??= {});
  const cur = r[host] ?? { ok: 0, fail: 0, at: 0 };
  if (ok) cur.ok++;
  else cur.fail++;
  cur.at = Date.now();
  r[host] = cur;
}

async function saveReach() {
  if (reach) await AsyncStorage.setItem(REACH_KEY, JSON.stringify(reach)).catch(() => undefined);
}

/** Servers that never answered on this network are skipped for 12 h; servers that did are tried first. */
async function orderByReach(servers: FtpServer[]): Promise<FtpServer[]> {
  const r = await readReach();
  const now = Date.now();
  const usable = servers.filter((s) => {
    const h = r[hostOf(s.base)];
    return !h || h.ok > 0 || h.fail < 3 || now - h.at > 12 * 3600 * 1000;
  });
  return usable.sort((a, b) => (r[hostOf(b.base)]?.ok ?? 0) - (r[hostOf(a.base)]?.ok ?? 0));
}

async function allServers(): Promise<FtpServer[]> {
  const known = new Set(BDIX_SERVERS.map((s) => hostOf(s.base)));
  const extra = (await directoryServers()).filter((s) => !known.has(hostOf(s.base)));
  return orderByReach([...BDIX_SERVERS, ...extra]);
}

/** Search every server (12 at a time); each is capped by the shared time budget. */
export async function search(query: string, budgetMs = 9000): Promise<{ server: FtpServer; files: { url: string; label: string }[] }[]> {
  const tokens = norm(query).split(' ').filter((t) => t.length > 1);
  if (tokens.length === 0) return [];
  const deadline = Date.now() + budgetMs;
  const servers = (await allServers()).filter((s) => hostAvailable(s.base));
  const hits = await mapLimit(servers, 12, async (server) => {
    try {
      if (Date.now() > deadline) return null;
      const files = server.type === 'circle' ? await searchCircle(server, query) : await crawl(server, tokens, deadline);
      noteReach(hostOf(server.base), true);
      return files.length > 0 ? { server, files } : null;
    } catch {
      noteReach(hostOf(server.base), false);
      return null;
    }
  });
  saveReach();
  return hits.filter((h): h is { server: FtpServer; files: { url: string; label: string }[] } => h !== null);
}

/** CircleFTP JSON API: posts → details → episode links ("ttp://" is sometimes written for "http://"). */
async function searchCircle(server: FtpServer, query: string): Promise<{ url: string; label: string }[]> {
  const list = await getJson<{ posts?: { id: number; title?: string; name?: string }[] } | { id: number; title?: string; name?: string }[]>(
    `${server.base}/api/posts?searchTerm=${encodeURIComponent(query)}&order=desc`,
    { timeout: STEP_TIMEOUT, retries: 0 },
  );
  const posts = Array.isArray(list) ? list : (list.posts ?? []);
  const tokens = norm(query).split(' ');
  const out: { url: string; label: string }[] = [];
  for (const post of posts.slice(0, 4)) {
    if (!matches(post.title ?? post.name ?? '', tokens)) continue;
    const detail = await getJson<unknown>(`${server.base}/api/posts/${post.id}`, { timeout: STEP_TIMEOUT, retries: 0 }).catch(() => null);
    walk(detail, (s) => {
      const fixed = s.startsWith('ttp') ? `h${s}` : s;
      if (/^https?:\/\//i.test(fixed) && MEDIA.test(fixed.split('?')[0])) out.push({ url: fixed, label: safeDecode(fixed.split('/').pop() ?? post.title ?? 'file') });
    });
  }
  return out;
}

function walk(node: unknown, visit: (s: string) => void) {
  if (typeof node === 'string') visit(node);
  else if (Array.isArray(node)) node.forEach((n) => walk(n, visit));
  else if (node && typeof node === 'object') Object.values(node).forEach((n) => walk(n, visit));
}

export function filesToTitle(name: string, year: number, files: { url: string; label: string }[], serverName: string): Title {
  const id = `bx:${norm(name).replace(/ /g, '-')}-${year}`;
  return {
    id, source: 'bdix', ref: id, name, kind: 'movie', year, maturity: '13+', runtime: 0, seasons: [], genres: [], synopsis: `Direct files on ${serverName}.`,
    cast: [], creators: [], tint: tintFor(id), quality: [...new Set(files.map((f) => /(2160p|1080p|720p|480p)/i.exec(f.label)?.[1].toUpperCase() ?? 'HD'))], files, detailed: true,
  };
}
