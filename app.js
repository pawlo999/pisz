/* Pisz — the app: screens, finger, voice, drawing.
   Decisions live in engine.js; this file only shows them and listens.     */
(function () {
'use strict';

var BUILD = 1;
/* The sync service. The URL is public; the key the parent pastes in is the
   only credential, because there is no login for a four-year-old.        */
var SYNC_URL = 'https://pisz-sync.pawlo999.workers.dev';
var P = window.Pisz, R = window.PiszReport, G = P.G;

/* ============ content ============================================== */
/* The word a letter "lives in", shown with its picture and spoken as
   "s jak słoń". Same rule as Litery: never a bare letter to the speaker. */
var WORD = {
  pl:{ A:['auto','🚗'], B:['but','👟'], C:['cebula','🧅'], D:['dom','🏠'], E:['ekran','🖥️'],
       F:['foka','🦭'], G:['gwiazda','⭐️'], H:['hipopotam','🦛'], I:['indyk','🦃'], J:['jabłko','🍎'],
       K:['kot','🐱'], L:['lody','🍦'], M:['mama','👩'], N:['nos','👃'], O:['oko','👁️'],
       P:['pies','🐶'], R:['ryba','🐟'], S:['słoń','🐘'], T:['tort','🎂'], U:['ucho','👂'],
       W:['woda','💧'], Y:['motyl','🦋'], Z:['zebra','🦓'],
       /* ćma: there is no moth emoji, the butterfly stands in for it */
       'Ą':['wąż','🐍'], 'Ć':['ćma','🦋'], 'Ę':['ręka','✋'], 'Ł':['łódka','⛵'], 'Ń':['koń','🐴'],
       'Ó':['ósemka','8️⃣'], 'Ś':['ślimak','🐌'], 'Ź':['źrebak','🐎'], 'Ż':['żaba','🐸'] },
  nb:{ A:['and','🦆'], B:['ball','⚽'], C:['cowboy','🤠'], D:['dør','🚪'], E:['egg','🥚'],
       F:['fisk','🐟'], G:['gutt','👦'], H:['hus','🏠'], I:['is','🍦'], J:['jordbær','🍓'],
       K:['katt','🐱'], L:['lys','💡'], M:['mus','🐭'], N:['nese','👃'], O:['ost','🧀'],
       P:['penn','🖊️'], R:['rev','🦊'], S:['sol','☀️'], T:['tog','🚆'], U:['ugle','🦉'],
       V:['vann','💧'], W:['wienerpølse','🌭'], Y:['sykkel','🚲'], Z:['zebra','🦓'],
       /* ærlig (honest) has no picture of its own; the halo face stands in */
       'Æ':['ærlig','😇'], 'Ø':['øre','👂'], 'Å':['åtte','8️⃣'] }
};
/* letters the voice is not trusted to say on their own (Litery: iOS is
   silent or wrong on some) — these are only ever heard inside their word */
var WORD_ONLY = { pl:'ĄĘŃÓ', nb:'ØÅY' };
/* letters whose word does not start with them, said his way (6 Oct) */
var PHRASE = { pl:{ Y:'y jak w motylu' }, nb:{} };
var NUM = {
  pl:['zero','jeden','dwa','trzy','cztery','pięć','sześć','siedem','osiem','dziewięć'],
  nb:['null','en','to','tre','fire','fem','seks','sju','åtte','ni']
};
var KEYCAP = ['0️⃣','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣'];
/* [name, picture, what the instruction says — Polish needs the accusative] */
var SHAPE = {
  pl:{ rain:['deszcz','🌧️','deszcz'], road:['gąsienica','🐛','gąsienicę'], ball:['piłka','⚽','piłkę'],
       plus:['plusik','➕','plusik'], slide:['zjeżdżalnia','🛝','zjeżdżalnię'], box:['prezent','🎁','prezent'],
       x:['krzyżyk','❌','krzyżyk'], mountain:['góra','⛰️','górę'], zigzag:['błyskawica','⚡','błyskawicę'],
       rainbow:['tęcza','🌈','tęczę'], wave:['fale','🌊','fale'] },
  nb:{ rain:['regn','🌧️','regn'], road:['larve','🐛','en larve'], ball:['ball','⚽','en ball'],
       plus:['pluss','➕','et pluss'], slide:['sklie','🛝','en sklie'], box:['gave','🎁','en gave'],
       x:['kryss','❌','et kryss'], mountain:['fjell','⛰️','et fjell'], zigzag:['lyn','⚡','et lyn'],
       rainbow:['regnbue','🌈','en regnbue'], wave:['bølger','🌊','bølger'] }
};
var LINK = { pl:' jak ', nb:' som i ' };
var T_ = {
  pl:{ hi:'Cześć %s!', path:'Dzisiaj piszemy', watch:'Patrz!', turn:'Teraz ty!', dots:'Po kropkach!',
       copy:'Teraz bez kropek!', mem:'Napisz %w', memGap:'Napisz literkę, której brakuje: %w',
       shape:'Narysuj %w', start:'Zacznij od zielonej kropki.', again:'Spróbujmy jeszcze raz.',
       look:'Popatrz jeszcze raz.', name:'Napisz swoje imię!', nameDone:'To twoje imię!',
       praise:['Brawo!','Super!','Pięknie!','Ekstra!','Ale ładnie!'],
       fromTop:'Od samej góry!', rightWay:'W dobrą stronę!',
       mark:{ k:'A kreska?', p:'A kropka?', o:'A ogonek?', r:'A kółeczko?' },
       mirror:'Prawie! Ta literka patrzy w drugą stronę.',
       end:'Brawo %s!', endSub:'Pokaż mamie albo tacie!', night:'Na dzisiaj koniec. Do jutra!',
       paper:'A teraz napisz jedną literkę kredką na kartce i pokaż mamie albo tacie!',
       book:'Moje literki',
       cue:{ d:'w dół', a:'w prawo', s:'na skos', r:'dookoła', b:'brzuszek', u:'w górę i w dół',
             w:'fala', z:'zygzak', q:'kwadrat', k:'kreska', o:'ogonek', p:'kropka' } },
  nb:{ hi:'Hei %s!', path:'I dag skriver vi', watch:'Se her!', turn:'Nå er det din tur!', dots:'Følg prikkene!',
       copy:'Nå uten prikker!', mem:'Skriv %w', memGap:'Skriv bokstaven som mangler: %w',
       shape:'Tegn %w', start:'Begynn ved den grønne prikken.', again:'Vi prøver en gang til.',
       look:'Se en gang til.', name:'Skriv navnet ditt!', nameDone:'Det er navnet ditt!',
       praise:['Bra!','Flott!','Kjempebra!','Supert!','Så fint!'],
       fromTop:'Rett fra toppen!', rightWay:'Riktig vei!',
       mark:{ k:'Og streken?', p:'Og prikken?', o:'Og halen?', r:'Og ringen?' },
       mirror:'Nesten! Den bokstaven snur andre veien.',
       end:'Bra jobba %s!', endSub:'Vis mamma eller pappa!', night:'Det var alt for i dag. Vi ses i morgen!',
       paper:'Skriv en av bokstavene med fargestift på et ark, og vis mamma eller pappa!',
       book:'Bokstavene mine',
       cue:{ d:'ned', a:'bortover', s:'på skrå', r:'rundt', b:'bue', u:'opp og ned',
             w:'bølge', z:'sikksakk', q:'firkant', k:'strek', o:'hale', p:'prikk' } }
};
var GUESTS = ['🦊','🐼','🐨','🦁','🐯','🐸','🐵','🦄','🐧','🐢','🦋','🐞','🐙','🦒','🐘','🦔','🐿️','🦩','🦜','🐬'];

/* the same palette rule as Litery: her colour changes each launch */
var PALETTE = [
  { h:262, s:78, l:62, onMain:'#fff' }, { h:330, s:78, l:60, onMain:'#fff' },
  { h:40,  s:92, l:52, onMain:'#3a2600' }, { h:4, s:78, l:59, onMain:'#fff' }
];
var INK = '#6d3fd6';
function theme(c){
  var r = document.documentElement.style;
  function hsl(h, s, l, a){ return 'hsl(' + h + ' ' + s + '% ' + l + '%' + (a ? ' / ' + a : '') + ')'; }
  r.setProperty('--main', hsl(c.h, c.s, c.l));
  r.setProperty('--main-dark', hsl(c.h, c.s, Math.max(24, c.l - 16)));
  r.setProperty('--main-soft', hsl(c.h, c.s, c.l, '.22'));
  r.setProperty('--on-main', c.onMain);
  r.setProperty('--bg', hsl(c.h, 88, 91));
  r.setProperty('--bg2', hsl(c.h, 82, 81));
  r.setProperty('--card', hsl(c.h, 90, 98));
  r.setProperty('--line', hsl(c.h, 48, 73));
  r.setProperty('--ink', hsl(c.h, 45, 15));
  r.setProperty('--dim', hsl(c.h, 26, 40));
  INK = hsl(c.h, c.s, Math.max(30, c.l - 12));
  ROAD = hsl(c.h, 60, 92); ROADEDGE = hsl(c.h, 40, 80);
}
var ROAD = '#efe7fb', ROADEDGE = '#d6c8ee';

/* ============ state ================================================= */
var S = { name:'', lang:'pl', rate:0.7, size:5, maxS:3, strict:'gentle', digits:false, hum:true, left:false,
          syncKey:'', syncMsg:'', practice:false, day:'', sessionsToday:0, sessionsAll:0, saveError:'' };
var KEY = 'pisz.child.v1', LKEY = 'pisz.child.log';
/* never localStorage.clear(), never a key that is not ours: in Safari the
   letters game lives on the same origin, and her prizes are in it        */
var LOG = [], M = {};
var LOG_BUDGET = 2500000;   /* bytes; above this the oldest drawings are dropped locally (the cloud keeps them) */

function today(){ return P.dayKey(Date.now()); }
function load(){
  try{
    var o = JSON.parse(localStorage.getItem(KEY) || '{}');
    ['name','lang','rate','size','maxS','strict','digits','hum','left','syncKey','day','sessionsToday','sessionsAll']
      .forEach(function(k){ if(o[k] !== undefined) S[k] = o[k]; });
  }catch(e){}
  try{ LOG = JSON.parse(localStorage.getItem(LKEY) || '[]'); }catch(e){ LOG = []; }
  if(!Array.isArray(LOG)) LOG = [];
  if(S.day !== today()){ S.day = today(); S.sessionsToday = 0; }
  M = P.rebuild(LOG);
}
function save(){
  try{
    localStorage.setItem(KEY, JSON.stringify({ name:S.name, lang:S.lang, rate:S.rate, size:S.size, maxS:S.maxS,
      strict:S.strict, digits:S.digits, hum:S.hum, left:S.left, syncKey:S.syncKey, day:S.day,
      sessionsToday:S.sessionsToday, sessionsAll:S.sessionsAll }));
  }catch(e){ S.saveError = String(e && e.message || e); }
}
function saveLog(){
  try{
    var txt = JSON.stringify(LOG);
    if(txt.length > LOG_BUDGET){ trimDrawings(); txt = JSON.stringify(LOG); }
    localStorage.setItem(LKEY, txt);
    S.saveError = '';
  }catch(e){
    /* surfaced in the parent panel, never swallowed: in Litery a silent
       catch here hid an hour of answers that were written nowhere       */
    S.saveError = String(e && e.message || e);
    if(window.console) console.error('saveLog failed:', e);
  }
}
/* keep the three newest drawings of every glyph, drop the strokes of older
   rows (the rows themselves stay — they are what mastery is built from)  */
function trimDrawings(){
  var keep = {}, n = 0;
  for(var i = LOG.length - 1; i >= 0; i--){
    var r = LOG[i];
    if(!r || !r.s) continue;
    keep[r.g] = (keep[r.g] || 0) + 1;
    if(keep[r.g] > 3){ delete r.s; n++; }
  }
  return n;
}
function record(row){
  if(S.practice) return;               /* a parent's test run never counts */
  row.t = Date.now(); row.l = S.lang;
  /* the same millisecond twice would merge as one row on sync */
  if(LOG.length && LOG[LOG.length-1].t >= row.t) row.t = LOG[LOG.length-1].t + 1;
  LOG.push(row);
  M = P.rebuild(LOG);
  saveLog();
}

/* ============ sync ================================================== */
function rowKey(r){ return r.t + '|' + (r.k || r.st || '') + '|' + (r.g || r.x || ''); }
function mergeRows(a, b){
  var by = {}, out = [];
  a.concat(b).forEach(function(r){
    if(!r || typeof r.t !== 'number') return;
    var k = rowKey(r), have = by[k];
    if(have){ if(!have.s && r.s) have.s = r.s; return; }  /* keep the drawing if either copy has it */
    by[k] = r; out.push(r);
  });
  return out.sort(function(x, y){ return x.t - y.t; });
}
P.mergeRows = mergeRows;
var syncing = false;
function cloudSync(){
  if(!S.syncKey || S.practice || syncing) return;
  syncing = true; S.syncMsg = 'syncing…';
  fetch(SYNC_URL + '/s/' + encodeURIComponent(S.syncKey), {
    method:'POST', headers:{ 'Content-Type':'application/json' },
    body:JSON.stringify({ log:LOG, name:S.name, build:BUILD,
                          settings:{ lang:S.lang, size:S.size, maxS:S.maxS, strict:S.strict, digits:S.digits } })
  })
  .then(function(r){ return r.json(); })
  .then(function(d){
    if(!d || !Array.isArray(d.log)) throw new Error((d && d.error) || 'bad reply');
    /* merge, never replace: rows written while the request was in flight
       are in LOG but not in the reply                                    */
    LOG = mergeRows(LOG, d.log);
    M = P.rebuild(LOG);
    saveLog();
    S.syncMsg = LOG.length + ' rows in sync' + (d.added ? ' (+' + d.added + ' on the server)' : '');
  })
  .catch(function(e){ S.syncMsg = 'sync failed: ' + (e.message || e); })
  .then(function(){ syncing = false; paintSync(); });
}

/* ============ voice and sound ======================================= */
var VOICE = { pl:null, nb:null };
function findVoices(){
  if(!('speechSynthesis' in window)) return;
  speechSynthesis.getVoices().forEach(function(v){
    var l = v.lang.toLowerCase().replace('_', '-');
    if(l.indexOf('pl') === 0 && !VOICE.pl) VOICE.pl = v;
    if((l.indexOf('nb') === 0 || l.indexOf('no') === 0 || l.indexOf('nn') === 0) && !VOICE.nb) VOICE.nb = v;
  });
}
if('speechSynthesis' in window){
  findVoices();
  speechSynthesis.onvoiceschanged = findVoices;
  setTimeout(findVoices, 500); setTimeout(findVoices, 1500);
}
/* everything handed to the speaker is lowercase — iOS announces capitals */
function say(text, rate){
  if(!('speechSynthesis' in window) || !text) return;
  try{
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(String(text).toLowerCase());
    var v = VOICE[S.lang];
    if(v){ u.voice = v; u.lang = v.lang; }
    u.rate = rate || S.rate;
    speechSynthesis.speak(u);
  }catch(e){}
}
function nm(t){ return String(t).split('%s').join(S.name ? cap(S.name) : ''); }
function cap(s){ s = String(s).toLowerCase(); return s.charAt(0).toUpperCase() + s.slice(1); }
function pick(a){ return a[(Math.random() * a.length) | 0]; }
function tx(){ return T_[S.lang]; }

/* oscillator chimes, so the app ships no audio files */
var AC = null;
function ac(){
  try{
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    /* resume() returns a promise that rejects when there is no audio device;
       unhandled, it surfaces as a page error                              */
    if(AC.state === 'suspended'){ var pr = AC.resume(); if(pr && pr.catch) pr.catch(function(){}); }
  }catch(e){ AC = null; }
  return AC;
}
function tone(freqs, vol){
  var a = ac(); if(!a) return;
  try{
    freqs.forEach(function(f, i){
      var o = a.createOscillator(), g = a.createGain(), t = a.currentTime + i * 0.09;
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
      o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + 0.36);
    });
  }catch(e){}
}
/* a soft hum that rises as the stroke fills in — the "magic ink" feel */
var HUM = null;
function humStart(){
  if(!S.hum || HUM) return;
  var a = ac(); if(!a) return;
  try{
    var o = a.createOscillator(), g = a.createGain();
    o.type = 'triangle'; o.frequency.value = 330; g.gain.value = 0.0001;
    o.connect(g); g.connect(a.destination); o.start();
    g.gain.exponentialRampToValueAtTime(0.035, a.currentTime + 0.08);
    HUM = { o:o, g:g };
  }catch(e){}
}
function humSet(p){ if(HUM && AC) try{ HUM.o.frequency.setTargetAtTime(330 + 330 * p, AC.currentTime, 0.05); }catch(e){} }
function humStop(){
  if(!HUM || !AC) return;
  var h = HUM; HUM = null;
  try{ h.g.gain.setTargetAtTime(0.0001, AC.currentTime, 0.04); h.o.stop(AC.currentTime + 0.2); }catch(e){}
}
/* iOS counts touchend/pointerup/click as the gesture that may start audio,
   not touchstart or pointerdown — so unlock on the way up               */
var unlocked = false;
function unlock(){ if(unlocked) return; unlocked = true; ac(); }

/* ============ helpers =============================================== */
var $ = function(id){ return document.getElementById(id); };
var SCREENS = ['setup','home','welcome','lang','path','write','end','book','parent','stats'];
function current(){ return SCREENS.filter(function(x){ return $(x).classList.contains('on'); })[0]; }
function show(id){
  SCREENS.forEach(function(x){ $(x).classList.toggle('on', x === id); });
  document.documentElement.classList.toggle('dark', id === 'parent' || id === 'stats');
  $('gear').style.display = (id === 'parent' || id === 'stats' || id === 'setup') ? 'none' : 'block';
  $('band').style.display = S.practice ? 'block' : 'none';
  if(id !== 'write'){ humStop(); releaseWake(); }
}
function el(tag, cls, txt){ var e = document.createElement(tag); if(cls) e.className = cls; if(txt !== undefined) e.textContent = txt; return e; }
function confetti(){
  var host = $('confetti'); host.textContent = ''; host.className = 'confetti on';
  var bits = ['🎉','✨','⭐️','🎊','💫','🌟'];
  for(var i = 0; i < 24; i++){
    var b = el('i', null, pick(bits));
    b.style.left = (Math.random() * 100) + '%';
    b.style.animationDelay = (Math.random() * 0.6).toFixed(2) + 's';
    b.style.animationDuration = (1.8 + Math.random() * 1.5).toFixed(2) + 's';
    b.style.fontSize = (18 + Math.random() * 20).toFixed(0) + 'px';
    host.appendChild(b);
  }
  clearTimeout(confetti.t);
  confetti.t = setTimeout(function(){ host.className = 'confetti'; host.textContent = ''; }, 3400);
}
function bigFace(e, ms){
  $('bigfacee').textContent = e; $('bigface').classList.add('on');
  clearTimeout(bigFace.t);
  bigFace.t = setTimeout(function(){ $('bigface').classList.remove('on'); }, ms || 1600);
}

/* what a glyph is called and how it is said */
function wordOf(id){
  var g = G[id];
  if(!g) return ['', ''];
  if(g.kind === 'shape') return SHAPE[S.lang][g.theme] || ['', ''];
  if(g.kind === 'digit') return [NUM[S.lang][+id], KEYCAP[+id]];
  return WORD[S.lang][id] || WORD.pl[id] || WORD.nb[id] || ['', ''];
}
function wordOnly(id){ return WORD_ONLY[S.lang].indexOf(id) >= 0 || !WORD[S.lang][id]; }
/* "s jak słoń" — or just the word, when the voice cannot be trusted with the letter */
function letterPhrase(id){
  var g = G[id], w = wordOf(id)[0];
  if(g.kind === 'digit') return w;
  if(g.kind === 'shape') return w;
  if(PHRASE[S.lang][id]) return PHRASE[S.lang][id];
  if(wordOnly(id)) return w;
  return id.toLowerCase() + LINK[S.lang] + w;
}
function prompt(id, st){
  var g = G[id], t = tx();
  if(g.kind === 'shape') return t.shape.replace('%w', wordOf(id)[2] || wordOf(id)[0]);
  if(st === 'M'){
    if(g.kind === 'letter' && wordOnly(id)) return t.memGap.replace('%w', wordOf(id)[0]);
    return t.mem.replace('%w', letterPhrase(id));
  }
  return letterPhrase(id);
}
var DONE_ITEMS_EMOJI = '⭐️';

/* ============ the writing pad ======================================= */
/* Letter units -> screen. The frame is the same for every glyph (from
   accent height to ogonek depth), so all letters come out the same size
   and her M is as big as her I.                                         */
var FRAME = { top:-38, bottom:128, w:150 };
var L = { k:1, ox:0, oy:0, w:0, h:0, dpr:1 };
var cv = {}, cx = {};
['guide','ink','fx'].forEach(function(id){ cv[id] = $(id); cx[id] = cv[id].getContext('2d'); });

function layout(g){
  var pad = $('pad'), r = pad.getBoundingClientRect();
  var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  L.w = r.width; L.h = r.height; L.dpr = dpr; L.left = r.left; L.top = r.top;
  var hUnits = FRAME.bottom - FRAME.top;
  L.k = Math.min(r.height / (hUnits + 16), r.width / (FRAME.w + 10));
  var box = g ? g.box : { cx:50 };
  L.ox = r.width / 2 - box.cx * L.k;
  L.oy = (r.height - hUnits * L.k) / 2 - FRAME.top * L.k;
  ['guide','ink','fx'].forEach(function(id){
    var c = cv[id], W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
    if(c.width !== W || c.height !== H){ c.width = W; c.height = H; }
    cx[id].setTransform(dpr, 0, 0, dpr, 0, 0);
  });
}
function X(u){ return L.ox + u * L.k; }
function Y(u){ return L.oy + u * L.k; }
function toUnits(clientX, clientY){ return { x:(clientX - L.left - L.ox) / L.k, y:(clientY - L.top - L.oy) / L.k }; }
function clear(id){ cx[id].clearRect(0, 0, L.w, L.h); }

function polyline(c, pts, upto){
  c.beginPath();
  var n = upto === undefined ? pts.length : Math.min(pts.length, upto + 1);
  for(var i = 0; i < n; i++){ var p = pts[i]; i ? c.lineTo(X(p.x), Y(p.y)) : c.moveTo(X(p.x), Y(p.y)); }
}
function lines(c){
  /* the two lines of a school notebook: where a capital starts and ends */
  c.save(); c.strokeStyle = 'rgba(80,60,120,.13)'; c.lineWidth = 2; c.setLineDash([10, 10]);
  [0, 100].forEach(function(y){ c.beginPath(); c.moveTo(14, Y(y)); c.lineTo(L.w - 14, Y(y)); c.stroke(); });
  c.restore();
}
function startDot(c, st, n, pulse){
  var p = st.pts[0], r = 7.5 * L.k * (pulse || 1);
  c.save();
  c.fillStyle = '#16a34a'; c.beginPath(); c.arc(X(p.x), Y(p.y), r, 0, 7); c.fill();
  c.fillStyle = '#fff'; c.font = '800 ' + Math.round(9 * L.k) + 'px ui-rounded,system-ui,sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(String(n), X(p.x), Y(p.y) + 0.5);
  /* which way to go: an arrow a little along the stroke */
  if(!st.dot && st.pts.length > 14){
    var a = st.pts[Math.min(st.pts.length - 1, 12)], b = st.pts[Math.min(st.pts.length - 1, 22)];
    var ang = Math.atan2(b.y - a.y, b.x - a.x), hx = X(b.x), hy = Y(b.y), s = 5 * L.k;
    c.strokeStyle = '#16a34a'; c.lineWidth = 2.6 * L.k; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(X(a.x), Y(a.y)); c.lineTo(hx, hy);
    c.moveTo(hx - s * Math.cos(ang - 0.6), hy - s * Math.sin(ang - 0.6)); c.lineTo(hx, hy);
    c.lineTo(hx - s * Math.cos(ang + 0.6), hy - s * Math.sin(ang + 0.6)); c.stroke();
  }
  c.restore();
}
function road(c, g, doneUpTo){
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  g.strokes.forEach(function(st){
    if(st.dot){ c.fillStyle = ROADEDGE; c.beginPath(); c.arc(X(st.pts[0].x), Y(st.pts[0].y), 11 * L.k, 0, 7); c.fill(); return; }
    polyline(c, st.pts); c.strokeStyle = ROADEDGE; c.lineWidth = 26 * L.k; c.stroke();
    polyline(c, st.pts); c.strokeStyle = ROAD; c.lineWidth = 22 * L.k; c.stroke();
  });
  g.strokes.forEach(function(st){
    if(st.dot) return;
    polyline(c, st.pts); c.setLineDash([3 * L.k, 4 * L.k]); c.strokeStyle = 'rgba(80,60,120,.28)';
    c.lineWidth = 1.6 * L.k; c.stroke(); c.setLineDash([]);
  });
  c.restore();
}
function dotted(c, g){
  c.save(); c.fillStyle = 'rgba(80,60,120,.38)';
  g.strokes.forEach(function(st){
    var pts = st.dot ? st.pts : P.geo.bySpacing(st.pts, 7);
    pts.forEach(function(p){ c.beginPath(); c.arc(X(p.x), Y(p.y), 2.3 * L.k, 0, 7); c.fill(); });
  });
  c.restore();
}
function fillStroke(c, st, idx, color, width){
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = color; c.lineWidth = width * L.k;
  if(st.dot){ c.fillStyle = color; c.beginPath(); c.arc(X(st.pts[0].x), Y(st.pts[0].y), width * 0.6 * L.k, 0, 7); c.fill(); }
  else if(idx > 0){ polyline(c, st.pts, idx); c.stroke(); }
  c.restore();
}
function inkStroke(c, pts, color, width){
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = color || INK; c.lineWidth = (width || 8) * L.k;
  if(pts.length === 1){ c.fillStyle = color || INK; c.beginPath(); c.arc(X(pts[0].x), Y(pts[0].y), (width || 8) * 0.5 * L.k, 0, 7); c.fill(); }
  else { polyline(c, pts); c.stroke(); }
  c.restore();
}

/* a thumbnail: a glyph's template, or her strokes fitted into the box */
function thumb(canvas, id, strokes, opt){
  opt = opt || {};
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var r = canvas.getBoundingClientRect(), w = r.width || 100, h = r.height || 100;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  var c = canvas.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
  var pts = [], src;
  if(strokes && strokes.length) src = strokes;
  else if(G[id]) src = G[id].strokes.map(function(s){ return s.pts; });
  else return;
  src.forEach(function(s){ pts = pts.concat(s); });
  if(!pts.length) return;
  var b = P.geo.bbox(pts), size = Math.max(b.w, b.h, 40), k = Math.min(w, h) * 0.78 / size;
  var ox = w / 2 - b.cx * k, oy = h / 2 - b.cy * k;
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = opt.color || (strokes ? INK : 'rgba(80,60,120,.55)');
  c.fillStyle = c.strokeStyle;
  c.lineWidth = Math.max(2.5, (opt.width || 7) * k);
  src.forEach(function(s){
    if(!s.length) return;
    if(s.length === 1){ c.beginPath(); c.arc(ox + s[0].x * k, oy + s[0].y * k, c.lineWidth / 2, 0, 7); c.fill(); return; }
    c.beginPath();
    s.forEach(function(p, i){ i ? c.lineTo(ox + p.x * k, oy + p.y * k) : c.moveTo(ox + p.x * k, oy + p.y * k); });
    c.stroke();
  });
}

/* ============ input ================================================= */
/* One finger at a time. A pen, once seen, wins: touches are then a palm.
   If iPadOS stops sending pointer events (it does after a five-finger
   swipe — WebKit 236390) the touch events take over.                    */
var IN = { id:null, pen:false, touchMode:false, lastDown:0, moves:0, coal:0, t0:0, rate:0, types:{}, fallback:0 };
var pad = $('pad');
function down(clientX, clientY){
  layoutIfMoved();
  if(STEP && !STEP.ready) skipDemo();
  IN.moves = 0; IN.coal = 0; IN.t0 = performance.now();
  if(STEP && STEP.down) STEP.down(toUnits(clientX, clientY));
}
function move(clientX, clientY){ IN.moves++; if(STEP && STEP.move) STEP.move(toUnits(clientX, clientY)); }
function up(){
  var dt = performance.now() - IN.t0;
  if(dt > 150 && IN.moves) IN.rate = Math.round(1000 * IN.moves / dt);
  unlock();
  if(STEP && STEP.up) STEP.up();
}
pad.addEventListener('pointerdown', function(e){
  if(IN.touchMode) return;
  IN.types[e.pointerType] = 1;
  if(e.pointerType === 'mouse' && e.button !== 0) return;
  if(e.pointerType === 'pen') IN.pen = true;
  else if(IN.pen && e.pointerType === 'touch') return;
  if(IN.id !== null) return;
  IN.id = e.pointerId; IN.lastDown = Date.now();
  try{ pad.setPointerCapture(e.pointerId); }catch(err){}
  e.preventDefault();
  down(e.clientX, e.clientY);
});
pad.addEventListener('pointermove', function(e){
  /* a hovering pen moves without ever going down: no ink */
  if(IN.touchMode || e.pointerId !== IN.id) return;
  var list = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
  if(list && list.length){ IN.coal += list.length - 1; for(var i = 0; i < list.length; i++) move(list[i].clientX, list[i].clientY); }
  else move(e.clientX, e.clientY);
});
function pointerEnd(e){
  if(IN.touchMode || e.pointerId !== IN.id) return;
  IN.id = null;
  up();
}
pad.addEventListener('pointerup', pointerEnd);
pad.addEventListener('pointercancel', pointerEnd);
/* touch: stop the page from scrolling, zooming or showing a loupe, and
   watch for pointer events that never came                               */
pad.addEventListener('touchstart', function(e){
  e.preventDefault();
  if(!IN.touchMode && IN.id === null && Date.now() - IN.lastDown > 400){
    var t = e.changedTouches[0];
    setTimeout(function(){
      if(IN.touchMode || Date.now() - IN.lastDown < 600) return;
      IN.touchMode = true; IN.fallback++;
      IN.tid = t.identifier; down(t.clientX, t.clientY);
    }, 120);
    return;
  }
  if(IN.touchMode && IN.tid === null){ var t2 = e.changedTouches[0]; IN.tid = t2.identifier; down(t2.clientX, t2.clientY); }
}, { passive:false });
pad.addEventListener('touchmove', function(e){
  e.preventDefault();
  if(!IN.touchMode) return;
  Array.prototype.forEach.call(e.changedTouches, function(t){ if(t.identifier === IN.tid) move(t.clientX, t.clientY); });
}, { passive:false });
function touchEnd(e){
  if(!IN.touchMode) return;
  Array.prototype.forEach.call(e.changedTouches, function(t){ if(t.identifier === IN.tid){ IN.tid = null; up(); } });
}
pad.addEventListener('touchend', touchEnd);
pad.addEventListener('touchcancel', touchEnd);
document.addEventListener('gesturestart', function(e){ e.preventDefault(); });
/* the child screens never scroll; the parent screens must */
document.addEventListener('touchmove', function(e){
  var on = current();
  if(on !== 'parent' && on !== 'stats' && on !== 'book') e.preventDefault();
}, { passive:false });
var lastRect = '';
function layoutIfMoved(){
  var r = pad.getBoundingClientRect(), k = r.left + ',' + r.top + ',' + r.width + ',' + r.height;
  if(k !== lastRect){ lastRect = k; if(STEP && STEP.relayout) STEP.relayout(); }
}

/* ============ steps ================================================= */
/* An item is one glyph and 1-3 steps:
     R road    trace inside a wide road; it fills as she goes
     T dots    trace over dots, her own ink
     C copy    write it with the model beside the pad
     M memory  write it from its word alone
     N name    her name, letter by letter, each copied
   STEP is whichever one is on screen.                                   */
var SES = null, RUN = null, STEP = null, FX = null;

function rivals(id){
  /* what she might have written instead: what she has met, and the shapes */
  var out = P.SHAPES.slice();
  Object.keys(M).forEach(function(k){ if(out.indexOf(k) < 0) out.push(k); });
  P.allFor(S.lang, S.digits).forEach(function(k){ if(G[k].kind === 'letter' && out.indexOf(k) < 0 && M[k]) out.push(k); });
  return out.filter(function(k){ return k !== id; });
}

function startSession(){
  var items = P.session(M, { lang:S.lang, name:S.name, size:S.size, digits:S.digits });
  SES = { items:items, done:{}, samples:[], started:Date.now(), id:Date.now() };
  paintPath();
  show('path');
}

function paintPath(){
  $('ptitle').textContent = tx().path;
  var host = $('bubbles'); host.textContent = '';
  var nextI = SES.items.findIndex(function(it, i){ return !SES.done[i]; });
  SES.items.forEach(function(it, i){
    var b = el('button', 'bub' + (SES.done[i] ? ' done' : i === nextI ? ' next' : ' later'));
    var c = el('canvas'); b.appendChild(c); host.appendChild(b);
    b.addEventListener('click', function(){
      unlock();
      if(SES.done[i]){ say(it.name ? nm('%s') : letterPhrase(it.g)); return; }
      runItem(i);
    });
    requestAnimationFrame(function(){
      var smp = SES.done[i] && SES.done[i].s;
      if(it.name) drawNameThumb(c, it.g, SES.done[i] && SES.done[i].parts);
      else thumb(c, it.g, smp || null, { color: smp ? INK : 'rgba(80,60,120,.6)' });
    });
  });
}
function drawNameThumb(c, name, parts){
  var dpr = Math.min(window.devicePixelRatio || 1, 2), r = c.getBoundingClientRect();
  c.width = r.width * dpr; c.height = r.height * dpr;
  var x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
  x.fillStyle = parts ? INK : 'rgba(80,60,120,.6)';
  x.font = '800 ' + Math.round(r.height * 0.34) + 'px ui-rounded,system-ui,sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(name.length > 5 ? name.slice(0, 5) + '…' : name, r.width / 2, r.height / 2);
}

function runItem(i){
  var it = SES.items[i];
  RUN = { i:i, item:it, steps:it.steps.slice(), si:0, fails:0, helps:0, t0:Date.now() };
  show('write');
  requestWake();
  if(it.name){ startName(); return; }
  paintWord(it.g, it.steps[0]);
  startStep();
}

function paintWord(id, st){
  var w = wordOf(id);
  $('wemoji').textContent = w[1] || '';
  var shown = '';
  if(G[id].kind === 'letter' && w[0]){
    shown = w[0].toUpperCase();
    /* from memory: the word with her letter missing, as in Litery */
    if(st === 'M'){
      var at = shown.indexOf(id);
      shown = at >= 0 ? shown.slice(0, at) + '_' + shown.slice(at + 1) : shown;
    }
  } else if(G[id].kind === 'shape') shown = w[0];
  else shown = st === 'M' ? '' : id;
  $('wword').textContent = shown;
  $('word').style.visibility = (w[1] || shown) ? 'visible' : 'hidden';
}
$('word').addEventListener('click', function(){
  unlock();
  if(!RUN) return;
  if(RUN.item.name){ say(nm('%s')); return; }
  var st = STEP && STEP.st;
  say(st === 'M' ? prompt(RUN.item.g, 'M') : letterPhrase(RUN.item.g));
});

function paintDots(){
  var host = $('dots'); host.textContent = '';
  SES.items.forEach(function(it, i){
    host.appendChild(el('div', 'dot' + (SES.done[i] ? ' f' : RUN && RUN.i === i ? ' c' : '')));
  });
}

function startStep(){
  paintDots();
  var st = RUN.steps[RUN.si], id = RUN.item.g;
  paintWord(id, st);
  var first = RUN.si === 0;
  if(st === 'R' || st === 'T') STEP = traceStep(id, st);
  else STEP = freeStep(id, st);
  STEP.st = st;
  STEP.t0 = Date.now();
  STEP.relayout();
  $('clear').classList.toggle('hide', st === 'R' || st === 'T');
  armWatchdog(STEP);
  /* show before doing: the guide draws it first, unless she already
     writes it from memory (then 👀 is there if she wants it)            */
  var lv = M[id] ? M[id].lv : 0;
  if(st === 'R' || (st === 'T' && first) || (st === 'C' && first && lv <= 2)){
    /* name it, let the voice finish, then draw it: the first stroke's word
       ("w dół") used to cut the sentence off, so a new letter was never
       introduced by name before she saw it drawn                         */
    var me = STEP;
    var intro = G[id].kind === 'shape' ? prompt(id, st)
              : (first ? letterPhrase(id) + '. ' : '') + tx().watch;
    say(intro);
    setTimeout(function(){
      if(STEP !== me) return;
      demo(id, st === 'C' ? 'model' : 'pad', function(){
        if(STEP !== me) return;
        say(st === 'R' ? tx().turn : st === 'T' ? tx().dots : tx().copy);
        me.ready = true;
      });
    }, Math.min(2600, 450 + intro.length * 60));
  } else {
    STEP.ready = true;
    say(st === 'M' ? prompt(id, 'M') : st === 'C' ? tx().copy : st === 'T' ? tx().dots : tx().turn);
  }
}

function stepDone(ok, extra){
  /* the glyph on the pad, not the item: in her name the item is "ADA"
     and each row must be the letter she just wrote                     */
  var st = STEP.st, id = STEP.g ? STEP.g.id : RUN.item.g;
  var row = { g:id, st:st, ok:ok ? 1 : 0, ms:Date.now() - STEP.t0 };
  if(extra) for(var k in extra) row[k] = extra[k];
  /* help during a memory step makes it a copy — that is what it was */
  if(st === 'M' && STEP.helped) row.st = 'C';
  record(row);
  return row;
}

function nextStep(){
  RUN.si++;
  if(RUN.si < RUN.steps.length){ setTimeout(startStep, 900); return; }
  itemDone();
}

function itemDone(){
  var it = RUN.item, id = it.g;
  SES.done[RUN.i] = { s:RUN.sample || null, parts:RUN.parts || null };
  if(RUN.sample) SES.samples.push({ g:id, s:RUN.sample });
  var w = wordOf(id);
  tone([523, 659, 784, 1047]);
  if(!it.name){
    bigFace(w[1] || DONE_ITEMS_EMOJI, 1700);
    setTimeout(function(){ say(G[id].kind === 'shape' ? w[0] : letterPhrase(id)); }, 350);
  }
  confetti();
  var cur = RUN;
  setTimeout(function(){
    if(RUN !== cur || current() !== 'write') return;
    STEP = null; RUN = null;
    if(Object.keys(SES.done).length >= SES.items.length) endSession();
    else { paintPath(); show('path'); }
  }, 2100);
}

/* ---- tracing: road or dots ---------------------------------------- */
function traceStep(id, st){
  var g = G[id], tol = st === 'R' ? 16 : 13;
  var tr = g.strokes.map(function(s, i){
    var bidir = g.mark.indexOf(i) >= 0 && g.cue[i] === 'k';
    return new P.Tracer(s, { tol:tol, bidir:bidir });
  });
  var me = { st:st, g:g, tr:tr, i:0, raw:[], cur:null, wrong:0, off:0, idleT:null, ready:false, lifts:0 };
  function paintGuide(){
    clear('guide'); var c = cx.guide;
    lines(c);
    if(st === 'R') road(c, g); else dotted(c, g);
    if(me.i < tr.length) startDot(c, tr[me.i].s, me.i + 1);
  }
  function paintInk(){
    clear('ink'); var c = cx.ink;
    if(st === 'T') me.raw.forEach(function(s){ inkStroke(c, s, INK, 8); });
    /* on the road the fill is the ink; her finger still leaves a faint
       trail, so a touch off the road is never met with nothing          */
    else me.raw.forEach(function(s){ inkStroke(c, s, 'rgba(60,40,90,.16)', 4); });
    tr.forEach(function(t, i){
      if(i > me.i) return;
      if(st === 'R') fillStroke(c, t.s, t.done ? t.s.pts.length - 1 : t.idx, INK, 18);
      else if(t.done && t.s.dot) fillStroke(c, t.s, 0, INK, 10);
    });
  }
  me.relayout = function(){ layout(g); paintGuide(); paintInk(); };
  function poke(){
    clearTimeout(me.idleT);
    me.idleT = setTimeout(function(){
      if(STEP !== me || !me.ready) return;
      /* stuck: show the stroke again and point at where it starts */
      say(tx().start); me.help++;
      demoStroke(g, me.i, 'pad', function(){ paintGuide(); });
    }, 12000);
  }
  me.help = 0;
  me.down = function(p){
    if(!me.ready || me.i >= tr.length) return;
    var t = tr[me.i], why = t.begin(p);
    me.cur = [p]; me.raw.push(me.cur);
    if(why === 'ok'){
      if(t.done){ strokeDone(); return; }
      humStart(); humSet(t.progress());
    } else {
      me.wrong++;
      if(me.wrong % 2 === 1){ say(tx().start); pulseStart(g, me.i); }
    }
    paintInk(); poke();
  };
  me.move = function(p){
    if(!me.cur) return;
    me.cur.push(p);
    var t = tr[me.i];
    if(t && t.down){
      t.move(p); humSet(t.progress());
      if(t.done){ me.cur = null; strokeDone(); return; }
    }
    if(st === 'T') inkStroke(cx.ink, me.cur.slice(-2), INK, 8);
    else paintInk();
  };
  me.up = function(){
    humStop();
    var t = tr[me.i];
    if(t){ if(t.down) me.lifts++; t.end(); }
    me.cur = null;
    /* lifted just short of the end: that finished it */
    if(t && t.done){ strokeDone(); return; }
    paintInk();
  };
  function strokeDone(){
    humStop();
    tone([660 + me.i * 90, 880 + me.i * 90], 0.16);
    me.i++;
    paintGuide(); paintInk(); poke();
    if(me.i >= tr.length){
      clearTimeout(me.idleT);
      me.ready = false;
      var off = Math.round(tr.reduce(function(a, t){ return a + t.off; }, 0));
      var extra = { e:me.wrong ? 'start' : '', n:me.raw.length, h:me.help ? 1 : 0, w:me.wrong, off:off };
      /* her own ink over the dots is kept: it is what the end of a first
         sitting has to show, before there is any free writing            */
      if(st === 'T'){ extra.s = P.pack(me.raw.filter(function(s){ return s.length; })); RUN.sample = P.unpack(extra.s); }
      stepDone(true, extra);
      say(pick(tx().praise));
      nextStep();
    } else if(G[RUN.item.g].strokes.length > 1){
      var c = G[RUN.item.g].cue[me.i];
      if(c && tx().cue[c]) setTimeout(function(){ if(STEP === me) say(tx().cue[c]); }, 250);
    }
  }
  poke();
  return me;
}

/* ---- free writing: copy, memory ----------------------------------- */
function freeStep(id, st, opt){
  opt = opt || {};
  var g = G[id];
  var me = { st:st, g:g, strokes:[], cur:null, ready:false, judgeT:null, idleT:null, tries:0,
             helped:false, last:null, opt:opt };
  function paintGuide(){
    clear('guide'); lines(cx.guide);
    if(me.overlay){
      cx.guide.save(); cx.guide.globalAlpha = 0.18;
      g.strokes.forEach(function(s){ inkStroke(cx.guide, s.pts, '#000', 9); });
      cx.guide.restore();
    }
  }
  function paintInk(){ clear('ink'); me.strokes.forEach(function(s){ inkStroke(cx.ink, s, INK, 8); }); }
  me.relayout = function(){
    var showModel = st === 'C' || st === 'N';
    $('model').classList.toggle('on', showModel);
    sizeModel();
    layout(g); paintGuide(); paintInk();
    if(showModel) paintModel(g);
  };
  me.down = function(p){
    if(!me.ready) return;
    clearTimeout(me.judgeT); clearTimeout(me.idleT);
    me.cur = [p]; me.strokes.push(me.cur);
    inkStroke(cx.ink, me.cur, INK, 8);
  };
  me.move = function(p){
    if(!me.cur) return;
    me.cur.push(p);
    inkStroke(cx.ink, me.cur.slice(-2), INK, 8);
  };
  me.up = function(){
    if(!me.cur) return;
    me.cur = null;
    clearTimeout(me.judgeT);
    /* wait a moment: E is four strokes, and she is between two of them */
    me.judgeT = setTimeout(check, 650);
  };
  function check(){
    if(STEP !== me || !me.strokes.length) return;
    var r = P.verify(me.strokes, id, S.strict, rivals(id));
    me.last = r;
    if(r.ok){ success(r); return; }
    var expect = g.strokes.length;
    if(r.errors.indexOf('mark') >= 0 && !me.markSaid){
      me.markSaid = true;
      var mi = g.mark[0], cue = g.cue[mi];
      say(tx().mark[cue === 'r' && id !== 'Å' ? 'r' : cue] || tx().mark.k);
    }
    /* clearly more than a letter's worth of ink: start again */
    if(me.strokes.length > expect * 2 + 3){ fail(r); return; }
    me.idleT = setTimeout(function(){ if(STEP === me) fail(me.last); }, me.strokes.length >= expect ? 4200 : 6500);
  }
  function success(r){
    me.ready = false; clearTimeout(me.idleT);
    var packed = P.pack(me.strokes);
    var row = stepDone(true, { e:r.errors.join(','), sc:r.score, n:me.strokes.length, s:packed, h:me.helped ? 1 : 0 });
    RUN.sample = P.unpack(packed);
    if(opt.onDone){ opt.onDone(true, packed); return; }
    var good = r.errors.indexOf('start') < 0 && r.errors.indexOf('dir') < 0;
    say(good && Math.random() < 0.6 ? pick([tx().fromTop, tx().rightWay]) + ' ' + pick(tx().praise) : pick(tx().praise));
    tone([660, 880]);
    nextStep();
  }
  function fail(r){
    if(STEP !== me) return;
    me.ready = false; clearTimeout(me.idleT); clearTimeout(me.judgeT);
    me.tries++;
    stepDone(false, { e:(r && r.errors || []).join(','), sc:r ? r.score : 0, n:me.strokes.length,
                      s:P.pack(me.strokes), other:r && r.other || undefined });
    var mirror = r && r.errors.indexOf('mirror') >= 0;
    if(me.tries >= 2 && opt.onDone){ opt.onDone(false, P.pack(me.strokes)); return; }
    if(me.tries >= 2){
      /* twice not there: trace it over the dots instead, and that ends it */
      say(tx().look);
      RUN.steps.splice(RUN.si + 1, RUN.steps.length, 'T');
      setTimeout(function(){ if(STEP === me) nextStep(); }, 700);
      return;
    }
    say(mirror ? tx().mirror : tx().look);
    me.overlay = true; paintGuide();
    setTimeout(function(){
      if(STEP !== me) return;
      demo(id, 'pad', function(){
        if(STEP !== me) return;
        me.strokes = []; me.overlay = st === 'C' || st === 'N'; paintGuide(); paintInk();
        me.helped = true; me.markSaid = false;
        me.ready = true; me.t0 = Date.now();
        say(tx().again);
      });
    }, mirror ? 2600 : 1200);
  }
  me.clearInk = function(){ me.strokes = []; clearTimeout(me.judgeT); clearTimeout(me.idleT); paintInk(); };
  return me;
}

/* the model, beside the pad: landscape left of it, portrait above it */
function sizeModel(){
  var stage = $('stage'), r = stage.getBoundingClientRect(), portrait = r.height > r.width;
  stage.classList.toggle('portrait', portrait);
  stage.classList.toggle('lefty', !!S.left);
  var m = $('model');
  if(portrait){ m.style.width = ''; m.style.height = Math.round(r.height * 0.26) + 'px'; }
  else { m.style.height = ''; m.style.width = Math.round(r.width * 0.24) + 'px'; }
}
function paintModel(g, upto){
  var c = $('modelc'), dpr = Math.min(window.devicePixelRatio || 1, 2), r = c.getBoundingClientRect();
  c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
  var x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, r.width, r.height);
  var k = Math.min(r.height / 180, r.width / 150), ox = r.width / 2 - g.box.cx * k, oy = (r.height - 166 * k) / 2 + 38 * k;
  x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = 'rgba(40,20,70,.85)'; x.fillStyle = x.strokeStyle;
  x.lineWidth = 8 * k;
  g.strokes.forEach(function(s, i){
    if(upto !== undefined && i > upto.i) return;
    var pts = upto !== undefined && i === upto.i ? s.pts.slice(0, upto.n + 1) : s.pts;
    if(s.dot){ x.beginPath(); x.arc(ox + s.pts[0].x * k, oy + s.pts[0].y * k, 5 * k, 0, 7); x.fill(); return; }
    x.beginPath();
    pts.forEach(function(p, j){ j ? x.lineTo(ox + p.x * k, oy + p.y * k) : x.moveTo(ox + p.x * k, oy + p.y * k); });
    x.stroke();
  });
  return { x:x, k:k, ox:ox, oy:oy };
}

