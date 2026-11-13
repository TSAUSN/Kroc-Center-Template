// Minimal Instance API client for one Zesty instance. Unlike the skill's
// zesty-api.mjs (one instance, read from zesty.config.json), the center sync
// talks to several instances in one run, so each gets its own client.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class ApiError extends Error {}

export function client({ id, zuid, token }) {
  if (!zuid || !token) throw new ApiError(`${id}: missing instance ZUID or token`);
  const base = `https://${zuid}.api.zesty.io/v1`;

  async function api(method, path, body) {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(`${base}/${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      // Retry rate limits and gateway hiccups; everything else is final.
      if ((res.status === 429 || res.status >= 502) && attempt < 3) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      const text = await res.text();
      let json = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        /* non-JSON error page */
      }
      if (res.status === 401) throw new ApiError(`${id}: token rejected (expired or wrong instance?)`);
      if (!res.ok || json.error) {
        const msg = json.error || json.message || text.slice(0, 200);
        const err = new ApiError(`${id}: ${method} ${path} → ${res.status} ${msg}`.trim());
        err.status = res.status;
        throw err;
      }
      return json.data;
    }
  }

  return { id, zuid, api };
}

// Run fn over items with at most `limit` in flight (keeps the API calm).
export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
