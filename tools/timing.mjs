// How long one verdict takes (P.verify against her alphabet), in node:
// average, 95th percentile and slowest. Compare two builds by running it on
// each, ideally twice, with nothing else busy — the machine's load moves it.
//
//   node tools/timing.mjs [repo root]
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
const ROOT = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const P = createRequire(import.meta.url)(ROOT + '/engine.js');
if (process.env.TUNE) Object.assign(P.TUNE, JSON.parse(process.env.TUNE));
const { childify } = await import(pathToFileURL(ROOT + '/test/childify.mjs').href);
const all = P.allFor('pl', false), ids = all.filter(id => P.G[id]);
const ts = [];
for (let rep = 0; rep < 2; rep++) for (const id of ids) for (let s = 1; s <= 3; s++) {
  const ink = childify(P.G[id], { noise: 'moderate', seed: s * 101 + id.charCodeAt(0) });
  const t = process.hrtime.bigint();
  P.verify(ink, id, 'gentle', all.filter(x => x !== id));
  if (rep) ts.push(Number(process.hrtime.bigint() - t) / 1e6);   /* the first round warms the caches */
}
ts.sort((a, b) => a - b);
console.log(`${ts.length} verdicts: avg ${(ts.reduce((a, b) => a + b, 0) / ts.length).toFixed(1)} ms, p95 ${ts[Math.floor(ts.length * 0.95)].toFixed(1)} ms, max ${ts[ts.length - 1].toFixed(1)} ms`);
