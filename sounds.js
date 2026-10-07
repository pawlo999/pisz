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
var S = { key:'', index:{}, store:'sounds.index', bufs:{}, ctx:null };

function clipOf(lang, letter){
  var c = String(letter || '').toLowerCase();
  return (SAME[lang] && SAME[lang][c]) || c;
}
function urlOf(lang, c){
  var v = S.index[lang] && S.index[lang][c];
  return BASE + encodeURIComponent(S.key) + '/' + lang + '/' + encodeURIComponent(c) + '?v=' + v;
}
function has(lang, letter){
  var c = clipOf(lang, letter);
  return !!(S.key && S.index[lang] && S.index[lang][c]);
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
  var c = clipOf(lang, letter), id = lang + ':' + c + ':' + (S.index[lang] && S.index[lang][c]);
  if(S.bufs[id]) return Promise.resolve(S.bufs[id]);
  var ctx = S.ctx && S.ctx();
  if(!ctx) return Promise.reject(new Error('no audio'));
  return bytes(lang, c).then(function(ab){
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
                      SAME:SAME, BASE:BASE, CACHE:CACHE, _state:S };
})(typeof window !== 'undefined' ? window : this);
