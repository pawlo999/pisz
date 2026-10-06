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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
