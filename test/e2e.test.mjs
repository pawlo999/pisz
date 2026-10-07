// node test/e2e.test.mjs [webkit|chromium|all]
// The real app in a real browser engine, driven like a child and a parent.
// Needs the app served: python3 serve.py 8791 (PISZ_URL overrides).
import { createRequire } from 'module';
import { childify, scribble } from './childify.mjs';
import { launch, open, draw, sleep, until, templateStrokes, IPAD, IPAD_LAND, BASE as BASE_URL } from './harness.mjs';
import { playSitting } from './play.mjs';
import worker from '../sync/src/worker.js';
import { fakeKV } from './fakekv.mjs';
const require = createRequire(import.meta.url);
const P = require('../engine.js');

const which = process.argv[2] || 'all';
let pass = 0, fail = 0;
const ok = (c, m, x = '') => { c ? (pass++, console.log('  ✓ ' + m)) : (fail++, console.log('  ✗ ' + m + (x ? '   <- ' + x : ''))); };
const DAY = 86400000;
const SYNC = 'https://pisz-sync.pawlo999.workers.dev';

function rowsFor(g, lv, t0) {
  const out = []; let t = t0;
  if (lv >= 1) out.push({ t: t++, l: 'pl', g, st: 'R', ok: 1 });
  if (lv >= 2) out.push({ t: t++, l: 'pl', g, st: 'T', ok: 1 });
  if (lv >= 3) out.push({ t: t++, l: 'pl', g, st: 'C', ok: 1 });
  if (lv >= 4) out.push({ t: t++, l: 'pl', g, st: 'M', ok: 1 });
  if (lv >= 5) out.push({ t: t + DAY, l: 'pl', g, st: 'M', ok: 1 });
  return out;
}
function seedLog(spec, daysAgo = 3) {
  let t = Date.now() - daysAgo * DAY, log = [];
  for (const [g, lv] of spec) { log = log.concat(rowsFor(g, lv, t)); t += 100; }
  return log;
}
const SHAPES2 = [['|', 2], ['-', 2], ['o', 2]];
const state = page => page.evaluate(() => {
  const a = window.__pisz;
  return { screen: a.current(), st: a.STEP && a.STEP.st, ready: !!(a.STEP && a.STEP.ready), g: a.STEP && a.STEP.g && a.STEP.g.id,
           item: a.RUN && a.RUN.item.g, rows: a.LOG.length, items: a.SES && a.SES.items.map(i => i.g + ':' + i.steps.join('')) };
});
const ready = (page, st, ms = 15000) => until(page, s => { const a = window.__pisz; return a.STEP && a.STEP.ready && (!s || a.STEP.st === s); }, st, ms, 'step ' + st);
async function enter(page) {
  await page.click('#avatar'); await sleep(2100);
  await page.click('.flag[data-lang="pl"]'); await sleep(300);
}
async function runItemOf(page, g) {
  const i = await page.evaluate(g => window.__pisz.SES.items.findIndex(it => it.g === g), g);
  if (i < 0) throw new Error(g + ' not in this sitting: ' + JSON.stringify((await state(page)).items));
  await page.evaluate(i => window.__pisz.runItem(i), i);
}
const rowsOf = (page, g) => page.evaluate(g => window.__pisz.LOG.filter(r => r.g === g).map(r => ({ st: r.st, ok: r.ok, e: r.e || '', h: r.h || 0, s: !!r.s })), g);
function speechOk(said) {
  const bare = said.filter(s => s.trim().length <= 1);
  const unsafe = said.filter(s => /^(ą|ę|ń|ó|ø|å) /.test(s));
  const upper = said.filter(s => s !== s.toLowerCase());
  return { good: !bare.length && !unsafe.length && !upper.length, why: JSON.stringify({ bare, unsafe, upper }) };
}

