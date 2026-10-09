// node test/sounds.test.mjs — the letter sounds a parent records.
// Chromium only: headless WebKit has no working audio here. Needs the app
// served: python3 serve.py 8791 (PISZ_URL overrides).
import fs from 'fs';
import os from 'os';
import path from 'path';
import { chromium } from 'playwright-core';
import worker from '../sync/src/worker.js';
import { fakeKV } from './fakekv.mjs';
import { open, sleep, until, BASE } from './harness.mjs';

let pass = 0, fail = 0;
const ok = (c, m, x = '') => { c ? (pass++, console.log('  ✓ ' + m)) : (fail++, console.log('  ✗ ' + m + (x ? '   <- ' + x : ''))); };
const SYNC = 'https://pisz-sync.pawlo999.workers.dev';
const KEY = 'sound-test-key-0123456789';

/* a mono 16-bit WAV of the given samples */
function wav(x, sr = 22050) {
  const b = Buffer.alloc(44 + x.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + x.length * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24);
  b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36);
  b.writeUInt32LE(x.length * 2, 40);
  for (let i = 0; i < x.length; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x[i])) * 32767), 44 + i * 2);
  return b;
}
const tone = (sec, f, amp, sr = 22050) => Float32Array.from({ length: Math.round(sec * sr) }, (_, i) => amp * Math.sin(2 * Math.PI * f * i / sr));
const silence = (sec, sr = 22050) => new Float32Array(Math.round(sec * sr));
const cat = (...a) => { const o = new Float32Array(a.reduce((n, x) => n + x.length, 0)); let p = 0; for (const x of a) { o.set(x, p); p += x.length; } return o; };
function readWav(buf) {
  const b = Buffer.from(buf), sr = b.readUInt32LE(24), ch = b.readUInt16LE(22), n = b.readUInt32LE(40) / 2, x = [];
  for (let i = 0; i < n; i++) x.push(b.readInt16LE(44 + i * 2) / 32767);
  let peak = 0, s = 0; for (const v of x) peak = Math.max(peak, Math.abs(v));
  const mid = x.slice(Math.floor(n / 4), Math.floor(3 * n / 4)); for (const v of mid) s += v * v;
  return { riff: b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WAVE', sr, ch, sec: n / sr, peak,
           rms: Math.sqrt(s / (mid.length || 1)) };
}

/* the sync service, in process, bytes and all */
async function routeSync(ctx, env, opts = {}) {
  await ctx.route(SYNC + '/**', async route => {
    const req = route.request();
    if (opts.down) return route.abort();
    if (opts.fail && opts.fail(req.url())) return route.fulfill({ status: 500, body: 'boom' });
    const body = ['PUT', 'POST'].includes(req.method()) ? req.postDataBuffer() : undefined;
    const res = await worker.fetch(new Request(req.url(), { method: req.method(), body }), env);
    route.fulfill({ status: res.status, headers: Object.fromEntries(res.headers), body: Buffer.from(await res.arrayBuffer()) });
  });
}
const put = (env, lang, c, samples) => worker.fetch(new Request(SYNC + '/a/' + KEY + '/' + lang + '/' + encodeURIComponent(c),
  { method: 'PUT', body: wav(samples) }), env).then(r => r.json());

/* when each clip started and stopped, and when each sentence reached the voice */
const SPY = () => {
  window.__clips = []; window.__stops = 0; window.__saidAt = [];
  const st = AudioBufferSourceNode.prototype.start, sp = AudioBufferSourceNode.prototype.stop;
  AudioBufferSourceNode.prototype.start = function (...a) {
    window.__clips.push({ t: performance.now(), d: this.buffer && this.buffer.duration, speaking: speechSynthesis.speaking });
    return st.apply(this, a);
  };
  AudioBufferSourceNode.prototype.stop = function (...a) { window.__stops++; return sp.apply(this, a); };
  const s = window.speechSynthesis, sp2 = s.speak;
  s.speak = u => { window.__saidAt.push({ t: performance.now(), text: u.text }); sp2(u); };
};

