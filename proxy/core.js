// Shared CORS / header proxy used by the Vercel Edge function (api/proxy.js) and the Cloudflare Worker (worker/index.js).
//
//   GET /api/proxy?url=<https://upstream/…>&h=<base64url JSON headers>[&rewrite=1]
//
// Browsers cannot call most of the movie sources directly (no CORS, mixed http/https content, headers such as
// Referer that scripts may not set). The proxy fetches the upstream URL server-side, forwards Range requests so
// seeking works, and returns the bytes with CORS headers. HLS playlists are rewritten when `rewrite=1` so that
// players without hls.js (iPhone Safari before iOS 17.1) can follow the segment URLs through the proxy as well.

const BLOCKED_HOST = /^(localhost|.*\.local|.*\.internal|metadata\.google\.internal)$/i;
const PRIVATE_V4 = /^(0\.|10\.|127\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/;
// POST is only forwarded to hosts that need it (AniList GraphQL); everything else is read-only.
const POST_HOSTS = new Set(['graphql.anilist.co']);
const FORWARD_REQUEST_HEADERS = ['range', 'if-range', 'if-none-match', 'if-modified-since', 'accept', 'accept-language'];
const FORWARD_RESPONSE_HEADERS = [
  'content-type',
  'content-length',
  'content-range',
  'accept-ranges',
  'etag',
  'last-modified',
  'content-disposition',
];
const DEFAULT_UA =
  'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

function decodeHeaders(raw) {
  if (!raw) return {};
  try {
    const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(escape(atob(b64)));
    const parsed = JSON.parse(json);
    const out = {};
    for (const [k, v] of Object.entries(parsed)) {
      const name = k.toLowerCase();
      // Never let a page set hop-by-hop, cookie or origin-identifying headers upstream.
      if (typeof v !== 'string' || /^(host|connection|content-length|cookie|set-cookie|transfer-encoding|upgrade|proxy-.*|sec-.*)$/.test(name)) continue;
      out[name] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function encodeHeaders(headers) {
  const json = JSON.stringify(headers);
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function isBlocked(target) {
  if (!/^https?:$/.test(target.protocol)) return true;
  const host = target.hostname.replace(/^\[|\]$/g, '');
  if (BLOCKED_HOST.test(host)) return true;
  if (PRIVATE_V4.test(host)) return true;
  if (/^(::1?|f[cd][0-9a-f]{2}:|fe80:)/i.test(host)) return true; // IPv6 loopback / unique-local / link-local
  return false;
}

function allowedOrigin(request, allowList) {
  const origin = request.headers.get('origin') || '';
  const referer = request.headers.get('referer') || '';
  const seen = origin || (referer ? new URL(referer).origin : '');
  if (allowList.length === 0) return origin || '*';
  if (!seen) return null; // direct hits from tools without an origin are refused when an allow-list is set
  return allowList.some((a) => a === seen || (a.startsWith('*.') && new URL(seen).hostname.endsWith(a.slice(1)))) ? seen : null;
}

function corsHeaders(origin) {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, HEAD, POST, OPTIONS',
    'access-control-allow-headers': 'range, if-range, content-type, accept, x-requested-with',
    'access-control-expose-headers': 'content-length, content-range, accept-ranges, content-type, x-final-url, x-upstream-status',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}

function rewritePlaylist(text, baseUrl, selfUrl, headerParam) {
  const wrap = (uri) => {
    const abs = new URL(uri, baseUrl).href;
    const u = new URL(selfUrl);
    u.search = `?url=${encodeURIComponent(abs)}${headerParam ? `&h=${headerParam}` : ''}&rewrite=1`;
    return u.href;
  };
  return text
    .split(/\r?\n/)
    .map((line) => {
      if (!line.trim()) return line;
      if (line.startsWith('#')) return line.replace(/URI="([^"]+)"/g, (_, uri) => `URI="${wrap(uri)}"`);
      return wrap(line.trim());
    })
    .join('\n');
}

/**
 * @param {Request} request
 * @param {{ allowedOrigins?: string[], selfUrl?: string }} options
 */
export async function handleProxy(request, options = {}) {
  const allowList = options.allowedOrigins ?? [];
  const origin = allowedOrigin(request, allowList);
  if (origin === null) return new Response('Origin not allowed', { status: 403 });
  const cors = corsHeaders(origin);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!['GET', 'HEAD', 'POST'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers: cors });

  const self = new URL(request.url);
  const raw = self.searchParams.get('url');
  if (!raw) return new Response('Missing url', { status: 400, headers: cors });
  let target;
  try {
    target = new URL(raw);
  } catch {
    return new Response('Invalid url', { status: 400, headers: cors });
  }
  if (isBlocked(target)) return new Response('Blocked target', { status: 403, headers: cors });
  // POST goes to AniList always; to any other public host only when an origin allow-list protects the proxy (plugin requests).
  if (request.method === 'POST' && !POST_HOSTS.has(target.hostname) && allowList.length === 0) return new Response('Method not allowed for this host', { status: 405, headers: cors });

  const headerParam = self.searchParams.get('h') || '';
  const upstreamHeaders = new Headers({ 'user-agent': DEFAULT_UA, accept: '*/*' });
  for (const name of FORWARD_REQUEST_HEADERS) {
    const v = request.headers.get(name);
    if (v) upstreamHeaders.set(name, v);
  }
  for (const [k, v] of Object.entries(decodeHeaders(headerParam))) upstreamHeaders.set(k, v);
  if (request.method === 'POST') upstreamHeaders.set('content-type', request.headers.get('content-type') || 'application/json');

  let upstream;
  try {
    upstream = await fetch(target.href, {
      method: request.method,
      headers: upstreamHeaders,
      body: request.method === 'POST' ? await request.arrayBuffer() : undefined,
      redirect: 'follow',
    });
  } catch (e) {
    return new Response(`Upstream unreachable: ${e instanceof Error ? e.message : 'error'}`, { status: 502, headers: cors });
  }

  const headers = new Headers(cors);
  for (const name of FORWARD_RESPONSE_HEADERS) {
    const v = upstream.headers.get(name);
    if (v) headers.set(name, v);
  }
  headers.set('x-final-url', upstream.url || target.href);
  headers.set('x-upstream-status', String(upstream.status));

  const type = (upstream.headers.get('content-type') || '').toLowerCase();
  const isPlaylist = /mpegurl/.test(type) || /\.m3u8(\?|$)/i.test(target.pathname + target.search);
  if (isPlaylist && self.searchParams.get('rewrite') === '1' && upstream.ok) {
    const text = await upstream.text();
    if (text.includes('#EXTM3U')) {
      headers.delete('content-length');
      headers.set('content-type', 'application/vnd.apple.mpegurl');
      headers.set('cache-control', 'no-store');
      return new Response(rewritePlaylist(text, upstream.url || target.href, options.selfUrl || `${self.origin}${self.pathname}`, headerParam), { status: 200, headers });
    }
    return new Response(text, { status: upstream.status, headers });
  }

  // Playlists, scripts and pages can be cached briefly; media bytes are streamed through untouched.
  if (isPlaylist) headers.set('cache-control', 'no-store');
  else if (/json|html|javascript|text/.test(type)) headers.set('cache-control', 'public, max-age=300');
  else headers.set('cache-control', 'public, max-age=3600');

  // A response status of 206 must be preserved so <video> can seek.
  return new Response(request.method === 'HEAD' ? null : upstream.body, { status: upstream.status, headers });
}

export { encodeHeaders };
