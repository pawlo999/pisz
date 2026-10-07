// node test/worker.test.mjs — the sync worker against an in-memory KV.
import worker, { mergeLogs } from '../sync/src/worker.js';
import { fakeKV } from './fakekv.mjs';

let pass = 0, fail = 0;
const ok = (c, m, x = '') => { c ? (pass++, console.log('  ✓ ' + m)) : (fail++, console.log('  ✗ ' + m + (x ? '   <- ' + x : ''))); };

const env = { STORE: fakeKV() };
const KEY = 'test-key-0123456789abcdef';
const call = (method, body, key = KEY) => worker.fetch(new Request('https://x/s/' + key, {
  method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }), env)
  .then(async r => ({ status: r.status, body: await r.json().catch(() => null), cors: r.headers.get('access-control-allow-origin') }));

console.log('\nsync worker');
const a = [{ t: 1, g: 'L', st: 'R', ok: 1 }, { t: 2, g: 'L', st: 'C', ok: 1, s: [[0, 0, 0, 100]] }];
const b = [{ t: 2, g: 'L', st: 'C', ok: 1 }, { t: 3, g: 'T', st: 'R', ok: 1 }];
let r = await call('POST', { log: a, name: 'ADA', settings: { lang: 'pl' } });
ok(r.status === 200 && r.body.log.length === 2 && r.body.added === 2, 'first device posts its log', JSON.stringify(r.body));
r = await call('POST', { log: b, name: 'ADA' });
ok(r.body.log.length === 3 && r.body.added === 1, 'second device adds only what is new');
ok(r.body.log.find(x => x.t === 2).s, 'a row arriving without its drawing does not erase the drawing');
ok(r.body.settings.lang === 'pl', 'a post without settings keeps the stored ones');
r = await call('GET');
ok(r.body.log.length === 3 && r.cors === '*', 'GET returns the merged record, with CORS for parent.html');
ok([...env.STORE.m.keys()].every(k => k.startsWith('pisz:')), 'everything is stored under "pisz:" — Litery\'s keys are never touched');
env.STORE.m.set(KEY, JSON.stringify({ litery: true }));
await call('POST', { log: [{ t: 9, g: 'O', st: 'R', ok: 1 }] });
ok(JSON.parse(env.STORE.m.get(KEY)).litery === true, 'a Litery record under the same sync key is left exactly as it was');
r = await call('POST', { log: a }, 'short');
ok(r.status === 404, 'a short key is refused');
r = await worker.fetch(new Request('https://x/s/' + KEY, { method: 'POST', body: 'not json' }), env);
ok(r.status === 400, 'garbage is refused');
r = await call('POST', { nolog: 1 });
ok(r.status === 400, 'a payload without a log is refused');
const big = { t: 99, g: 'S', st: 'C', ok: 1, s: [Array(30000).fill(1)] };
r = await call('POST', { log: [big] });
ok(!r.body.log.find(x => x.t === 99), 'an absurdly large row is dropped, not stored');
ok(mergeLogs([{ t: 5, k: 'S', x: '5' }], [{ t: 5, k: 'S', x: '5' }]).length === 1, 'the same row from two devices is kept once');
ok(mergeLogs([{ t: 5, g: 'A', st: 'C' }], [{ t: 5, g: 'B', st: 'C' }]).length === 2, 'two rows in the same millisecond for different letters are both kept');
r = await worker.fetch(new Request('https://x/s/' + KEY, { method: 'OPTIONS' }), env);
ok(r.status === 200 || r.status === 204, 'CORS preflight answers');

console.log('\nrecorded letter sounds');
function wav(n = 4000) {                // a minimal valid 16-bit mono WAV with n samples
  const b = new ArrayBuffer(44 + n * 2), v = new DataView(b), w = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, 1, true); v.setUint32(24, 22050, true); v.setUint32(28, 44100, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(8000 * Math.sin(i / 5)), true);
  return b;
}
const A = (path, method = 'GET', body) => worker.fetch(new Request('https://x/a/' + path, { method, body }), env);
const clip = wav();
let ar = await A(KEY + '/pl/' + encodeURIComponent('ś'), 'PUT', clip);
ok(ar.status === 200 && (await ar.json()).ok, 'a parent recording of ś is stored');
ar = await A(KEY);
const idx = await ar.json();
ok(idx.pl && typeof idx.pl['ś'] === 'number' && ar.headers.get('access-control-allow-origin') === '*', 'the index lists it with when it was recorded', JSON.stringify(idx));
ar = await A(KEY + '/pl/' + encodeURIComponent('ś'));
const got = new Uint8Array(await ar.arrayBuffer());
ok(ar.status === 200 && ar.headers.get('content-type') === 'audio/wav' && got.length === clip.byteLength && got[44] === new Uint8Array(clip)[44],
   'and comes back byte for byte as audio/wav');
ok((await A(KEY + '/pl/g')).status === 404, 'a letter not recorded yet is a 404 (the app falls back to the voice)');
ok((await A(KEY + '/pl/q', 'PUT', clip)).status === 404, 'a letter the app does not use is refused');
ok((await A(KEY + '/pl/s', 'PUT', new TextEncoder().encode('not audio at all, just text padding padding padding'))).status === 400, 'something that is not a WAV is refused');
ok((await A(KEY + '/pl/s', 'PUT', wav(120000))).status === 400, 'a recording over 200 KB is refused');
ok((await A('short/pl/s', 'PUT', clip)).status === 404, 'a short key is refused');
ok([...env.STORE.m.keys()].filter(k => k !== KEY).every(k => k.startsWith('pisz:')), 'sounds too live under pisz: only (the bare key is the Litery fixture above)');
ar = await A(KEY + '/nb/' + encodeURIComponent('ø'), 'PUT', clip);
ok(ar.status === 200 && Object.keys((await (await A(KEY)).json()).nb).includes('ø'), 'Norwegian ø is kept beside the Polish letters');
ar = await worker.fetch(new Request('https://x/a/' + KEY + '/pl/s', { method: 'OPTIONS' }), env);
ok(/PUT/.test(ar.headers.get('access-control-allow-methods')), 'the browser is allowed to PUT (CORS)');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
