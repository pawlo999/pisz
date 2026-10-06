// How often the judge says yes: to the right glyph written by a child
// (should be nearly always) and to every other glyph (should be rare).
// node measure.mjs [noise] [strictness] [n]
import { createRequire } from 'module';
import { childify, scribble } from './childify.mjs';
const require = createRequire(import.meta.url);
const P = require('../engine.js');

const noise = process.argv[2] || 'moderate', strict = process.argv[3] || 'gentle', N = +(process.argv[4] || 20);
const ids = Object.keys(P.G);
const t0 = Date.now();
let judged = 0;
const rows = [];
for (const id of ids) {
  let ok = 0; const errs = {};
  for (let s = 1; s <= N; s++) {
    const r = P.judge(childify(P.G[id], { noise, seed: s * 7919 + id.charCodeAt(0) }), id, strict);
    judged++;
    if (r.ok) ok++; else r.errors.forEach(e => errs[e] = (errs[e] || 0) + 1);
  }
  rows.push([id, ok / N, errs]);
}
const weak = rows.filter(r => r[1] < 0.95);
console.log(`right glyph accepted (${noise}, ${strict}, n=${N}): mean ${(rows.reduce((a, r) => a + r[1], 0) / rows.length * 100).toFixed(1)}%`);
weak.forEach(r => console.log('  low', r[0], (r[1] * 100).toFixed(0) + '%', JSON.stringify(r[2])));

// cross: draw X, ask for Y
const fa = [];
for (const drawn of ids) for (const asked of ids) {
  if (drawn === asked) continue;
  let ok = 0; const M = Math.max(4, N / 4);
  for (let s = 1; s <= M; s++) { if (P.judge(childify(P.G[drawn], { noise, seed: s * 31 + 5 }), asked, strict).ok) ok++; judged++; }
  if (ok / M > 0.25) fa.push([drawn, asked, ok / M]);
}
console.log(`wrong glyph accepted >25% of the time: ${fa.length} pairs`);
fa.sort((a, b) => b[2] - a[2]).forEach(f => console.log(`  drew ${f[0]} asked ${f[1]}: ${(f[2] * 100).toFixed(0)}%`));

let sc = 0;
for (let s = 1; s <= 200; s++) { const id = ids[s % ids.length]; if (P.judge(scribble(s, 1 + s % 3), id, strict).ok) sc++; judged++; }
console.log(`scribbles accepted: ${sc}/200`);
console.log(`${judged} judgements, ${((Date.now() - t0) / judged).toFixed(1)} ms each`);
