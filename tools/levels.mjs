// Whole letters and shapes, written the way a child would, at every level:
// how many pass, and how many are taken for unfinished or for another letter.
// The test suite floors only gentle; run this on any change to the judge.
// b9: heavy wobble, whole letters passed 255 / 247 / 215 of 276.
//
//   node tools/levels.mjs [repo root] [--seeds N]     (default: this repo, 6)
// TUNE='{"reach":26}' in the environment is merged into P.TUNE.
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
const argv = process.argv.slice(2);
const si = argv.indexOf('--seeds'), SEEDS = si < 0 ? 6 : +argv.splice(si, 2)[1];
const ROOT = path.resolve(argv[0] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const P = createRequire(import.meta.url)(ROOT + '/engine.js');
if (process.env.TUNE) Object.assign(P.TUNE, JSON.parse(process.env.TUNE));
const { childify } = await import(pathToFileURL(ROOT + '/test/childify.mjs').href);
const all = [...new Set([...P.allFor('pl', true), ...P.allFor('nb', true)])];
const cands = [...new Set([...P.SHAPES, ...all])];   /* allFor already holds the shapes: listed twice, they took rival slots */
const letters = all.filter(id => P.G[id] && P.G[id].kind !== 'shape');
for (const [what, ids] of [['letters', letters], ['shapes', P.SHAPES]]) {
  for (const lvl of ['gentle', 'normal', 'strict']) for (const noise of ['moderate', 'heavy']) {
    let n = 0, ok = 0, unf = 0, other = 0; const who = {};
    for (const id of ids) for (let s = 1; s <= SEEDS; s++) {
      const r = P.verify(childify(P.G[id], { noise, seed: s * 7919 + id.charCodeAt(0) * 3 }), id, lvl, cands.filter(x => x !== id));
      n++; if (r.ok) ok++;
      if ((r.errors || []).includes('unfinished')) { unf++; who[id] = (who[id] || 0) + 1; }
      if (r.other) other++;
    }
    console.log(what.padEnd(8), lvl.padEnd(7), noise.padEnd(9), 'passed', `${ok}/${n}`.padEnd(8), 'unfinished', String(unf).padEnd(3), 'other', String(other).padEnd(3), JSON.stringify(who));
  }
}