/* ---- the guide draws it: every stroke, in order, with its word ----- */
/* every demo carries a ticket; forcing the pad writable voids it, so a
   replay that was cancelled can never finish later and wipe her ink     */
var DEMO = 0, DEMO_ON = null;
function cancelDemo(){ DEMO++; DEMO_ON = null; FX = null; clear('fx'); }
/* she touches the pad while the guide is still drawing: after the first
   moment, that means "I've got it" — finish the demo now, the same way
   it would have finished, and let the touch start her stroke           */
function skipDemo(){
  if(!DEMO_ON || performance.now() - DEMO_ON.t0 < 1500) return false;
  var d = DEMO_ON;
  cancelDemo();
  if(d.where === 'model' && STEP && STEP.g) paintModel(STEP.g);
  d.done && d.done();
  return true;
}
function demo(id, where, done){
  var g = G[id], i = 0, ticket = ++DEMO;
  DEMO_ON = { t0:performance.now(), where:where, done:done };
  if(where === 'pad') clear('fx');
  (function next(){
    if(ticket !== DEMO) return;
    if(!STEP || i >= g.strokes.length){ DEMO_ON = null; if(where === 'pad') setTimeout(function(){ clear('fx'); }, 250); else if(STEP) paintModel(g); done && done(); return; }
    demoStroke(g, i, where, function(){ i++; setTimeout(next, 260); }, true);
  })();
}
function demoStroke(g, i, where, done, keep){
  var st = g.strokes[i], speed = 0.095;       /* units per millisecond */
  var cue = g.cue[i];
  if(g.strokes.length > 1 || g.kind !== 'shape') if(cue && tx().cue[cue]) say(tx().cue[cue], S.rate);
  var t0 = performance.now(), dur = st.dot ? 300 : Math.max(450, st.len / speed);
  var anim = { alive:true };
  FX = anim;
  if(where === 'model') paintModel(g, { i:i, n:0 });
  (function frame(now){
    if(!anim.alive || FX !== anim) return;
    /* a frame's timestamp is when the frame began, which can be before t0:
       unclamped, the first frame indexed pts[-1] and the demo died there */
    var f = Math.max(0, Math.min(1, (now - t0) / dur)), n = Math.round(f * (st.pts.length - 1));
    if(where === 'pad'){
      if(keep) redrawDemoTrail(g, i - 1); else clear('fx');
      var c = cx.fx;
      startDot(c, st, i + 1);
      c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = 'rgba(22,163,74,.85)'; c.lineWidth = 9 * L.k;
      if(st.dot){ c.fillStyle = c.strokeStyle; c.beginPath(); c.arc(X(st.pts[0].x), Y(st.pts[0].y), 6 * L.k, 0, 7); c.fill(); }
      else { polyline(c, st.pts, n); c.stroke(); }
      var p = st.pts[n];
      c.font = Math.round(22 * L.k) + 'px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('✏️', X(p.x) + 8 * L.k, Y(p.y) - 9 * L.k);
      c.restore();
    } else {
      paintModel(g, { i:i, n:n });
    }
    if(f < 1) requestAnimationFrame(frame);
    else {
      /* keep the finished stroke, drop the pencil */
      if(where === 'pad') redrawDemoTrail(g, keep ? i : -1);
      setTimeout(function(){ if(FX === anim) done && done(); }, 120);
    }
  })(t0);
}
function redrawDemoTrail(g, upto){
  clear('fx'); var c = cx.fx;
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = 'rgba(22,163,74,.85)'; c.lineWidth = 9 * L.k;
  for(var i = 0; i <= upto; i++){
    var st = g.strokes[i];
    if(st.dot){ c.fillStyle = c.strokeStyle; c.beginPath(); c.arc(X(st.pts[0].x), Y(st.pts[0].y), 6 * L.k, 0, 7); c.fill(); }
    else { polyline(c, st.pts); c.stroke(); }
  }
  c.restore();
}
function pulseStart(g, i){
  var t0 = performance.now(), anim = { alive:true }; FX = anim;
  (function frame(now){
    if(FX !== anim) return;
    var f = Math.max(0, (now - t0) / 900);
    clear('fx');
    if(f < 1){ startDot(cx.fx, g.strokes[i], i + 1, 1 + 0.5 * Math.sin(f * Math.PI * 3)); requestAnimationFrame(frame); }
  })(t0);
}