async function suite(engine) {
  console.log(`\n=== ${engine} ===`);
  const b = await launch(engine);

  /* ---------------------------------------------------------------- */
  console.log('\nfirst launch');
  {
    const { page, errors } = await open(b, {});
    ok(await page.isVisible('#setup'), 'with no name stored, the parent is asked for one');
    await page.fill('#nameinput', 'ada'); await page.click('#namego'); await sleep(200);
    ok(await page.isVisible('#home') && (await page.textContent('#pname')) === 'Ada', 'the name is kept and shown as "Ada"');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('pisz.child.v1')).name);
    ok(stored === 'ADA', 'stored in capitals, the way she will write it', stored);
    ok(!errors.length, 'no errors', errors.join(' | '));
    await page.context().close();
  }

  /* ---------------------------------------------------------------- */
  console.log('\na whole first sitting');
  {
    const { page, errors, said, speech } = await open(b, { seed: { name: 'ADA', lang: 'pl' } });
    await enter(page);
    const items = (await state(page)).items;
    ok(items.join(' ') === '|:RT -:RT o:RT', 'the first sitting is the three opening strokes, road then dots', items.join(' '));
    const trace = await playSitting(page);
    ok(trace[trace.length - 1] === 'end', 'it plays through to the end screen', trace.join(' '));
    const log = await page.evaluate(() => window.__pisz.LOG);
    ok(log.filter(r => r.st).length === 6 && log.filter(r => r.k === 'S').length === 1, '6 steps and one finished sitting recorded', log.length + ' rows');
    ok(log.filter(r => r.st === 'T').every(r => r.s && r.s.length), 'her ink over the dots is kept');
    ok(await page.evaluate(() => document.querySelectorAll('#today canvas').length) === 3, 'the end screen shows the three things she drew');
    ok(await page.evaluate(() => window.__pisz.S.sessionsToday) === 1, 'one sitting counted for today');
    const M = await page.evaluate(() => window.__pisz.M);
    ok(['|', '-', 'o'].every(g => M[g].lv === 2), 'each shape is at "traced the dots"');
    const sp = speechOk(await said());
    ok(sp.good, 'the voice never got a bare letter, an unsafe letter or a capital', sp.why);
    ok((await said()).includes('narysuj kreskę w bok'), 'shapes are called what they are, in the accusative ("narysuj kreskę w bok")');
    const shapes = await page.evaluate(() => { const a = window.__pisz; return ['/', '\\', 'o', '#'].map(g => a.prompt(g, 'R')); });
    ok(shapes.join('|') === 'Narysuj skośną kreskę w lewo|Narysuj skośną kreskę w prawo|Narysuj kółko|Narysuj kwadrat',
       'the two slants have different names; kółko, kwadrat', shapes.join('|'));
    const words = await page.evaluate(() => { const a = window.__pisz;
      return ['Ć', 'Ź', 'Ó', 'S', 'Ą', 'Ę', 'Ń', 'Y'].map(g => a.letterPhrase(g)).concat([a.prompt('Y', 'M')]); });
    ok(words.join('|') === 'ć jak ćma|ź jak źrebak|ó jak ósemka|s jak sowa|ą jak w słowie wąż|ę jak w słowie ręka|ń jak w słowie koń|y jak w słowie motyl|Napisz y jak w słowie motyl',
       'one rule: "x jak słowo" when the word starts with it, "x jak w słowie …" when it cannot', words.join('|'));
    const nb = await page.evaluate(() => { const a = window.__pisz; a.S.lang = 'nb'; const r = [a.letterPhrase('Æ'), a.prompt('Æ', 'M')]; a.S.lang = 'pl'; return r; });
    ok(nb.join('|') === 'æ som i ærlig|Skriv æ som i ærlig', 'and æ som i ærlig', nb.join('|'));
    const sp1 = await speech();
    ok(!sp1.cuts.length && !sp1.dropped.length, 'a whole first sitting: no sentence cut off', JSON.stringify(sp1));
    ok(!errors.length, 'no errors', errors.join(' | '));

    await page.reload(); await sleep(400);
    const after = await page.evaluate(() => ({ n: window.__pisz.LOG.length, lv: window.__pisz.M['o'].lv }));
    ok(after.n === log.length && after.lv === 2, 'after a reload everything is still there');
    await page.context().close();
  }

  /* ---------------------------------------------------------------- */
  console.log('\na new letter: watch, road, dots, copy — and a miss on the way');
  {
    const { page, errors, said, speech } = await open(b, { seed: { name: 'ADA', lang: 'pl' }, log: seedLog(SHAPES2) });
    await enter(page);
    const items = (await state(page)).items;
    ok(items.some(s => s === 'D:RTC'), 'her name\'s letter D comes first among the new ones, as road → dots → copy', items.join(' '));
    await runItemOf(page, 'D');
    await ready(page, 'R'); await draw(page, templateStrokes(P, 'D'));
    await ready(page, 'T'); await draw(page, templateStrokes(P, 'D'));
    await ready(page, 'C');
    ok(await page.isVisible('#model'), 'when copying, the model is shown beside the pad');
    const intro = (await said()).indexOf('d jak dom. patrz!'), cue = (await said()).indexOf('w dół');
    ok(intro >= 0 && cue > intro, 'a new letter is named ("d jak dom. patrz!") before the guide draws it', JSON.stringify((await said()).slice(0, 8)));
    await draw(page, scribble(4, 9).map(s => s.map(p => ({ x: p.x * 0.6, y: p.y }))));
    await sleep(1200);
    await ready(page, 'C', 15000);
    ok((await said()).some(s => s === 'popatrz jeszcze raz.'), 'a miss: "popatrz jeszcze raz", then the guide draws it again');
    await draw(page, childify(P.G.D, { noise: 'moderate', seed: 5, place: false }));
    await until(page, () => window.__pisz.current() !== 'write', null, 8000, 'item end');
    const r = await rowsOf(page, 'D');
    ok(r.map(x => x.st + x.ok).join(' ') === 'R1 T1 C0 C1', 'logged: road, dots, a missed copy, a copy', JSON.stringify(r));
    ok(r[3].h === 1 && r[3].s && r[2].s, 'the copy after help is marked as helped; both drawings are kept');
    ok(await page.evaluate(() => window.__pisz.M.D.lv) === 3, 'D is now at "copied"');
    const sp = await speech();
    ok(!sp.cuts.length && !sp.dropped.length, 'nothing the app said was cut off or dropped — the voice finishes before the game moves on',
       JSON.stringify(sp));
    ok(!errors.length, 'no errors', errors.join(' | '));
    await page.context().close();
  }

  /* ---------------------------------------------------------------- */
  console.log('\nfrom memory, the next day');
  {
    const { page, errors, said } = await open(b, { seed: { name: 'ADA', lang: 'pl' }, log: seedLog([...SHAPES2, ['L', 3]], 1) });
    await enter(page);
    ok((await state(page)).items.includes('L:M'), 'a copied letter comes back as "from memory"', (await state(page)).items.join(' '));
    await runItemOf(page, 'L');
    await ready(page, 'M');
    ok((await page.textContent('#wword')) === '_ODY', 'the card shows its word with her letter missing: _ODY');
    ok(!(await page.isVisible('#model')), 'no model on screen');
    ok((await said()).includes('napisz l jak lody'), 'the voice asks for "l jak lody"', JSON.stringify(await said()));
    await draw(page, childify(P.G.L, { noise: 'moderate', seed: 2, place: false }));
    await until(page, () => window.__pisz.current() !== 'write', null, 8000, 'item end');
    const r = await rowsOf(page, 'L');
    ok(r[r.length - 1].st === 'M' && r[r.length - 1].ok === 1, 'logged as written from memory');
    ok(!errors.length, 'no errors', errors.join(' | '));
    await page.context().close();
  }

  /* ---------------------------------------------------------------- */
  console.log('\na forgotten accent');
  {
    const { page, errors, said } = await open(b, { seed: { name: 'ADA', lang: 'pl' }, log: seedLog([...SHAPES2, ['/', 2], ['\\', 2], ['L', 5], ['Ł', 2]], 3) });
    await enter(page);
    await runItemOf(page, 'Ł');
    await ready(page, 'C');
    const Lonly = childify(P.G['Ł'], { noise: 'moderate', seed: 3, place: false });
    await draw(page, [Lonly[0]]);
    await sleep(1300);
    ok((await said()).includes('a kreska?'), 'an Ł without its stroke: "a kreska?"', JSON.stringify((await said()).slice(-3)));
    ok((await state(page)).screen === 'write', 'and she is still on it, not marked wrong');
    await draw(page, [Lonly[1]]);
    await until(page, () => window.__pisz.current() !== 'write', null, 8000, 'item end');
    const r = await rowsOf(page, 'Ł');
    ok(r[r.length - 1].ok === 1 && r[r.length - 1].st === 'C', 'adding the stroke completes it', JSON.stringify(r));
    ok(!errors.length, 'no errors', errors.join(' | '));
    await page.context().close();
  }

  /* ---------------------------------------------------------------- */
  console.log('\nher name');
  {
    const { page, errors, said } = await open(b, { seed: { name: 'ADA', lang: 'pl' },
      log: seedLog([...SHAPES2, ['/', 2], ['\\', 2], ['A', 3], ['D', 3]], 2) });
    await enter(page);
    const items = (await state(page)).items;
    ok(items.includes('ADA:N'), 'once she can copy A and D, her name is part of the sitting', items.join(' '));
    await runItemOf(page, 'ADA');
    for (const [i, ch] of ['A', 'D', 'A'].entries()) {
      await ready(page, 'N');
      await draw(page, childify(P.G[ch], { noise: 'moderate', seed: 20 + i, place: false }));
      await sleep(1100);
    }
    await until(page, () => window.__pisz.current() !== 'write', null, 9000, 'name end');
    const n = await page.evaluate(() => window.__pisz.LOG.filter(r => r.st === 'N').map(r => r.g + r.ok).join(''));
    ok(n === 'A1D1A1', 'each letter of her name is logged as she writes it', n);
    ok((await said()).some(s => s.indexOf('to twoje imię') === 0), '"to twoje imię" at the end');
    ok(!errors.length, 'no errors', errors.join(' | '));
    await page.context().close();
  }

  /* ---------------------------------------------------------------- */
  console.log('\nthe daily limit and the test run');
  {
    const { page, errors } = await open(b, { seed: { name: 'ADA', lang: 'pl', maxS: 1 } });
    await enter(page);
    await playSitting(page);
    ok((await page.textContent('#again')) === '🌙', 'after the last sitting of the day the play button is a moon');
    await page.click('#pathback').catch(() => {});
    await page.evaluate(() => document.getElementById('again').click()); await sleep(200);
    ok((await state(page)).screen === 'end', 'tapping the moon does not start another');
    await page.reload(); await sleep(300);
    await enter(page);
    ok((await state(page)).screen === 'end' && (await page.textContent('#esub')).includes('Do jutra'), 'coming back the same day: "Do jutra!"');

    // test run
    await page.dispatchEvent('#gear', 'mousedown'); await sleep(1350); await page.dispatchEvent('#gear', 'mouseup');
    ok(await page.isVisible('#parent'), 'a long press on the gear opens the parent panel');
    await page.click('#practicebtn');
    ok((await page.textContent('#practicebtn')).includes('ON') && await page.isVisible('#band'), 'test run on, and the red band says so');
    const before = await page.evaluate(() => window.__pisz.LOG.length);
    await page.click('#pback'); await sleep(200);
    await page.evaluate(() => window.__pisz.startSession()); await sleep(300);
    await playSitting(page);
    const after = await page.evaluate(() => window.__pisz.LOG.length);
    ok(after === before, 'a test run writes nothing to her record', before + ' -> ' + after);
    ok(!errors.length, 'no errors', errors.join(' | '));
    await page.context().close();
  }

  /* ---------------------------------------------------------------- */
  console.log('\nthe parent report');
  {
    const log = seedLog([...SHAPES2, ['L', 5], ['T', 4], ['D', 3]], 5);
    log.push({ t: Date.now() - DAY, l: 'pl', g: 'L', st: 'M', ok: 1, s: P.pack(childify(P.G.L, { seed: 3 })) });
    log.push({ t: Date.now() - DAY + 5, l: 'pl', g: 'S', st: 'C', ok: 0, e: 'mirror', s: P.pack(childify(P.G.S, { seed: 4, mirror: true })) });
    const { page, errors } = await open(b, { seed: { name: 'ADA', lang: 'pl' }, log });
    await page.dispatchEvent('#gear', 'mousedown'); await sleep(1350); await page.dispatchEvent('#gear', 'mouseup');
    await page.click('#statsbtn'); await sleep(300);
    ok(await page.isVisible('#stats'), 'the report opens');
    const txt = await page.textContent('#rep');
    ok(/letters from memory/.test(txt) && /Her handwriting over time/.test(txt) && /Her next sitting/.test(txt), 'it has the headline, her handwriting and the next sitting');
    ok(await page.evaluate(() => document.querySelectorAll('#rep .smp canvas').length) >= 2, 'her drawings are shown');
    ok(await page.evaluate(() => document.querySelectorAll('#rep .smp.bad').length) === 1, 'the one not accepted is outlined');
    await page.screenshot({ path: `test/out/${engine}-report.png`, fullPage: true });
    await page.click('#sback'); await page.click('#pback'); await sleep(200);
    ok((await state(page)).screen === 'home', 'back out to where it was opened');
    ok(!errors.length, 'no errors', errors.join(' | '));
    await page.context().close();
  }

  /* ---------------------------------------------------------------- */
  console.log('\nsaving that fails is shown, not swallowed');
  {
    const { page } = await open(b, { seed: { name: 'ADA', lang: 'pl' } });
    await page.evaluate(() => {
      const orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) { if (k === 'pisz.child.log') throw new Error('QuotaExceededError (simulated)'); return orig.call(this, k, v); };
    });
    await enter(page);
    await page.evaluate(() => document.querySelector('.bub.next').click());
    await ready(page, 'R'); await draw(page, templateStrokes(P, '|')); await sleep(600);
    await page.dispatchEvent('#gear', 'mousedown'); await sleep(1350); await page.dispatchEvent('#gear', 'mouseup');
    ok((await page.textContent('#savev')).includes('FAILING'), 'the parent panel says saving is FAILING', await page.textContent('#savev'));
    await page.context().close();
  }

  /* ---------------------------------------------------------------- */
  console.log('\ntwo devices through the sync service');
  {
    const env = { STORE: fakeKV() };
    const posts = [];
    async function wire(page) {
      await page.route(SYNC + '/**', async route => {
        const req = route.request();
        const res = await worker.fetch(new Request(req.url(), { method: req.method(), headers: { 'content-type': 'application/json' },
          body: req.method() === 'POST' ? req.postData() : undefined }), env);
        if (req.method() === 'POST') posts.push(JSON.parse(req.postData()).log.length);
        route.fulfill({ status: res.status, headers: Object.fromEntries(res.headers), body: await res.text() });
      });
    }
    const KEY = 'family-key-0123456789';
    const A = await open(b, { seed: { name: 'ADA', lang: 'pl', syncKey: KEY }, log: seedLog([...SHAPES2, ['L', 3]], 2) });
    await wire(A.page); await A.page.reload(); await sleep(2200);
    const B = await open(b, { seed: { name: 'ADA', lang: 'pl', syncKey: KEY }, log: seedLog([['|', 2], ['T', 3]], 4) });
    await wire(B.page); await B.page.reload(); await sleep(2200);
    await A.page.dispatchEvent('#gear', 'mousedown'); await sleep(1350); await A.page.dispatchEvent('#gear', 'mouseup'); await sleep(800);
    const la = await A.page.evaluate(() => window.__pisz.LOG.length), lb = await B.page.evaluate(() => window.__pisz.LOG.length);
    ok(posts.length >= 3 && la === lb && la > 0, `both devices end with the same record (${la} / ${lb} rows)`);
    const Ma = await A.page.evaluate(() => window.__pisz.M), Mb = await B.page.evaluate(() => window.__pisz.M);
    ok(Ma.T && Ma.L && JSON.stringify(Ma) === JSON.stringify(Mb), 'and they agree on what she knows (T from one, L from the other)');
    ok((await A.page.textContent('#syncstat')).includes('rows in sync'), 'the panel says it is in sync', await A.page.textContent('#syncstat'));
    ok([...env.STORE.m.keys()].every(k => k.startsWith('pisz:')), 'stored under pisz: only');
    ok(!A.errors.length && !B.errors.length, 'no errors', A.errors.concat(B.errors).join(' | '));
    await A.page.context().close(); await B.page.context().close();
  }

  /* ---------------------------------------------------------------- */
  console.log('\nfingers, pens and palms');
  {
    const { page, errors } = await open(b, { seed: { name: 'ADA', lang: 'pl' } });
    await enter(page);
    await page.evaluate(() => document.querySelector('.bub.next').click());
    await ready(page, 'R');
    // a pen draws; a palm (touch) landing meanwhile is ignored
    const pts = templateStrokes(P, '|')[0];
    await page.evaluate(({ pts }) => {
      const pad = document.getElementById('pad'), c = p => window.__pisz.toClient(p.x, p.y);
      const ev = (type, p, id, kind) => pad.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: kind, isPrimary: true, bubbles: true, cancelable: true, clientX: c(p).x, clientY: c(p).y, buttons: 1 }));
      ev('pointerdown', pts[0], 5, 'pen');
      ev('pointerdown', { x: 60, y: 90 }, 6, 'touch');         // the palm
      for (let i = 1; i < pts.length; i++) { ev('pointermove', pts[i], 5, 'pen'); ev('pointermove', { x: 60 + i, y: 90 }, 6, 'touch'); }
      ev('pointerup', pts[pts.length - 1], 5, 'pen'); ev('pointerup', { x: 70, y: 90 }, 6, 'touch');
    }, { pts });
    await sleep(300);
    ok((await state(page)).st === 'T' || (await page.evaluate(() => window.__pisz.LOG.length)) >= 1, 'the pen stroke counts while a palm rests on the screen');
    const raw = await page.evaluate(() => window.__pisz.IN.pen);
    ok(raw === true, 'after a pen has been seen, the app is in pen mode (touches are palms)');
    // a hovering pen moves without going down: no ink
    await ready(page, 'T');
    const before = await page.evaluate(() => window.__pisz.STEP.raw.length);
    await page.evaluate(() => {
      const pad = document.getElementById('pad'), c = window.__pisz.toClient(0, 10);
      for (let i = 0; i < 20; i++) pad.dispatchEvent(new PointerEvent('pointermove', { pointerId: 9, pointerType: 'pen', bubbles: true, clientX: c.x, clientY: c.y + i * 5, buttons: 0 }));
    });
    ok(await page.evaluate(() => window.__pisz.STEP.raw.length) === before, 'a hovering pen leaves no ink');
    ok(!errors.length, 'no errors', errors.join(' | '));
    await page.context().close();
  }

  if (engine === 'webkit') {
    console.log('\nwhen iPadOS stops sending pointer events (WebKit 236390), touches take over');
    const { page, errors } = await open(b, { seed: { name: 'ADA', lang: 'pl' } });
    await enter(page);
    await page.evaluate(() => document.querySelector('.bub.next').click());
    await ready(page, 'R');
    const res = await page.evaluate(async (pts) => {
      const pad = document.getElementById('pad'), c = p => window.__pisz.toClient(p.x, p.y);
      /* WPE WebKit will not construct Touch objects; an event of the same
         type carrying the same fields exercises the same handlers        */
      const mk = (type, p) => {
        const e = new Event(type, { bubbles: true, cancelable: true });
        const t = { identifier: 1, target: pad, clientX: c(p).x, clientY: c(p).y };
        Object.defineProperty(e, 'changedTouches', { value: [t] });
        Object.defineProperty(e, 'touches', { value: type === 'touchend' ? [] : [t] });
        pad.dispatchEvent(e);
      };
      mk('touchstart', pts[0]);
      await new Promise(r => setTimeout(r, 200));
      for (let i = 1; i < pts.length; i++) mk('touchmove', pts[i]);
      mk('touchend', pts[pts.length - 1]);
      await new Promise(r => setTimeout(r, 300));
      return { touchMode: window.__pisz.IN.touchMode, st: window.__pisz.STEP && window.__pisz.STEP.st, rows: window.__pisz.LOG.length };
    }, templateStrokes(P, '|')[0]);
    if (typeof res === 'string') ok(false, 'touch fallback could not be exercised: ' + res);
    else ok(res.touchMode && (res.st === 'T' || res.rows >= 1), 'a stroke made of touch events alone still completes the road', JSON.stringify(res));
    ok(!errors.length, 'no errors', errors.join(' | '));
    await page.context().close();
  }

  if (engine === 'chromium') {
    console.log('\nthe parent panel scrolls under a real finger');
    {
      const { page } = await open(b, { seed: { name: 'ADA', lang: 'pl' }, viewport: { width: 820, height: 700 } });
      await page.dispatchEvent('#gear', 'mousedown'); await sleep(1350); await page.dispatchEvent('#gear', 'mouseup');
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 410, y: 600 }] });
      for (let y = 590; y >= 200; y -= 15) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 410, y }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await sleep(400);
      const top = await page.evaluate(() => document.getElementById('parent').scrollTop);
      ok(top > 100, 'dragging up scrolls the settings (the child screens never scroll)', 'scrollTop ' + top);
      await page.context().close();
    }
    console.log('\nreal touches from the browser (not events made by the page)');
    const { page, errors } = await open(b, { seed: { name: 'ADA', lang: 'pl' } });
    await enter(page);
    await page.evaluate(() => document.querySelector('.bub.next').click());
    await ready(page, 'R');
    const cdp = await page.context().newCDPSession(page);
    const pts = templateStrokes(P, '|')[0];
    const cl = await page.evaluate(pts => pts.map(p => window.__pisz.toClient(p.x, p.y)), pts);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cl[0].x, y: cl[0].y }] });
    for (const p of cl.slice(1)) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p.x, y: p.y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(500);
    const st = await state(page);
    ok(st.st === 'T' || st.rows >= 1, 'a real finger stroke completes the road', JSON.stringify(st));
    ok(await page.evaluate(() => window.__pisz.IN.types.touch === 1 && !window.__pisz.IN.touchMode), 'it arrived as pointer events of type touch');
    ok(!errors.length, 'no errors', errors.join(' | '));
    await page.context().close();
  }

  /* ---------------------------------------------------------------- */
  console.log('\nscreens it will meet');
  const VIEWS = [['iPad 10.9 portrait', 820, 1180], ['iPad 10.9 landscape', 1180, 820], ['iPad mini portrait', 744, 1133],
                 ['iPad Pro 13 landscape', 1376, 1032], ['Android phone', 390, 844]];
  for (const [name, w, h] of VIEWS) {
    const { page, errors } = await open(b, { seed: { name: 'ADA', lang: 'pl' }, log: seedLog([...SHAPES2, ['/', 2], ['\\', 2], ['W', 2]]), viewport: { width: w, height: h } });
    await enter(page);
    await runItemOf(page, 'W');
    await ready(page, 'C');
    const m = await page.evaluate(() => {
      const r = id => { const b = document.getElementById(id).getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
      const L = window.__pisz.L;
      return { pad: r('pad'), model: r('model'), watch: r('watch'), clear: r('clear'), word: r('word'), gear: r('gear'), back: r('wback'),
               frameTop: L.oy + -38 * L.k, frameBottom: L.oy + 128 * L.k, frameLeft: L.ox + -14 * L.k, frameRight: L.ox + 106 * L.k,
               k: L.k, vw: innerWidth, vh: innerHeight };
    });
    const overlap = (a, b) => !(a.r <= b.l || b.r <= a.l || a.b <= b.t || b.b <= a.t);
    const inside = x => x.l >= 0 && x.t >= 0 && x.r <= m.vw + 0.5 && x.b <= m.vh + 0.5;
    const problems = [];
    if (overlap(m.pad, m.model)) problems.push('model overlaps pad');
    if (m.frameTop < -0.5 || m.frameBottom > m.pad.h + 0.5) problems.push('letter frame taller than the pad');
    if (m.frameLeft < 0 || m.frameRight > m.pad.w) problems.push('W does not fit across the pad');
    ['pad', 'watch', 'clear', 'word', 'gear', 'back'].forEach(k => { if (!inside(m[k])) problems.push(k + ' off screen'); });
    if (overlap(m.word, m.gear)) problems.push('word card under the gear');
    const capPx = 100 * m.k;
    if (w >= 700 && capPx < 220) problems.push('letters only ' + capPx.toFixed(0) + 'px tall');
    ok(!problems.length, `${name}: everything on screen, nothing overlapping, a capital is ${capPx.toFixed(0)} px tall`, problems.join('; '));
    await draw(page, childify(P.G.W, { noise: 'moderate', seed: 2, place: false }));
    await sleep(400);
    await page.screenshot({ path: `test/out/${engine}-${name.replace(/ /g, '-')}.png` });
    ok(!errors.length, `${name}: no errors`, errors.join(' | '));
    await page.context().close();
  }

  /* ---------------------------------------------------------------- */
  console.log('\nturning the iPad mid-letter');
  {
    const { page, errors } = await open(b, { seed: { name: 'ADA', lang: 'pl' }, log: seedLog([...SHAPES2, ['L', 2]]) });
    await enter(page);
    await runItemOf(page, 'L');
    await ready(page, 'C');
    const L = childify(P.G.L, { noise: 'moderate', seed: 9, place: false });
    await draw(page, [L[0].slice(0, Math.floor(L[0].length / 2))]);   // half an L
    await page.setViewportSize(IPAD_LAND); await sleep(500);
    const st = await state(page);
    ok(st.screen === 'write' && st.st === 'C', 'still on the same letter after turning');
    ok(await page.evaluate(() => window.__pisz.STEP.strokes.length) === 1, 'her half-written stroke is still there');
    ok(!errors.length, 'no errors', errors.join(' | '));
    await page.context().close();
  }

  /* ---------------------------------------------------------------- */
  console.log('\nleaving a letter half way');
  {
    const { page, errors } = await open(b, { seed: { name: 'ADA', lang: 'pl' } });
    await enter(page);
    await page.evaluate(() => document.querySelector('.bub.next').click());
    await ready(page, 'R');
    await page.click('#wback'); await sleep(300);
    ok((await state(page)).screen === 'path', 'the back arrow returns to today\'s path');
    ok(await page.evaluate(() => document.querySelectorAll('.bub.done').length) === 0, 'the letter is not marked done');
    await page.evaluate(() => document.querySelector('.bub.next').click());
    await ready(page, 'R');
    await draw(page, templateStrokes(P, '|'));
    await ready(page, 'T');
    ok(true, 'and it can be started again');
    ok(!errors.length, 'no errors', errors.join(' | '));
    await page.context().close();
  }

  /* ---------------------------------------------------------------- */
  console.log('\nshe does not have to wait for the guide');
  {
    const { page, errors } = await open(b, { seed: { name: 'ADA', lang: 'pl' }, log: seedLog(SHAPES2) });
    await enter(page);
    await runItemOf(page, 'D');
    await sleep(1500 + 450 + 17 * 60 + 300);           // the intro, then a moment of the demo
    const before = await page.evaluate(() => window.__pisz.STEP.ready);
    await draw(page, templateStrokes(P, 'D'));
    await until(page, () => window.__pisz.STEP && window.__pisz.STEP.st === 'T', null, 4000, 'dots step').catch(() => {});
    const st = await state(page);
    ok(before === false && st.st === 'T', 'touching the pad during the demo skips it, and that stroke counts', JSON.stringify({ before, st: st.st }));
    ok(!errors.length, 'no errors', errors.join(' | '));
    await page.context().close();
  }

  /* ---------------------------------------------------------------- */
  console.log('\nher book');
  {
    const log = seedLog([...SHAPES2, ['L', 4]], 3);
    log.push({ t: Date.now() - 2 * DAY, l: 'pl', g: 'L', st: 'C', ok: 1, s: P.pack(childify(P.G.L, { seed: 1, noise: 'heavy' })) });
    log.push({ t: Date.now() - DAY, l: 'pl', g: 'L', st: 'M', ok: 1, s: P.pack(childify(P.G.L, { seed: 2 })) });
    const { page, errors, said } = await open(b, { seed: { name: 'ADA', lang: 'pl' }, log });
    await enter(page);
    await page.click('#tobook'); await sleep(300);
    const n = await page.evaluate(() => document.querySelectorAll('#cards .card').length);
    ok(n === P.allFor('pl').length, `every shape and letter has a page (${n})`);
    ok(await page.evaluate(() => document.querySelectorAll('#cards .card.none').length) === n - 1, 'only L has her ink; the rest are faint');
    await page.evaluate(() => [...document.querySelectorAll('#cards .card')].find(c => !c.classList.contains('none') && c.querySelectorAll('.lv i.on').length === 5).click());
    await sleep(300);
    ok(await page.isVisible('#detail') && await page.evaluate(() => document.querySelectorAll('#detailrow canvas').length) === 2, 'L opens her first and her latest L side by side');
    ok((await said()).includes('l jak lody'), 'and says "l jak lody"');
    await page.click('#detail'); await sleep(100);
    await page.click('#bookback'); await sleep(200);
    ok((await state(page)).screen === 'path', 'back to today\'s path');
    ok(!errors.length, 'no errors', errors.join(' | '));
    await page.context().close();
  }

  /* ---------------------------------------------------------------- */
  console.log('\none parent dashboard for both apps, on his phone');
  {
    const env = { STORE: fakeKV() };
    const KEY = 'family-key-0123456789';
    const log = seedLog([...SHAPES2, ['L', 5], ['T', 3]], 4);
    log.push({ t: Date.now() - DAY, l: 'pl', g: 'L', st: 'M', ok: 1, s: P.pack(childify(P.G.L, { seed: 2 })) });
    await worker.fetch(new Request(SYNC + '/s/' + KEY, { method: 'POST', body: JSON.stringify({ log, name: 'ADA', settings: { size: 5 } }) }), env);
    // what Litery's service answers: its log, and the mastery it rebuilt
    const t0 = Date.now() - 2 * DAY;
    const litery = { name: 'ADA', prizes: ['⭐️', '🚀'], settings: {},
      log: [{ t: t0, l: 'pl', k: 'L', x: 's', w: 0, ms: 2100 }, { t: t0 + 1, l: 'pl', k: 'L', x: 'k', w: 1, ms: 4100 },
            { t: t0 + 2, l: 'pl', k: 'L', x: 'k', w: 0, ms: 3000 }, { t: t0 + 3, l: 'pl', k: 'P', x: '⭐️' }],
      mastery: { 'pl:L:s': { n: 46, ft: 30, box: 2, last: t0, ms: [2100] }, 'pl:L:k': { n: 43, ft: 25, box: 3, last: t0 + 2, ms: [3000] },
                 'pl:L:m': { n: 39, ft: 35, box: 5, last: t0 - DAY, ms: [1800] } } };
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route(SYNC + '/**', async route => {
      const res = await worker.fetch(new Request(route.request().url(), { method: route.request().method() }), env);
      route.fulfill({ status: res.status, headers: Object.fromEntries(res.headers), body: await res.text() });
    });
    let literyKey = '';
    await page.route('https://litery-sync.pawlo999.workers.dev/**', route => {
      literyKey = route.request().url().split('/s/')[1];
      route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify(litery) });
    });
    await page.goto(BASE_URL + 'parent.html');
    await page.fill('#key', KEY); await page.click('#go'); await sleep(900);
    ok((await page.textContent('#title')) === 'How Ada is doing', 'one key loads her record');
    ok(literyKey === KEY, 'the same key asks Litery\'s service too');
    ok(/letters known/.test(await page.textContent('#litrep')) && (await page.evaluate(() => document.querySelectorAll('#litrep table tr').length)) >= 4,
       'Litery: letters by box, first try, time, last 10 days');
    const tog = await page.evaluate(() => [...document.querySelectorAll('#tletters span')].map(s => s.textContent));
    ok(await page.isVisible('#together') && tog[0] === 'K' && tog.includes('S') && !tog.includes('M'),
       'five minutes together: the letters she is on now (K, S), not the ones she knows (M)', JSON.stringify(tog));
    ok(/sound, not the name/.test(await page.textContent('#ttips')), 'with what to do: the sound, not the name');
    await page.click('#tab-pisz'); await sleep(200);
    ok(await page.isVisible('#rep') && await page.evaluate(() => document.querySelectorAll('#rep .smp canvas').length) >= 1 &&
       /Her next sitting/.test(await page.textContent('#rep')), 'Pisz tab: her handwriting and what comes next');
    await page.reload(); await sleep(900);
    ok((await page.textContent('#title')) === 'How Ada is doing' && await page.isVisible('#rep'), 'the key and the tab are remembered on that phone');
    await page.screenshot({ path: `test/out/${engine}-parent-phone.png`, fullPage: true });
    await page.click('#tab-litery'); await sleep(200);
    await page.screenshot({ path: `test/out/${engine}-parent-phone-litery.png`, fullPage: true });
    ok(!errors.length, 'no errors', errors.join(' | '));
    await ctx.close();
  }

  /* ---------------------------------------------------------------- */
  console.log('\nleft hand, and paper every third sitting');
  {
    const { page, errors, said } = await open(b, { seed: { name: 'ADA', lang: 'pl', left: true, sessionsAll: 2 }, log: seedLog([...SHAPES2, ['L', 2]]), viewport: IPAD_LAND });
    await enter(page);
    await runItemOf(page, 'L');
    await ready(page, 'C');
    const pos = await page.evaluate(() => ({ m: document.getElementById('model').getBoundingClientRect().left, p: document.getElementById('pad').getBoundingClientRect().left }));
    ok(pos.m > pos.p, 'left-handed: the model is on the right of the pad');
    await draw(page, childify(P.G.L, { seed: 4, place: false }));
    await until(page, () => window.__pisz.current() !== 'write', null, 8000, 'item end');
    await playSitting(page);
    ok((await page.textContent('#esub')).includes('kredką na kartce'), 'the third sitting ends with "napisz … kredką na kartce"', await page.textContent('#esub'));
    ok(!errors.length, 'no errors', errors.join(' | '));
    await page.context().close();
  }

  /* ---------------------------------------------------------------- */
  if (engine === 'chromium') {        // this WebKit build has no media plugins: audio crashes it
    console.log('\nthe letter-sound test page');
    const ctx = await b.newContext({ viewport: IPAD, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    let posted = null;
    await page.route(SYNC + '/**', r => { posted = r.request().postData(); r.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: '{"log":[]}' }); });
    await page.goto(BASE_URL + 'voices.html'); await sleep(800);
    const n = await page.evaluate(() => [document.querySelectorAll('#pl .row').length, document.querySelectorAll('#nb .row').length, document.querySelectorAll('#phrases .row').length]);
    ok(n.join() === '31,23,15', 'every Polish and Norwegian letter, and the phrases to check', n.join());
    const dur = await page.evaluate(async () => Promise.all(['sounds/pl/sz.wav', 'sounds/pl/ą.wav', 'sounds/nb/ø.wav'].map(f => new Promise(res => {
      const a = new Audio(); a.onloadedmetadata = () => res(a.duration); a.onerror = () => res(-1); a.src = f; setTimeout(() => res(-2), 4000); }))));
    ok(dur.every(d => d > 0.3 && d < 0.7), 'recordings load, including file names with ą and ø', JSON.stringify(dur));
    await page.evaluate(() => document.querySelector('#pl .row').querySelectorAll('.pick')[2].click());
    await page.fill('#key', 'family-key-0123456789'); await page.click('#send'); await sleep(400);
    const row = posted && JSON.parse(posted).log[0];
    ok(row && row.k === 'V' && JSON.parse(row.x)['pl:a'] === 'rec0', 'his pick reaches the sync service as one row', posted);
    ok(!errors.length, 'no errors', errors.join(' | '));
    await ctx.close();
  }

  /* ---------------------------------------------------------------- */
  if (engine === 'chromium') {
    console.log('\noffline: in the car, at her grandmother\'s');
    const ctx = await b.newContext({ viewport: IPAD, hasTouch: true });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(BASE_URL + 'index.html?c=0');
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await page.reload(); await sleep(800);
    const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
    await ctx.setOffline(true);
    await page.reload(); await sleep(600);
    const up = await page.evaluate(() => !!(window.Pisz && document.getElementById('setup')));
    ok(controlled && up, 'with the network gone the app still opens, engine and all');
    ok(!errors.length, 'no errors', errors.join(' | '));
    await ctx.close();
  }

  /* ---------------------------------------------------------------- */
  console.log('\nan app error never leaves her stuck');
  {
    const { page, errors } = await open(b, { seed: { name: 'ADA', lang: 'pl' } });
    await page.evaluate(() => {
      const orig = CanvasRenderingContext2D.prototype.fillText; let once = true;
      CanvasRenderingContext2D.prototype.fillText = function (t, ...a) {
        if (once && t === '✏️') { once = false; throw new Error('simulated crash inside the demo'); }
        return orig.call(this, t, ...a);
      };
    });
    await enter(page);
    await page.evaluate(() => document.querySelector('.bub.next').click());
    const t0 = Date.now();
    await ready(page, 'R', 12000);
    ok(Date.now() - t0 < 6000, `the pad takes ink again ${((Date.now() - t0) / 1000).toFixed(1)} s after a crash in the demo`);
    const e = await page.evaluate(() => window.__pisz.LOG.filter(r => r.k === 'E').map(r => r.x));
    ok(e.length === 1 && /simulated crash/.test(e[0]), 'the error is written into her log for the parent report', JSON.stringify(e));
    ok(errors.length === 1, 'and nothing else went wrong', errors.join(' | '));
    await page.context().close();
  }

  await b.close();
}

for (const e of which === 'all' ? ['webkit', 'chromium'] : [which]) await suite(e);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
