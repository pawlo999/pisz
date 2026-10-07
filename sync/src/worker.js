/**
 * Pisz sync.
 *
 * One JSON blob per family, stored under an unguessable key that doubles as
 * the credential — there is no login, because a four-year-old is the user
 * and the payload is letter practice. The same design as Litery's worker.
 *
 * It MERGES rather than overwrites: every device posts its whole log, the
 * server keeps the union and hands it back, so neither device is
 * authoritative and neither can erase the other by being opened at the
 * wrong moment. What she knows is rebuilt from the log on the device.
 *
 * It shares Litery's KV namespace, under "pisz:", so one key pasted into
 * both apps keeps two separate records that can never touch each other.
 *
 * It also keeps the letter sounds a parent records (record.html): one short
 * WAV per letter per language, which both apps play before "jak sowa".
 *   GET /a/<key>                  which letters exist, with when recorded
 *   GET /a/<key>/<lang>/<letter>  the sound
 *   PUT /a/<key>/<lang>/<letter>  a new sound replaces the old one
 */

const PREFIX = 'pisz:';
const MAX_ROW = 20000;          // bytes; a drawing is ~100-900
const MAX_ROWS = 100000;        // years of play; refuses runaway posts
const MAX_SOUND = 200000;       // bytes; a recorded letter is 10-60 KB
const LETTERS = {
  pl: 'a ą b c ć d e ę f g h i j k l ł m n ń o ó p r s ś t u w y z ź ż',
  nb: 'a b c d e f g h i j k l m n o p r s t u v w y z æ ø å',
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Max-Age': '86400',
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS },
  });

/* the same identity the app uses: when, what kind, which glyph */
export const rowKey = r => `${r.t}|${r.k || r.st || ''}|${r.g || r.x || ''}`;

export function mergeLogs(a = [], b = []) {
  const by = new Map(), out = [];
  for (const r of [...a, ...b]) {
    if (!r || typeof r !== 'object' || typeof r.t !== 'number') continue;
    if (JSON.stringify(r).length > MAX_ROW) continue;
    const k = rowKey(r), have = by.get(k);
    if (have) { if (!have.s && r.s) have.s = r.s; continue; }   // keep the drawing if either copy has it
    by.set(k, r); out.push(r);
  }
  return out.sort((x, y) => x.t - y.t);
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const path = new URL(request.url).pathname.split('/').filter(Boolean).map(decodeURIComponent);
    if (path[0] === 'a') return sound(request, env, path);
    if (path[0] !== 's' || !path[1] || path[1].length < 16) return json({ error: 'bad key' }, 404);
    const key = PREFIX + path[1];

    const stored = await env.STORE.get(key, 'json');
    const state = stored || { log: [], settings: {}, name: '', updated: 0 };

    if (request.method === 'GET') return json(state);
    if (request.method !== 'POST') return json({ error: 'method' }, 405);

    let body;
    try { body = await request.json(); }
    catch { return json({ error: 'not json' }, 400); }
    if (!body || typeof body !== 'object' || !Array.isArray(body.log)) return json({ error: 'not a payload' }, 400);

    const log = mergeLogs(state.log, body.log);
    if (log.length > MAX_ROWS) return json({ error: 'too many rows' }, 413);

    const next = {
      log,
      settings: body.settings && typeof body.settings === 'object' && Object.keys(body.settings).length ? body.settings : state.settings,
      name: typeof body.name === 'string' && body.name ? body.name.slice(0, 24) : state.name,
      updated: Date.now(),
    };
    await env.STORE.put(key, JSON.stringify(next));
    return json({ ...next, added: next.log.length - state.log.length });
  },
};

/* the recorded letter sounds */
async function sound(request, env, path) {
  const [, k, lang, letter] = path;
  if (!k || k.length < 16) return json({ error: 'bad key' }, 404);
  const indexKey = PREFIX + 'ai:' + k;
  if (!lang) {
    if (request.method !== 'GET') return json({ error: 'method' }, 405);
    return json((await env.STORE.get(indexKey, 'json')) || {});
  }
  if (!LETTERS[lang] || !LETTERS[lang].split(' ').includes(letter)) return json({ error: 'no such letter' }, 404);
  const clipKey = PREFIX + 'a:' + k + ':' + lang + ':' + letter;
  if (request.method === 'GET') {
    const buf = await env.STORE.get(clipKey, 'arrayBuffer');
    if (!buf) return json({ error: 'not recorded' }, 404);
    return new Response(buf, { headers: { 'content-type': 'audio/wav', 'cache-control': 'no-cache', ...CORS } });
  }
  if (request.method !== 'PUT') return json({ error: 'method' }, 405);
  const buf = await request.arrayBuffer();
  const b = new Uint8Array(buf);
  const tag = (o, t) => String.fromCharCode(...b.slice(o, o + 4)) === t;
  if (buf.byteLength < 44 || buf.byteLength > MAX_SOUND || !tag(0, 'RIFF') || !tag(8, 'WAVE')) {
    return json({ error: 'not a short WAV' }, 400);
  }
  await env.STORE.put(clipKey, buf);
  const index = (await env.STORE.get(indexKey, 'json')) || {};
  (index[lang] = index[lang] || {})[letter] = Date.now();
  await env.STORE.put(indexKey, JSON.stringify(index));
  return json({ ok: true, lang, letter, at: index[lang][letter] });
}