/* ---- her name ------------------------------------------------------- */
function startName(){
  var name = RUN.item.g, i = 0, parts = [];
  RUN.parts = parts;
  var strip = $('namestrip'); strip.textContent = '';
  var cells = name.split('').map(function(ch){ var c = el('canvas'); strip.appendChild(c); return c; });
  say(tx().name);
  function paintStrip(){
    cells.forEach(function(c, k){
      c.classList.toggle('cur', k === i);
      thumb(c, name[k], parts[k] ? P.unpack(parts[k]) : null, { color: parts[k] ? INK : 'rgba(80,60,120,.35)', width:9 });
    });
  }
  function one(){
    if(i >= name.length){
      strip.textContent = '';
      RUN.sample = null;
      say(nm(tx().nameDone + ' %s!'));
      setTimeout(function(){ if(RUN) itemDone(); }, 600);
      return;
    }
    var id = name[i];
    paintWord(id, 'N');
    STEP = freeStep(id, 'N', { onDone:function(ok, packed){
      parts[i] = packed; i++;
      tone([660, 880]);
      paintStrip();
      setTimeout(one, 700);
    } });
    STEP.st = 'N'; STEP.t0 = Date.now();
    $('clear').classList.remove('hide');
    STEP.relayout(); paintStrip();
    STEP.ready = true;
    if(i > 0) say(letterPhrase(id));
  }
  paintDots();
  one();
}

