// Grid search: tolerance x direction threshold -> how often a child's real
// attempt passes (moderate and heavy noise) and how often a wrong glyph does.
// node measure2.mjs "tol,tol" "cos,cos" [samples]
import { createRequire } from 'module';
import { childify, scribble } from './childify.mjs';
const require = createRequire(import.meta.url);
const P = require('../engine.js');
const tols = (process.argv[2] || '13').split(',').map(Number);
const coss = (process.argv[3] || '0.6').split(',').map(Number);
const N = +(process.argv[4] || 5);
const margins = (process.argv[5] || '8').split(',').map(Number);
const ids = Object.keys(P.G);
const pct = x => (x * 100).toFixed(1).padStart(5) + '%';
for (const tol of tols) for (const cos of coss) for (const margin of margins) {
  P.MARGIN = margin;
  P.STRICT.test = { tol, minCov: 0.75, minPrec: 0.75 };
  P.TUNE.cos = cos;
  const t0 = Date.now();
  let tm = 0, th = 0, n = 0, vm = 0, vh = 0;
  const missM = {}, missH = {};
  for (const id of ids) for (let s = 1; s <= N; s++) {
    const a = childify(P.G[id], { noise: 'moderate', seed: s * 7919 + id.charCodeAt(0) });
    const b = childify(P.G[id], { noise: 'heavy', seed: s * 104729 + id.charCodeAt(0) });
    const ra = P.judge(a, id, 'test'), rb = P.judge(b, id, 'test');
    n++; if (ra.ok) tm++; else missM[id] = (missM[id] || 0) + 1;
    if (rb.ok) th++; else missH[id] = (missH[id] || 0) + 1;
    if (P.verify(a, id, 'test', ids).ok) vm++;
    if (P.verify(b, id, 'test', ids).ok) vh++;
  }
  let fa = 0, fv = 0, m = 0; const worst = {};
  for (const drawn of ids) for (const asked of ids) {
    if (drawn === asked) continue;
    const u = childify(P.G[drawn], { noise: 'moderate', seed: drawn.charCodeAt(0) * 13 + asked.charCodeAt(0) });
    m++;
    const r = P.judge(u, asked, 'test');
    if (r.ok) { fa++; if (P.verify(u, asked, 'test', ids).ok) { fv++; worst[drawn + '>' + asked] = 1; } }
  }
  let sc = 0; for (let s = 1; s <= 100; s++) if (P.judge(scribble(s * 3 + 1, 1 + s % 3), ids[s % ids.length], 'test').ok) sc++;
  console.log(`tol ${tol} cos ${cos} margin ${margin}: judge pass mod ${pct(tm / n)} heavy ${pct(th / n)} | wrong ${pct(fa / m)} | verify pass mod ${pct(vm / n)} heavy ${pct(vh / n)} wrong ${pct(fv / m)} | scribble ${sc}% | ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  if (tols.length * coss.length * margins.length === 1) {
    console.log('  missed (moderate):', JSON.stringify(missM));
    console.log('  missed (heavy):', JSON.stringify(missH));
    console.log('  wrong pairs still passing verify:', Object.keys(worst).join(' '));
  }
}
