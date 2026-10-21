// Cloudflare Pages Function: the same proxy as api/proxy.js (Vercel) and worker/index.js, so the whole app can also
// be hosted on Cloudflare Pages. Set ALLOWED_ORIGINS in the Pages project's environment variables.
import { handleProxy } from '../../proxy/core.js';

export function onRequest(context) {
  const allowedOrigins = String(context.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return handleProxy(context.request, { allowedOrigins });
}
