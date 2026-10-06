// node test/engine.test.mjs — the engine, without a browser.
import { createRequire } from 'module';
import { childify, scribble, traceAlong, rng } from './childify.mjs';
const require = createRequire(import.meta.url);
const P = require('../engine.js');

let pass = 0, fail = 0;
const ok = (c, m, x = '') => { c ? (pass++, console.log('  ✓ ' + m)) : (fail++, console.log('  ✗ ' + m + (x ? '   <- ' + x : ''))); };
const section = s => console.log('\n' + s);
const ids = Object.keys(P.G);
const letters = ids.filter(id => P.G[id].kind === 'letter');
const pct = x => (100 * x).toFixed(1) + '%';

/* ------------------------------------------------------------------ */
section('templates follow the school rules');
{
  const bad = ids.filter(id => P.G[id].strokes.some(s => !s.pts.length || s.pts.some(p => isNaN(p.x) || isNaN(p.y))));
  ok(!bad.length, 'every glyph parses into finite points', bad.join(' '));
  const late = [...letters, ...P.DIGITS].filter(id => {
    const g = P.G[id], p = g.strokes[0].pts[0];
    return p.y > g.body.y0 + g.body.h * 0.45;
  });
  ok(!late.length, 'every letter and digit starts in its top half', late.join(' '));
  const wrongWay = [];
  ids.forEach(id => {
    const g = P.G[id];
    g.src.forEach((src, i) => {
      if (g.mark.includes(i)) return;
      const m = src.match(/^M ([-\d.]+) ([-\d.]+) L ([-\d.]+) ([-\d.]+)$/);
      if (!m) return;
      const dx = m[3] - m[1], dy = m[4] - m[2];
      if (Math.abs(dy) > 2 * Math.abs(dx) && dy < 0) wrongWay.push(id + ' stroke ' + (i + 1) + ' goes up');
      if (Math.abs(dx) > 2 * Math.abs(dy) && dx < 0) wrongWay.push(id + ' stroke ' + (i + 1) + ' goes left');
    });
  });
  ok(!wrongWay.length, 'straight strokes go down, and across from left to right', wrongWay.join('; '));
  const round = ['O', 'C', 'G', 'Q', 'S', 'o', '0'].filter(id => {
    const p = P.G[id].strokes[0].pts; return !(p[6].x < p[0].x);
  });
  ok(!round.length, 'round letters start at the top going anticlockwise', round.join(' '));
  ok(['T'].every(id => P.G.T.src[0].indexOf('M 35 0 L 35 100') === 0), 'T: the stem first, then the bar (every model found)');
  ok(P.G['Ż'].strokes[1].dot && P.G['Ż'].strokes.length === 2, 'Ż is Z plus a dot, never a crossed Z');
  const marksLast = letters.filter(id => P.G[id].mark.length && P.G[id].mark.some(i => i !== P.G[id].strokes.length - 1));
  ok(!marksLast.length, 'accents, dots, ogonki, rings and slashes come last', marksLast.join(' '));
  const all = new Set(ids);
  const missing = [...P.SHAPES, ...P.LETTERS.pl, ...P.LETTERS.nb, ...P.DIGITS].filter(id => !all.has(id));
  ok(!missing.length, 'every curriculum entry is a glyph', missing.join(' '));
  const needMissing = ids.filter(id => P.G[id].needs.some(n => !all.has(n)));
  ok(!needMissing.length, 'every prerequisite exists', needMissing.join(' '));
  ok(!['Q', 'V', 'X'].some(c => P.LETTERS.pl.includes(c)), 'Polish list has no Q, V, X');
  ok(['Æ', 'Ø', 'Å'].every(c => P.LETTERS.nb.includes(c)) && ['Ą', 'Ć', 'Ę', 'Ł', 'Ń', 'Ó', 'Ś', 'Ź', 'Ż'].every(c => P.LETTERS.pl.includes(c)),
     'Norwegian has Æ Ø Å, Polish has all nine diacritic letters');
  // shapes in the order children can copy them: | before -, / before \
  ok(P.SHAPES.indexOf('|') < P.SHAPES.indexOf('-') && P.SHAPES.indexOf('/') < P.SHAPES.indexOf('\\') && P.SHAPES.indexOf('+') < P.SHAPES.indexOf('x'),
     'shape order follows the developmental sequence (| - o + / \\ □ x)');
}

