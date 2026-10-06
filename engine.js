/* Pisz — the writing engine.
 *
 * Everything that decides something lives here, with no DOM in it, so the
 * same file runs in the app, on the parent dashboard and under node in the
 * tests. index.html only draws and listens.
 *
 * Coordinates are "letter units": a capital is 100 high, y grows DOWN, the
 * top of a capital is y=0 and the baseline y=100. Accents sit above 0,
 * ogonki below 100. Every tolerance below is in these units, so it does not
 * change with the size of the screen.
 */
(function (root) {
'use strict';

var P = {};

/* ================================================================== */
/* geometry                                                            */
/* ================================================================== */

function dist(a, b){ var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx*dx + dy*dy); }
function d2(a, b){ var dx = a.x - b.x, dy = a.y - b.y; return dx*dx + dy*dy; }

function pathLen(pts){
  var L = 0;
  for(var i = 1; i < pts.length; i++) L += dist(pts[i-1], pts[i]);
  return L;
}

/* evenly spaced points along a polyline, `step` units apart */
function bySpacing(pts, step){
  if(pts.length < 2) return pts.map(function(p){ return { x:p.x, y:p.y }; });
  var out = [{ x:pts[0].x, y:pts[0].y }], carry = 0;
  for(var i = 1; i < pts.length; i++){
    var a = pts[i-1], b = pts[i], seg = dist(a, b);
    if(seg === 0) continue;
    var at = step - carry;
    while(at <= seg){
      var t = at / seg;
      out.push({ x:a.x + (b.x - a.x)*t, y:a.y + (b.y - a.y)*t });
      at += step;
    }
    carry = seg - (at - step);
  }
  var last = pts[pts.length-1], tail = out[out.length-1];
  if(dist(last, tail) > step * 0.25) out.push({ x:last.x, y:last.y });
  return out;
}

/* n points evenly spaced along a polyline */
function resample(pts, n){
  var L = pathLen(pts);
  if(L === 0 || n < 2) return pts.slice(0, 1);
  var out = bySpacing(pts, L / (n - 1));
  while(out.length > n) out.pop();
  while(out.length < n) out.push({ x:pts[pts.length-1].x, y:pts[pts.length-1].y });
  return out;
}

function bbox(pts){
  var b = { x0:Infinity, y0:Infinity, x1:-Infinity, y1:-Infinity };
  pts.forEach(function(p){
    if(p.x < b.x0) b.x0 = p.x; if(p.x > b.x1) b.x1 = p.x;
    if(p.y < b.y0) b.y0 = p.y; if(p.y > b.y1) b.y1 = p.y;
  });
  b.w = b.x1 - b.x0; b.h = b.y1 - b.y0;
  b.cx = (b.x0 + b.x1) / 2; b.cy = (b.y0 + b.y1) / 2;
  return b;
}

/* Ramer–Douglas–Peucker, so a stored sample keeps its shape in a tenth of
   the points. used only for what goes to disk, never for judging.        */
function simplify(pts, eps){
  if(pts.length < 3) return pts.slice();
  var keep = new Array(pts.length); keep[0] = keep[pts.length-1] = true;
  (function rec(i0, i1){
    var a = pts[i0], b = pts[i1], best = -1, bi = -1;
    var dx = b.x - a.x, dy = b.y - a.y, L = Math.sqrt(dx*dx + dy*dy) || 1e-9;
    for(var i = i0 + 1; i < i1; i++){
      var d = Math.abs(dy*pts[i].x - dx*pts[i].y + b.x*a.y - b.y*a.x) / L;
      if(L < 1e-6) d = dist(pts[i], a);
      if(d > best){ best = d; bi = i; }
    }
    if(best > eps){ keep[bi] = true; rec(i0, bi); rec(bi, i1); }
  })(0, pts.length - 1);
  return pts.filter(function(p, i){ return keep[i]; });
}

/* ---- the stroke language -------------------------------------------
   M x y              start here
   L x y              straight to
   C x1 y1 x2 y2 x y  cubic curve to
   A cx cy rx ry a0 a1  elliptical arc, angles in degrees, 0 = right,
                      90 = down. a1 > a0 turns clockwise on screen,
                      a1 < a0 anticlockwise. it starts wherever a0 puts it.
   D x y              a dot: a stroke that is a single tap
   The direction a stroke is written in IS the direction it is defined in.
   ------------------------------------------------------------------- */
function parseStroke(src){
  var tok = src.trim().split(/[\s,]+/), i = 0, pts = [], cur = null, dot = false;
  function num(){ var v = parseFloat(tok[i++]); if(isNaN(v)) throw new Error('bad number in "' + src + '"'); return v; }
  function push(p){ if(!pts.length || dist(pts[pts.length-1], p) > 1e-6) pts.push(p); cur = p; }
  while(i < tok.length){
    var c = tok[i++];
    if(c === 'M'){ push({ x:num(), y:num() }); }
    else if(c === 'D'){ push({ x:num(), y:num() }); dot = true; }
    else if(c === 'L'){
      var to = { x:num(), y:num() }, n = Math.max(1, Math.ceil(dist(cur, to)));
      for(var k = 1; k <= n; k++) push({ x:cur.x + (to.x - cur.x)*k/n, y:cur.y + (to.y - cur.y)*k/n });
      cur = to;
    }
    else if(c === 'C'){
      var p0 = cur, p1 = { x:num(), y:num() }, p2 = { x:num(), y:num() }, p3 = { x:num(), y:num() };
      var est = dist(p0, p1) + dist(p1, p2) + dist(p2, p3), m = Math.max(4, Math.ceil(est));
      for(var j = 1; j <= m; j++){
        var t = j / m, u = 1 - t;
        push({ x:u*u*u*p0.x + 3*u*u*t*p1.x + 3*u*t*t*p2.x + t*t*t*p3.x,
               y:u*u*u*p0.y + 3*u*u*t*p1.y + 3*u*t*t*p2.y + t*t*t*p3.y });
      }
    }
    else if(c === 'A'){
      var cx = num(), cy = num(), rx = num(), ry = num(), a0 = num(), a1 = num();
      var r0 = a0 * Math.PI/180, r1 = a1 * Math.PI/180;
      var arcLen = Math.abs(r1 - r0) * (rx + ry) / 2, s = Math.max(6, Math.ceil(arcLen));
      for(var q = 0; q <= s; q++){
        var ang = r0 + (r1 - r0) * q / s;
        push({ x:cx + rx*Math.cos(ang), y:cy + ry*Math.sin(ang) });
      }
    }
    else throw new Error('unknown command "' + c + '" in "' + src + '"');
  }
  return { pts:pts, dot:dot };
}

/* ================================================================== */
/* what she writes                                                     */
/* ================================================================== */
/* Stroke order and direction follow the common school print model:
   every stroke starts at the top, lines go down or left-to-right, round
   letters start at the top and go anticlockwise, and a mark (accent, dot,
   ogonek, ring, slash) always comes last. See PLAN.md for the sources.
   `cue` is one word per stroke the guide says while drawing it.
   `mark` lists strokes that are diacritics, so a missing one can be named. */

var G = {};
function glyph(id, kind, strokes, opt){
  opt = opt || {};
  G[id] = { id:id, kind:kind, src:strokes, cue:opt.cue || [], mark:opt.mark || [],
            needs:opt.needs || [], theme:opt.theme || null, base:opt.base || null };
}

/* -- shapes: the pre-writing strokes, in the order children can copy them -- */
glyph('|',   'shape', ['M 0 0 L 0 100'],                         { cue:['d'], theme:'rain' });
glyph('-',   'shape', ['M 0 50 L 100 50'],                       { cue:['a'], theme:'road' });
glyph('o',   'shape', ['A 50 50 50 50 -90 -450'],                { cue:['r'], theme:'ball' });
glyph('+',   'shape', ['M 50 0 L 50 100', 'M 0 50 L 100 50'],    { cue:['d','a'], theme:'plus', needs:['|','-'] });
glyph('/',   'shape', ['M 80 0 L 0 100'],                        { cue:['s'], theme:'slide', needs:['|','-'] });
glyph('\\',  'shape', ['M 0 0 L 80 100'],                        { cue:['s'], theme:'slide', needs:['|','-'] });
glyph('#',   'shape', ['M 0 0 L 0 90 L 90 90 L 90 0 L 0 0'],      { cue:['q'], theme:'box', needs:['|','-'] });
glyph('^',   'shape', ['M 0 100 L 45 0 L 90 100'],               { cue:['u'], theme:'mountain', needs:['\\','/'] });
glyph('~',   'shape', ['M 0 55 C 12 20 38 20 50 55 C 62 90 88 90 100 55'], { cue:['w'], theme:'wave', needs:['o'] });
glyph('n',   'shape', ['A 50 100 50 75 180 360'],                { cue:['r'], theme:'rainbow', needs:['o'] });
glyph('x',   'shape', ['M 0 0 L 80 100', 'M 80 0 L 0 100'],      { cue:['s','s'], theme:'x', needs:['\\','/'] });
glyph('z',   'shape', ['M 0 30 L 20 80 L 40 30 L 60 80 L 80 30 L 100 80'], { cue:['z'], theme:'zigzag', needs:['\\','/'] });

/* -- capitals -- */
var L = {
  A:[['M 40 0 L 0 100','M 40 0 L 80 100','M 18 62 L 62 62'], 'ssa', ['\\','/']],
  B:[['M 0 0 L 0 100','M 0 0 C 70 0 70 48 0 48 C 80 48 80 100 0 100'], 'db', ['|','o']],
  C:[['A 46 50 46 50 -40 -320'], 'r', ['o']],
  D:[['M 0 0 L 0 100','M 0 0 C 98 0 98 100 0 100'], 'db', ['|','o']],
  E:[['M 0 0 L 0 100','M 0 0 L 58 0','M 0 50 L 50 50','M 0 100 L 58 100'], 'daaa', ['|','-']],
  F:[['M 0 0 L 0 100','M 0 0 L 56 0','M 0 50 L 48 50'], 'daa', ['|','-']],
  G:[['A 46 50 46 50 -40 -360 L 54 50'], 'r', ['o']],
  H:[['M 0 0 L 0 100','M 66 0 L 66 100','M 0 50 L 66 50'], 'dda', ['|','-']],
  I:[['M 0 0 L 0 100'], 'd', ['|']],
  J:[['M 52 0 L 52 70 A 26 70 26 30 0 180'], 'd', ['|','o']],
  K:[['M 0 0 L 0 100','M 60 0 L 3 54 L 62 100'], 'ds', ['|','\\','/']],
  L:[['M 0 0 L 0 100 L 56 100'], 'd', ['|','-']],
  M:[['M 0 0 L 0 100','M 0 0 L 42 100 L 84 0 L 84 100'], 'ds', ['|','\\','/']],
  N:[['M 0 0 L 0 100','M 0 0 L 68 100 L 68 0'], 'ds', ['|','\\']],
  O:[['A 46 50 46 50 -90 -450'], 'r', ['o']],
  P:[['M 0 0 L 0 100','M 0 0 C 76 0 76 54 0 54'], 'db', ['|','o']],
  Q:[['A 46 50 46 50 -90 -450','M 58 70 L 94 104'], 'rs', ['o','\\']],
  R:[['M 0 0 L 0 100','M 0 0 C 74 0 74 52 0 52 L 62 100'], 'db', ['|','o','\\']],
  S:[['A 36 25 33 25 -25 -270 A 36 75 35 25 -90 150'], 'r', ['o','~']],
  T:[['M 35 0 L 35 100','M 0 0 L 70 0'], 'da', ['|','-']],
  U:[['M 0 0 L 0 66 A 33 66 33 34 180 0 L 66 0'], 'd', ['|','o']],
  V:[['M 0 0 L 38 100 L 76 0'], 's', ['\\','/']],
  W:[['M 0 0 L 24 100 L 52 0 L 80 100 L 104 0'], 's', ['\\','/']],
  X:[['M 0 0 L 70 100','M 70 0 L 0 100'], 'ss', ['\\','/']],
  Y:[['M 0 0 L 36 50','M 72 0 L 36 50 L 36 100'], 'ss', ['\\','/','|']],
  Z:[['M 0 0 L 66 0 L 0 100 L 66 100'], 'a', ['-','/']]
};
Object.keys(L).forEach(function(k){
  glyph(k, 'letter', L[k][0], { cue:L[k][1].split(''), needs:L[k][2] });
});

/* letters built from another letter plus a mark. the mark comes last, and
   the base letter must be known first (needs).                          */
function withMark(id, base, mark, cue, dx){
  var b = G[base];
  glyph(id, 'letter', b.src.concat([mark]), { cue:b.cue.concat([cue]), mark:[b.src.length],
                                              needs:[base], base:base });
}
withMark('Ą', 'A', 'M 80 100 C 64 106 64 124 84 122', 'o');
withMark('Ć', 'C', 'M 60 -32 L 48 -10', 'k');
withMark('Ę', 'E', 'M 56 100 C 40 106 40 124 60 122', 'o');
withMark('Ł', 'L', 'M 24 36 L -12 64', 'k');
withMark('Ń', 'N', 'M 44 -32 L 32 -10', 'k');
withMark('Ó', 'O', 'M 58 -32 L 46 -10', 'k');
withMark('Ś', 'S', 'M 48 -32 L 36 -10', 'k');
withMark('Ź', 'Z', 'M 42 -32 L 30 -10', 'k');
withMark('Ż', 'Z', 'D 33 -16', 'p');
withMark('Ø', 'O', 'M 90 -8 L 2 108', 'k');
withMark('Å', 'A', 'A 40 -17 11 11 -90 -450', 'r');
glyph('Æ', 'letter', ['M 48 0 L 0 100', 'M 48 0 L 48 100', 'M 48 0 L 96 0',
                      'M 24 50 L 90 50', 'M 48 100 L 96 100'],
      { cue:'sdaaa'.split(''), needs:['A','E'] });

/* -- digits, European forms: 1 with a flag, 7 without a bar -- */
var D = {
  '0':[['A 34 50 34 50 -90 -450'], 'r', ['o']],
  '1':[['M 6 26 L 36 0 L 36 100'], 's', ['|','/']],
  '2':[['M 4 26 C 4 -8 64 -8 62 26 C 60 52 22 70 0 100 L 64 100'], 'r', ['o','/']],
  '3':[['M 4 14 C 26 -6 64 0 60 26 C 58 42 40 48 24 48 C 46 48 66 56 66 76 C 66 104 22 108 2 90'], 'r', ['o']],
  '4':[['M 42 0 L 0 66 L 66 66','M 50 30 L 50 100'], 'sd', ['|','-','/']],
  '5':[['M 6 0 L 3 44 C 30 32 64 40 62 70 C 60 104 18 106 0 88','M 6 0 L 58 0'], 'da', ['|','o']],
  '6':[['M 56 4 C 22 -8 2 26 2 62 C 2 92 20 100 34 100 C 54 100 66 88 66 70 C 66 52 52 42 36 42 C 20 42 6 50 2 64'], 'r', ['o']],
  '7':[['M 0 0 L 64 0 L 20 100','M 16 52 L 58 52'], 'aa', ['-','/']],
  '8':[['M 56 18 C 52 -6 8 -6 8 20 C 8 44 62 52 62 76 C 62 106 2 106 2 76 C 2 52 56 44 56 18'], 'r', ['o','~']],
  '9':[['A 32 28 28 28 -15 -360 L 60 100'], 'r', ['o','|']]
};
Object.keys(D).forEach(function(k){
  glyph(k, 'digit', D[k][0], { cue:D[k][1].split(''), needs:D[k][2] });
});

/* sample every glyph once */
Object.keys(G).forEach(function(id){
  var g = G[id];
  g.strokes = g.src.map(function(s){
    var r = parseStroke(s);
    var pts = r.dot ? r.pts : bySpacing(r.pts, 1);
    var cum = [0];
    for(var i = 1; i < pts.length; i++) cum.push(cum[i-1] + dist(pts[i-1], pts[i]));
    return { pts:pts, cum:cum, len:cum[cum.length-1], dot:r.dot };
  });
  var all = [];
  g.strokes.forEach(function(s){ all = all.concat(s.pts); });
  g.box = bbox(all);
  var body = [];
  g.strokes.forEach(function(s, i){ if(g.mark.indexOf(i) < 0) body = body.concat(s.pts); });
  g.body = bbox(body);
});

P.G = G;
P.glyph = function(id){ return G[id]; };

/* ================================================================== */
/* the curriculum                                                      */
/* ================================================================== */
/* Shapes first, then capitals grouped by the strokes they need: straight
   lines, then round, then line-plus-round, then slants, then S. A letter is
   offered only once the shapes it is built from are in her hand (`needs`),
   and the letters of her own name jump the queue as soon as they qualify.  */
P.SHAPES  = ['|','-','o','+','/','\\','#','x','^','z','n','~'];
/* Straight lines, then round, then slanted (the HWT pre-K order; O is
   the capital preschoolers write correctly most often — Puranik & Lonigan
   2011), S last of the plain ones because it is the hardest. Polish has
   no Q V X and Norwegian hardly uses Q or X: X is practised as a shape.  */
P.LETTERS = {
  pl:['L','I','T','H','F','E','O','C','U','D','P','B','R','J','G',
      'A','N','M','K','W','Y','Z','S',
      'Ł','Ó','Ć','Ę','Ą','Ń','Ś','Ż','Ź'],
  nb:['L','I','T','H','F','E','O','C','U','D','P','B','R','J','G',
      'A','V','N','M','K','W','Y','Z','S',
      'Ø','Å','Æ']
};
P.DIGITS = ['1','0','7','4','2','3','5','6','8','9'];

/* ================================================================== */
/* tracing: following a stroke she can see                             */
/* ================================================================== */
/* One Tracer per template stroke. It only ever moves FORWARD along the
   stroke, which is what makes direction and start point matter without a
   separate rule: begun at the wrong end, or drawn backwards, nothing
   advances. A lifted finger keeps its progress — she may stop half way and
   carry on from where she stopped.                                       */
function Tracer(stroke, opt){
  opt = opt || {};
  this.s = stroke;
  this.tol = opt.tol || 15;            /* how far off the line still counts */
  this.startTol = opt.startTol || this.tol * 1.3;
  this.endTol = opt.endTol || 7;       /* this close to the end is done      */
  this.window = opt.window || 28;      /* how far ahead one move may reach   */
  this.idx = 0;                        /* furthest point reached             */
  this.down = false;
  this.done = false;
  this.last = null;
  this.offRun = 0;                     /* units drawn off the line, this go  */
  this.bidir = !!opt.bidir;            /* an accent or slash: either way is right */
  this.off = 0;                        /* total units drawn off the line     */
  this.lifts = 0;
}
Tracer.prototype.progress = function(){
  return this.s.len ? this.s.cum[this.idx] / this.s.len : (this.done ? 1 : 0);
};
Tracer.prototype.point = function(){ return this.s.pts[this.idx]; };

/* returns why a touch did not start the stroke, or 'ok' */
Tracer.prototype.begin = function(p){
  if(this.done) return 'done';
  var here = this.s.pts[this.idx];
  var tol = this.idx === 0 ? this.startTol : this.tol * 1.6;
  if(this.s.dot){
    if(dist(p, here) <= this.startTol){ this.done = true; this.idx = 0; return 'ok'; }
    return 'start';
  }
  if(dist(p, here) <= tol){
    this.down = true; this.last = { x:p.x, y:p.y }; this.offRun = 0;
    if(this.idx > 0) this.lifts++;
    this.move(p);
    return 'ok';
  }
  /* nobody teaches which way an accent or a slash goes: from either end */
  var end = this.s.pts[this.s.pts.length-1];
  if(this.bidir && this.idx === 0 && dist(p, end) <= this.startTol){
    var rp = this.s.pts.slice().reverse(), cum = [0];
    for(var i = 1; i < rp.length; i++) cum.push(cum[i-1] + dist(rp[i-1], rp[i]));
    this.s = { pts:rp, cum:cum, len:this.s.len, dot:false };
    this.bidir = false;
    return this.begin(p);
  }
  /* why not: began at the far end (backwards), somewhere else on the line,
     or nowhere near it                                                    */
  if(this.idx === 0 && dist(p, end) <= this.startTol && dist(end, here) > this.startTol) return 'end';
  if(this.nearest(p).d <= this.tol) return 'start';
  return 'off';
};

Tracer.prototype.nearest = function(p){
  var best = Infinity, bi = 0, pts = this.s.pts;
  for(var i = 0; i < pts.length; i++){
    var dd = d2(p, pts[i]);
    if(dd < best){ best = dd; bi = i; }
  }
  return { i:bi, d:Math.sqrt(best) };
};

/* feed a finger position; returns { adv: points advanced, off: bool, back: bool } */
Tracer.prototype.move = function(p){
  var r = { adv:0, off:false, back:false };
  if(!this.down || this.done) return r;
  /* fill in between two events so a fast swipe cannot jump the window */
  var from = this.last || p, seg = dist(from, p), n = Math.max(1, Math.ceil(seg / 2));
  var pts = this.s.pts, cum = this.s.cum;
  for(var k = 1; k <= n; k++){
    var q = { x:from.x + (p.x - from.x)*k/n, y:from.y + (p.y - from.y)*k/n };
    var limit = cum[this.idx] + this.window, best = Infinity, bi = -1;
    for(var i = this.idx; i < pts.length && cum[i] <= limit; i++){
      var dd = d2(q, pts[i]);
      if(dd < best){ best = dd; bi = i; }
    }
    if(Math.sqrt(best) <= this.tol){
      if(bi > this.idx){ r.adv += bi - this.idx; this.idx = bi; }
      this.offRun = 0;
    } else {
      var step = seg / n;
      this.offRun += step; this.off += step;
      r.off = true;
      /* on the line, but behind her: she is going the wrong way */
      var nr = this.nearest(q);
      if(nr.d <= this.tol && cum[nr.i] < cum[this.idx] - this.window * 0.5) r.back = true;
    }
  }
  this.last = { x:p.x, y:p.y };
  if(this.s.len - cum[this.idx] <= this.endTol){ this.idx = pts.length - 1; this.done = true; this.down = false; }
  return r;
};

/* lifting the finger a little short of the end still finishes the stroke:
   children stop short, and a wobble near the end is not a missing part  */
Tracer.prototype.end = function(){
  if(this.down && !this.done && this.idx > 0 &&
     this.s.len - this.s.cum[this.idx] <= Math.max(this.endTol * 1.5, this.s.len * 0.1)){
    this.idx = this.s.pts.length - 1; this.done = true;
  }
  this.down = false; this.last = null;
};

P.Tracer = Tracer;

/* ================================================================== */
/* judging free writing                                                */
/* ================================================================== */
/* She writes anywhere, at any size. Her ink is fitted onto the template —
   scale, a little stretch, a little shift — and then two things are asked:
     coverage   is every stroke of the letter there?   (per stroke)
     precision  is everything she drew part of the letter?
   Both are fractions of points within `tol` of the other side. Order and
   direction are judged separately and do not decide pass/fail; they are
   logged, and they decide whether the next item brings tracing back.     */

var FIT_FY = [0.82, 0.91, 1, 1.1, 1.22];
var FIT_FX = [0.68, 0.8, 0.9, 1, 1.12, 1.26, 1.45];

/* Points carry the direction of the line through them (unsigned: a line
   drawn backwards still lies the same way). Two points only match when
   they are close AND their lines run the same way. Without it a Z
   "covered" an I and an E passed as a B: at a forgiving tolerance
   everything is near something. 1883 of 3422 wrong-letter pairs passed
   on distance alone.                                                     */
P.TUNE = { cos:0.6 };

function tangents(pts, k){
  return pts.map(function(p, i){
    var a = pts[Math.max(0, i - k)], b = pts[Math.min(pts.length - 1, i + k)];
    var dx = b.x - a.x, dy = b.y - a.y, L = Math.sqrt(dx*dx + dy*dy);
    return { x:p.x, y:p.y, tx:L > 1e-6 ? dx / L : 0, ty:L > 1e-6 ? dy / L : 0 };
  });
}

function same(a, b, tol2){
  if(d2(a, b) > tol2) return false;
  if((!a.tx && !a.ty) || (!b.tx && !b.ty)) return true;       /* a dot has no direction */
  return Math.abs(a.tx*b.tx + a.ty*b.ty) >= P.TUNE.cos;
}

/* points bucketed by cell, so "is anything near p" reads nine cells
   instead of every point — the judge runs on every lift of her finger,
   once per rival letter, on a tablet                                    */
function Grid(pts, cell){
  this.c = cell; this.m = {};
  for(var i = 0; i < pts.length; i++){
    var p = pts[i], k = Math.floor(p.x / cell) + ',' + Math.floor(p.y / cell);
    (this.m[k] || (this.m[k] = [])).push(p);
  }
}
Grid.prototype.any = function(p, tol2){
  var cx = Math.floor(p.x / this.c), cy = Math.floor(p.y / this.c);
  for(var dx = -1; dx <= 1; dx++) for(var dy = -1; dy <= 1; dy++){
    var b = this.m[(cx + dx) + ',' + (cy + dy)];
    if(!b) continue;
    for(var i = 0; i < b.length; i++) if(same(p, b[i], tol2)) return true;
  }
  return false;
};

/* the template, sampled at ~3 units with directions, cached per glyph */
var PREP = {};
function prep(g, mirror, tol){
  var key = g.id + (mirror ? '|m|' : '||') + tol;
  if(PREP[key]) return PREP[key];
  var T = g.strokes.map(function(s){
    var pts = s.dot ? s.pts : bySpacing(s.pts, 3);
    if(mirror) pts = pts.map(function(p){ return { x:g.box.x0 + g.box.x1 - p.x, y:p.y }; });
    return s.dot ? pts.map(function(p){ return { x:p.x, y:p.y, tx:0, ty:0 }; }) : tangents(pts, 2);
  });
  var all = [].concat.apply([], T);
  /* an accent, a dot, a slash or a ring has to be its own little stroke:
     a Z whose top bar happens to pass near where the dot of Ż would be has
     not drawn the dot. an ogonek may hang off the leg in one go.         */
  var kind = g.strokes.map(function(s, i){
    if(s.dot) return 'dot';
    if(g.mark.indexOf(i) >= 0 && g.cue[i] !== 'o') return 'mark';
    return 'body';
  });
  var pr = PREP[key] = { T:T, all:all, kind:kind, grid:new Grid(all, tol * 1.15) };
  if(!mirror){
    var mT = g.strokes.map(function(s){
      var pts = s.dot ? s.pts : bySpacing(s.pts, 3);
      pts = pts.map(function(p){ return { x:g.box.x0 + g.box.x1 - p.x, y:p.y }; });
      return s.dot ? pts.map(function(p){ return { x:p.x, y:p.y, tx:0, ty:0 }; }) : tangents(pts, 2);
    });
    pr.sym = coverScore({ T:T, grid:pr.grid }, mT, tol).minCov >= 0.85;
  }
  return pr;
}

/* V: her strokes, already fitted. tAll / pr.all: flattened points.  */
function coverScore(pr, V, tol){
  var tol2 = tol*tol, ptol2 = tol2 * 1.3, cell = tol * 1.15;
  var flatU = [].concat.apply([], V), ug = new Grid(flatU, cell), mg = null, dg = null;
  if(pr.kind && pr.kind.some(function(k){ return k !== 'body'; })){
    var lens = V.map(pathLen), total = lens.reduce(function(a, b){ return a + b; }, 0);
    mg = new Grid([].concat.apply([], V.filter(function(s, i){ return lens[i] <= total * 0.45; })), cell);
    dg = new Grid([].concat.apply([], V.filter(function(s, i){ return lens[i] <= 14; })), cell);
  }
  var cov = pr.T.map(function(s, k){
    var hit = 0, grid = !pr.kind ? ug : pr.kind[k] === 'mark' ? mg : pr.kind[k] === 'dot' ? dg : ug;
    for(var i = 0; i < s.length; i++) if(grid.any(s[i], tol2)) hit++;
    return s.length ? hit / s.length : 0;
  });
  var prec = 0;
  for(var j = 0; j < flatU.length; j++) if(pr.grid.any(flatU[j], ptol2)) prec++;
  prec = flatU.length ? prec / flatU.length : 0;
  var minCov = Math.min.apply(null, cov), mean = cov.reduce(function(a, b){ return a + b; }, 0) / cov.length;
  return { cov:cov, minCov:minCov, meanCov:mean, prec:prec, score:(0.5*minCov + 0.5*mean) * prec };
}

/* her strokes, scaled and moved; directions are carried through the same
   stretch so a squashed diagonal still points where it really points    */
function transform(U, ub, ref, sx, sy, dx, dy){
  return U.map(function(s){
    return s.map(function(p){
      var tx = p.tx * sx, ty = p.ty * sy, L = Math.sqrt(tx*tx + ty*ty);
      return { x:(p.x - ub.cx) * sx + ref.cx + dx, y:(p.y - ub.cy) * sy + ref.cy + dy,
               tx:L > 1e-9 ? tx / L : 0, ty:L > 1e-9 ? ty / L : 0 };
    });
  });
}

/* best fit of her strokes U onto the template. tries fitting her ink to
   the whole glyph and to the glyph without its marks, so a missing accent
   is reported as a missing accent rather than as a squashed letter.     */
function fit(U, g, pr, tol){
  var flat = [].concat.apply([], U), ub = bbox(flat);
  var refs = [g.box];
  if(g.mark.length) refs.push(g.body);
  var best = null;
  function tryIt(ref, sx, sy, dx, dy){
    var V = transform(U, ub, ref, sx, sy, dx, dy);
    var sc = coverScore(pr, V, tol);
    if(!best || sc.score > best.sc.score) best = { sc:sc, sx:sx, sy:sy, ref:ref, dx:dx, dy:dy, V:V };
  }
  refs.forEach(function(ref){
    var base;
    if(ref.h >= 25 && ub.h >= 4) base = ref.h / ub.h;
    else if(ref.w >= 25 && ub.w >= 4) base = ref.w / ub.w;
    else base = 1;
    /* a narrow template (I, |) says nothing about width: keep her aspect */
    var narrow = ref.w < 12;
    FIT_FY.forEach(function(fy){
      (narrow ? [1] : FIT_FX).forEach(function(fx){
        var sy = base * fy;
        tryIt(ref, narrow ? sy : sy * fx, sy, 0, 0);
      });
    });
  });
  /* then nudge position */
  var b0 = best;
  [-6, -3, 0, 3, 6].forEach(function(dx){
    [-6, -3, 0, 3, 6].forEach(function(dy){
      if(dx || dy) tryIt(b0.ref, b0.sx, b0.sy, dx, dy);
    });
  });
  best.ub = ub;
  return best;
}

/* which template stroke each of her strokes drew, and in which direction */
function formation(V, g, tol){
  var tol2 = tol*tol, out = { order:true, dir:[], start:true, assign:[] };
  var used = [];
  g.strokes.forEach(function(s, ti){
    var T = s.dot ? s.pts : bySpacing(s.pts, 3);
    var bestJ = -1, bestHit = 0;
    V.forEach(function(u, j){
      var hit = 0;
      T.forEach(function(p){
        for(var i = 0; i < u.length; i++){ if(d2(p, u[i]) <= tol2){ hit++; return; } }
      });
      if(hit > bestHit){ bestHit = hit; bestJ = j; }
    });
    out.assign.push(bestJ);
    /* marks: nobody teaches which way an accent or a slash is drawn, so
       neither way is a mistake                                          */
    if(bestJ < 0 || s.dot || g.mark.indexOf(ti) >= 0){ out.dir.push(true); return; }
    var u = V[bestJ];
    function along(p){
      var bi = 0, bd = Infinity;
      for(var i = 0; i < s.pts.length; i++){ var dd = d2(p, s.pts[i]); if(dd < bd){ bd = dd; bi = i; } }
      return s.cum[bi] / (s.len || 1);
    }
    var closed = dist(s.pts[0], s.pts[s.pts.length-1]) < 12;
    var forward;
    if(closed){
      /* a circle starts and ends in the same place; its direction is the sign of its area */
      forward = (signedArea(u) > 0) === (signedArea(s.pts) > 0);
    } else {
      forward = along(u[u.length-1]) >= along(u[0]) - 0.05;
    }
    out.dir.push(forward);
    if(used.length && bestJ < used[used.length-1]) out.order = false;
    used.push(bestJ);
  });
  var first = g.strokes[0], u0 = V[out.assign[0]] || V[0];
  out.start = !!(u0 && dist(u0[0], first.pts[0]) <= tol * 1.6);
  if(first && dist(first.pts[0], first.pts[first.pts.length-1]) < 12){
    /* round letters: anywhere in the top 40% of the circle counts as the top */
    out.start = !!(u0 && u0[0].y <= g.box.y0 + g.box.h * 0.4);
  }
  return out;
}

function signedArea(pts){
  var a = 0;
  for(var i = 0; i < pts.length; i++){
    var p = pts[i], q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

/* levels of leniency. `gentle` is where a four-year-old starts. */
P.STRICT = {
  gentle:{ tol:15, minCov:0.72, minPrec:0.74 },
  normal:{ tol:13, minCov:0.8,  minPrec:0.8  },
  strict:{ tol:11, minCov:0.86, minPrec:0.86 }
};

function prepUser(strokes, g){
  var U = strokes.filter(function(s){ return s && s.length; }).map(function(s){
    var sp = bySpacing(s, 2);
    return sp.length ? sp : s;
  });
  /* specks: a stray touch is not a stroke, unless this letter has a dot */
  var hasDot = g.strokes.some(function(s){ return s.dot; });
  U = U.filter(function(s){ return hasDot || pathLen(s) >= 4; });
  return U.map(function(s){ return tangents(s, 3); });
}

/* strokes: [[{x,y}...]...] in letter units. returns the verdict.
   fast: shape only — no mirror test, no formation (used for rivals).    */
P.judge = function(strokes, id, strictness, fast){
  var g = G[id], cfg = P.STRICT[strictness || 'gentle'] || P.STRICT.gentle;
  var res = { ok:false, id:id, errors:[], strokes:strokes.length, score:0 };
  var U = Array.isArray(strokes.U) ? strokes.U : prepUser(strokes, g);
  if(!U.length){ res.errors.push('empty'); return res; }

  var pr = prep(g, false, cfg.tol);
  var f = fit(U, g, pr, cfg.tol);
  res.cov = f.sc.cov.map(function(c){ return Math.round(c * 100) / 100; });
  res.prec = Math.round(f.sc.prec * 100) / 100;
  res.score = Math.round(f.sc.score * 100);
  var shapeOk = f.sc.minCov >= cfg.minCov && f.sc.prec >= cfg.minPrec;
  res.ok = shapeOk;
  if(fast) return res;

  /* Written as a mirror image? At a tolerance kind enough for a four-year-
     old a backwards B or S can still pass as the letter, so for any letter
     that is not its own mirror the mirrored template is always tried: if
     it fits clearly better, it was written backwards. Normal at this age
     (Fischer 2021) — shown the model again, never counted against her.  */
  if(!pr.sym){
    var pm = prep(g, true, cfg.tol);
    var fm = fit(U, g, pm, cfg.tol);
    if(fm.sc.minCov >= cfg.minCov && fm.sc.prec >= cfg.minPrec && fm.sc.score >= f.sc.score + 0.1){
      res.errors.push('mirror'); shapeOk = false; res.ok = false;
    }
  }

  /* a missing mark is its own, nameable mistake */
  var markMiss = g.mark.filter(function(i){ return f.sc.cov[i] < cfg.minCov; });
  var bodyOk = f.sc.cov.every(function(c, i){ return g.mark.indexOf(i) >= 0 || c >= cfg.minCov; });
  if(markMiss.length && bodyOk) res.errors.push('mark');

  var fo = formation(f.V, g, cfg.tol);
  if(!fo.start) res.errors.push('start');
  if(fo.dir.some(function(d){ return !d; })) res.errors.push('dir');
  if(!fo.order) res.errors.push('order');
  res.dir = fo.dir;

  res.fit = { sx:f.sx, sy:f.sy, dx:f.dx, dy:f.dy, ref:{ cx:f.ref.cx, cy:f.ref.cy }, ub:{ cx:f.ub.cx, cy:f.ub.cy } };
  if(!shapeOk && res.errors.indexOf('mark') < 0 && res.errors.indexOf('mirror') < 0) res.errors.push('shape');
  return res;
};

/* The judge above asks "is this close enough to X". With a forgiving
   tolerance plenty of things are close enough to X — an oval to a 4, an E
   to an F — so the answer the child sees also asks "is it closer to
   something else". A rival wins only if it passes on its own and beats the
   target by a clear margin: a wobbly 4 that is a bit like a 9 still counts.
   candidates: glyph ids she might plausibly have written instead.        */
P.MARGIN = 8;
P.RIVALS = 6;      /* how many of the closest candidates get the full fit */
P.SAME = [['0','o','O'], ['|','I'], ['x','X']];
function twins(a, b){
  return P.SAME.some(function(g){ return g.indexOf(a) >= 0 && g.indexOf(b) >= 0; });
}
P.verify = function(strokes, id, strictness, candidates){
  var r = P.judge(strokes, id, strictness);
  if(!r.ok) return r;
  var cache = {}, cfg = P.STRICT[strictness || 'gentle'] || P.STRICT.gentle;
  var rival = null;
  function userFor(c){
    /* prepUser depends only on whether the glyph has a dot; share it */
    var dotty = G[c].strokes.some(function(s){ return s.dot; }) ? 1 : 0;
    return cache[dotty] || (cache[dotty] = prepUser(strokes, G[c]));
  }
  /* one unshifted fit per candidate to rank them; the full search only for
     the closest few — the whole alphabet took 216 ms, too slow on a lift */
  var ranked = (candidates || []).filter(function(c){ return c !== id && G[c] && !twins(c, id); })
    .map(function(c){
      var g = G[c], U = userFor(c), ub = bbox([].concat.apply([], U));
      var base = g.box.h >= 25 && ub.h >= 4 ? g.box.h / ub.h : g.box.w >= 25 && ub.w >= 4 ? g.box.w / ub.w : 1;
      var V = transform(U, ub, g.box, g.box.w < 12 ? base : base, base, 0, 0);
      return { c:c, q:coverScore(prep(g, false, cfg.tol), V, cfg.tol).score };
    })
    .sort(function(a, b){ return b.q - a.q; })
    .slice(0, P.RIVALS);
  ranked.forEach(function(x){
    var input = []; input.U = userFor(x.c);
    var o = P.judge(input, x.c, strictness, true);
    if(o.ok && o.score >= r.score + P.MARGIN && (!rival || o.score > rival.score)) rival = { id:x.c, score:o.score };
  });
  if(rival){ r.ok = false; r.errors.push('other'); r.other = rival.id; }
  return r;
};

/* What she drew is mostly another glyph — for the parent, not the child. */
P.closest = function(strokes, candidates, strictness){
  var best = null;
  candidates.forEach(function(id){
    var r = P.judge(strokes, id, strictness, true);
    if(!best || r.score > best.score) best = { id:id, score:r.score, ok:r.ok };
  });
  return best;
};
/* ================================================================== */
/* samples on disk                                                     */
/* ================================================================== */
/* integers, simplified, flattened: [[x,y,x,y...], ...]                */
P.pack = function(strokes){
  return strokes.map(function(s){
    var out = [];
    simplify(s, 0.9).forEach(function(p){ out.push(Math.round(p.x), Math.round(p.y)); });
    return out;
  });
};
P.unpack = function(packed){
  return (packed || []).map(function(a){
    var s = [];
    for(var i = 0; i + 1 < a.length; i += 2) s.push({ x:a[i], y:a[i+1] });
    return s;
  });
};

/* ================================================================== */
/* what she knows, rebuilt from the log                                */
/* ================================================================== */
/* A log row per finished step:
     t   when                 g   glyph id
     st  step: R road, T dots, C copy, M from memory, N name
     ok  1 passed, 0 not      e   errors, comma list (start,dir,order,mirror,mark,shape,off)
     ms  time on the step     l   language she was playing in
     s   her strokes (copy, memory, name only) — packed
     sc  shape score 0-100
   Other rows: k:'S' session finished (x = prize), k:'D' device report.
   Mastery is derived from rows, never stored as the truth, so two devices
   merge by replaying both logs — the rule Litery learned the hard way.

   Levels:
     0 new · 1 traced the road · 2 traced the dots · 3 copied from a model
     4 wrote from memory · 5 from memory on two different days (owned)    */
P.LEVELS = ['new','road','dots','copy','memory','owned'];

function dayKey(ts){
  var d = new Date(ts);
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
P.dayKey = dayKey;

P.rebuild = function(log){
  var M = {};
  /* only glyphs this build knows: a row from a newer build, or a bad one,
     must not become a "letter" nothing can draw                          */
  log.filter(function(r){ return r && r.g && r.st && G[r.g]; })
     .slice().sort(function(a, b){ return a.t - b.t; })
     .forEach(function(r){
       var m = M[r.g] || (M[r.g] = { lv:0, n:0, ok:0, last:0, memDays:{}, fails:0,
                                     errs:{}, recent:[], firstAt:r.t });
       m.n++; m.last = r.t;
       if(r.ok) m.ok++;
       (r.e ? String(r.e).split(',') : []).forEach(function(e){ if(e) m.errs[e] = (m.errs[e] || 0) + 1; });
       m.recent.push({ st:r.st, ok:r.ok ? 1 : 0, e:r.e || '' });
       if(m.recent.length > 6) m.recent.shift();
       var gain = { R:1, T:2, C:3, M:4, N:3 }[r.st] || 0;
       if(r.ok){
         m.fails = 0;
         if(r.st === 'M'){ m.memDays[dayKey(r.t)] = 1; }
         m.lv = Math.max(m.lv, gain);
         if(Object.keys(m.memDays).length >= 2) m.lv = 5;
       } else if((r.st === 'C' || r.st === 'M') && !/mirror/.test(r.e || '')){
         /* a mirrored letter is a stage children pass through, not a miss
            (Fischer 2021): it is shown again, never counted against her */
         m.fails++;
         /* two misses in a row at the top of what she can do: step back one,
            so the next item gives her the model again                      */
         if(m.fails >= 2 && m.lv >= gain && gain >= 3){ m.lv = gain - 1; m.fails = 0; m.memDays = {}; }
       }
     });
  return M;
};

/* the steps an item takes, given where she is with that glyph */
P.plan = function(m, opt){
  opt = opt || {};
  var lv = m ? m.lv : 0;
  var formErr = m && m.recent.slice(-3).filter(function(r){
    return /start|dir/.test(r.e);
  }).length >= 2;
  /* watch -> trace -> copy in one go for something new; from memory only
     on a later visit, because recall after a delay is the step that
     teaches (Berninger 1997) and the one where reversals show up        */
  var p;
  if(opt.shape){
    p = lv <= 0 ? ['R', 'T'] : lv === 1 ? ['T', 'C'] : ['C'];
  } else {
    if(lv <= 0) p = ['R', 'T', 'C'];
    else if(lv === 1) p = ['T', 'C'];
    else if(lv === 2) p = ['C'];
    else p = ['M'];
  }
  /* starting points and directions keep going wrong: trace once first,
     which is the only step that will not let her do it backwards        */
  if(formErr && p[0] !== 'R' && p[0] !== 'T') p = ['T'].concat(p);
  return p;
};

/* glyph is ready to be learned: its building blocks are in her hand */
function ready(id, M){
  return G[id].needs.every(function(n){ return M[n] && M[n].lv >= 2; });
}

/* Leitner spacing for things she owns: 1, 2, 4, 8 days after the last
   success, by how many separate days she has written it from memory.    */
function due(m, now){
  var days = Object.keys(m.memDays).length;
  var gap = [0, 1, 2, 4, 8, 14][Math.min(5, days)] * 86400000;
  return now - m.last >= gap - 3600000;
}

/* Build one session: a short, finite list of items.
   opt: { lang, name, size, digits, now, learnAtOnce }                    */
P.session = function(M, opt){
  opt = opt || {};
  var now = opt.now || Date.now(), size = opt.size || 6, lang = opt.lang || 'pl';
  var learnAtOnce = opt.learnAtOnce || 3;
  var items = [];
  var letters = P.LETTERS[lang].concat(opt.digits ? P.DIGITS : []);
  var name = String(opt.name || '').toUpperCase().split('').filter(function(c){ return G[c]; });

  function lv(id){ return M[id] ? M[id].lv : 0; }
  function add(id, why){
    if(items.some(function(it){ return it.g === id; })) return false;
    items.push({ g:id, why:why, steps:P.plan(M[id], { shape:G[id].kind === 'shape' }) });
    return true;
  }

  /* 1. warm up with a shape: the next one to learn, else the stalest one */
  var shapeNew = P.SHAPES.filter(function(s){ return lv(s) < 2 && ready(s, M); });
  var shapeOld = P.SHAPES.filter(function(s){ return lv(s) >= 2; })
                         .sort(function(a, b){ return M[a].last - M[b].last; });
  if(shapeNew.length) add(shapeNew[0], 'shape');
  else if(shapeOld.length) add(shapeOld[0], 'warm-up');

  /* while shapes are still the lesson, a second new shape is the lesson */
  var learningLetters = letters.filter(function(id){ var l = lv(id); return M[id] && l >= 1 && l <= 3; });
  if(shapeNew.length > 1 && P.SHAPES.filter(function(s){ return lv(s) >= 2; }).length < 4){
    add(shapeNew[1], 'shape');
  }

  /* 2. letters she is learning, least known first */
  learningLetters.sort(function(a, b){ return lv(a) - lv(b) || M[a].last - M[b].last; })
                 .forEach(function(id){ if(items.length < size) add(id, 'learning'); });

  /* 3. at most ONE new letter, and only while few are in progress */
  if(items.length < size && learningLetters.length < learnAtOnce){
    var cands = letters.filter(function(id){ return !M[id] && ready(id, M); });
    var mine = cands.filter(function(id){ return name.indexOf(id) >= 0; });
    var pick = mine[0] || cands[0];
    if(pick) add(pick, mine[0] ? 'name' : 'new');
  }

  /* 4. reviews that are due, stalest first */
  letters.filter(function(id){ return M[id] && lv(id) >= 4 && due(M[id], now); })
         .sort(function(a, b){ return M[a].last - M[b].last; })
         .forEach(function(id){ if(items.length < size) add(id, 'review'); });

  /* 5. her name, once every letter in it can be copied */
  if(name.length >= 2 && name.length <= 8 && name.every(function(c){ return lv(c) >= 3; }) &&
     items.length < size + 1){
    items.push({ g:name.join(''), why:'name', steps:['N'], name:true });
  }

  /* 6. still short: more shapes and owned letters, stalest first */
  var filler = P.SHAPES.concat(letters).filter(function(id){ return M[id] && lv(id) >= 2; })
                       .sort(function(a, b){ return M[a].last - M[b].last; });
  for(var i = 0; i < filler.length && items.length < size; i++) add(filler[i], 'practice');

  /* 7. first ever session, nothing known: the opening shapes */
  for(var j = 0; j < P.SHAPES.length && items.length < Math.min(size, 3); j++){
    if(ready(P.SHAPES[j], M)) add(P.SHAPES[j], 'shape');
  }
  return items;
};

/* ================================================================== */
/* what the parent sees                                                */
/* ================================================================== */
P.summary = function(log, now){
  now = now || Date.now();
  var M = P.rebuild(log);
  var days = {};
  log.forEach(function(r){
    if(!r || typeof r.t !== 'number') return;
    var d = dayKey(r.t), o = days[d] || (days[d] = { steps:0, ok:0, ms:0, sessions:0, prizes:[] , first:r.t, last:r.t });
    if(r.k === 'S'){ o.sessions++; if(r.x) o.prizes.push(r.x); }
    else if(r.g){ o.steps++; if(r.ok) o.ok++; o.ms += Math.min(r.ms || 0, 120000); }
    o.first = Math.min(o.first, r.t); o.last = Math.max(o.last, r.t);
  });
  var samples = {};
  log.forEach(function(r){
    if(r && r.g && r.s && (r.st === 'M' || r.st === 'C' || r.st === 'N')){
      (samples[r.g] = samples[r.g] || []).push(r);
    }
  });
  Object.keys(samples).forEach(function(g){ samples[g].sort(function(a, b){ return a.t - b.t; }); });
  return { mastery:M, days:days, samples:samples };
};

/* which letters this child's game covers, in order, for the grid */
P.allFor = function(lang, digits){
  return P.SHAPES.concat(P.LETTERS[lang || 'pl'], digits ? P.DIGITS : []);
};

P.geo = { dist:dist, pathLen:pathLen, bySpacing:bySpacing, resample:resample,
          bbox:bbox, simplify:simplify, parseStroke:parseStroke, signedArea:signedArea };

if(typeof module !== 'undefined' && module.exports) module.exports = P;
else root.Pisz = P;

})(typeof window !== 'undefined' ? window : this);
