// Browser-side helpers for the CORS proxy (see proxy/core.js). API traffic (JSON, HTML, plugin scripts) goes
// through EXPO_PUBLIC_PROXY_URL (default: the Vercel Edge function at /api/proxy). Media bytes can be sent to a
// different, bandwidth-friendlier endpoint with EXPO_PUBLIC_MEDIA_PROXY (for example a Cloudflare Worker).
// Metro inlines `process.env.EXPO_PUBLIC_*` at build time.
declare const process: { env: Record<string, string | undefined> };

const clean = (v: string | undefined, fallback: string) => (v && v.trim() ? v.trim().replace(/\/$/, '') : fallback);

export const API_PROXY = clean(process.env.EXPO_PUBLIC_PROXY_URL, '/api/proxy');
export const MEDIA_PROXY = clean(process.env.EXPO_PUBLIC_MEDIA_PROXY, API_PROXY);

function encodeHeaders(headers: Record<string, string>): string {
  const json = JSON.stringify(headers);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Wraps an upstream URL so the proxy fetches it. `rewrite` makes the proxy rewrite HLS playlists (native Safari HLS). */
export function proxied(url: string, headers?: Record<string, string>, opts: { media?: boolean; rewrite?: boolean } = {}): string {
  const base = opts.media ? MEDIA_PROXY : API_PROXY;
  const h = headers && Object.keys(headers).length > 0 ? `&h=${encodeHeaders(headers)}` : '';
  return `${base}?url=${encodeURIComponent(url)}${h}${opts.rewrite ? '&rewrite=1' : ''}`;
}

/** Direct <video src> works without CORS, but not for http:// (mixed content) or when headers are required. */
export function needsProxy(url: string, headers?: Record<string, string>): boolean {
  return /^http:/i.test(url) || (!!headers && Object.keys(headers).length > 0);
}