/* ---- buttons on the pad ------------------------------------------- */
$('watch').addEventListener('click', function(){
  unlock();
  if(!STEP || !RUN || RUN.item.name && !STEP.g) return;
  var id = STEP.g ? STEP.g.id : RUN.item.g;
  if(STEP.st === 'M') STEP.helped = true;
  var was = STEP.ready; STEP.ready = false;
  demo(id, 'pad', function(){ if(STEP){ STEP.ready = was || true; if(STEP.relayout) STEP.relayout(); } });
});
$('clear').addEventListener('click', function(){ unlock(); if(STEP && STEP.clearInk) STEP.clearInk(); });
$('wback').addEventListener('click', function(){
  unlock();
  if(STEP){ clearTimeout(STEP.idleT); clearTimeout(STEP.judgeT); }
  FX = null; STEP = null; RUN = null; humStop();
  try{ speechSynthesis.cancel(); }catch(e){}
  paintPath(); show('path');
});

/* ============ end of a session ===================================== */
function endSession(){
  if(!S.practice){
    S.sessionsToday++; S.sessionsAll++; save();
    LOG.push({ t:Date.now(), l:S.lang, k:'S', x:String(SES.items.length), ms:Date.now() - SES.started });
    saveLog();
    cloudSync();
  }
  var night = S.sessionsToday >= S.maxS && !S.practice;
  /* the screen is not the goal, paper is: every third sitting that had a
     letter in it ends by sending her to a crayon (transfer to paper is
     what the studies measure — Patchan & Puranik 2016)                  */
  var hadLetter = SES.items.some(function(it){ return it.name || G[it.g] && G[it.g].kind !== 'shape'; });
  var paper = hadLetter && S.sessionsAll % 3 === 0 && !S.practice;
  var sub = paper ? tx().paper : night ? tx().night : tx().endSub;
  $('guest').textContent = paper ? '🖍️' : pick(GUESTS);
  $('etitle').textContent = nm(tx().end);
  $('esub').textContent = sub;
  var host = $('today'); host.textContent = '';
  SES.samples.slice(-10).forEach(function(s){
    var c = el('canvas'); host.appendChild(c);
    requestAnimationFrame(function(){ thumb(c, s.g, s.s); });
  });
  $('again').textContent = night ? '🌙' : '▶';
  $('again').dataset.night = night ? '1' : '';
  confetti();
  tone([523, 659, 784, 1047, 1319]);
  show('end');
  setTimeout(function(){ say(nm(tx().end) + ' ' + sub); }, 400);
}
$('again').addEventListener('click', function(){
  unlock();
  if($('again').dataset.night){ say(tx().night); return; }
  startSession();
});
$('endbook').addEventListener('click', function(){ unlock(); openBook('end'); });
$('tobook').addEventListener('click', function(){ unlock(); openBook('path'); });
$('pathback').addEventListener('click', function(){ unlock(); show('lang'); });

