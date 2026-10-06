// Synthetic handwriting: a template glyph, written the way a small child
// writes it — the wrong size, tilted, wobbly, strokes that miss each other.
// Seeded, so a failing case can be replayed.

export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
const between = (r, a, b) => a + (b - a) * r();

export const NOISE = {
  clean:    { s: [1, 1],     a: [1, 1],       r: 0,  sh: 0,    o: 0, w: 0,   e: 0,    j: 0 },
  moderate: { s: [0.6, 1.5], a: [0.85, 1.18], r: 8,  sh: 0.1,  o: 4, w: 2.5, e: 0.06, j: 0.6 },
  heavy:    { s: [0.5, 1.7], a: [0.78, 1.28], r: 13, sh: 0.16, o: 7, w: 4.5, e: 0.12, j: 1.2 },
};

// one stroke of template points -> a child's version of it
function wobbleStroke(pts, r, n) {
  const len = pts.length;
  const ph1 = between(r, 0, 6.3), ph2 = between(r, 0, 6.3);
  const f1 = between(r, 0.6, 1.8), f2 = between(r, 2, 4.5);
  const a1 = between(r, 0.4, 1) * n.w, a2 = between(r, 0.1, 0.5) * n.w;
  const ox = between(r, -n.o, n.o), oy = between(r, -n.o, n.o);
  const e0 = between(r, -n.e, n.e), e1 = between(r, -n.e, n.e);
  let p = pts;
  if (p.length > 4) {
    const cut0 = Math.max(0, Math.round(-e0 * len)), cut1 = Math.max(0, Math.round(-e1 * len));
    p = p.slice(cut0, Math.max(cut0 + 2, len - cut1));
    if (e0 > 0) { const a = p[0], b = p[1]; const k = e0 * len; p = [{ x: a.x + (a.x - b.x) * k, y: a.y + (a.y - b.y) * k }, ...p]; }
    if (e1 > 0) { const a = p[p.length - 1], b = p[p.length - 2]; const k = e1 * len; p = [...p, { x: a.x + (a.x - b.x) * k, y: a.y + (a.y - b.y) * k }]; }
  }
  return p.map((q, i) => {
    const t = p.length > 1 ? i / (p.length - 1) : 0;
    const wx = a1 * Math.sin(2 * Math.PI * f1 * t + ph1) + a2 * Math.sin(2 * Math.PI * f2 * t + ph2);
    const wy = a1 * Math.cos(2 * Math.PI * f1 * t + ph2) + a2 * Math.cos(2 * Math.PI * f2 * t + ph1);
    return { x: q.x + ox + wx + between(r, -n.j, n.j), y: q.y + oy + wy + between(r, -n.j, n.j) };
  });
}

// resample at an uneven pace, like a finger that speeds up and slows down
function pace(pts, r) {
  const out = [pts[0]];
  let acc = 0, step = between(r, 1.5, 5);
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x, dy = pts[i].y - pts[i - 1].y;
    acc += Math.sqrt(dx * dx + dy * dy);
    if (acc >= step) { out.push(pts[i]); acc = 0; step = between(r, 1.5, 5); }
  }
  if (out[out.length - 1] !== pts[pts.length - 1]) out.push(pts[pts.length - 1]);
  return out;
}

/**
 * g: engine glyph. opts: { noise, seed, reverse: [stroke idx], drop: [idx],
 *   order: [idx...], mirror, split, place: false keeps template position }
 */
export function childify(g, opts = {}) {
  const r = rng(opts.seed || 1);
  const n = NOISE[opts.noise || 'moderate'];
  const s = between(r, n.s[0], n.s[1]), a = between(r, n.a[0], n.a[1]);
  const rot = between(r, -n.r, n.r) * Math.PI / 180, sh = between(r, -n.sh, n.sh);
  const tx = opts.place === false ? 0 : between(r, -30, 30), ty = opts.place === false ? 0 : between(r, -20, 20);
  const cx = g.box.cx, cy = g.box.cy;
  let strokes = g.strokes.map((st, i) => {
    let pts = st.dot ? [st.pts[0], { x: st.pts[0].x + 0.5, y: st.pts[0].y + 0.5 }] : st.pts.map(p => ({ x: p.x, y: p.y }));
    if (opts.mirror) pts = pts.map(p => ({ x: g.box.x0 + g.box.x1 - p.x, y: p.y }));
    if (!st.dot) pts = wobbleStroke(pts, r, n);
    if ((opts.reverse || []).includes(i)) pts = pts.slice().reverse();
    return pts;
  });
  if (opts.drop) strokes = strokes.filter((_, i) => !opts.drop.includes(i));
  if (opts.order) strokes = opts.order.map(i => strokes[i]).filter(Boolean);
  if (opts.split) {
    let li = 0; strokes.forEach((st, i) => { if (st.length > strokes[li].length) li = i; });
    const st = strokes[li], m = Math.floor(st.length / 2);
    if (st.length > 6) strokes.splice(li, 1, st.slice(0, m), st.slice(m));
  }
  return strokes.map(st => pace(st.map(p => {
    let x = (p.x - cx) * s * a, y = (p.y - cy) * s;
    x += sh * y;
    const X = x * Math.cos(rot) - y * Math.sin(rot), Y = x * Math.sin(rot) + y * Math.cos(rot);
    return { x: X + cx + tx, y: Y + cy + ty };
  }), r));
}

// a scribble: random walk, for "is nonsense ever accepted"
export function scribble(seed, strokes = 2) {
  const r = rng(seed); const out = [];
  for (let k = 0; k < strokes; k++) {
    let x = between(r, 0, 100), y = between(r, 0, 100), ang = between(r, 0, 6.3);
    const s = [];
    for (let i = 0; i < 60; i++) { ang += between(r, -0.6, 0.6); x += 3 * Math.cos(ang); y += 3 * Math.sin(ang); s.push({ x, y }); }
    out.push(s);
  }
  return out;
}

// points along a template stroke the way a finger would trace it, wobbling by `amp`
export function traceAlong(st, { amp = 0, step = 3, seed = 1, reverse = false } = {}) {
  const r = rng(seed);
  let pts = st.pts;
  if (reverse) pts = pts.slice().reverse();
  const out = [];
  let acc = step;
  for (let i = 0; i < pts.length; i++) {
    if (i > 0) { const dx = pts[i].x - pts[i - 1].x, dy = pts[i].y - pts[i - 1].y; acc += Math.sqrt(dx * dx + dy * dy); }
    if (acc >= step || i === pts.length - 1) {
      const t = i / Math.max(1, pts.length - 1);
      out.push({ x: pts[i].x + amp * Math.sin(t * 9 + seed), y: pts[i].y + amp * Math.cos(t * 7 + seed) + between(r, -0.3, 0.3) });
      acc = 0;
    }
  }
  return out;
}