/* ------------------------------------------------------------------ */
section('tracing');
function trace(stroke, pts, opt) {
  const t = new P.Tracer(stroke, opt);
  const why = t.begin(pts[0]);
  for (const p of pts.slice(1)) t.move(p);
  t.end();
  return { t, why };
}
{
  let perfect = 0, total = 0, wob = 0, rev = 0, revTotal = 0, off = 0;
  ids.forEach(id => P.G[id].strokes.forEach((st, i) => {
    total++;
    if (trace(st, st.dot ? [st.pts[0]] : traceAlong(st)).t.done) perfect++;
    if (trace(st, st.dot ? [st.pts[0]] : traceAlong(st, { amp: 8, seed: i + 3 }), { tol: 13 }).t.done) wob++;
    if (!st.dot && st.len > 30 && P.geo.dist(st.pts[0], st.pts[st.pts.length - 1]) > 30 && !P.G[id].mark.includes(i)) {
      revTotal++;
      const r = trace(st, traceAlong(st, { reverse: true }));
      if (!r.t.done && r.why === 'end') rev++;
    }
    if (!st.dot && trace(st, traceAlong(st).map(p => ({ x: p.x + 26, y: p.y }))).t.done) off++;
  }));
  ok(perfect === total, `a stroke traced exactly is done (${perfect}/${total})`);
  ok(wob === total, `wobbling 8 units either side still counts (${wob}/${total})`);
  ok(rev === revTotal, `begun at the far end it never completes, and says why (${rev}/${revTotal})`);
  ok(off === 0, `26 units beside the line never completes (${off} did)`);

  const L = P.G.L.strokes[0], pts = traceAlong(L);
  const t = new P.Tracer(L); t.begin(pts[0]);
  pts.slice(1, 25).forEach(p => t.move(p)); t.end();
  const mid = t.progress();
  t.begin(pts[24]); pts.slice(25).forEach(p => t.move(p)); t.end();
  ok(mid > 0.2 && mid < 0.8 && t.done && t.lifts === 1, 'lifting half way and carrying on finishes the stroke', `mid ${mid.toFixed(2)} lifts ${t.lifts}`);

  const fast = P.geo.bySpacing(P.G.L.strokes[0].pts, 22);
  ok(trace(P.G.L.strokes[0], fast).t.done, 'a fast swipe with events 22 units apart still fills in');

  const O = P.G.O.strokes[0];
  const cw = traceAlong(O, { reverse: true });
  const tc = new P.Tracer(O); tc.begin(cw[0]); let back = false;
  cw.slice(1).forEach(p => { if (tc.move(p).back) back = true; });
  ok(!tc.done && back, 'a circle drawn clockwise never completes, and the tracer can tell she went backwards');

  ok(new P.Tracer(P.G.L.strokes[0]).begin({ x: 60, y: 40 }) === 'off', 'a touch nowhere near the line is "off"');
  ok(new P.Tracer(P.G.L.strokes[0]).begin({ x: 0, y: 60 }) === 'start', 'a touch on the line but not at its start is "start"');
  const dot = new P.Tracer(P.G['Ż'].strokes[1]);
  ok(dot.begin({ x: 35, y: -14 }) === 'ok' && dot.done, 'the dot of Ż is done with one tap near it');

  const kreska = P.G['Ś'].strokes[1];
  const k1 = trace(kreska, traceAlong(kreska, { reverse: true }), { bidir: true });
  const k2 = trace(kreska, traceAlong(kreska), { bidir: true });
  ok(k1.t.done && k2.t.done, 'an accent can be traced from either end (no source says which way)');
}