/* ============ her book ============================================= */
var bookFrom = 'path';
/* her free writing if there is any; her ink over the dots until then */
function samplesOf(id){
  var mine = LOG.filter(function(r){ return r && r.g === id && r.s && r.ok; });
  var free = mine.filter(function(r){ return r.st !== 'T'; });
  return free.length ? free : mine;
}
function openBook(from){
  bookFrom = from || 'path';
  $('btitle').textContent = tx().book;
  var host = $('cards'); host.textContent = '';
  P.allFor(S.lang, S.digits).forEach(function(id){
    var smp = samplesOf(id), m = M[id];
    var card = el('button', 'card' + (smp.length ? '' : ' none'));
    var c = el('canvas'); card.appendChild(c);
    var lv = el('div', 'lv');
    for(var k = 1; k <= 5; k++) lv.appendChild(el('i', m && m.lv >= k ? 'on' : ''));
    card.appendChild(lv);
    host.appendChild(card);
    requestAnimationFrame(function(){ thumb(c, id, smp.length ? P.unpack(smp[smp.length - 1].s) : null); });
    card.addEventListener('click', function(){ unlock(); openDetail(id, smp); });
  });
  show('book');
}
function openDetail(id, smp){
  var row = $('detailrow'); row.textContent = '';
  var pickS = smp.length > 1 ? [smp[0], smp[smp.length - 1]] : smp;
  if(!pickS.length){ var c0 = el('canvas'); row.appendChild(c0); requestAnimationFrame(function(){ thumb(c0, id, null); }); }
  pickS.forEach(function(r){
    var c = el('canvas'); row.appendChild(c);
    requestAnimationFrame(function(){ thumb(c, id, P.unpack(r.s)); });
  });
  var w = wordOf(id);
  $('detailcap').textContent = (w[1] || '') + ' ' + (G[id].kind === 'letter' ? (w[0] || '').toUpperCase() : w[0] || '');
  $('detail').classList.add('on');
  say(letterPhrase(id));
}
$('detail').addEventListener('click', function(){ $('detail').classList.remove('on'); });
$('bookback').addEventListener('click', function(){ unlock(); show(bookFrom === 'end' ? 'end' : 'path'); });

