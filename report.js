/* Pisz — what the parent sees. Used by the app's parent panel and by
   parent.html, which reads the same log from the sync service, so the two
   can never disagree about what she has done.                            */
(function (root) {
'use strict';
var P = root.Pisz;

var CSS = '\
.pr{color:#eceff5;font:500 14px/1.45 ui-rounded,system-ui,-apple-system,sans-serif}\
.pr h4{color:#9aa3b2;font-size:12px;letter-spacing:.09em;text-transform:uppercase;font-weight:800;margin:22px 0 8px}\
.pr .note{color:#9aa3b2;font-size:13px;margin:4px 0 10px}\
.pr table{width:100%;border-collapse:collapse;font-size:13px}\
.pr td,.pr th{padding:5px 6px;border-bottom:1px solid #262b38;text-align:left;vertical-align:middle}\
.pr th{color:#9aa3b2;font-weight:700;font-size:12px}\
.pr td.r,.pr th.r{text-align:right}\
.pr .g{display:inline-flex;width:34px;height:34px;border-radius:9px;align-items:center;justify-content:center;font-weight:800;font-size:17px;color:#0d0f14}\
.pr .lvbar{display:inline-flex;gap:3px}\
.pr .lvbar i{width:14px;height:8px;border-radius:3px;background:#262b38}\
.pr .err{color:#f0b46b;font-size:12px}\
.pr .samples{display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 12px}\
.pr .smp{display:flex;flex-direction:column;align-items:center;font-size:11px;color:#9aa3b2}\
.pr .smp canvas{width:64px;height:64px;border-radius:10px;background:#f6f3fb}\
.pr .smp.bad canvas{box-shadow:0 0 0 2px #b4535f}\
.pr .glabel{font-weight:800;font-size:16px;margin-top:10px}\
.pr .kpi{display:flex;gap:10px;flex-wrap:wrap}\
.pr .kpi div{background:#1d2130;border-radius:12px;padding:10px 14px;min-width:120px}\
.pr .kpi b{display:block;font-size:22px}\
.pr .warn{background:#7a2e39;color:#fff;border-radius:10px;padding:10px 12px;margin:8px 0}\
.pr .tiles{display:flex;flex-wrap:wrap;gap:5px;margin:6px 0 4px}\
.pr .tiles .g{width:30px;height:30px;font-size:15px;border-radius:8px}\
.pr .legend{display:flex;flex-wrap:wrap;gap:10px;font-size:12px;color:#9aa3b2;margin:6px 0 4px}\
.pr .legend i{display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:4px;vertical-align:-1px}\
';
var LEVEL = ['new', 'traced the road', 'traced the dots', 'copied', 'from memory', 'owned'];
var LEVELCOL = ['#4b5263', '#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'];
var STEP = { R:'road', T:'dots', C:'copied', M:'memory', N:'name' };
var ERR = { start:'starts in the wrong place', dir:'goes the wrong way', order:'strokes out of order',
            mirror:'mirrored', mark:'forgot the accent', shape:'shape not there yet', other:'wrote another letter',
            off:'off the line' };

function el(tag, cls, txt){ var e = document.createElement(tag); if(cls) e.className = cls; if(txt !== undefined) e.textContent = txt; return e; }
function fmtDay(d){ return d.slice(5).replace('-', '.'); }
function label(id){
  var names = { '|':'| line down', '-':'— line across', 'o':'○ circle', '+':'+ cross', '/':'/ slant', '\\':'\\ slant',
                '#':'□ square', 'x':'✕ cross', '^':'^ mountain', 'z':'zigzag', 'n':'∩ rainbow', '~':'~ waves' };
  return names[id] || id;
}

function draw(canvas, strokes){
  var dpr = Math.min(root.devicePixelRatio || 1, 2), w = 64, h = 64;
  canvas.width = w * dpr; canvas.height = h * dpr;
  var c = canvas.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  var pts = []; strokes.forEach(function(s){ pts = pts.concat(s); });
  if(!pts.length) return;
  var b = P.geo.bbox(pts), size = Math.max(b.w, b.h, 40), k = 52 / size;
  c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = '#4c2a8a'; c.fillStyle = '#4c2a8a';
  c.lineWidth = Math.max(2, 6 * k);
  strokes.forEach(function(s){
    if(!s.length) return;
    if(s.length === 1){ c.beginPath(); c.arc(32 + (s[0].x - b.cx) * k, 32 + (s[0].y - b.cy) * k, c.lineWidth / 2, 0, 7); c.fill(); return; }
    c.beginPath();
    s.forEach(function(p, i){ var x = 32 + (p.x - b.cx) * k, y = 32 + (p.y - b.cy) * k; i ? c.lineTo(x, y) : c.moveTo(x, y); });
    c.stroke();
  });
}

/* evenly spread picks from a list, always keeping first and last */
function spread(list, n){
  if(list.length <= n) return list.slice();
  var out = [];
  for(var i = 0; i < n; i++) out.push(list[Math.round(i * (list.length - 1) / (n - 1))]);
  return out;
}

/* opt: { lang, digits, now, name, saveError, plan } */
function render(host, log, opt){
  opt = opt || {};
  if(!document.getElementById('pisz-report-css')){
    var st = el('style'); st.id = 'pisz-report-css'; st.textContent = CSS; document.head.appendChild(st);
  }
  host.textContent = '';
  var wrap = el('div', 'pr'); host.appendChild(wrap);
  log = (log || []).filter(function(r){ return r && typeof r.t === 'number'; });
  var sum = P.summary(log, opt.now), M = sum.mastery;

  if(opt.saveError) wrap.appendChild(el('div', 'warn', 'Saving on this device is FAILING: ' + opt.saveError));
  var steps = log.filter(function(r){ return r.st; });
  if(!steps.length){
    wrap.appendChild(el('div', 'note', 'Nothing recorded yet. Progress appears here after her first sitting (not in a test run).'));
  }

  /* ---- headline ---- */
  var days = Object.keys(sum.days).sort().reverse();
  var owned = Object.keys(M).filter(function(k){ return P.G[k] && P.G[k].kind !== 'shape' && M[k].lv >= 4; });
  var learning = Object.keys(M).filter(function(k){ return P.G[k] && P.G[k].kind !== 'shape' && M[k].lv >= 1 && M[k].lv < 4; });
  var kpi = el('div', 'kpi'); wrap.appendChild(kpi);
  [[days.length, 'days played'],
   [owned.length, 'letters from memory'],
   [learning.length, 'letters in progress'],
   [Object.keys(M).filter(function(k){ return P.G[k] && P.G[k].kind === 'shape' && M[k].lv >= 2; }).length + '/' + P.SHAPES.length, 'shapes']
  ].forEach(function(k){ var d = el('div'); d.appendChild(el('b', null, String(k[0]))); d.appendChild(document.createTextNode(k[1])); kpi.appendChild(d); });

  /* ---- days ---- */
  wrap.appendChild(el('h4', null, 'Last ' + Math.min(14, days.length) + ' days'));
  if(days.length){
    var tab = el('table');
    var hr = el('tr'); ['day', 'sittings', 'minutes', 'steps', 'right'].forEach(function(h, i){ hr.appendChild(el('th', i ? 'r' : '', h)); });
    tab.appendChild(hr);
    days.slice(0, 14).forEach(function(d){
      var v = sum.days[d], tr = el('tr');
      tr.appendChild(el('td', null, fmtDay(d)));
      tr.appendChild(el('td', 'r', String(v.sessions)));
      tr.appendChild(el('td', 'r', String(Math.round(v.ms / 60000 * 10) / 10)));
      tr.appendChild(el('td', 'r', String(v.steps)));
      tr.appendChild(el('td', 'r', v.steps ? Math.round(100 * v.ok / v.steps) + '%' : '—'));
      tab.appendChild(tr);
    });
    wrap.appendChild(tab);
    wrap.appendChild(el('div', 'note', 'Minutes count time spent on the writing steps only.'));
  }

  /* ---- every glyph at a glance ---- */
  var every = P.allFor(opt.lang || 'pl', opt.digits);
  wrap.appendChild(el('h4', null, 'Everything, at a glance'));
  var tiles = el('div', 'tiles'); wrap.appendChild(tiles);
  function tile(id){
    var m = M[id], g = el('span', 'g', P.G[id].kind === 'shape' ? label(id).charAt(0) : id);
    g.style.background = LEVELCOL[m ? m.lv : 0]; if(!m) g.style.color = '#9aa3b2';
    g.title = label(id) + ': ' + (m ? LEVEL[m.lv] : 'not yet');
    return g;
  }
  every.forEach(function(id){ tiles.appendChild(tile(id)); });
  var lg = el('div', 'legend'); wrap.appendChild(lg);
  LEVEL.forEach(function(name, i){ var s2 = el('span'); var sw = el('i'); sw.style.background = LEVELCOL[i]; s2.appendChild(sw); s2.appendChild(document.createTextNode(i ? name : 'not yet')); lg.appendChild(s2); });
  wrap.appendChild(el('div', 'note',
    'Levels: traced the road → traced the dots → copied → wrote from memory → from memory on two different days (owned). ' +
    'Mirrored letters are normal at this age and do not count against her.'));

  /* ---- what she has started ---- */
  var started = every.filter(function(id){ return M[id]; });
  wrap.appendChild(el('h4', null, 'What she has started (' + started.length + ')'));
  var t2 = el('table');
  var h2 = el('tr'); ['', 'level', 'tries', 'right', 'last', 'keeps happening'].forEach(function(h, i){ h2.appendChild(el('th', i === 2 || i === 3 ? 'r' : '', h)); });
  t2.appendChild(h2);
  started.forEach(function(id){
    var m = M[id], tr = el('tr');
    var g = el('span', 'g', id.length === 1 && P.G[id].kind !== 'shape' ? id : label(id).charAt(0));
    g.style.background = LEVELCOL[m ? m.lv : 0]; if(!m) g.style.color = '#9aa3b2';
    var td0 = el('td'); td0.appendChild(g); tr.appendChild(td0);
    var lvTd = el('td'), bar = el('span', 'lvbar');
    for(var k = 1; k <= 5; k++){ var i = el('i'); if(m && m.lv >= k) i.style.background = LEVELCOL[m.lv]; bar.appendChild(i); }
    lvTd.appendChild(bar); lvTd.appendChild(el('div', 'note', m ? LEVEL[m.lv] : 'not yet')); tr.appendChild(lvTd);
    tr.appendChild(el('td', 'r', m ? String(m.n) : ''));
    tr.appendChild(el('td', 'r', m && m.n ? Math.round(100 * m.ok / m.n) + '%' : ''));
    tr.appendChild(el('td', null, m ? fmtDay(P.dayKey(m.last)) : ''));
    var errs = m ? Object.keys(m.errs).filter(function(e){ return ERR[e] && m.errs[e] >= 2; })
                       .sort(function(a, b){ return m.errs[b] - m.errs[a]; })
                       .map(function(e){ return ERR[e] + ' ×' + m.errs[e]; }) : [];
    tr.appendChild(el('td', 'err', errs.join(', ')));
    t2.appendChild(tr);
  });
  wrap.appendChild(t2);

  /* ---- her handwriting over time ---- */
  var withS = Object.keys(sum.samples);
  wrap.appendChild(el('h4', null, 'Her handwriting over time'));
  if(!withS.length) wrap.appendChild(el('div', 'note', 'Her own drawings appear here once she copies or writes from memory.'));
  else wrap.appendChild(el('div', 'note', 'Oldest on the left. Red outline: the app did not accept it yet.'));
  P.allFor(opt.lang || 'pl', opt.digits).concat(withS.filter(function(k){ return P.allFor(opt.lang || 'pl', opt.digits).indexOf(k) < 0; }))
    .forEach(function(id){
      var list = sum.samples[id];
      if(!list) return;
      wrap.appendChild(el('div', 'glabel', label(id)));
      var row = el('div', 'samples'); wrap.appendChild(row);
      spread(list, 8).forEach(function(r){
        var box = el('div', 'smp' + (r.ok ? '' : ' bad')), c = el('canvas');
        box.appendChild(c); box.appendChild(el('span', null, fmtDay(P.dayKey(r.t)) + ' ' + (STEP[r.st] || '')));
        row.appendChild(box);
        draw(c, P.unpack(r.s));
      });
    });

  /* ---- what comes next ---- */
  if(opt.plan && opt.plan.length){
    wrap.appendChild(el('h4', null, 'Her next sitting'));
    var t3 = el('table');
    opt.plan.forEach(function(it){
      var tr = el('tr');
      tr.appendChild(el('td', null, it.name ? it.g + ' (her name)' : label(it.g)));
      tr.appendChild(el('td', null, it.steps.map(function(s){ return STEP[s]; }).join(' → ')));
      tr.appendChild(el('td', 'note', it.why));
      t3.appendChild(tr);
    });
    wrap.appendChild(t3);
  }

  /* ---- the device, as it reported itself ---- */
  var dev = log.filter(function(r){ return r.k === 'D'; }).pop();
  if(dev){
    wrap.appendChild(el('h4', null, 'Device check, ' + fmtDay(P.dayKey(dev.t))));
    var pre = el('pre', 'note'); pre.style.whiteSpace = 'pre-wrap';
    try{ pre.textContent = JSON.stringify(JSON.parse(dev.x), null, 1); }catch(e){ pre.textContent = String(dev.x); }
    wrap.appendChild(pre);
  }
  /* ---- anything that went wrong on the device ---- */
  var errs = log.filter(function(r){ return r.k === 'E'; });
  if(errs.length){
    wrap.appendChild(el('h4', null, 'App errors on the device (' + errs.length + ')'));
    wrap.appendChild(el('div', 'note', 'Not her doing — the app recovered by itself. Worth passing on so it can be fixed.'));
    errs.slice(-5).reverse().forEach(function(r){
      wrap.appendChild(el('div', 'note', fmtDay(P.dayKey(r.t)) + ' · build ' + (r.b || '?') + ' · ' + r.x));
    });
  }
  wrap.appendChild(el('div', 'note', log.length + ' rows in the record.'));
}

root.PiszReport = { render:render };
})(typeof window !== 'undefined' ? window : this);