/* ------------------------------------------------------------------ */
section('judging free writing');
const all = ids;
{
  const cleanBad = [];
  for (const id of ids) for (const s of ['gentle', 'normal', 'strict']) {
    if (!P.judge(childify(P.G[id], { noise: 'clean', seed: 1 }), id, s).ok) cleanBad.push(id + '/' + s);
  }
  ok(!cleanBad.length, 'the template itself passes at every strictness', cleanBad.join(' '));

  const N = 6;
  for (const [noise, floor] of [['moderate', 0.97], ['heavy', 0.9]]) {
    let n = 0, good = 0; const miss = {};
    for (const id of ids) for (let s = 1; s <= N; s++) {
      n++;
      if (P.verify(childify(P.G[id], { noise, seed: s * 7919 + id.charCodeAt(0) * 3 }), id, 'gentle', all).ok) good++;
      else miss[id] = (miss[id] || 0) + 1;
    }
    ok(good / n >= floor, `a child's ${noise} attempt is accepted ${pct(good / n)} (floor ${pct(floor)})`, JSON.stringify(miss));
  }

  let wrong = 0, m = 0; const leaks = [];
  const r = rng(99);
  for (const drawn of ids) for (let k = 0; k < 12; k++) {
    const asked = ids[Math.floor(r() * ids.length)];
    if (asked === drawn || (P.SAME || []).some(g => g.includes(asked) && g.includes(drawn))) continue;
    m++;
    if (P.verify(childify(P.G[drawn], { noise: 'moderate', seed: k + 11 }), asked, 'gentle', all).ok) { wrong++; leaks.push(drawn + '>' + asked); }
  }
  ok(wrong / m <= 0.03, `another letter is accepted ${pct(wrong / m)} of the time (ceiling 3%)`, leaks.join(' '));

  let sc = 0;
  for (let s = 1; s <= 150; s++) if (P.verify(scribble(s * 5 + 2, 1 + s % 3), ids[s % ids.length], 'gentle', all).ok) sc++;
  ok(sc / 150 <= 0.08, `scribbles accepted ${pct(sc / 150)} (ceiling 8%)`);

  // marks
  const marked = letters.filter(id => P.G[id].mark.length);
  let markHit = 0, markN = 0; const markMiss = [];
  for (const id of marked) for (let s = 1; s <= 4; s++) {
    markN++;
    const r2 = P.judge(childify(P.G[id], { noise: 'moderate', seed: s * 13, drop: P.G[id].mark }), id, 'gentle');
    if (!r2.ok && r2.errors.includes('mark')) markHit++; else markMiss.push(id + (r2.ok ? ' passed' : ' ' + r2.errors));
  }
  ok(markHit / markN >= 0.9, `a forgotten accent/dot/ogonek/ring/slash is caught and named ${pct(markHit / markN)}`, markMiss.join('; '));
  const zz = P.verify(childify(P.G.Z, { noise: 'moderate', seed: 3 }), 'Ż', 'gentle', all);
  const zk = P.verify(childify(P.G['Ź'], { noise: 'moderate', seed: 3 }), 'Ż', 'gentle', all);
  ok(!zz.ok && !zk.ok, 'asked for Ż: a plain Z is not it, and neither is Ź', `${zz.ok} ${zk.ok}`);

  // mirror
  const asym = ['B', 'C', 'D', 'E', 'F', 'G', 'J', 'K', 'L', 'N', 'P', 'R', 'S', 'Z', '2', '3', '4', '5', '6', '7', '9'];
  let mir = 0, mirN = 0; const mirMiss = [];
  for (const id of asym) for (let s = 1; s <= 3; s++) {
    mirN++;
    const r3 = P.judge(childify(P.G[id], { noise: 'moderate', seed: s * 17, mirror: true }), id, 'gentle');
    if (!r3.ok && r3.errors.includes('mirror')) mir++; else mirMiss.push(id + (r3.ok ? ' passed' : ' ' + r3.errors));
  }
  ok(mir / mirN >= 0.75, `a mirrored letter is recognised as mirrored ${pct(mir / mirN)}`, mirMiss.join('; '));

  // direction and order: the shape still counts, the habit is logged
  let dirOk = 0, dirN = 0; const dirMiss = [];
  for (const id of ['L', 'T', 'H', 'E', 'F', 'V', 'Z', 'O', 'C', 'S', 'U', 'M', 'N']) for (let s = 1; s <= 3; s++) {
    dirN++;
    const r4 = P.judge(childify(P.G[id], { noise: 'moderate', seed: s * 19, reverse: [0] }), id, 'gentle');
    if (r4.ok && (r4.errors.includes('dir') || r4.errors.includes('start'))) dirOk++; else dirMiss.push(id + ' ' + r4.ok + ' ' + r4.errors);
  }
  ok(dirOk / dirN >= 0.9, `a stroke drawn backwards still counts as the letter, but is flagged ${pct(dirOk / dirN)}`, dirMiss.join('; '));
  const eo = P.judge(childify(P.G.E, { noise: 'moderate', seed: 5, order: [3, 2, 1, 0] }), 'E', 'gentle');
  ok(eo.ok && eo.errors.includes('order'), 'E with its strokes in reverse order passes and is flagged for order', eo.errors.join(','));
  ok(P.judge([], 'L').errors.includes('empty'), 'no ink is "empty", not a crash');
  ok(!P.judge([[{ x: 5, y: 5 }]], 'L').ok, 'a single tap is not an L');

  // time per verdict
  const t0 = Date.now(); let k = 0;
  for (const id of ['A', 'E', 'S', 'Ż', 'W', 'Æ']) for (let s = 1; s <= 4; s++) { P.verify(childify(P.G[id], { noise: 'moderate', seed: s }), id, 'gentle', all); k++; }
  const each = (Date.now() - t0) / k;
  ok(each < 150, `a full verdict against all ${all.length} rivals takes ${each.toFixed(0)} ms in node (ceiling 150)`);
}