/* ============ wake lock ============================================ */
var WAKE = null;
function requestWake(){
  try{
    if(navigator.wakeLock && !WAKE) navigator.wakeLock.request('screen').then(function(w){ WAKE = w; w.addEventListener('release', function(){ WAKE = null; }); }).catch(function(){});
  }catch(e){}
}
function releaseWake(){ try{ if(WAKE) WAKE.release(); }catch(e){} WAKE = null; }
document.addEventListener('visibilitychange', function(){
  if(document.hidden){ humStop(); try{ speechSynthesis.cancel(); }catch(e){} IN.id = null; }
  else if(current() === 'write') requestWake();
});
window.addEventListener('resize', function(){ if(current() === 'write' && STEP && STEP.relayout){ lastRect = ''; setTimeout(layoutIfMoved, 60); } });

/* ============ never stuck ========================================== */
/* Whatever goes wrong, she must not be left looking at a pad that will
   not take ink: a demo that died once did exactly that. The pad becomes
   writable after 9 s whatever happens, and any error is written into the
   log, where it syncs to the parent report.                             */
/* counts how long the pad has refused ink without a break. the longest
   honest wait — a miss, then the guide redrawing Æ — is about 8 s       */
var STUCK = { step:null, since:0 };
function armWatchdog(step){ STUCK.step = step; STUCK.since = 0; }
setInterval(function(){
  var st = STEP;
  if(!st || st.ready || current() !== 'write'){ STUCK.since = 0; return; }
  if(STUCK.step !== st){ STUCK.step = st; STUCK.since = 0; }
  if(!STUCK.since){ STUCK.since = Date.now(); return; }
  if(Date.now() - STUCK.since >= 12000){ cancelDemo(); st.ready = true; STUCK.since = 0; }
}, 500);
var errorsToday = 0;
function noteError(msg){
  try{
    if(!S.practice && errorsToday++ < 20){
      LOG.push({ t:Date.now(), k:'E', x:String(msg).slice(0, 300), b:BUILD }); saveLog();
    }
  }catch(e){}
  if(STEP && !STEP.ready){ var st = STEP; setTimeout(function(){ if(STEP === st && !st.ready){ cancelDemo(); st.ready = true; } }, 400); }
}
window.addEventListener('error', function(e){ noteError((e.message || 'error') + ' @' + (e.lineno || '?') + ':' + (e.colno || '?')); });
window.addEventListener('unhandledrejection', function(e){ noteError('promise: ' + (e.reason && e.reason.message || e.reason)); });

