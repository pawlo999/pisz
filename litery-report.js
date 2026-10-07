/* Litery's side of the shared parent dashboard (parent.html).
   Litery's sync service hands back its log and the mastery it rebuilt from
   it; this only draws. Kept apart from report.js because the two apps
   measure different things: Litery recognises letters, Pisz writes them. */
(function (root) {
'use strict';

var BOXCOL = ['#4b5263', '#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'];
var LANG = { pl:'Polski', nb:'Norsk' };
var DAY = 86400000;

function el(tag, cls, txt){ var e = document.createElement(tag); if(cls) e.className = cls; if(txt !== undefined) e.textContent = txt; return e; }
function dayKey(ts){ var d = new Date(ts); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
function fmtDay(d){ return d.slice(5).replace('-', '.'); }
function median(a){ if(!a || !a.length) return 0; var b = a.slice().sort(function(x, y){ return x - y; }); return b[b.length >> 1]; }

/* letters she is learning now: met, not yet at box 4, newest activity first */
function learning(M, lang){
  return Object.keys(M).filter(function(k){ return k.indexOf(lang + ':L:') === 0 && M[k].box < 4; })
    .sort(function(a, b){ return M[b].last - M[a].last; })
    .map(function(k){ return k.split(':')[2]; });
}

/* d: the sync reply { log, mastery, prizes } ; opt: { now } */
function render(host, d, opt){
  opt = opt || {};
  var now = opt.now || Date.now();
  var log = (d && d.log || []).filter(function(r){ return r && typeof r.t === 'number'; });
  var M = d && d.mastery || {};
  if(root.PiszReport && root.PiszReport.ensureCss) root.PiszReport.ensureCss();
  host.textContent = '';
  var wrap = el('div', 'pr'); host.appendChild(wrap);
  if(!log.length){ wrap.appendChild(el('div', 'note', 'Nothing from Litery yet under this key.')); return; }

  var asked = log.filter(function(r){ return r.k === 'L' || r.k === 'N' || r.k === 'F'; });
  var last = Math.max.apply(null, log.map(function(r){ return r.t; }));
  var kpi = el('div', 'kpi'); wrap.appendChild(kpi);
  var known = Object.keys(M).filter(function(k){ return k.indexOf(':L:') > 0 && M[k].box >= 4; }).length;
  [[known, 'letters known (box 4+)'], [(d.prizes || []).length, 'prizes'],
   [Math.max(0, Math.round((now - last) / DAY)) === 0 ? 'today' : Math.round((now - last) / DAY) + ' d ago', 'last played']
  ].forEach(function(k){ var x = el('div'); x.appendChild(el('b', null, String(k[0]))); x.appendChild(document.createTextNode(k[1])); kpi.appendChild(x); });

  ['pl', 'nb'].forEach(function(lang){
    var ids = Object.keys(M).filter(function(k){ return k.indexOf(lang + ':L:') === 0; })
      .sort(function(a, b){ return M[b].n - M[a].n; });
    if(!ids.length) return;
    wrap.appendChild(el('h4', null, 'Letters · ' + LANG[lang] + ' — ' +
      ids.filter(function(k){ return M[k].box >= 4; }).length + '/' + ids.length + ' known'));
    var t = el('table');
    var hr = el('tr'); ['', 'box', 'seen', 'first try', 'time', 'last 10 days'].forEach(function(h, i){ hr.appendChild(el('th', i > 1 ? 'r' : '', h)); });
    t.appendChild(hr);
    ids.forEach(function(k){
      var m = M[k], x = k.split(':')[2], tr = el('tr');
      var g = el('span', 'g', x.toUpperCase()); g.style.background = BOXCOL[Math.min(5, m.box)];
      var td = el('td'); td.appendChild(g); tr.appendChild(td);
      var bar = el('span', 'lvbar');
      for(var i = 1; i <= 5; i++){ var s = el('i'); if(m.box >= i) s.style.background = BOXCOL[Math.min(5, m.box)]; bar.appendChild(s); }
      var tdb = el('td'); tdb.appendChild(bar); tr.appendChild(tdb);
      tr.appendChild(el('td', 'r', String(m.n)));
      tr.appendChild(el('td', 'r', m.n ? Math.round(100 * m.ft / m.n) + '%' : ''));
      tr.appendChild(el('td', 'r', (median(m.ms) / 1000).toFixed(1) + ' s'));
      var recent = log.filter(function(r){ return r.k === 'L' && r.l === lang && r.x === x && r.t > now - 10 * DAY; });
      var ok = recent.filter(function(r){ return !r.w; }).length;
      tr.appendChild(el('td', 'r', recent.length ? ok + '/' + recent.length : '—'));
      t.appendChild(tr);
    });
    wrap.appendChild(t);
  });

  /* first-sound rounds, once the app has them */
  var fs = log.filter(function(r){ return r.k === 'F'; });
  if(fs.length){
    var fok = fs.filter(function(r){ return !r.w; }).length;
    wrap.appendChild(el('h4', null, 'First sounds'));
    wrap.appendChild(el('div', 'note', fs.length + ' rounds of "which starts like…", ' + Math.round(100 * fok / fs.length) + '% right first try.'));
  }

  /* days */
  var byDay = {};
  log.forEach(function(r){
    var k = dayKey(r.t), o = byDay[k] || (byDay[k] = { q:0, ft:0, p:0, n:0 });
    if(r.k === 'P') o.p++;
    else if(r.k === 'L' || r.k === 'N' || r.k === 'F'){ o.q++; if(!r.w) o.ft++; if(r.k === 'N') o.n++; }
  });
  var days = Object.keys(byDay).sort().reverse().slice(0, 14);
  wrap.appendChild(el('h4', null, 'Last ' + days.length + ' days'));
  var td2 = el('table');
  var h2 = el('tr'); ['day', 'questions', 'first try', 'prizes'].forEach(function(h, i){ h2.appendChild(el('th', i ? 'r' : '', h)); });
  td2.appendChild(h2);
  days.forEach(function(k){
    var v = byDay[k], tr = el('tr');
    tr.appendChild(el('td', null, fmtDay(k)));
    tr.appendChild(el('td', 'r', String(v.q)));
    tr.appendChild(el('td', 'r', v.q ? Math.round(100 * v.ft / v.q) + '%' : '—'));
    tr.appendChild(el('td', 'r', String(v.p)));
    td2.appendChild(tr);
  });
  wrap.appendChild(td2);
  wrap.appendChild(el('div', 'note', asked.length + ' answers recorded.'));
}

root.LiteryReport = { render:render, learning:learning };
})(typeof window !== 'undefined' ? window : this);
