// Vercel Edge Function. Set ALLOWED_ORIGINS (comma separated, e.g. "https://mythtube.vercel.app,*.example.com")
// in the Vercel project settings to stop other sites from using your proxy.
import { handleProxy } from '../proxy/core.js';

export const config = { runtime: 'edge' };

export default function handler(request) {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return handleProxy(request, { allowedOrigins });
}