/* ============ start-up ============================================= */
load();
try{ if(navigator.storage && navigator.storage.persist) navigator.storage.persist(); }catch(e){}
var forced = (location.search.match(/[?&]c=(\d)/) || [])[1];
theme(PALETTE[forced !== undefined ? (+forced % PALETTE.length) : (Math.random() * PALETTE.length) | 0]);
$('build').textContent = 'b' + BUILD;
setTimeout(cloudSync, 1500);
if('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')){
  navigator.serviceWorker.register('sw.js').catch(function(){});
}

function paintHome(){ $('pname').textContent = S.name ? cap(S.name) : '—'; $('greet').textContent = nm(tx().hi); }
if(!S.name) show('setup'); else { paintHome(); show('home'); }
$('namego').addEventListener('click', function(){
  var v = ($('nameinput').value || '').trim().slice(0, 12);
  if(!v) return;
  S.name = v.toUpperCase(); save(); paintHome(); show('home');
});
$('nameinput').addEventListener('keydown', function(e){ if(e.key === 'Enter') $('namego').click(); });

var wTimer = null;
$('avatar').addEventListener('click', function(){
  unlock();
  $('wtitle').textContent = nm(tx().hi);
  show('welcome');
  say(nm(tx().hi));
  clearTimeout(wTimer); wTimer = setTimeout(function(){ show('lang'); }, 1900);
});
$('welcome').addEventListener('click', function(){ clearTimeout(wTimer); show('lang'); });
Array.prototype.forEach.call(document.querySelectorAll('.flag'), function(f){
  f.addEventListener('click', function(){
    unlock();
    S.lang = f.getAttribute('data-lang'); save();
    if(S.sessionsToday >= S.maxS && !S.practice){
      SES = { items:[], done:{}, samples:[], started:Date.now() };
      $('guest').textContent = '🌙'; $('etitle').textContent = nm(tx().end); $('esub').textContent = tx().night;
      $('today').textContent = ''; $('again').textContent = '🌙'; $('again').dataset.night = '1';
      show('end'); say(tx().night);
      return;
    }
    startSession();
  });
});

