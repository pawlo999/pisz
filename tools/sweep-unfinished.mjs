// Which letters does the judge accept when she has NOT finished them?
// Every letter and digit, with one whole body line left out or one line
// stopped at its last corner, written the way a child would (moderate
// wobble, 12 seeds), asked for by name. b8: 92 of 984 accepted; b9: 9.
//
//   node tools/sweep-unfinished.mjs [repo root]      (default: this repo)
// TUNE='{"reach":26}' in the environment is merged into P.TUNE.
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
const ROOT = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const P = createRequire(import.meta.url)(ROOT + '/engine.js');
if (process.env.TUNE) Object.assign(P.TUNE, JSON.parse(process.env.TUNE));
const { childify } = await import(pathToFileURL(ROOT + '/test/childify.mjs').href);
const box = strokes => P.geo.bbox(strokes.flatMap(s => s.pts));
function lastCorner(pts) {
  let best = -1;
  for (let i = 3; i < pts.length - 3; i++) {
    const a = pts[i - 3], b = pts[i], c = pts[i + 3];
    let d = Math.abs(Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(b.y - a.y, b.x - a.x)); if (d > Math.PI) d = 2 * Math.PI - d;
    if (d > 0.6) best = i;
  }
  return best;
}
const ids = [...new Set([...P.allFor('pl', true), ...P.allFor('nb', true)])];
const out = []; let total = 0;
for (const id of ids) {
  const g = P.G[id]; if (!g || g.kind === 'shape') continue;
  const variants = [];
  if (g.strokes.length > 1) g.strokes.forEach((s, i) => { if (!s.dot && g.mark.indexOf(i) < 0) variants.push({ what: `without line ${i + 1}`, strokes: g.strokes.filter((_, j) => j !== i) }); });
  g.strokes.forEach((s, i) => {
    if (s.dot) return;
    const k = lastCorner(s.pts);
    if (k > 0) variants.push({ what: `line ${i + 1} stopped at its last corner`, strokes: g.strokes.map((t, j) => j === i ? { ...t, pts: t.pts.slice(0, k + 1) } : t) });
  });
  for (const v of variants) {
    const fake = { strokes: v.strokes, box: box(v.strokes), mark: [] };
    let acc = 0; const N = 12; total += N;
    for (let seed = 1; seed <= N; seed++) if (P.verify(childify(fake, { noise: 'moderate', seed, place: false }), id, 'gentle', ids.filter(x => x !== id)).ok) acc++;
    if (acc) out.push({ id, what: v.what, acc });
  }
}
out.sort((a, b) => b.acc - a.acc);
for (const o of out) console.log(JSON.stringify(o.id), P.G[o.id].kind, `${o.acc}/12`, o.what);
console.log(`unfinished letters accepted: ${out.reduce((a, o) => a + o.acc, 0)} of ${total} tries`);