/* ------------------------------------------------------------------ */
section('stored drawings');
{
  const s = childify(P.G.S, { noise: 'moderate', seed: 4 });
  const packed = P.pack(s), back = P.unpack(packed);
  const bytes = JSON.stringify(packed).length;
  ok(back.length === s.length && bytes < 900, `a drawing packs to ${bytes} bytes and unpacks to the same strokes`);
  ok(P.judge(back, 'S', 'gentle').ok, 'an unpacked drawing is still judged the same');
}

/* ------------------------------------------------------------------ */
section('what she knows, rebuilt from the log');
const DAY = 86400000, T0 = Date.UTC(2026, 9, 1, 9);
{
  const log = [
    { t: T0, g: 'L', st: 'R', ok: 1 }, { t: T0 + 1, g: 'L', st: 'T', ok: 1 }, { t: T0 + 2, g: 'L', st: 'C', ok: 1 },
  ];
  let M = P.rebuild(log);
  ok(M.L.lv === 3, 'road, dots, copy in one item: level 3 (copied)');
  log.push({ t: T0 + DAY, g: 'L', st: 'M', ok: 1 });
  M = P.rebuild(log); ok(M.L.lv === 4, 'from memory the next day: level 4');
  log.push({ t: T0 + DAY + 5, g: 'L', st: 'M', ok: 1 });
  M = P.rebuild(log); ok(M.L.lv === 4, 'a second success the SAME day does not make it owned');
  log.push({ t: T0 + 2 * DAY, g: 'L', st: 'M', ok: 1 });
  M = P.rebuild(log); ok(M.L.lv === 5, 'from memory on a second day: owned (level 5)');
  log.push({ t: T0 + 3 * DAY, g: 'L', st: 'M', ok: 0, e: 'shape' }, { t: T0 + 3 * DAY + 1, g: 'L', st: 'M', ok: 0, e: 'shape' });
  M = P.rebuild(log); ok(M.L.lv === 3, 'two misses in a row from memory: back to copying');
  const mlog = [{ t: T0, g: 'S', st: 'C', ok: 1 }, { t: T0 + DAY, g: 'S', st: 'M', ok: 0, e: 'mirror' }, { t: T0 + DAY + 1, g: 'S', st: 'M', ok: 0, e: 'mirror' }];
  ok(P.rebuild(mlog).S.lv === 3, 'mirrored attempts are never counted against her');
  const shuffled = log.slice().sort(() => Math.random() - 0.5);
  ok(JSON.stringify(P.rebuild(shuffled)) === JSON.stringify(P.rebuild(log)), 'the order rows arrive in does not matter (two devices merge)');
}