/* ============ the parent's side ===================================== */
var press = null;
function armGear(){ clearTimeout(press); press = setTimeout(openParent, 1200); }
function disarmGear(){ clearTimeout(press); }
$('gear').addEventListener('touchstart', armGear, { passive:true });
$('gear').addEventListener('touchend', disarmGear);
$('gear').addEventListener('mousedown', armGear);
$('gear').addEventListener('mouseup', disarmGear);
var panelFrom = 'home';
function openParent(){
  panelFrom = current() || 'home';
  if(STEP){ clearTimeout(STEP.idleT); clearTimeout(STEP.judgeT); }
  cloudSync();
  paintParent();
  show('parent');
}
function paintParent(){
  $('sizev').textContent = S.size; $('size').value = S.size;
  $('minv').textContent = Math.round(S.size * 0.8);
  $('maxv').textContent = S.maxS; $('maxs').value = S.maxS;
  $('ratev').textContent = S.rate.toFixed(2); $('rate').value = S.rate;
  $('buildv').textContent = BUILD;
  $('savev').textContent = S.saveError ? 'FAILING — ' + S.saveError : LOG.length + ' rows recorded';
  var td = LOG.filter(function(r){ return r && P.dayKey(r.t) === today(); });
  var steps = td.filter(function(r){ return r.st; }), ok = steps.filter(function(r){ return r.ok; }).length;
  $('todayv').textContent = S.sessionsToday + ' sitting' + (S.sessionsToday === 1 ? '' : 's') + ', ' + steps.length +
    ' steps, ' + (steps.length ? Math.round(100 * ok / steps.length) + '% right' : '—');
  $('synckey').value = S.syncKey || '';
  $('modev').textContent = (window.navigator.standalone ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches))
      ? 'full screen, from the home icon' : 'inside the browser';
  paintSync(); paintChoices();
}
function paintSync(){ var e = $('syncstat'); if(e) e.textContent = S.syncMsg || (S.syncKey ? 'key set' : 'not set'); }
function paintChoices(){
  function mark(sel, attr, val){
    Array.prototype.forEach.call(document.querySelectorAll(sel), function(b){ b.classList.toggle('on', b.getAttribute(attr) === String(val)); });
  }
  mark('[data-strict]', 'data-strict', S.strict);
  mark('[data-digits]', 'data-digits', S.digits ? 1 : 0);
  mark('[data-hum]', 'data-hum', S.hum ? 1 : 0);
  mark('[data-setlang]', 'data-setlang', S.lang);
  mark('[data-hand]', 'data-hand', S.left ? 1 : 0);
  $('practicebtn').textContent = 'Test run: ' + (S.practice ? 'ON' : 'OFF');
  $('practicebtn').className = 'pbtn' + (S.practice ? ' warn' : '');
}
$('size').addEventListener('input', function(e){ S.size = +e.target.value; save(); paintParent(); });
$('maxs').addEventListener('input', function(e){ S.maxS = +e.target.value; save(); paintParent(); });
$('rate').addEventListener('input', function(e){ S.rate = +e.target.value; save(); $('ratev').textContent = S.rate.toFixed(2); });
Array.prototype.forEach.call(document.querySelectorAll('[data-strict]'), function(b){
  b.addEventListener('click', function(){ S.strict = b.getAttribute('data-strict'); save(); paintChoices(); });
});
Array.prototype.forEach.call(document.querySelectorAll('[data-digits]'), function(b){
  b.addEventListener('click', function(){ S.digits = b.getAttribute('data-digits') === '1'; save(); paintChoices(); });
});
Array.prototype.forEach.call(document.querySelectorAll('[data-hum]'), function(b){
  b.addEventListener('click', function(){ S.hum = b.getAttribute('data-hum') === '1'; save(); paintChoices(); });
});
Array.prototype.forEach.call(document.querySelectorAll('[data-hand]'), function(b){
  b.addEventListener('click', function(){ S.left = b.getAttribute('data-hand') === '1'; save(); paintChoices(); });
});
Array.prototype.forEach.call(document.querySelectorAll('[data-setlang]'), function(b){
  b.addEventListener('click', function(){ S.lang = b.getAttribute('data-setlang'); save(); paintChoices(); paintHome(); });
});
$('practicebtn').addEventListener('click', function(){ S.practice = !S.practice; paintChoices(); $('band').style.display = S.practice ? 'block' : 'none'; });
$('syncsave').addEventListener('click', function(){ S.syncKey = ($('synckey').value || '').trim(); save(); S.syncMsg = ''; cloudSync(); paintSync(); });
$('syncnow').addEventListener('click', function(){ cloudSync(); paintSync(); });
$('pback').addEventListener('click', function(){
  if(panelFrom === 'write' && RUN){ show('write'); if(STEP && STEP.relayout){ lastRect = ''; STEP.relayout(); } return; }
  show(panelFrom === 'parent' || panelFrom === 'stats' ? 'home' : panelFrom);
});
$('rename').addEventListener('click', function(){ $('nameinput').value = S.name; show('setup'); });
$('statsbtn').addEventListener('click', function(){
  R.render($('rep'), LOG, { lang:S.lang, digits:S.digits, now:Date.now(), name:S.name, saveError:S.saveError,
                             plan:P.session(M, { lang:S.lang, name:S.name, size:S.size, digits:S.digits }) });
  show('stats');
});
$('sback').addEventListener('click', function(){ show('parent'); });
$('copydata').addEventListener('click', function(){
  var ta = $('dump'); ta.style.display = 'block';
  ta.value = JSON.stringify({ build:BUILD, name:S.name, log:LOG });
  ta.select();
  var done = false; try{ done = document.execCommand('copy'); }catch(e){}
  $('copydata').textContent = done ? 'Copied (' + LOG.length + ' rows)' : 'Select the box below and copy';
});
$('mergebtn').addEventListener('click', function(){
  var ta = $('dump');
  if(ta.style.display === 'block' && ta.dataset.mode === 'merge'){
    try{
      var d = JSON.parse(ta.value);
      if(!d || !Array.isArray(d.log)) throw new Error('no log in that');
      var before = LOG.length;
      LOG = mergeRows(LOG, d.log); M = P.rebuild(LOG); saveLog();
      $('mergebtn').textContent = 'Merged: +' + (LOG.length - before) + ' rows';
    }catch(e){ $('mergebtn').textContent = 'Could not read that: ' + (e.message || e); }
    ta.style.display = 'none'; ta.dataset.mode = '';
    return;
  }
  ta.value = ''; ta.dataset.mode = 'merge'; ta.style.display = 'block'; ta.focus();
  $('mergebtn').textContent = 'Paste, then tap here again';
});

/* what this device can actually do — the things no document settles */
$('devcheck').addEventListener('click', function(){
  var v = [];
  try{ v = speechSynthesis.getVoices().filter(function(x){ return /^(pl|nb|no|nn)/i.test(x.lang); })
                .map(function(x){ return x.lang + ' ' + x.name + (x.localService ? '' : ' (online)'); }); }catch(e){}
  var rep = {
    ua:navigator.userAgent, standalone:!!(navigator.standalone || (matchMedia && matchMedia('(display-mode: standalone)').matches)),
    touchPoints:navigator.maxTouchPoints, dpr:window.devicePixelRatio, screen:screen.width + 'x' + screen.height,
    voices:v, pointerTypes:Object.keys(IN.types), coalesced:!!(window.PointerEvent && PointerEvent.prototype.getCoalescedEvents),
    moveRate:IN.rate, touchFallback:IN.fallback, wakeLock:!!navigator.wakeLock, audio:AC ? AC.state : 'none',
    storageKeys:Object.keys(localStorage).filter(function(k){ return /^(pisz|litery)\./.test(k); })
  };
  var out = $('devout');
  function finish(){
    out.textContent = JSON.stringify(rep, null, 1);
    if(!S.practice){ LOG.push({ t:Date.now(), k:'D', x:JSON.stringify(rep) }); saveLog(); cloudSync(); }
  }
  try{
    if(navigator.storage && navigator.storage.persisted){
      navigator.storage.persisted().then(function(p){ rep.persisted = p; return navigator.storage.estimate ? navigator.storage.estimate() : null; })
        .then(function(est){ if(est) rep.quotaMB = Math.round(est.quota / 1e6); finish(); }).catch(finish);
    } else finish();
  }catch(e){ finish(); }
});

/* ============ test hooks =========================================== */
/* ?dev=probe hands the internals to the browser tests; nothing else reads it */
if(/[?&]dev=probe\b/.test(location.search)){
  window.__pisz = { S:S, get LOG(){ return LOG; }, get M(){ return M; }, get STEP(){ return STEP; },
                    get RUN(){ return RUN; }, get SES(){ return SES; }, L:L, P:P, current:current,
                    toClient:function(x, y){ return { x:L.left + X(x), y:L.top + Y(y) }; },
                    startSession:startSession, runItem:runItem, layout:layout, IN:IN, save:save,
                    letterPhrase:letterPhrase, prompt:prompt };
}
})();