const tmp = fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR ? process.env.CLAUDE_JOB_DIR + '/tmp' : os.tmpdir(), 'mic-'));
const micFile = path.join(tmp, 'mic.wav');
/* a sound in the middle of silence, again and again */
fs.writeFileSync(micFile, wav(cat(silence(1.0, 48000), tone(0.5, 200, 0.3, 48000), silence(1.0, 48000)), 48000));

process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = '1';
const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
  '--use-file-for-fake-audio-capture=' + micFile, '--autoplay-policy=no-user-gesture-required'] });

/* ------------------------------------------------------------------ */
console.log('\nthe recording page');
{
  const env = { STORE: fakeKV() };
  const ctx = await b.newContext({ viewport: { width: 820, height: 1180 }, serviceWorkers: 'block', permissions: ['microphone'] });
  await routeSync(ctx, env);
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(k => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('litery.child.v2', JSON.stringify({ syncKey: k })); sessionStorage.setItem('seeded', '1'); } }, KEY);
  await page.goto(BASE + 'record.html'); await sleep(500);
  ok(await page.inputValue('#key') === KEY, "the family key is picked up from the letters game on this device");
  const rows = await page.$$eval('.row', r => r.map(x => x.querySelector('.ch').textContent + '|' + x.className + '|' + x.querySelector('.hint').textContent));
  ok(rows.length === 32, 'Polish lists all 32 letters', rows.length);
  ok(rows.some(r => r.startsWith('Ó|row same|tak samo jak U')), 'Ó is not recorded: it is the U sound', rows.find(r => r[0] === 'Ó'));
  ok(/bez samogłoski/.test(rows.find(r => r[0] === 'G')), 'G asks for the sound with no vowel after it', rows.find(r => r[0] === 'G'));
  ok(await page.textContent('#count') === '0 / 31 recorded', 'nothing recorded yet', await page.textContent('#count'));

  await page.click('.btn.rec[data-letter="g"]');
  await until(page, () => document.querySelector('.btn.rec[data-letter="g"]').classList.contains('live'), null, 4000, 'recording');
  await until(page, () => /✓|!/.test(document.querySelector('.btn.rec[data-letter="g"]').parentNode.querySelector('.st').textContent), null, 8000, 'saved');
  const st = await page.$eval('.btn.rec[data-letter="g"]', e => e.parentNode.querySelector('.st').textContent);
  ok(st === '✓', 'a tap records for 3 s, and the sound is saved', st + ' ' + await page.textContent('#msg'));
  const clip = env.STORE.m.get('pisz:a:' + KEY + ':pl:g');
  const w = clip ? readWav(clip) : {};
  ok(w.riff && w.sr === 22050 && w.ch === 1, 'stored as a 22 kHz mono WAV', JSON.stringify(w));
  ok(w.sec > 0.4 && w.sec < 2.9, `trimmed to the sound: ${w.sec && w.sec.toFixed(2)} s of a 3 s take`);
  ok(w.peak <= 0.951 && Math.abs(w.rms / 0.16 - 1) < 0.25, `loudness evened out: level ${w.rms && w.rms.toFixed(3)} (aim 0.16), peak ${w.peak && w.peak.toFixed(2)}`);
  const ix = JSON.parse(env.STORE.m.get('pisz:ai:' + KEY) || '{}');
  ok(ix.pl && ix.pl.g > 0, 'the index lists it, with when', JSON.stringify(ix));
  ok(await page.textContent('#count') === '1 / 31 recorded', 'the count moves', await page.textContent('#count'));
  ok(await page.$eval('.btn.rec[data-letter="g"]', e => !e.previousElementSibling.disabled), '▶ is offered to listen back');

  await put(env, 'pl', 'h', tone(0.4, 300, 0.4)); await put(env, 'pl', 'w', tone(0.4, 300, 0.4));
  await page.reload(); await sleep(600);
  await page.click('.tab[data-lang="nb"]');
  const nb = await page.$$eval('.row', r => r.map(x => x.querySelector('.ch').textContent + '|' + x.querySelector('.hint').textContent));
  ok(nb.length === 27 && nb.find(r => r[0] === 'C') === 'C|samme lyd som K — trenger ikke opptak', 'Norwegian: C borrows the K of "cowboy"', nb.find(r => r[0] === 'C'));
  ok(await page.textContent('#count') === '0 / 24 recorded · 2 use the Polish one', 'Norwegian has its own 24; G and V use the Polish ones meanwhile', await page.textContent('#count'));
  const g = await page.$eval('.btn.rec[data-letter="g"]', e => ({ cls: e.parentNode.className, hint: e.parentNode.querySelector('.hint').textContent,
                                                                  st: e.parentNode.querySelector('.st').textContent, play: !e.previousElementSibling.disabled }));
  ok(/borrow/.test(g.cls) && /now uses your Polish G — record to replace it/.test(g.hint) && g.st === '↺' && g.play,
     'the Norwegian G row says it plays the Polish G, and ▶ plays it', JSON.stringify(g));
  const h = await page.$eval('.btn.rec[data-letter="h"]', e => e.parentNode.className);
  ok(!/borrow/.test(h), 'H never borrows (Polish H is another sound)', h);

  await page.reload(); await sleep(600);
  ok(await page.$eval('.btn.rec[data-letter="g"]', e => e.parentNode.classList.contains('done')), 'after a reload, G shows as recorded');

  /* the cleaning itself, on sounds whose answer is known */
  const c = await page.evaluate(async () => {
    const sr = 48000, mk = (parts) => {
      const n = parts.reduce((a, p) => a + Math.round(p[0] * sr), 0), x = new Float32Array(n); let o = 0;
      for (const [sec, f] of parts) { const m = Math.round(sec * sr); for (let i = 0; i < m; i++) x[o + i] = f(i); o += m; }
      const b = new AudioBuffer({ length: n, sampleRate: sr, numberOfChannels: 1 }); b.copyToChannel(x, 0); return b;
    };
    let seed = 1; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    const hum = i => 0.001 * rnd(), vowel = i => 0.05 * Math.sin(2 * Math.PI * 220 * i / sr), hiss = i => 0.3 * rnd();
    const lvl = b => { const x = b.getChannelData(0); let s = 0, p = 0; for (const v of x) { s += v * v; p = Math.max(p, Math.abs(v)); }
                       return { sec: b.duration, rms: Math.sqrt(s / x.length), peak: p }; };
    const v = await window.__rec.clean(mk([[0.5, hum], [0.4, vowel], [0.6, hum]]));
    const h = await window.__rec.clean(mk([[0.3, hum], [0.4, hiss], [0.3, hum]]));
    const none = await window.__rec.clean(mk([[1.5, i => 0.003 * rnd()]]));
    return { v: lvl(v.buffer), h: lvl(h.buffer), none, wavOk: new TextDecoder().decode(new Uint8Array(v.wav, 0, 4)) };
  });
  ok(c.v.sec > 0.4 && c.v.sec < 0.6, `the silence around a sound is cut: 1.5 s → ${c.v.sec.toFixed(2)} s`);
  ok(Math.abs(c.v.rms / c.h.rms - 1) < 0.25, `a quiet "aaa" and a loud "sss" come out equally loud (${c.v.rms.toFixed(3)} vs ${c.h.rms.toFixed(3)})`);
  ok(c.v.peak <= 0.951 && c.h.peak <= 0.951, 'never clipped');
  ok(c.none === null, 'a take with nothing in it is refused, not saved as hiss');
  ok(!errors.length, 'no errors', errors.join(' | '));
  await ctx.close();
}

