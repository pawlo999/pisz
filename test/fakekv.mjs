// An in-memory stand-in for Cloudflare KV, enough for the sync worker.
export function fakeKV() {
  const m = new Map();
  return { m, get: async (k, type) => (m.has(k) ? (type === 'json' ? JSON.parse(m.get(k)) : m.get(k)) : null),
           put: async (k, v) => { m.set(k, v); } };
}
