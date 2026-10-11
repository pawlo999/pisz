/* Pisz — the app: screens, finger, voice, drawing.
   Decisions live in engine.js; this file only shows them and listens.     */
(function () {
'use strict';

var BUILD = 8;
/* The sync service. The URL is public; the key the parent pastes in is the
   only credential, because there is no login for a four-year-old.        */
var SYNC_URL = 'https://pisz-sync.pawlo999.workers.dev';
var P = window.Pisz, R = window.PiszReport, G = P.G;

/* ============ content ============================================== */
/* The word a letter "lives in", shown with its picture and spoken as
   "s jak słoń". Same rule as Litery: never a bare letter to the speaker. */
/* Each word starts with ONE plain sound: a cluster (sł-, gw-) or a softened
   consonant (pi-) makes the first sound hard to hear at four (research,
   7 Oct) — so sowa, gęś and pomidor, not słoń, gwiazda and pies.          */
var WORD = {
  pl:{ A:['auto','🚗'], B:['but','👟'], C:['cebula','🧅'], D:['dom','🏠'], E:['ekran','🖥️'],
       F:['foka','🦭'], G:['gęś','🪿'], H:['hipopotam','🦛'], I:['indyk','🦃'], J:['jabłko','🍎'],
       K:['kot','🐱'], L:['lody','🍦'], M:['mama','👩'], N:['nos','👃'], O:['oko','👁️'],
       P:['pomidor','🍅'], R:['ryba','🐟'], S:['sowa','🦉'], T:['tort','🎂'], U:['ucho','👂'],
       W:['woda','💧'], Y:['motyl','🦋'], Z:['zebra','🦓'],
       /* ćma: there is no moth emoji, the butterfly stands in for it */
       'Ą':['wąż','🐍'], 'Ć':['ćma','🦋'], 'Ę':['ręka','✋'], 'Ł':['łódka','⛵'], 'Ń':['koń','🐴'],
       'Ó':['ósemka','8️⃣'], 'Ś':['ślimak','🐌'], 'Ź':['źrebak','🐎'], 'Ż':['żaba','🐸'] },
  nb:{ A:['and','🦆'], B:['ball','⚽'], C:['cowboy','🤠'], D:['dør','🚪'], E:['egg','🥚'],
       F:['fisk','🐟'], G:['gutt','👦'], H:['hus','🏠'], I:['is','🍦'], J:['jordbær','🍓'],
       K:['katt','🐱'], L:['lys','💡'], M:['mus','🐭'], N:['nese','👃'], O:['ost','🧀'],
       P:['penn','🖊️'], R:['rev','🦊'], S:['sol','☀️'], T:['tog','🚆'], U:['ugle','🦉'],
       V:['vann','💧'], W:['wienerpølse','🌭'], Y:['yrke','👷'], Z:['zebra','🦓'],
       /* ærlig (honest) has no picture of its own; the halo face stands in */
       'Æ':['ærlig','😇'], 'Ø':['øre','👂'], 'Å':['åtte','8️⃣'] }
};
/* letters the voice is not trusted to say on their own (Litery: iOS is
   silent or wrong on some) — these are only ever heard inside their word */
/* NB y: his call 7 Oct — 'y som i …' is said right, and yrke starts with y */
var WORD_ONLY = { pl:'', nb:'ØÅ' };
/* One rule for Polish (his call, 7 Oct): a letter that starts its word is
   "s jak sowa"; one that cannot start a word is "ą jak w słowie wąż".
   Never "jak w wężu" or "jak w koniu": the declined word loses the letter. */
var INSIDE = { pl:' jak w słowie ', nb:' som i ' };
var NUM = {
  pl:['zero','jeden','dwa','trzy','cztery','pięć','sześć','siedem','osiem','dziewięć'],
  nb:['null','en','to','tre','fire','fem','seks','sju','åtte','ni']
};
var KEYCAP = ['0️⃣','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣'];
/* [name, picture, what the instruction says — Polish needs the accusative].
   A shape is called what it is. A picture is kept only where it looks like
   the shape (mountain, rainbow, waves); "deszcz" for a lone line meant
   nothing without a cloud on screen (his call, 7 Oct).                   */
var SHAPE = {
  pl:{ down:['kreska w dół','⬇️','kreskę w dół'], across:['kreska w bok','➡️','kreskę w bok'],
       ring:['kółko','⭕','kółko'], plus:['plusik','➕','plusik'],
       slantL:['skośna kreska w lewo','↙️','skośną kreskę w lewo'],
       slantR:['skośna kreska w prawo','↘️','skośną kreskę w prawo'],
       box:['kwadrat','🟪','kwadrat'], x:['krzyżyk','❌','krzyżyk'], mountain:['góra','⛰️','górę'],
       zigzag:['zygzak','⚡','zygzak'], rainbow:['tęcza','🌈','tęczę'], wave:['fale','🌊','fale'] },
  nb:{ down:['strek ned','⬇️','en strek ned'], across:['strek bortover','➡️','en strek bortover'],
       ring:['ring','⭕','en ring'], plus:['pluss','➕','et pluss'],
       slantL:['skrå strek mot venstre','↙️','en skrå strek mot venstre'],
       slantR:['skrå strek mot høyre','↘️','en skrå strek mot høyre'],
       box:['firkant','🟪','en firkant'], x:['kryss','❌','et kryss'], mountain:['fjell','⛰️','et fjell'],
       zigzag:['sikksakk','⚡','en sikksakk'], rainbow:['regnbue','🌈','en regnbue'], wave:['bølger','🌊','bølger'] }
};
var LINK = { pl:' jak ', nb:' som i ' };
var T_ = {
  pl:{ hi:'Cześć %s!', path:'Dzisiaj piszemy', watch:'Patrz!', turn:'Teraz ty!', dots:'Po kropkach!',
       copy:'Teraz bez kropek!', mem:'Napisz %w', memGap:'Napisz literkę, której brakuje: %w',
       shape:'Narysuj %w', start:'Zacznij od zielonej kropki.', resume:'Rysuj dalej od zielonej kropki.', again:'Spróbujmy jeszcze raz.',
       look:'Popatrz jeszcze raz.', name:'Napisz swoje imię!', nameDone:'To twoje imię!',
       praise:['Brawo!','Super!','Pięknie!','Ekstra!','Ale ładnie!'],
       fromTop:'Od samej góry!', rightWay:'W dobrą stronę!',
       seeStart:'Zobacz, skąd zaczynamy.', seeWay:'Zobacz, w którą stronę.', first:'Najpierw popatrz!',
       keep:'Zostawmy tę pierwszą, była ładna.',
       mark:{ k:'A kreska?', p:'A kropka?', o:'A ogonek?', r:'A kółeczko?' },
       mirror:'Prawie! Ta literka patrzy w drugą stronę.',
       end:'Brawo %s!', endSub:'Pokaż mamie albo tacie!', night:'Na dzisiaj koniec. Do jutra!',
       paper:'A teraz napisz jedną literkę kredką na kartce i pokaż mamie albo tacie!',
       book:'Moje literki',
       cue:{ d:'w dół', a:'w prawo', s:'na skos', r:'dookoła', b:'brzuszek', u:'w górę i w dół',
             w:'fala', z:'zygzak', q:'kwadrat', k:'kreska', o:'ogonek', p:'kropka' } },
  nb:{ hi:'Hei %s!', path:'I dag skriver vi', watch:'Se her!', turn:'Nå er det din tur!', dots:'Følg prikkene!',
       copy:'Nå uten prikker!', mem:'Skriv %w', memGap:'Skriv bokstaven som mangler: %w',
       shape:'Tegn %w', start:'Begynn ved den grønne prikken.', resume:'Fortsett fra den grønne prikken.', again:'Vi prøver en gang til.',
       look:'Se en gang til.', name:'Skriv navnet ditt!', nameDone:'Det er navnet ditt!',
       praise:['Bra!','Flott!','Kjempebra!','Supert!','Så fint!'],
       fromTop:'Rett fra toppen!', rightWay:'Riktig vei!',
       seeStart:'Se hvor vi begynner.', seeWay:'Se hvilken vei.', first:'Se først!',
       keep:'Vi beholder den første, den var fin.',
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
/* The voice is a queue, not an interrupt. Cancelling before every new
   sentence (Litery's way) cut 22 of the 37 sentences of one sitting: the
   next instruction arrived before the last had finished — "d jak dom.
   patrz!" was cut by the first stroke's "w dół". Now a sentence waits its
   turn and the game waits for the voice before it moves on. Her taps do not
   cut it either (9 Oct, his words: "it's interrupting and sounds like bad
   product") — only leaving a screen does.
   Everything handed to the speaker is lowercase — iOS announces capitals. */
var VOX = { until:0, last:'', at:0, tapText:'', tapUntil:0, hushAt:0, live:[], trouble:0 };
function speakMs(text, rate){ return 300 + String(text).length * 62 / (rate || S.rate || 0.7); }
/* one sentence to the engine, which queues it behind the one playing */
function utter(text, rate, counted){
  if(!('speechSynthesis' in window) || !text) return;
  try{
    var now = Date.now();
    var u = new SpeechSynthesisUtterance(String(text).toLowerCase());
    var v = VOICE[S.lang];
    if(v){ u.voice = v; u.lang = v.lang; }
    u.rate = rate || S.rate;
    /* every sentence reports how it ended, so one the iPad cuts short is
       written into her log (row k:'Q') and shows in the parent report;
       held in VOX.live, or Safari may drop its events                    */
    VOX.live.push(u);
    var gone = function(){ var i = VOX.live.indexOf(u); if(i >= 0) VOX.live.splice(i, 1); };
    u.onstart = function(){ u.t0 = Date.now(); };
    u.onerror = function(e){ gone(); speechTrouble(e && e.error || 'error', text, u.t0 ? Date.now() - u.t0 : 0); };
    u.onend = function(){
      gone();
      var ms = u.t0 ? Date.now() - u.t0 : 0, exp = speakMs(text, u.rate);
      if(u.t0 && exp > 1500 && ms < exp * 0.35) speechTrouble('short', text, ms);
    };
    speechSynthesis.speak(u);
    if(!counted) VOX.until = Math.max(VOX.until, now) + speakMs(text, u.rate);
    VOX.at = now;
  }catch(e){}
}
function speechTrouble(kind, text, ms){
  /* our own stop, on leaving a screen, is not trouble */
  if(Date.now() - VOX.hushAt < 600 && /interrupt|cancel/.test(kind)) return;
  if(VOX.trouble++ >= 30) return;
  try{
    LOG.push({ t:Date.now(), k:'Q', x:(kind + ' | ' + String(text).split(MARK).join('')).slice(0, 140), ms:ms || 0, b:BUILD });
    saveLog();
  }catch(e){}
}
/* A letter whose sound a parent recorded (record.html) travels inside the
   sentence as MARK + id + MARK, and is played as that recording followed
   by the voice's "jak sowa" — the voice itself can only say the letter's
   name ("gie"), never its sound. A sentence holding one goes through a
   queue of its own, so the recording waits for the voice ahead of it and
   the voice waits for the recording.                                    */
var MARK = '\u2063', CLIP_MS = 700;
var Q = [], PUMP = { busy:false, t:0, src:null, gen:0, seg:null };
/* tap: she asked to hear it (the word, a bubble, a page of her book). It
   waits for the voice to be free instead of cutting it; tapping the same
   thing again while it waits is the same request, and a tap on something
   else replaces a request that has not started yet                      */
function say(text, rate, tap){
  if(!text) return;
  var now = Date.now();
  if(tap){
    if(text === VOX.tapText && now < VOX.tapUntil) return;
    Q = Q.filter(function(x){ return !x.tap; });
    Q = Q.concat(partsOf(text, rate, true));
    VOX.tapText = text; VOX.tapUntil = VOX.until;
    pump();
    return;
  }
  /* the same sentence already waiting or playing: once is enough */
  if(text === VOX.last && (VOX.until > now || PUMP.busy)) return;
  VOX.last = text;
  if(String(text).indexOf(MARK) < 0 && !PUMP.busy){ utter(text, rate); return; }
  Q = Q.concat(partsOf(text, rate, false));
  pump();
}
function partsOf(text, rate, tap){
  var now = Date.now(), out = [];
  String(text).split(MARK).forEach(function(p, i){
    if(i % 2){ out.push({ id:p, rate:rate, tap:tap }); VOX.until = Math.max(VOX.until, now) + CLIP_MS + speakMs(restOf(p), rate || S.rate); }
    else if(p.trim()){ out.push({ text:p, rate:rate, tap:tap }); VOX.until = Math.max(VOX.until, now) + speakMs(p, rate || S.rate); }
  });
  return out;
}
function pump(){
  /* a recording loading or playing calls pump when it is done: anything
     said meanwhile waits behind it (9 Oct — it went out over the
     recording, and the recording's "jak sowa" was lost)                  */
  if(PUMP.seg) return;
  clearTimeout(PUMP.t);
  while(Q.length && Q[0].text !== undefined && !Q[0].tap){ var x = Q.shift(); utter(x.text, x.rate, true); }
  if(!Q.length){ PUMP.busy = false; return; }
  PUMP.busy = true;
  /* a recording, or a sentence she tapped for, waits for the voice ahead
     of it (not forever: an engine stuck "speaking" must not hold the game) */
  if(engineBusy() && Date.now() < VOX.until + 4000){ PUMP.t = setTimeout(pump, 60); return; }
  var seg = Q.shift(), gen = PUMP.gen, done = false;
  if(seg.text !== undefined){ utter(seg.text, seg.rate, true); pump(); return; }
  PUMP.seg = seg;
  function fallback(){
    if(done || gen !== PUMP.gen) return;
    done = true; PUMP.seg = null; utter(plainPhrase(seg.id), seg.rate, true); pump();
  }
  /* not loaded in time, not recorded after all, or the audio is off: the
     voice says the whole phrase the old way, so she never hears "jak sowa"
     on its own                                                           */
  PUMP.t = setTimeout(fallback, CLIP_MS);
  window.LetterSounds.load(S.lang, seg.id).then(function(buf){
    if(done || gen !== PUMP.gen) return;
    ac();
    try{ if(speechSynthesis.speaking) speechTrouble('overlap', MARK + seg.id + MARK, 0); }catch(e){}
    var src = window.LetterSounds.start(buf);
    if(!src){ fallback(); return; }
    done = true; clearTimeout(PUMP.t); PUMP.src = src;
    PUMP.t = setTimeout(function(){
      if(gen !== PUMP.gen) return;
      PUMP.src = null; PUMP.seg = null; utter(restOf(seg.id), seg.rate, true); pump();
    }, Math.round(buf.duration * 1000) + 120);
  }, fallback);
}
/* leaving a screen: the one thing that stops the voice mid-sentence */
function hush(){
  VOX.hushAt = Date.now();
  try{ speechSynthesis.cancel(); }catch(e){}
  Q = []; PUMP.gen++; clearTimeout(PUMP.t); PUMP.busy = false; PUMP.seg = null;
  if(PUMP.src){ try{ PUMP.src.stop(); }catch(e){} PUMP.src = null; }
  VOX.until = 0; VOX.last = ''; VOX.tapText = ''; VOX.tapUntil = 0;
}
function engineBusy(){
  if(Date.now() - VOX.at < 250) return true;           /* the engine may not report it yet */
  try{
    if(typeof speechSynthesis.speaking === 'boolean') return speechSynthesis.speaking || speechSynthesis.pending;
  }catch(e){}
  return Date.now() < VOX.until;
}
function voiceBusy(){ return PUMP.busy || engineBusy(); }
/* cb once the voice has finished: asked of the engine, never more than
   4 s past its own estimate — an engine stuck "speaking" must not stop
   the game                                                              */
function whenQuiet(cb, min){
  var start = Date.now(), cap = Math.max(0, VOX.until - start) + 4000 + (min || 0);
  setTimeout(function check(){
    if(voiceBusy() && Date.now() - start < cap){ setTimeout(check, 100); return; }
    cb();
  }, min || 0);
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
    /* iOS leaves it "interrupted" after a call or the screen locking */
    if(AC.state !== 'running' && AC.state !== 'closed'){ var pr = AC.resume(); if(pr && pr.catch) pr.catch(function(){}); }
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
/* a letter the parent has recorded */
function hasClip(id){
  var g = G[id];
  return !!(g && g.kind === 'letter' && WORD[S.lang][id] && window.LetterSounds && window.LetterSounds.has(S.lang, id));
}
/* " jak sowa", " jak w słowie motyl" */
function restOf(id){
  var w = wordOf(id)[0], c = id.toLowerCase();
  return (w.charAt(0) === c ? LINK[S.lang] : INSIDE[S.lang]) + w;
}
/* "s jak słoń" — or just the word, when the voice cannot be trusted with the letter */
function plainPhrase(id){
  var g = G[id], w = wordOf(id)[0];
  if(g.kind === 'digit') return w;
  if(g.kind === 'shape') return w;
  if(wordOnly(id)) return w;
  return id.toLowerCase() + restOf(id);
}
/* with a recording, its sound stands where the letter's name stood */
function letterPhrase(id){ return hasClip(id) ? MARK + id + MARK : plainPhrase(id); }
function prompt(id, st){
  var g = G[id], t = tx();
  if(g.kind === 'shape') return t.shape.replace('%w', wordOf(id)[2] || wordOf(id)[0]);
  if(st === 'M'){
    if(g.kind === 'letter' && wordOnly(id) && !hasClip(id)) return t.memGap.replace('%w', wordOf(id)[0]);
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
/* layers, bottom to top: the guide, her ink, the green dot (it must never
   disappear under her ink — 9 Oct), the guide's own drawing             */
['guide','ink','dot','fx'].forEach(function(id){ cv[id] = $(id); cx[id] = cv[id].getContext('2d'); });

function layout(g){
  var pad = $('pad'), r = pad.getBoundingClientRect();
  var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  L.w = r.width; L.h = r.height; L.dpr = dpr; L.left = r.left; L.top = r.top;
  var hUnits = FRAME.bottom - FRAME.top;
  L.k = Math.min(r.height / (hUnits + 16), r.width / (FRAME.w + 10));
  var box = g ? g.box : { cx:50 };
  L.ox = r.width / 2 - box.cx * L.k;
  L.oy = (r.height - hUnits * L.k) / 2 - FRAME.top * L.k;
  ['guide','ink','dot','fx'].forEach(function(id){
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
/* the green dot: where a stroke starts, or (from > 0) where she stopped */
function startDot(c, st, n, pulse, from){
  from = from || 0;
  var p = st.pts[from], r = 7.5 * L.k * (pulse || 1);
  c.save();
  c.fillStyle = '#16a34a'; c.beginPath(); c.arc(X(p.x), Y(p.y), r, 0, 7); c.fill();
  c.fillStyle = '#fff'; c.font = '800 ' + Math.round(9 * L.k) + 'px ui-rounded,system-ui,sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(String(n), X(p.x), Y(p.y) + 0.5);
  /* which way to go: an arrow a little along the stroke */
  if(!st.dot && st.pts.length - from > 14){
    var a = st.pts[Math.min(st.pts.length - 1, from + 12)], b = st.pts[Math.min(st.pts.length - 1, from + 22)];
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
/* One finger draws. A pen, once seen, wins: touches are then a palm.
   Other fingers on the glass are not ink (9 Oct, his words: "she is
   touching the screen with other fingers"): a finger becomes her line only
   once it moves, or as a short tap with no other finger down (a dot, an
   accent); a finger that rests never blocks the one that draws, and is
   never told "start from the green dot".
   If iPadOS stops sending pointer events (it does after a five-finger
   swipe — WebKit 236390) the touch events take over.                    */
var IN = { id:null, pen:false, touchMode:false, lastDown:0, moves:0, coal:0, t0:0, rate:0, types:{}, fallback:0, rests:0 };
var CAND = {};                                  /* fingers down that are not ink (yet) */
var MOVE_PX = 8, TAP_MS = 1000, PALM_PX = 44;
var pad = $('pad');
function down(clientX, clientY){
  layoutIfMoved();
  /* she is writing: a guide still drawing (the figure on top) goes on
     without its words. While the guide shows a letter on her pad she
     watches first (his call, 10 Oct): a touch is not ink, and is answered
     once with "Najpierw popatrz!" instead of with nothing               */
  if(STEP && STEP.ready){ if(DEMO_ON) DEMO_ON.quiet = true; }
  else if(STEP && STEP.watch && !STEP.told){ STEP.told = true; say(tx().first); }
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
function fingerDown(id, x, y, wide){
  layoutIfMoved();
  var others = Object.keys(CAND).length > 0 || IN.id !== null;
  Object.keys(CAND).forEach(function(k){ CAND[k].crowd = true; });
  CAND[id] = { pts:[{ x:x, y:y }], t0:performance.now(), crowd:others, wide:!!wide };
}
function fingerMove(id, x, y){
  if(id === IN.id){ move(x, y); return; }
  var c = CAND[id];
  if(!c || c.wide) return;
  c.pts.push({ x:x, y:y });
  if(IN.id === null && Math.hypot(x - c.pts[0].x, y - c.pts[0].y) >= MOVE_PX) ink(id, c);
}
/* this finger is her line: from where it first touched, nothing lost */
function ink(id, c){
  delete CAND[id];
  IN.id = id;
  down(c.pts[0].x, c.pts[0].y);
  for(var i = 1; i < c.pts.length; i++) move(c.pts[i].x, c.pts[i].y);
}
function fingerUp(id, cancelled){
  if(id === IN.id){ IN.id = null; up(); return; }
  var c = CAND[id];
  if(!c) return;
  delete CAND[id];
  /* a short tap with no other finger on the glass: a dot, an accent */
  if(!cancelled && IN.id === null && !c.crowd && !c.wide && performance.now() - c.t0 < TAP_MS){ ink(id, c); IN.id = null; up(); }
  else IN.rests++;
}
pad.addEventListener('pointerdown', function(e){
  if(IN.touchMode) return;
  IN.types[e.pointerType] = 1;
  if(e.pointerType === 'mouse' && e.button !== 0) return;
  if(e.pointerType === 'pen') IN.pen = true;
  else if(IN.pen && e.pointerType === 'touch') return;
  IN.lastDown = Date.now();
  try{ pad.setPointerCapture(e.pointerId); }catch(err){}
  e.preventDefault();
  /* a pen or a mouse never rests on the glass */
  if(e.pointerType !== 'touch'){ if(IN.id !== null) return; IN.id = e.pointerId; down(e.clientX, e.clientY); return; }
  fingerDown(e.pointerId, e.clientX, e.clientY, Math.max(e.width || 0, e.height || 0) > PALM_PX);
});
pad.addEventListener('pointermove', function(e){
  /* a hovering pen moves without ever going down: no ink */
  if(IN.touchMode) return;
  if(e.pointerId !== IN.id && !CAND[e.pointerId]) return;
  var list = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
  if(list && list.length){ IN.coal += list.length - 1; for(var i = 0; i < list.length; i++) fingerMove(e.pointerId, list[i].clientX, list[i].clientY); }
  else fingerMove(e.pointerId, e.clientX, e.clientY);
});
pad.addEventListener('pointerup', function(e){ if(!IN.touchMode) fingerUp(e.pointerId, false); });
pad.addEventListener('pointercancel', function(e){ if(!IN.touchMode) fingerUp(e.pointerId, true); });
/* touch: stop the page from scrolling, zooming or showing a loupe, and
   watch for pointer events that never came                               */
pad.addEventListener('touchstart', function(e){
  e.preventDefault();
  var wide = function(t){ return 2 * Math.max(t.radiusX || 0, t.radiusY || 0) > PALM_PX; };
  if(!IN.touchMode && IN.id === null && Date.now() - IN.lastDown > 400){
    var t = e.changedTouches[0];
    setTimeout(function(){
      if(IN.touchMode || Date.now() - IN.lastDown < 600) return;
      IN.touchMode = true; IN.fallback++; CAND = {};
      fingerDown('t' + t.identifier, t.clientX, t.clientY, wide(t));
    }, 120);
    return;
  }
  if(IN.touchMode) Array.prototype.forEach.call(e.changedTouches, function(t){ fingerDown('t' + t.identifier, t.clientX, t.clientY, wide(t)); });
}, { passive:false });
pad.addEventListener('touchmove', function(e){
  e.preventDefault();
  if(!IN.touchMode) return;
  Array.prototype.forEach.call(e.changedTouches, function(t){ fingerMove('t' + t.identifier, t.clientX, t.clientY); });
}, { passive:false });
pad.addEventListener('touchend', function(e){
  if(IN.touchMode) Array.prototype.forEach.call(e.changedTouches, function(t){ fingerUp('t' + t.identifier, false); });
});
pad.addEventListener('touchcancel', function(e){
  if(IN.touchMode) Array.prototype.forEach.call(e.changedTouches, function(t){ fingerUp('t' + t.identifier, true); });
});
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
      if(SES.done[i]){ runAgain(i); return; }
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
  /* the whole name, as large as fits (10 Oct: five letters were cut off) */
  var text = name.length > 8 ? name.slice(0, 8) + '…' : name, px = Math.round(r.height * 0.34);
  x.font = '800 ' + px + 'px ui-rounded,system-ui,sans-serif';
  var w = x.measureText(text).width;
  if(w > r.width * 0.9){ px = Math.floor(px * r.width * 0.9 / w); x.font = '800 ' + px + 'px ui-rounded,system-ui,sans-serif'; }
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, r.width / 2, r.height / 2);
}

/* a finished letter, once more (his call, 10 Oct: she wanted to make one
   prettier): its last step again, without the intro. A better try
   replaces the drawing on her path; a miss is logged with ag:1 and never
   counts against her                                                    */
function runAgain(i){
  var it = SES.items[i], d = SES.done[i] || {};
  var st = it.name ? 'N' : it.steps.indexOf('M') >= 0 ? 'M' : it.steps.indexOf('C') >= 0 ? 'C' : d.st || 'C';
  runItem(i, { g:it.g, name:it.name, why:it.why, again:true, steps:[st] });
}
function runItem(i, again){
  var it = again || SES.items[i];
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
  if(RUN.item.name){ say(nm('%s'), null, true); return; }
  var st = STEP && STEP.st;
  say(st === 'M' ? prompt(RUN.item.g, 'M') : letterPhrase(RUN.item.g), null, true);
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
  /* the sponge in dots too (his call, 7 Oct: she wants it perfect); the
     road only ever fills where it should, so there is nothing to wipe   */
  $('clear').classList.toggle('hide', st === 'R');
  $('undo').classList.toggle('hide', st === 'R');
  armWatchdog(STEP);
  /* show before doing: the guide draws it first, unless she already
     writes it from memory (then 👀 is there if she wants it)            */
  var lv = M[id] ? M[id].lv : 0;
  if(!RUN.item.again && !RUN.fallback && (st === 'R' || (st === 'T' && first) || (st === 'C' && first && lv <= 2))){
    /* name it, let the voice finish, then draw it: the first stroke's word
       ("w dół") used to cut the sentence off, so a new letter was never
       introduced by name before she saw it drawn                         */
    /* ...and she watches it first: the pad takes ink at "Teraz ty!". On
       7 Oct the pad was opened during the guide because it ignored her
       without a word; on 10 Oct he chose watching first after all, now
       that a touch meanwhile is answered ("Najpierw popatrz!")          */
    var me = STEP;
    me.intro = true; me.watch = true; me.told = false;
    var intro = G[id].kind === 'shape' ? prompt(id, st)
              : (first ? letterPhrase(id) + '. ' : '') + tx().watch;
    say(intro);
    whenQuiet(function(){
      if(STEP !== me || !me.intro) return;
      demo(id, st === 'C' ? 'model' : 'pad', function(){
        if(STEP !== me) return;
        me.intro = false; me.watch = false; me.ready = true;
        say(st === 'R' ? tx().turn : st === 'T' ? tx().dots : tx().copy);
      });
    }, 250);
  } else {
    STEP.ready = true;
    say(st === 'M' ? prompt(id, 'M') : st === 'C' ? tx().copy : st === 'T' ? tx().dots : tx().turn);
  }
}

function stepDone(ok, extra){
  /* the glyph on the pad, not the item: in her name the item is "ADA"
     and each row must be the letter she just wrote                     */
  var st = STEP.st, id = STEP.g ? STEP.g.id : RUN.item.g;
  /* the step is over: a guide still drawing over it stops */
  cancelDemo(); STEP.intro = false;
  var row = { g:id, st:st, ok:ok ? 1 : 0, ms:Date.now() - STEP.t0 };
  if(extra) for(var k in extra) row[k] = extra[k];
  if(RUN && RUN.item.again) row.ag = 1;
  /* help during a memory step makes it a copy — that is what it was */
  if(st === 'M' && STEP.helped) row.st = 'C';
  record(row);
  return row;
}

function nextStep(){
  RUN.si++;
  var cur = RUN;
  if(RUN.si < RUN.steps.length){ whenQuiet(function(){ if(RUN === cur) startStep(); }, 700); return; }
  itemDone();
}

function itemDone(){
  var it = RUN.item, id = it.g;
  var was = SES.done[RUN.i] || {};
  SES.done[RUN.i] = { s:RUN.sample || was.s || null, parts:RUN.parts || was.parts || null, st:STEP && STEP.st || was.st };
  if(RUN.sample){
    /* once more: the new drawing takes the old one's place on the end screen */
    var k = it.again ? SES.samples.map(function(x){ return x.g; }).lastIndexOf(id) : -1;
    if(k >= 0) SES.samples[k] = { g:id, s:RUN.sample }; else SES.samples.push({ g:id, s:RUN.sample });
  }
  var w = wordOf(id);
  tone([523, 659, 784, 1047]);
  if(!it.name){
    bigFace(w[1] || DONE_ITEMS_EMOJI, 1700);
    setTimeout(function(){ say(G[id].kind === 'shape' ? w[0] : letterPhrase(id)); }, 350);
  }
  confetti();
  var cur = RUN;
  whenQuiet(function(){
    if(RUN !== cur || current() !== 'write') return;
    STEP = null; RUN = null;
    if(Object.keys(SES.done).length >= SES.items.length) endSession();
    else { paintPath(); show('path'); }
  }, 1900);
}

/* ---- tracing: road or dots ---------------------------------------- */
function traceStep(id, st){
  var g = G[id], tol = st === 'R' ? 16 : 13;
  function tracer(s, i){
    var bidir = g.mark.indexOf(i) >= 0 && g.cue[i] === 'k';
    return new P.Tracer(s, { tol:tol, bidir:bidir });
  }
  var tr = g.strokes.map(tracer);
  var me = { st:st, g:g, tr:tr, i:0, raw:[], cur:null, wrong:0, off:0, idleT:null, ready:false, lifts:0, clears:0,
             undos:0, hist:[] };
  function paintGuide(){
    clear('guide'); var c = cx.guide;
    lines(c);
    if(st === 'R') road(c, g); else dotted(c, g);
    clear('dot');
    if(me.i < tr.length) startDot(cx.dot, tr[me.i].s, me.i + 1, 1, tr[me.i].idx);
  }
  me.dotAt = function(){ var t = tr[me.i]; return t ? t.s.pts[t.idx] : null; };
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
  /* the figure above the pad belongs to copying: a road or dots step
     after a copy step showed the last item's figure (7 Oct, twice)      */
  me.relayout = function(){ $('model').classList.remove('on'); layout(g); paintGuide(); paintInk(); };
  function poke(){
    clearTimeout(me.idleT);
    me.idleT = setTimeout(function(){
      if(STEP !== me || !me.ready) return;
      /* stuck: show the stroke again and point at where it starts */
      say(tr[me.i] && tr[me.i].idx > 0 ? tx().resume : tx().start); me.help++;
      demoStroke(g, me.i, 'pad', function(){ paintGuide(); });
    }, 12000);
  }
  me.help = 0;
  me.down = function(p){
    if(!me.ready || me.i >= tr.length) return;
    var t = tr[me.i];
    /* what ↩️ goes back to */
    me.hist.push({ i:me.i, wrong:me.wrong, t:{ idx:t.idx, done:t.done, s:t.s, bidir:t.bidir, off:t.off, lifts:t.lifts } });
    var why = t.begin(p);
    me.cur = [p]; me.raw.push(me.cur);
    if(why === 'ok'){
      if(t.done){ strokeDone(); return; }
      humStart(); humSet(t.progress());
    } else {
      me.wrong++;
      if(me.wrong % 2 === 1){ say(t.idx > 0 ? tx().resume : tx().start); pulseStart(t.s, me.i + 1, t.idx); }
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
    /* lifted half way: the green dot moves to where she stopped */
    if(t && t.idx > 0) paintGuide();
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
      if(me.clears) extra.cl = me.clears;
      if(me.undos) extra.un = me.undos;
      /* her own ink over the dots is kept: it is what the end of a first
         sitting has to show, before there is any free writing            */
      if(st === 'T'){ extra.s = P.pack(me.raw.filter(function(s){ return s.length; })); RUN.sample = P.unpack(extra.s); }
      /* a road that ends the item (after two missed copies): the letter she
         filled stands for her drawing on the path and the end screen      */
      else if(!RUN.sample) RUN.sample = g.strokes.map(function(s){ return s.pts.map(function(p){ return { x:p.x, y:p.y }; }); });
      stepDone(true, extra);
      say(pick(tx().praise));
      nextStep();
    } else if(G[RUN.item.g].strokes.length > 1){
      var c = G[RUN.item.g].cue[me.i];
      if(c && tx().cue[c]) setTimeout(function(){ if(STEP === me) say(tx().cue[c]); }, 250);
    }
  }
  /* the sponge: her ink goes, and the letter starts again from line 1 */
  me.clearInk = function(){
    if(st !== 'T') return;
    humStop(); clearTimeout(me.idleT);
    me.cur = null; me.raw = []; me.hist = []; me.i = 0; me.clears++;
    g.strokes.forEach(function(s, i){ tr[i] = tracer(s, i); });
    paintGuide(); paintInk(); poke();
  };
  /* ↩️ (his call, 10 Oct): only her last line goes, and with it whatever
     progress it made; a finished letter is not undone                  */
  me.undo = function(){
    if(st !== 'T' || !me.ready || me.cur || !me.raw.length) return;
    humStop();
    me.raw.pop();
    var h = me.hist.pop();
    if(h){
      var t = tr[h.i];
      t.idx = h.t.idx; t.done = h.t.done; t.s = h.t.s; t.bidir = h.t.bidir; t.off = h.t.off; t.lifts = h.t.lifts;
      t.down = false; t.last = null;
      for(var k = h.i + 1; k < tr.length; k++) tr[k] = tracer(g.strokes[k], k);
      me.i = h.i; me.wrong = h.wrong;
    }
    me.undos++;
    paintGuide(); paintInk(); poke();
  };
  poke();
  return me;
}

/* ---- free writing: copy, memory ----------------------------------- */
function freeStep(id, st, opt){
  opt = opt || {};
  var g = G[id];
  var me = { st:st, g:g, strokes:[], cur:null, ready:false, judgeT:null, idleT:null, tries:0,
             helped:false, last:null, opt:opt, undos:0 };
  function paintGuide(){
    clear('guide'); clear('dot'); lines(cx.guide);
    /* after a first miss: the letter in dots under her next try (his call
       2b, 10 Oct), each line with its numbered green start and arrow     */
    if(me.overlay === 'dots'){
      dotted(cx.guide, g);
      g.strokes.forEach(function(s, i){ if(!s.dot) startDot(cx.dot, s, i + 1); });
      return;
    }
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
    /* the missed try goes when she writes again, even if its replay was cut short */
    if(me.reset){ me.reset = false; me.strokes = []; paintInk(); }
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
    var row = stepDone(true, { e:r.errors.join(','), sc:r.score, n:me.strokes.length, s:packed, h:me.helped ? 1 : 0,
                               un:me.undos || undefined });
    RUN.sample = P.unpack(packed);
    if(opt.onDone){ opt.onDone(true, packed); return; }
    var wrongStart = r.errors.indexOf('start') >= 0, wrongWay = r.errors.indexOf('dir') >= 0;
    tone([660, 880]);
    if(!wrongStart && !wrongWay){
      say(Math.random() < 0.6 ? pick([tx().fromTop, tx().rightWay]) + ' ' + pick(tx().praise) : pick(tx().praise));
      nextStep();
      return;
    }
    /* right, but begun in the wrong place or drawn the wrong way: it
       counts, and the line in question is drawn again the right way
       (his call 1a, 10 Oct — show, never reject; Berninger 1997)       */
    var i = wrongStart ? 0 : Math.max(0, (r.dir || []).indexOf(false));
    say(pick(tx().praise) + ' ' + (wrongStart ? tx().seeStart : tx().seeWay));
    var where = $('model').classList.contains('on') ? 'model' : 'pad';
    me.watch = true; me.told = true;                 /* no figure tap or 👀 can cut it short */
    whenQuiet(function(){
      if(STEP !== me) return;
      demoStroke(g, i, where, function(){
        if(STEP !== me) return;
        if(where === 'model') paintModel(g); else setTimeout(function(){ clear('fx'); }, 400);
        me.watch = false;
        nextStep();
      }, true);
    }, 150);
  }
  function fail(r){
    if(STEP !== me) return;
    me.ready = false; clearTimeout(me.idleT); clearTimeout(me.judgeT);
    me.tries++;
    stepDone(false, { e:(r && r.errors || []).join(','), sc:r ? r.score : 0, n:me.strokes.length,
                      s:P.pack(me.strokes), other:r && r.other || undefined, un:me.undos || undefined,
                      h:me.helped ? 1 : undefined });
    var mirror = r && r.errors.indexOf('mirror') >= 0;
    if(me.tries >= 2 && opt.onDone){ opt.onDone(false, P.pack(me.strokes)); return; }
    if(me.tries >= 2 && RUN.item.again){
      /* once more did not come out: her first one stays, back to the path —
         without praise for the miss                                       */
      say(tx().keep);
      var cur = RUN;
      whenQuiet(function(){ if(RUN !== cur) return; STEP = null; RUN = null; paintPath(); show('path'); }, 600);
      return;
    }
    if(me.tries >= 2){
      /* twice not there: the most help there is — the road, which always
         finishes the letter (his call 2b, 10 Oct; before, it was the dots) */
      say(tx().look);
      RUN.steps.splice(RUN.si + 1, RUN.steps.length, 'R');
      RUN.fallback = true;                   /* she has seen it twice: no third demonstration */
      setTimeout(function(){ if(STEP === me) nextStep(); }, 700);
      return;
    }
    say(mirror ? tx().mirror : tx().look);
    me.overlay = true; paintGuide();
    /* she watches it shown again first (his call, 10 Oct) */
    me.watch = true; me.told = false; me.reset = true; me.helped = true; me.markSaid = false;
    whenQuiet(function(){
      if(STEP !== me) return;
      demo(id, 'pad', function(){
        if(STEP !== me) return;
        if(me.reset){ me.reset = false; me.strokes = []; }
        /* the least help first: dots under her next try — copy, memory
           (which makes it a helped copy) or her name alike              */
        me.overlay = 'dots'; paintGuide(); paintInk();
        me.watch = false; me.ready = true; me.t0 = Date.now();
        say(tx().again);
      });
    }, 600);
  }
  me.clearInk = function(){ me.strokes = []; clearTimeout(me.judgeT); clearTimeout(me.idleT); paintInk(); };
  /* ↩️: her last line goes; what is left is looked at again */
  me.undo = function(){
    if(!me.ready || me.cur || !me.strokes.length) return;
    clearTimeout(me.judgeT); clearTimeout(me.idleT);
    me.strokes.pop(); me.undos++;
    paintInk();
    if(me.strokes.length) me.judgeT = setTimeout(check, 650);
  };
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
/* she may write while the guide draws (7 Oct): it then goes on without
   its words (DEMO_ON.quiet), and stops when her step is done           */
function demo(id, where, done, quiet){
  var g = G[id], i = 0, ticket = ++DEMO;
  DEMO_ON = { t0:performance.now(), where:where, done:done, quiet:!!quiet };
  if(where === 'pad') clear('fx');
  (function next(){
    if(ticket !== DEMO) return;
    if(!STEP || i >= g.strokes.length){ DEMO_ON = null; if(where === 'pad') setTimeout(function(){ clear('fx'); }, 250); else if(STEP) paintModel(g); done && done(); return; }
    demoStroke(g, i, where, function(){ i++; whenQuiet(next, 260); }, true);
  })();
}
function demoStroke(g, i, where, done, keep){
  var st = g.strokes[i], speed = 0.095;       /* units per millisecond */
  var cue = g.cue[i];
  var quiet = DEMO_ON && DEMO_ON.quiet;
  if(!quiet && (g.strokes.length > 1 || g.kind !== 'shape')) if(cue && tx().cue[cue]) say(tx().cue[cue], S.rate);
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
function pulseStart(st, n, from){
  var t0 = performance.now(), anim = { alive:true }; FX = anim;
  (function frame(now){
    if(FX !== anim) return;
    var f = Math.max(0, (now - t0) / 900);
    clear('fx');
    if(f < 1){ startDot(cx.fx, st, n, 1 + 0.5 * Math.sin(f * Math.PI * 3), from); requestAnimationFrame(frame); }
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
      whenQuiet(one, 600);
    } });
    STEP.st = 'N'; STEP.t0 = Date.now();
    $('clear').classList.remove('hide'); $('undo').classList.remove('hide');
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
  /* only on a pad that is hers: never over a guide already showing, nor a
     step that is over                                                  */
  if(!STEP.ready || STEP.watch) return;
  if(STEP.st === 'M') STEP.helped = true;
  /* she watches it, then carries on (10 Oct) */
  var me = STEP;
  me.ready = false; me.watch = true; me.told = false;
  demo(id, 'pad', function(){ if(STEP !== me) return; me.watch = false; me.ready = true; if(me.relayout) me.relayout(); });
});
$('clear').addEventListener('click', function(){ unlock(); if(STEP && STEP.clearInk) STEP.clearInk(); });
$('undo').addEventListener('click', function(){ unlock(); if(STEP && STEP.undo) STEP.undo(); });
/* the figure above the pad writes itself again at every tap (his ask,
   9 Oct), quietly — the pad stays hers meanwhile                        */
$('model').addEventListener('click', function(){
  unlock();
  /* not while the guide is still showing it for the first time */
  if(!STEP || !STEP.g || STEP.watch || !$('model').classList.contains('on')) return;
  var g = STEP.g;
  demo(g.id, 'model', function(){ if(STEP && STEP.g === g) paintModel(g); }, true);
});
$('wback').addEventListener('click', function(){
  unlock();
  if(STEP){ clearTimeout(STEP.idleT); clearTimeout(STEP.judgeT); }
  FX = null; STEP = null; RUN = null; humStop();
  hush();
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
  if($('again').dataset.night){ say(tx().night, null, true); return; }
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
  /* ✏️ writes it now (his call, 7 Oct: she wanted her A). Not after the
     day's last sitting: the limit holds for a letter she picks too       */
  var night = bookFrom !== 'path' && S.sessionsToday >= S.maxS && !S.practice;
  $('detailwrite').style.display = night ? 'none' : '';
  $('detailwrite').dataset.id = id;
  $('detail').classList.add('on');
  say(letterPhrase(id), null, true);
}
$('detail').addEventListener('click', function(){ $('detail').classList.remove('on'); });
$('detailwrite').addEventListener('click', function(e){
  e.stopPropagation(); unlock();
  $('detail').classList.remove('on');
  writeChosen($('detailwrite').dataset.id);
});
/* in a sitting: her letter joins it (or is taken from it, if it is still
   to come); after one: the next sitting, her letter first               */
function writeChosen(id){
  var it = { g:id, why:'chosen', steps:P.plan(M[id], { shape:G[id].kind === 'shape' }) };
  if(bookFrom === 'path' && SES && Object.keys(SES.done).length < SES.items.length){
    var at = SES.items.findIndex(function(x, i){ return x.g === id && !x.name && !SES.done[i]; });
    if(at < 0){ SES.items.push(it); at = SES.items.length - 1; }
    runItem(at);
    return;
  }
  startSession();
  SES.items = [it].concat(SES.items.filter(function(x){ return x.g !== id; }));
  runItem(0);
}
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
  if(document.hidden){ humStop(); hush(); IN.id = null; CAND = {}; }
  else if(current() === 'write') requestWake();
});
window.addEventListener('resize', function(){ if(current() === 'write' && STEP && STEP.relayout){ lastRect = ''; setTimeout(layoutIfMoved, 60); } });

/* ============ never stuck ========================================== */
/* Whatever goes wrong, she must not be left looking at a pad that will
   not take ink: a demo that died once did exactly that. The pad becomes
   writable after 9 s whatever happens, and any error is written into the
   log, where it syncs to the parent report.                             */
/* counts how long the pad has refused ink without a break. the longest
   honest wait — the intro, then the guide drawing Æ and saying each of
   its five strokes, waiting for the voice each time — is about 12 s     */
var STUCK = { step:null, since:0 };
function armWatchdog(step){ STUCK.step = step; STUCK.since = 0; }
setInterval(function(){
  var st = STEP;
  if(!st || st.ready || current() !== 'write'){ STUCK.since = 0; return; }
  if(STUCK.step !== st){ STUCK.step = st; STUCK.since = 0; }
  if(!STUCK.since){ STUCK.since = Date.now(); return; }
  if(Date.now() - STUCK.since >= 20000){ cancelDemo(); st.ready = true; st.intro = false; st.watch = false; STUCK.since = 0; }
}, 500);
var errorsToday = 0;
function noteError(msg){
  try{
    if(!S.practice && errorsToday++ < 20){
      LOG.push({ t:Date.now(), k:'E', x:String(msg).slice(0, 300), b:BUILD }); saveLog();
    }
  }catch(e){}
  /* a guide that died mid-way (the pad is live during it now): end it */
  if(STEP && (!STEP.ready || STEP.intro)){
    var st = STEP;
    setTimeout(function(){ if(STEP === st && (!st.ready || st.intro)){ cancelDemo(); st.ready = true; st.intro = false; st.watch = false; } }, 400);
  }
}
window.addEventListener('error', function(e){ noteError((e.message || 'error') + ' @' + (e.lineno || '?') + ':' + (e.colno || '?')); });
window.addEventListener('unhandledrejection', function(e){ noteError('promise: ' + (e.reason && e.reason.message || e.reason)); });

/* ============ start-up ============================================= */
load();
function sounds(later){ return window.LetterSounds.init({ key:S.syncKey, ctx:ac, store:'pisz.sounds.index', later:later }); }
sounds(1500);
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
  window.LetterSounds.refresh().then(paintSounds);
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
  paintSync(); paintChoices(); paintSounds();
}
function paintSounds(){
  var n = function(l){ return window.LetterSounds.count(l).own; }, lent = window.LetterSounds.count('nb').borrowed;
  $('sndv').textContent = !S.syncKey ? 'needs the sync key below'
    : (n('pl') || n('nb')) ? n('pl') + ' Polish, ' + n('nb') + ' Norwegian recorded' + (lent ? ', ' + lent + ' more Norwegian from Polish' : '')
    : 'none yet — the voice says the letter names';
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
$('syncsave').addEventListener('click', function(){
  S.syncKey = ($('synckey').value || '').trim(); save(); S.syncMsg = ''; cloudSync(); paintSync();
  sounds().then(paintSounds);
});
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
                    letterPhrase:letterPhrase, plainPhrase:plainPhrase, prompt:prompt, say:say, hush:hush,
                    voiceBusy:voiceBusy, whenQuiet:whenQuiet, sounds:sounds, openParent:openParent,
                    openBook:openBook, get DEMO_ON(){ return DEMO_ON; } };
}
})();
