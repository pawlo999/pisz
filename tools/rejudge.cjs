// Her stored copy, memory and name attempts, judged again — the first check
// on any change to how letters are judged (b8 → b9: 3 of her 83 attempts
// changed: two Vs drawn for a Y, and an A of her name whose right leg stops
// under the bar).
//
//   node tools/rejudge.cjs <engine.js> [other engine.js] [--log PATH] [--all]
//
// Two engines (the usual use, e.g. master's against a branch's): the rows
// where they disagree. One engine: the rows whose verdict differs from the
// one she got at the time — that mixes in every build since, so it is for a
// first look, not for measuring one change. --all lists the rows that agree too.
// TUNE='{"reach":26}' in the environment is merged into the LAST engine given
// only, so a setting can be compared against the untouched build.
// Rivals are the app's own (P.rivals: the shapes + what she had met by then);
// the level is her current setting. Times are UTC. Prints letters and
// verdicts, never strokes; a letter of her name prints as "(name)", since
// the name-step rows in order would spell it. Default log:
// ~/.cache/pisz/her-log.json (tools/her-log.py).
const path = require('path'), os = require('os');
const argv = process.argv.slice(2);
const flag = n => { const i = argv.indexOf(n); return i < 0 ? null : argv.splice(i, 2)[1]; };
const logPath = flag('--log') || path.join(os.homedir(), '.cache/pisz/her-log.json');
const all = argv.includes('--all'); if (all) argv.splice(argv.indexOf('--all'), 1);
if (!argv.length) { console.error('usage: node tools/rejudge.cjs <engine.js> [other engine.js] [--log PATH] [--all]'); process.exit(2); }
/* a fresh module per argument: the same file twice must be two engines */
const load = (f, tuned) => {
  const file = require.resolve(path.resolve(f));
  delete require.cache[file];
  const P = require(file);
  if (tuned && process.env.TUNE) Object.assign(P.TUNE, JSON.parse(process.env.TUNE));
  return P;
};
const A = load(argv[0], argv.length === 1), B = argv[1] ? load(argv[1], true) : null;
const d = require(path.resolve(logPath));
const strict = (d.settings && d.settings.strict) || 'gentle';
const rivalsOf = (P, r) => {
  const M = P.rebuild(d.log.filter(x => x.t < r.t));
  if (P.rivals) return P.rivals(M, r.g);
  /* builds before b10 kept this list in app.js: the same rule, copied once */
  return [...new Set([...P.SHAPES, ...Object.keys(M)])].filter(x => x !== r.g && P.G[x]);
};
const verdict = (P, r) => {
  const v = P.verify(P.unpack(r.s), r.g, strict, rivalsOf(P, r));
  return { ok: !!v.ok, txt: v.ok ? 'accepted' + (v.errors.length ? ' (' + v.errors.join(',') + ')' : '') : 'rejected: ' + v.errors.join(',') + (v.other ? ' → ' + v.other : '') };
};
let n = 0, diff = 0;
for (const r of d.log.filter(r => r.s && ['C', 'M', 'N'].includes(r.st) && A.G[r.g] && (!B || B.G[r.g]))) {
  n++;
  const a = verdict(A, r), then = { ok: !!r.ok, txt: r.ok ? 'accepted then' : 'rejected then: ' + (r.e || '') };
  const b = B ? verdict(B, r) : then;
  const differs = a.ok !== b.ok;
  if (differs) diff++;
  const letter = r.st === 'N' ? '(name)' : r.g;
  if (differs || all) console.log(new Date(r.t).toISOString().slice(5, 19).replace('T', ' ') + 'Z', letter, r.st, 'n' + r.s.length, '|', a.txt, '|', b.txt, differs ? '  <-- differs' : '');
}
console.log(`${diff} of ${n} attempts differ` + (B ? ' between the two engines' : ' from the verdict she got at the time'));
