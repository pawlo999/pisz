/* The letter sounds a parent recorded (record.html), for both apps.
   Kept on the sync service under the family key; each device keeps a copy
   in the "sounds-v1" cache so they play offline. Litery has its own copy of
   this file's logic inline, because it is one file and must not break when
   Pisz changes.                                                            */
(function (root) {
'use strict';
var BASE = 'https://pisz-sync.pawlo999.workers.dev/a/';
var CACHE = 'sounds-v1';
/* letters that sound the same as another one share its recording; NB c
   is the k of its word, "c som i cowboy"                                 */
var SAME = { pl:{ 'ó':'u' }, nb:{ c:'k', z:'s', w:'v' } };
/* Norwegian consonants that sound as the Polish ones do play the Polish
   recording until a Norwegian one exists (his call, 7 Oct: nobody here
   records Norwegian). Not the vowels — the voice says a Norwegian vowel's
   name, which is its sound — and not h (Polish /x/) or r (his is rolled).
   Norwegian v is the Polish w.                                           */
var BORROW = { nb:{ pl:{ b:'b', d:'d', f:'f', g:'g', j:'j', k:'k', l:'l', m:'m', n:'n', p:'p', s:'s', t:'t', v:'w' } } };
var S = { key:'', index:{}, store:'sounds.index', bufs:{}, ctx:null };

function clipOf(lang, letter){
  var c = String(letter || '').toLowerCase();
  return (SAME[lang] && SAME[lang][c]) || c;
}
function urlOf(lang, c){
  var v = S.index[lang] && S.index[lang][c];
  return BASE + encodeURIComponent(S.key) + '/' + lang + '/' + encodeURIComponent(c) + '?v=' + v;
}
/* which recording a letter plays: its own, else the one it borrows */
function source(lang, letter){
  var c = clipOf(lang, letter);
  if(!S.key) return null;
  if(S.index[lang] && S.index[lang][c]) return { lang:lang, c:c };
  var b = BORROW[lang] || {};
  for(var from in b){
    var k = b[from][c];
    if(k && S.index[from] && S.index[from][k]) return { lang:from, c:k, borrowed:true };
  }
  return null;
}
function has(lang, letter){ return !!source(lang, letter); }
/* recorded in this language, and borrowed from another */
function count(lang){
  var own = Object.keys(S.index[lang] || {}).length, lent = 0, b = BORROW[lang] || {};
  Object.keys(b).forEach(function(from){
    Object.keys(b[from]).forEach(function(c){
      if(!(S.index[lang] && S.index[lang][c]) && S.index[from] && S.index[from][b[from][c]]) lent++;
    });
  });
  return { own:own, borrowed:lent };
}

/* bytes: memory, then this device's cache, then the network (cached on the way) */
function bytes(lang, c){
  var url = urlOf(lang, c);
  function net(){
    return fetch(url).then(function(r){
      if(!r.ok) throw new Error('no clip');
      var copy = r.clone();
      try{ if(root.caches) caches.open(CACHE).then(function(cc){ return cc.put(url, copy); }).catch(function(){}); }catch(e){}
      return r.arrayBuffer();
    });
  }
  if(!root.caches) return net();
  return caches.open(CACHE).then(function(cc){ return cc.match(url); })
    .then(function(hit){ return hit ? hit.arrayBuffer() : net(); })
    .catch(net);
}

/* the decoded clip, kept in memory */
function buffer(lang, letter){
  var src = source(lang, letter);
  if(!src) return Promise.reject(new Error('not recorded'));
  var id = src.lang + ':' + src.c + ':' + S.index[src.lang][src.c];
  if(S.bufs[id]) return Promise.resolve(S.bufs[id]);
  var ctx = S.ctx && S.ctx();
  if(!ctx) return Promise.reject(new Error('no audio'));
  return bytes(src.lang, src.c).then(function(ab){
    return new Promise(function(res, rej){
      var p = ctx.decodeAudioData(ab, res, rej);
      if(p && p.then) p.then(res, rej);
    });
  }).then(function(b){ S.bufs[id] = b; return b; });
}

/* the decoded clip, or a rejection — then the caller says the letter
   with the voice, as before                                              */
function load(lang, letter){
  if(!has(lang, letter)) return Promise.reject(new Error('not recorded'));
  return buffer(lang, letter);
}
/* plays a loaded clip now; returns the node, so a tap can stop it. Null
   when the audio is not running (iOS "interrupted" after a call): a clip
   that would play silently must not leave "jak sowa" on its own          */
function start(b){
  var ctx = S.ctx && S.ctx();
  if(!ctx || ctx.state !== 'running') return null;
  var src = ctx.createBufferSource(); src.buffer = b; src.connect(ctx.destination); src.start();
  return src;
}

/* which letters exist; fetched at start, remembered for offline */
function refresh(){
  if(!S.key) return Promise.resolve(S.index);
  return fetch(BASE + encodeURIComponent(S.key)).then(function(r){ return r.json(); })
    .then(function(ix){
      if(ix && typeof ix === 'object' && !ix.error){
        S.index = ix;
        try{ localStorage.setItem(S.store, JSON.stringify(ix)); }catch(e){}
        /* warm the device cache, so the first tap offline still plays */
        var keep = {};
        Object.keys(ix).forEach(function(lang){
          Object.keys(ix[lang] || {}).forEach(function(c){ keep[urlOf(lang, c)] = 1; bytes(lang, c).catch(function(){}); });
        });
        prune(keep);
      }
      return S.index;
    }).catch(function(){ return S.index; });
}

/* a sound recorded again leaves its old copy behind: drop those */
function prune(keep){
  try{
    if(!root.caches) return;
    caches.open(CACHE).then(function(cc){
      return cc.keys().then(function(reqs){
        reqs.forEach(function(r){ if(r.url.indexOf(BASE) === 0 && !keep[r.url]) cc.delete(r); });
      });
    }).catch(function(){});
  }catch(e){}
}

/* the list kept on this device is there at once; the network is asked
   now, or after opt.later ms (start-up waits, like the progress sync)    */
function init(opt){
  S.key = opt.key || ''; S.ctx = opt.ctx; S.store = opt.store || S.store;
  try{ S.index = JSON.parse(localStorage.getItem(S.store) || '{}') || {}; }catch(e){ S.index = {}; }
  if(!opt.later) return refresh();
  return new Promise(function(res){ setTimeout(function(){ refresh().then(res); }, opt.later); });
}

root.LetterSounds = { init:init, refresh:refresh, has:has, load:load, start:start, clipOf:clipOf,
                      source:source, count:count, SAME:SAME, BORROW:BORROW, BASE:BASE, CACHE:CACHE, _state:S };
})(typeof window !== 'undefined' ? window : this);
