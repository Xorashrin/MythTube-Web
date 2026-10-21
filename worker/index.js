// Cloudflare Worker (free plan: 100k requests/day, no bandwidth charge). Deploy with `npx wrangler deploy`.
// Set ALLOWED_ORIGINS as a Worker variable (comma separated) to restrict who may use it.
import { handleProxy } from '../proxy/core.js';

export default {
  fetch(request, env) {
    const allowedOrigins = String(env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return handleProxy(request, { allowedOrigins });
  },
};