section('what an item asks for');
{
  const plan = lv => P.plan(lv === null ? null : { lv, recent: [] });
  ok(plan(null).join() === 'R,T,C', 'something new: road, dots, then copy');
  ok(plan(1).join() === 'T,C' && plan(2).join() === 'C', 'then dots and copy, then copy');
  ok(plan(3).join() === 'M' && plan(5).join() === 'M', 'once copied: from memory only');
  ok(P.plan(null, { shape: true }).join() === 'R,T' && P.plan({ lv: 2, recent: [] }, { shape: true }).join() === 'C', 'shapes: road and dots, then copy; never memory');
  const formErr = { lv: 4, recent: [{ st: 'M', ok: 1, e: 'start' }, { st: 'M', ok: 1, e: 'dir' }] };
  ok(P.plan(formErr).join() === 'T,M', 'starting points keep going wrong: one trace over the dots first');
}

/* ------------------------------------------------------------------ */
section('forty days of a simulated child');
for (const lang of ['pl', 'nb']) {
  const r = rng(lang === 'pl' ? 7 : 8);
  const log = []; let t = T0;
  const seen = {}; let violations = [];
  let newPerSitting = [], maxLearning = 0, nameAt = null, firstLetterDay = null;
  const name = lang === 'pl' ? 'NADIA' : 'ADA';
  for (let day = 0; day < 40; day++) {
    for (let sitting = 0; sitting < 2; sitting++) {
      t = T0 + day * DAY + sitting * 3 * 3600000;
      const M = P.rebuild(log);
      const items = P.session(M, { lang, name, size: 5, now: t });
      const gs = items.map(i => i.g);
      if (new Set(gs).size !== gs.length) violations.push('duplicate item ' + gs);
      if (P.SAME.some(g => g.filter(x => gs.includes(x)).length > 1)) violations.push('look-alikes together ' + gs);
      if (items.length > 6) violations.push('too many items ' + items.length);
      const fresh = items.filter(i => !M[i.g] && P.G[i.g] && P.G[i.g].kind !== 'shape');
      newPerSitting.push(fresh.length);
      fresh.forEach(i => {
        if (P.G[i.g].needs.some(n => !M[n] || M[n].lv < 2)) violations.push(i.g + ' before its strokes');
        if (firstLetterDay === null) firstLetterDay = day;
      });
      const learning = Object.keys(M).filter(k => P.G[k] && P.G[k].kind !== 'shape' && M[k].lv >= 1 && M[k].lv <= 3).length;
      maxLearning = Math.max(maxLearning, learning);
      if (items.some(i => i.name) && nameAt === null) nameAt = day;
      // play: tracing always gets done; copying and memory succeed more with practice
      items.forEach(it => {
        const letters = it.name ? it.g.split('') : [it.g];
        letters.forEach(g => it.steps.forEach(st => {
          t += 20000;
          const tries = (seen[g + st] = (seen[g + st] || 0) + 1);
          const p = st === 'R' || st === 'T' ? 1 : Math.min(0.95, 0.55 + 0.12 * tries);
          log.push({ t, g, st, ok: r() < p ? 1 : 0 });
        }));
      });
    }
  }
  const M = P.rebuild(log);
  const owned = Object.keys(M).filter(k => P.G[k].kind === 'letter' && M[k].lv >= 4).length;
  ok(!violations.length, `${lang}: no duplicates, no oversized sitting, nothing before its strokes`, violations.slice(0, 5).join('; '));
  ok(Math.max(...newPerSitting) <= 1, `${lang}: at most one new letter per sitting`);
  ok(maxLearning <= 3, `${lang}: never more than 3 letters in progress at once (max ${maxLearning})`);
  ok(firstLetterDay !== null && firstLetterDay <= 2, `${lang}: the first letter arrives on day ${firstLetterDay} (after the opening strokes)`);
  ok(owned >= 12, `${lang}: ${owned} letters written from memory after 40 days of two short sittings`);
  ok(nameAt !== null, `${lang}: her name comes up as soon as she can copy its letters (day ${nameAt})`);
  const nameLetters = name.split('').filter(c => P.G[c]);
  const order = Object.keys(M).filter(k => P.G[k].kind === 'letter').sort((a, b) => M[a].firstAt - M[b].firstAt);
  const nameFirst = nameLetters.filter(c => order.indexOf(c) >= 0 && order.indexOf(c) < 8).length;
  ok(nameFirst >= Math.min(3, nameLetters.length), `${lang}: letters of her name are among the first eight (${order.slice(0, 8).join('')})`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