/* ------------------------------------------------------------------ */
console.log('\nPisz plays the recording, then says the word');
{
  const env = { STORE: fakeKV() };
  await put(env, 'pl', 's', cat(tone(0.5, 300, 0.4)));
  await put(env, 'pl', 't', cat(tone(0.2, 300, 0.4)));
  await put(env, 'pl', 'w', cat(tone(0.35, 300, 0.4)));
  await put(env, 'pl', 'h', cat(tone(0.45, 300, 0.4)));
  await put(env, 'pl', 'k', cat(tone(0.25, 300, 0.4)));
  await put(env, 'nb', 'k', cat(tone(0.3, 300, 0.4)));
  await put(env, 'nb', 'ø', cat(tone(0.4, 300, 0.4)));
  let failT = true;
  const { page, ctx, errors } = await open(b, { seed: { name: 'ADA', lang: 'pl', syncKey: KEY } });
  await routeSync(ctx, env, { fail: u => failT && /\/pl\/t\?/.test(u) });
  await page.addInitScript(SPY);
  await page.reload(); await sleep(800);
  await until(page, () => window.LetterSounds.has('pl', 'S'), null, 4000, 'index');
  const ph = await page.evaluate(() => [window.__pisz.letterPhrase('S'), window.__pisz.plainPhrase('S'), window.__pisz.letterPhrase('M')]);
  ok(ph[0] === '⁣S⁣' && ph[1] === 's jak sowa' && ph[2] === 'm jak mama', 'a recorded letter is marked; one not recorded is said as before', JSON.stringify(ph));

  await page.evaluate(() => { window.__pisz.say('raz dwa trzy cztery'); window.__pisz.say(window.__pisz.letterPhrase('S')); });
  await until(page, () => window.__saidAt.some(s => s.text === ' jak sowa'), null, 6000, 'jak sowa');
  let r = await page.evaluate(() => ({ clips: window.__clips, said: window.__saidAt }));
  const clip = r.clips[0], rest = r.said.find(s => s.text === ' jak sowa');
  ok(r.clips.length === 1 && Math.abs(clip.d - 0.5) < 0.02, 'the recording plays', JSON.stringify(r.clips));
  ok(clip && !clip.speaking, 'only once the sentence before it has finished — never over it');
  ok(rest && clip && rest.t - clip.t >= 500, `"jak sowa" follows when the recording ends (${rest && Math.round(rest.t - clip.t)} ms after it began)`);
  ok(!r.said.some(s => /^s jak/.test(s.text)), 'the voice never says the letter\'s name as well');

  /* the game waits for the recording as it waits for the voice */
  r = await page.evaluate(() => new Promise(res => {
    const a = window.__pisz, t0 = performance.now(); let busyMid = null;
    a.hush(); a.say(a.letterPhrase('S'));
    setTimeout(() => { busyMid = a.voiceBusy(); }, 300);
    a.whenQuiet(() => res({ busyMid, waited: performance.now() - t0, said: window.__saidAt.slice(-1)[0].text }));
  }));
  ok(r.busyMid === true, 'while the recording plays the voice counts as busy');
  ok(r.waited > 1000 && r.said === ' jak sowa', `the next step waits for both (${Math.round(r.waited)} ms)`);

  /* a sentence the game says while a recording plays waits for it and its "jak sowa"
     (9 Oct: it used to go out over the recording, and the "jak sowa" was lost)          */
  r = await page.evaluate(() => new Promise(res => {
    const a = window.__pisz; a.hush();
    const n = window.__clips.length, said = window.__saidAt.length;
    a.say(a.letterPhrase('S'));
    const iv = setInterval(() => {
      if (window.__clips.length > n) { clearInterval(iv); const tc = performance.now(); a.say('w bok');
        setTimeout(() => res({ after: window.__saidAt.slice(said).map(s => ({ text: s.text, at: Math.round(s.t - tc) })) }), 2000); }
    }, 20);
  }));
  ok(r.after.map(x => x.text).join('|') === ' jak sowa|w bok' && r.after[0].at >= 450, 'a sentence arriving during the recording comes after it and its "jak sowa"', JSON.stringify(r));

  /* her tap no longer cuts anything (9 Oct): it waits for the recording and its "jak sowa" */
  r = await page.evaluate(() => new Promise(res => {
    const a = window.__pisz; a.hush();
    const n = window.__clips.length, stops = window.__stops, said = window.__saidAt.length;
    a.say(a.letterPhrase('S'));
    const iv = setInterval(() => {
      if (window.__clips.length > n) { clearInterval(iv); a.say('hop', null, true);
        setTimeout(() => res({ stopped: window.__stops > stops, after: window.__saidAt.slice(said).map(s => s.text) }), 2000); }
    }, 20);
  }));
  ok(!r.stopped && r.after.join('|') === ' jak sowa|hop', 'a tap during the recording waits: "[s] jak sowa", then hers', JSON.stringify(r));
  /* leaving the screen is what stops it */
  r = await page.evaluate(() => new Promise(res => {
    const a = window.__pisz; a.hush();
    const n = window.__clips.length, stops = window.__stops, said = window.__saidAt.length;
    a.say(a.letterPhrase('S'));
    const iv = setInterval(() => {
      if (window.__clips.length > n) { clearInterval(iv); a.hush();
        setTimeout(() => res({ stopped: window.__stops > stops, after: window.__saidAt.slice(said).map(s => s.text) }), 1200); }
    }, 20);
  }));
  ok(r.stopped && !r.after.includes(' jak sowa'), 'leaving the screen stops the recording and drops its "jak sowa"', JSON.stringify(r));

  /* a recording that cannot be fetched: the old phrase, never "jak tort" alone */
  r = await page.evaluate(() => new Promise(res => {
    const a = window.__pisz, n = window.__clips.length, said = window.__saidAt.length;
    a.hush(); a.say(a.letterPhrase('T'));
    setTimeout(() => res({ clips: window.__clips.length - n, said: window.__saidAt.slice(said).map(s => s.text) }), 1500);
  }));
  ok(r.clips === 0 && r.said.join('|') === 't jak tort', 'a recording that will not load: the voice says "t jak tort" as before', JSON.stringify(r));

  /* audio not running (iOS after a call): no silent clip followed by "jak sowa" */
  r = await page.evaluate(() => new Promise(res => {
    const a = window.__pisz, keep = window.LetterSounds.start, said = window.__saidAt.length;
    window.LetterSounds.start = () => null;
    a.hush(); a.say(a.letterPhrase('S'));
    setTimeout(() => { window.LetterSounds.start = keep; res(window.__saidAt.slice(said).map(s => s.text)); }, 1200);
  }));
  ok(r.join('|') === 's jak sowa', 'audio switched off: the whole phrase from the voice', JSON.stringify(r));

  /* a sentence with the letter inside it */
  r = await page.evaluate(() => window.__pisz.prompt('S', 'M'));
  ok(r === 'Napisz ⁣S⁣', 'the write-from-memory prompt carries the recording too', JSON.stringify(r));

  /* Norwegian: C is the K recording; Ø, which the voice cannot say, gets its sound */
  r = await page.evaluate(() => { const a = window.__pisz; a.S.lang = 'nb';
    const o = { c: a.letterPhrase('C'), o: a.letterPhrase('Ø'), m: a.prompt('Ø', 'M'), a: a.letterPhrase('Å') }; a.S.lang = 'pl'; return o; });
  ok(r.c === '⁣C⁣' && r.o === '⁣Ø⁣' && r.m === 'Skriv ⁣Ø⁣' && r.a === 'åtte',
     'NB: C plays the K sound, Ø plays its own, Å (not recorded) stays "åtte"', JSON.stringify(r));
  r = await page.evaluate(() => new Promise(res => { const a = window.__pisz; a.S.lang = 'nb'; const said = window.__saidAt.length, n = window.__clips.length;
    a.hush(); a.say(a.letterPhrase('C'));
    setTimeout(() => { a.S.lang = 'pl'; res({ clip: window.__clips.slice(n).map(c => +c.d.toFixed(2)), said: window.__saidAt.slice(said).map(s => s.text) }); }, 1800); }));
  ok(r.clip.join() === '0.3' && r.said.join('|') === ' som i cowboy', '"[k] som i cowboy" — the Norwegian K, though a Polish K exists too', JSON.stringify(r));

  /* Norwegian with no recording of its own: the matching Polish consonant */
  const nbSay = id => page.evaluate(id => new Promise(res => { const a = window.__pisz; a.S.lang = 'nb'; const said = window.__saidAt.length, n = window.__clips.length;
    a.hush(); a.say(a.letterPhrase(id));
    setTimeout(() => { a.S.lang = 'pl'; res({ clip: window.__clips.slice(n).map(c => +c.d.toFixed(2)).join(), said: window.__saidAt.slice(said).map(s => s.text).join('|') }); }, 1500); }), id);
  r = await nbSay('S');
  ok(r.clip === '0.5' && r.said === ' som i sol', 'NB S plays the Polish S: "[s] som i sol"', JSON.stringify(r));
  r = await nbSay('V');
  ok(r.clip === '0.35' && r.said === ' som i vann', 'NB V plays the Polish W, which is the v sound', JSON.stringify(r));
  r = await nbSay('W');
  ok(r.clip === '0.35' && r.said === ' som i wienerpølse', 'NB W (= v) too', JSON.stringify(r));
  r = await nbSay('H');
  ok(r.clip === '' && r.said === 'h som i hus', 'NB H is said as before: the Polish H is another sound', JSON.stringify(r));
  r = await nbSay('E');
  ok(r.clip === '' && r.said === 'e som i egg', 'NB vowels are said as before: their name is their sound', JSON.stringify(r));

  /* the parent panel says what is recorded */
  await page.evaluate(() => window.__pisz.openParent()); await sleep(400);
  const sv = await page.textContent('#sndv');
  ok(sv === '5 Polish, 2 Norwegian recorded, 3 more Norwegian from Polish', 'the parent panel counts the recordings, and the borrowed ones', sv);
  ok(await page.getAttribute('#recbtn', 'href') === 'record.html', 'and links to the recording page');

  /* offline: the index and the recordings were kept on the device */
  await ctx.unrouteAll({ behavior: 'ignoreErrors' });
  await routeSync(ctx, env, { down: true });
  await page.reload(); await sleep(800);
  r = await page.evaluate(() => new Promise(res => {
    const a = window.__pisz;
    if (a.letterPhrase('S') !== '⁣S⁣') return res('not marked offline');
    a.hush(); a.say(a.letterPhrase('S'));
    setTimeout(() => res({ clips: window.__clips.length, said: window.__saidAt.map(s => s.text) }), 1500);
  }));
  ok(r.clips === 1 && r.said.join('|') === ' jak sowa', 'with the network gone the recording still plays, from this device', JSON.stringify(r));
  const stray = errors.filter(e => !/Failed to load resource|ERR_FAILED|500/.test(e));
  ok(!stray.length, 'no errors', stray.join(' | '));
  await ctx.close();
}

/* ------------------------------------------------------------------ */
console.log('\nno key, nothing recorded: exactly the old speech');
{
  const { page, ctx, errors } = await open(b, { seed: { name: 'ADA', lang: 'pl' } });
  let asked = 0;
  await ctx.route(SYNC + '/a/**', r => { asked++; r.abort(); });
  await page.reload(); await sleep(2200);           /* past the start-up wait */
  const r = await page.evaluate(() => [window.__pisz.letterPhrase('S'), window.__pisz.letterPhrase('Ą'), window.__pisz.prompt('S', 'M')]);
  ok(r.join('|') === 's jak sowa|ą jak w słowie wąż|Napisz s jak sowa', 'phrases unchanged', JSON.stringify(r));
  ok(asked === 0, 'and the sounds service is never asked without a key');
  ok(!errors.length, 'no errors', errors.join(' | '));
  await ctx.close();
}

await b.close();
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
