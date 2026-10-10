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
const ready = (page, st, ms = 15000) => until(page, s => { const a = window.__pisz; return a.STEP && a.STEP.ready && !a.STEP.intro && (!s || a.STEP.st === s); }, st, ms, 'step ' + st);
/* one sitting of exactly these items, started on the first */
const sitting = (page, items) => page.evaluate(items => { const s = window.__pisz.SES; s.items = items; s.done = {}; window.__pisz.runItem(0); }, items);
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
    const ny = await page.evaluate(() => { const a = window.__pisz; a.S.lang = 'nb'; const r = [a.letterPhrase('Y'), a.prompt('Y', 'M')]; a.S.lang = 'pl'; return r; });
    ok(ny.join('|') === 'y som i yrke|Skriv y som i yrke', 'and y som i yrke (his word)', ny.join('|'));
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
  console.log('\nshe watches the guide first (his call, 10 Oct), and a touch meanwhile is answered');
  {
    const { page, errors, said, speech } = await open(b, { seed: { name: 'ADA', lang: 'pl' }, log: seedLog(SHAPES2) });
    await enter(page);
    await runItemOf(page, 'D');
    await sleep(200);                                    // "d jak dom. patrz!" has only just begun
    for (let k = 0; k < 3; k++) await draw(page, [templateStrokes(P, 'D')[0]]);
    const during = await page.evaluate(() => ({ ready: window.__pisz.STEP.ready, raw: window.__pisz.STEP.raw.length, idx: window.__pisz.STEP.tr[0].idx }));
    ok(!during.ready && during.raw === 0 && during.idx === 0, 'three touches while the letter is introduced: no ink', JSON.stringify(during));
    await sleep(400);
    ok((await said()).filter(x => x === 'najpierw popatrz!').length === 1, 'and "najpierw popatrz!" once, not three times', JSON.stringify((await said()).slice(-5)));
    await ready(page, 'R');
    ok((await said()).includes('teraz ty!'), 'when the guide has drawn it: "teraz ty!"');
    await draw(page, templateStrokes(P, 'D'));
    await until(page, () => window.__pisz.STEP && window.__pisz.STEP.st === 'T', null, 6000, 'dots step');
    ok((await rowsOf(page, 'D'))[0].ok === 1, 'then her road counts');
    const sp = await speech();
    ok(!sp.cuts.length && !sp.dropped.length, 'nothing the app said was cut off', JSON.stringify(sp));
    ok(!errors.length, 'no errors', errors.join(' | '));
    await page.context().close();
  }

  /* ---------------------------------------------------------------- */
  console.log('\n10 Oct: the right way shown, ↩️, once more, the whole name');
  {
    // a letter right in shape but drawn from the wrong end: it counts, and the way is shown
    const { page, errors, said } = await open(b, { seed: { name: 'ADA', lang: 'pl' }, log: seedLog([...SHAPES2, ['L', 2]]) });
    await enter(page);
    await sitting(page, [{ g: 'L', steps: ['C'] }]);
    await ready(page, 'C');
    await draw(page, templateStrokes(P, 'L', { reverse: true }));
    /* her taps on the figure, or on 👀, while the right way is shown cannot cut it short */
    await sleep(900);
    for (let k = 0; k < 3; k++) { await page.evaluate(() => { document.getElementById('model').click(); document.getElementById('watch').click(); }); await sleep(150); }
    await until(page, () => window.__pisz.current() !== 'write', null, 9000, 'item end, not stalled');
    const r = (await rowsOf(page, 'L')).filter(x => x.st === 'C');
    ok(r.length === 1 && r[0].ok === 1 && /start/.test(r[0].e), 'an L drawn from the wrong end still counts', JSON.stringify(r));
    ok((await said()).some(x => /^\S+ zobacz, skąd zaczynamy\.$/.test(x)), '…and she hears praise + "zobacz, skąd zaczynamy" while its first line is drawn again', JSON.stringify((await said()).slice(-5)));
    ok(!errors.length, 'no errors', errors.join(' | '));
    await page.context().close();
  }
  {
    // ↩️ in the dots step: only her last line goes, with its progress
    const { page, errors } = await open(b, { seed: { name: 'ADA', lang: 'pl' } });
    await enter(page);
    await sitting(page, [{ g: 'E', steps: ['R', 'T'] }]);
    await ready(page, 'R');
    ok(await page.evaluate(() => document.getElementById('undo').classList.contains('hide')), 'no ↩️ on the road');
    await draw(page, templateStrokes(P, 'E'));
    await ready(page, 'T');
    const E = templateStrokes(P, 'E');
    await draw(page, E.slice(0, 2));
    await page.evaluate(() => document.getElementById('undo').click());
    const u = await page.evaluate(() => ({ i: window.__pisz.STEP.i, raw: window.__pisz.STEP.raw.length, done1: window.__pisz.STEP.tr[1].done, done0: window.__pisz.STEP.tr[0].done }));
    ok(u.i === 1 && u.raw === 1 && u.done0 && !u.done1, '↩️ after two lines of E: the second goes, the first stays', JSON.stringify(u));
    await draw(page, [[{ x: 80, y: 95 }, { x: 70, y: 95 }, { x: 60, y: 95 }]]);   // a line begun in the wrong place…
    await page.evaluate(() => document.getElementById('undo').click());           // …taken back
    await draw(page, E.slice(1));
    await until(page, () => window.__pisz.current() !== 'write', null, 8000, 'E done');
    const row = await page.evaluate(() => window.__pisz.LOG.filter(r => r.g === 'E' && r.st === 'T')[0]);
    ok(row && row.ok === 1 && row.un === 2 && row.w === 0 && !row.e, 'the E is finished; two ↩️ logged, and the wrong start she took back does not count', JSON.stringify(row && { un: row.un, w: row.w, e: row.e }));
    ok(!errors.length, 'no errors', errors.join(' | '));
    await page.context().close();
  }
  {
    // ↩️ while copying: a stray line taken back, and the L is looked at again
    const { page, errors } = await open(b, { seed: { name: 'ADA', lang: 'pl' }, log: seedLog([...SHAPES2, ['L', 2]]) });
    await enter(page);
    await sitting(page, [{ g: 'L', steps: ['C'] }]);
    await ready(page, 'C');
    await draw(page, templateStrokes(P, 'L').concat([[{ x: 70, y: 10 }, { x: 90, y: 30 }, { x: 95, y: 50 }]]));
    await page.evaluate(() => document.getElementById('undo').click());
    await until(page, () => window.__pisz.current() !== 'write', null, 8000, 'L done');
    const r = (await rowsOf(page, 'L')).filter(x => x.st === 'C');
    const n = await page.evaluate(() => window.__pisz.LOG.filter(r => r.g === 'L' && r.st === 'C').map(r => r.un));
    ok(r.length === 1 && r[0].ok === 1 && n[0] === 1, 'the stray line is gone and the L counts, with one ↩️ logged', JSON.stringify({ r, n }));
    ok(!errors.length, 'no errors', errors.join(' | '));
    await page.context().close();
  }
  {
    // once more: a finished bubble writes it again; a miss then never counts against her
    const { page, errors } = await open(b, { seed: { name: 'ADA', lang: 'pl' }, log: seedLog(SHAPES2) });
    await enter(page);
    await sitting(page, [{ g: '|', steps: ['C'] }, { g: '-', steps: ['C'] }]);
    await ready(page, 'C');
    await draw(page, templateStrokes(P, '|'));
    await until(page, () => window.__pisz.current() === 'path', null, 15000, 'back on the path');
    const lv0 = await page.evaluate(() => window.__pisz.M['|'].lv);
    await page.evaluate(() => document.querySelectorAll('#bubbles .bub')[0].click());
    await sleep(300);
    const again = await page.evaluate(() => ({ again: !!(window.__pisz.RUN && window.__pisz.RUN.item.again), steps: window.__pisz.RUN && window.__pisz.RUN.item.steps.join(''), screen: window.__pisz.current() }));
    ok(again.again && again.steps === 'C' && again.screen === 'write', 'tapping the finished | writes it once more, as a copy', JSON.stringify(again));
    await ready(page, 'C', 4000);                                   // no intro the second time
    for (let k = 0; k < 2; k++) {
      await draw(page, templateStrokes(P, '-'));                  // a line across: not a |
      await until(page, () => window.__pisz.current() === 'path' || (window.__pisz.STEP && window.__pisz.STEP.ready && window.__pisz.STEP.strokes && !window.__pisz.STEP.strokes.length), null, 20000, 'miss ' + k);
    }
    await until(page, () => window.__pisz.current() === 'path', null, 10000, 'back after two misses');
    const st = await page.evaluate(() => ({ lv: window.__pisz.M['|'].lv, ag: window.__pisz.LOG.filter(r => r.g === '|' && r.ag).map(r => r.ok).join('') }));
    ok(st.ag === '00' && st.lv === lv0, 'two misses on the once-more: logged as such, and her level is untouched', JSON.stringify({ st, lv0 }));
    await page.evaluate(() => document.querySelectorAll('#bubbles .bub')[0].click());
    await ready(page, 'C', 4000);
    await draw(page, templateStrokes(P, '|'));
    await until(page, () => window.__pisz.current() === 'path', null, 15000, 'back on the path');
    const ok2 = await page.evaluate(() => window.__pisz.LOG.filter(r => r.g === '|' && r.ag && r.ok).length);
    ok(ok2 === 1, 'a good once-more counts', 'ok rows ' + ok2);
    ok(!errors.length, 'no errors', errors.join(' | '));
    await page.context().close();
  }
  {
    // her name fits its bubble
    const { page, errors } = await open(b, { seed: { name: 'NADIA', lang: 'pl' } });
    await enter(page);
    await page.evaluate(() => { const s = window.__pisz.SES; s.items = [{ g: 'O', steps: ['C'] }, { g: 'NADIA', steps: ['N'], name: true }]; s.done = {}; window.__pisz.runItem(0); });
    await sleep(300);
    await page.evaluate(() => document.getElementById('wback').click()); await sleep(500);
    const edge = await page.evaluate(() => {
      const c = document.querySelectorAll('#bubbles .bub canvas')[1], x = c.getContext('2d'), w = c.width, h = c.height, band = Math.max(2, Math.round(w * 0.03));
      const ink = x0 => { const d = x.getImageData(x0, 0, band, h).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++; return n; };
      const mid = x.getImageData(Math.round(w * 0.3), 0, Math.round(w * 0.4), h).data; let m = 0; for (let i = 3; i < mid.length; i += 4) if (mid[i] > 40) m++;
      return { left: ink(0), right: ink(w - band), middle: m };
    });
    ok(edge.left === 0 && edge.right === 0 && edge.middle > 100, 'a five-letter name fits its bubble, nothing cut at the edges', JSON.stringify(edge));
    ok(!errors.length, 'no errors', errors.join(' | '));
    await page.context().close();
  }

  /* ---------------------------------------------------------------- */
  console.log('\n9 Oct: the dot on top, taps that wait, other fingers, the figure again');
  {
    // the green dot is drawn above her ink, so her line can never hide it
    const { page, errors } = await open(b, { seed: { name: 'ADA', lang: 'pl' } });
    await enter(page);
    await sitting(page, [{ g: 'O', steps: ['T'] }]);
    await ready(page, 'T');
    const O = templateStrokes(P, 'O')[0];
    await draw(page, [O.slice(0, Math.round(O.length * 0.45))]);
    const r = await page.evaluate(() => {
      const a = window.__pisz, d = a.STEP.dotAt(), kids = [...document.getElementById('pad').children].map(e => e.id);
      const at = (id, p) => { const cv = document.getElementById(id), rc = cv.getBoundingClientRect(), k = cv.width / rc.width, c = a.toClient(p.x + 5, p.y);
                              return Array.from(cv.getContext('2d').getImageData(Math.round((c.x - rc.left) * k), Math.round((c.y - rc.top) * k), 1, 1).data); };
      return { order: kids.indexOf('dot') > kids.indexOf('ink'), dot: at('dot', d), ink: at('ink', d) };
    });
    const green = px => px[1] > 120 && px[0] < 80 && px[3] > 200;
    ok(r.order && green(r.dot), 'the green dot has its own layer, above her ink', JSON.stringify(r));
    ok(!errors.length, 'no errors', errors.join(' | '));
    await page.context().close();
  }
  {
    // her taps on the word never cut the voice; four taps are one request
    const { page, errors, said, speech } = await open(b, { seed: { name: 'ADA', lang: 'pl' }, log: seedLog(SHAPES2) });
    await enter(page);
    await runItemOf(page, 'D');
    await sleep(300);                                            // "d jak dom. patrz!" is playing
    for (let i = 0; i < 4; i++) { await page.evaluate(() => document.getElementById('word').click()); await sleep(80); }
    await until(page, () => window.__pisz.STEP && !window.__pisz.STEP.intro, null, 15000, 'intro over');
    await sleep(2500);
    const s = await said(), sp = await speech();
    ok(!sp.cuts.length && !sp.dropped.length, 'four taps on the word while the letter is introduced: nothing is cut', JSON.stringify(sp));
    ok(s.filter(x => x === 'd jak dom').length === 1, 'and "d jak dom" comes once, after the voice is free', JSON.stringify(s));
    ok(!errors.length, 'no errors', errors.join(' | '));
    await page.context().close();
  }
  {
    // her book: tapping card after card never cuts; the last tap replaces one still waiting
    const { page, errors, said, speech } = await open(b, { seed: { name: 'ADA', lang: 'pl' } });
    await enter(page);
    await page.click('#tobook'); await sleep(300);
    await until(page, () => !window.__pisz.voiceBusy(), null, 8000, 'the voice free');
    const n0 = (await said()).length;
    await page.evaluate(() => { const ids = window.__pisz.P.allFor('pl', false), cards = [...document.querySelectorAll('#cards .card')];
      for (const id of ['A', 'B', 'C']) { cards[ids.indexOf(id)].click(); document.getElementById('detail').classList.remove('on'); } });
    await sleep(4000);
    const s = (await said()).slice(n0), sp = await speech();
    ok(!sp.cuts.length && s.join('|') === 'a jak auto|c jak cebula', 'A, B, C tapped in a row: A is finished, then C (B, still waiting, was replaced)', JSON.stringify({ s, sp }));
    ok(!errors.length, 'no errors', errors.join(' | '));
    await page.context().close();
  }
  {
    // a sentence the iPad cuts on its own is written into her log, and shown in the report; our own stop is not
    const { page, errors } = await open(b, { seed: { name: 'ADA', lang: 'pl' } });
    await enter(page);
    await page.evaluate(() => { window.__failText = 'zacznij od zielonej kropki.'; window.__pisz.say('zacznij od zielonej kropki.'); });
    await sleep(600);
    await page.evaluate(() => { window.__pisz.say('jeden dwa trzy cztery pięć sześć'); });
    await sleep(200);
    await page.evaluate(() => window.__pisz.hush());
    await sleep(300);
    const q = await page.evaluate(() => window.__pisz.LOG.filter(r => r.k === 'Q').map(r => r.x));
    ok(q.length === 1 && /^interrupted \| zacznij od zielonej kropki\.$/.test(q[0]), 'a sentence cut by the iPad is logged (row Q); the one we stopped on leaving is not', JSON.stringify(q));
    await page.evaluate(() => window.__pisz.openParent()); await sleep(300);
    await page.click('#statsbtn'); await sleep(400);
    ok(/Speech that did not finish \(1\)/.test(await page.textContent('#rep')), 'the parent report lists it');
    ok(!errors.length, 'no errors', errors.join(' | '));
    await page.context().close();
  }
  {
    // other fingers on the glass: a resting one is not ink, never nags, never blocks her drawing finger
    const { page, errors, said } = await open(b, { seed: { name: 'ADA', lang: 'pl' } });
    await enter(page);
    await sitting(page, [{ g: 'O', steps: ['T'] }, { g: 'L', steps: ['C'] }, { g: 'Ż', steps: ['T'] }]);
    await ready(page, 'T');
    const n0 = (await said()).length;
    const finger = (type, p, id) => page.evaluate(({ type, p, id }) => { const pad = document.getElementById('pad'), c = window.__pisz.toClient(p.x, p.y);
      pad.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: false, bubbles: true, cancelable: true, clientX: c.x, clientY: c.y, buttons: type === 'pointerup' ? 0 : 1 })); }, { type, p, id });
    await finger('pointerdown', { x: 110, y: 120 }, 70);          // the side of her hand, down first, far from the O
    await draw(page, templateStrokes(P, 'O'));                      // then her finger draws the O
    await finger('pointerup', { x: 110, y: 120 }, 70);
    await until(page, () => window.__pisz.current() !== 'write', null, 8000, 'O done');
    const o = (await rowsOf(page, 'O'))[0], s = (await said()).slice(n0);
    ok(o && o.ok === 1 && !s.some(x => /zacznij|rysuj dalej/.test(x)), 'a hand resting first does not block her O, and nothing tells her off', JSON.stringify({ o, s }));
    const w = await page.evaluate(() => window.__pisz.LOG.filter(r => r.g === 'O')[0].w);
    ok(w === 0, 'and it is not counted as a wrong start', 'w=' + w);
    // copying L with a finger resting on the glass: no blob of ink from it
    await page.evaluate(() => window.__pisz.runItem(1));
    await ready(page, 'C');
    await finger('pointerdown', { x: 100, y: 10 }, 80);
    await draw(page, templateStrokes(P, 'L'));
    const strokes = await page.evaluate(() => window.__pisz.STEP.strokes ? window.__pisz.STEP.strokes.length : -1);
    await finger('pointerup', { x: 100, y: 10 }, 80);
    ok(strokes === P.G.L.strokes.length, `only her ${P.G.L.strokes.length} lines are ink, the resting finger none`, 'strokes ' + strokes);
    await until(page, () => window.__pisz.current() !== 'write', null, 8000, 'L done');
    // a dot is still a tap: Ż over the dots, its dot tapped
    await page.evaluate(() => window.__pisz.runItem(2));
    await ready(page, 'T');
    await draw(page, templateStrokes(P, 'Ż'));
    await until(page, () => window.__pisz.current() !== 'write', null, 8000, 'Ż done');
    ok((await rowsOf(page, 'Ż'))[0].ok === 1, 'a short tap with no other finger down still makes the dot of Ż');
    ok(!errors.length, 'no errors', errors.join(' | '));
    await page.context().close();
  }
  {
    // the figure above the pad writes itself again at every tap, without words, and the pad stays hers
    const { page, errors, said } = await open(b, { seed: { name: 'ADA', lang: 'pl' }, log: seedLog([...SHAPES2, ['L', 2]]) });
    await enter(page);
    await sitting(page, [{ g: 'L', steps: ['C'] }]);
    await ready(page, 'C');
    const n0 = (await said()).length;
    await page.click('#model');
    const d1 = await page.evaluate(() => { const d = window.__pisz.DEMO_ON; window.__d1 = d; return d && { where: d.where, quiet: d.quiet }; });
    await sleep(300);
    await page.click('#model');
    const again = await page.evaluate(() => !!window.__pisz.DEMO_ON && window.__pisz.DEMO_ON !== window.__d1);
    ok(d1 && d1.where === 'model' && d1.quiet && again, 'a tap on the figure writes it again, and a second tap starts it over', JSON.stringify(d1));
    ok((await said()).length === n0, 'without a word');
    await draw(page, templateStrokes(P, 'L'));
    await until(page, () => window.__pisz.current() !== 'write', null, 8000, 'L done');
    ok((await rowsOf(page, 'L')).some(r => r.st === 'C' && r.ok === 1), 'and she can copy it meanwhile');
    ok(!errors.length, 'no errors', errors.join(' | '));
    await page.context().close();
  }

  /* ---------------------------------------------------------------- */
  console.log('\nher first real session, 7 Oct');
  {
    // a finger lifted half way round the O: back on the green dot, it carries on
    const { page, errors, said } = await open(b, { seed: { name: 'ADA', lang: 'pl' } });
    await enter(page);
    await sitting(page, [{ g: 'O', steps: ['T'] }]);
    await ready(page, 'T');
    const O = templateStrokes(P, 'O')[0], h = Math.round(O.length * 0.45);
    await draw(page, [O.slice(0, h)]);
    /* read the guide canvas itself: green where she stopped, not at the start */
    const lifted = await page.evaluate(() => {
      const a = window.__pisz, d = a.STEP.dotAt(), s0 = a.STEP.g.strokes[0].pts[0], cv = document.getElementById('dot');
      const r = cv.getBoundingClientRect(), k = cv.width / r.width, x = cv.getContext('2d');
      /* beside the centre, where the dot's white number is not */
      const green = p => { const c = a.toClient(p.x + 5, p.y), px = x.getImageData(Math.round((c.x - r.left) * k), Math.round((c.y - r.top) * k), 1, 1).data;
                           return px[1] > 120 && px[0] < 80 && px[2] < 120; };
      return { idx: a.STEP.tr[0].idx, atStop: green(d), atStart: green(s0) };
    });
    ok(lifted.idx > 0 && lifted.atStop && !lifted.atStart, 'after the lift the green dot is drawn where she stopped, and no longer at the start', JSON.stringify(lifted));
    const n0 = (await said()).length;
    await draw(page, [[{ x: 46, y: 50 }]]);                     // the middle of the O: nowhere
    await sleep(100);
    ok((await said()).slice(n0).includes('rysuj dalej od zielonej kropki.'), 'a touch elsewhere: "rysuj dalej od zielonej kropki", not "zacznij"', JSON.stringify((await said()).slice(n0)));
    await draw(page, [O]);                                       // back to the start dot, and round
    await until(page, () => window.__pisz.current() !== 'write', null, 8000, 'item end');
    const r = await rowsOf(page, 'O');
    ok(r.length === 1 && r[0].ok === 1, 'going back to the start dot, as told, finishes the O', JSON.stringify(r));
    ok(!errors.length, 'no errors', errors.join(' | '));
    await page.context().close();
  }
  {
    // the sponge in the dots step: her ink goes, the letter starts again
    const { page, errors } = await open(b, { seed: { name: 'ADA', lang: 'pl' } });
    await enter(page);
    await sitting(page, [{ g: 'E', steps: ['R', 'T'] }]);
    await ready(page, 'R');
    ok(await page.evaluate(() => document.getElementById('clear').classList.contains('hide')), 'no sponge on the road');
    await draw(page, templateStrokes(P, 'E'));
    await ready(page, 'T');
    ok(await page.evaluate(() => !document.getElementById('clear').classList.contains('hide')), 'the sponge is there in the dots step');
    const E = templateStrokes(P, 'E');
    await draw(page, E.slice(0, 2));
    await page.evaluate(() => document.getElementById('clear').click());
    const c = await page.evaluate(() => ({ i: window.__pisz.STEP.i, raw: window.__pisz.STEP.raw.length, idx: window.__pisz.STEP.tr[0].idx, done: window.__pisz.STEP.tr[0].done }));
    ok(c.i === 0 && c.raw === 0 && c.idx === 0 && !c.done, 'tapping it wipes her two lines and the E starts again from line 1', JSON.stringify(c));
    await draw(page, E);
    await until(page, () => window.__pisz.current() !== 'write', null, 8000, 'item end');
    const row = await page.evaluate(() => window.__pisz.LOG.filter(r => r.g === 'E' && r.st === 'T')[0]);
    ok(row && row.ok === 1 && row.cl === 1 && P.unpack(row.s).length === 4, 'the dots step is logged with one wipe, and only the clean E is kept', JSON.stringify(row && { cl: row.cl, n: row.n }));
    ok(!errors.length, 'no errors', errors.join(' | '));
    await page.context().close();
  }
  {
    // the figure above the pad: only while copying
    const { page, errors } = await open(b, { seed: { name: 'ADA', lang: 'pl' } });
    await enter(page);
    await sitting(page, [{ g: '|', steps: ['C'] }, { g: '-', steps: ['R', 'T'] }]);
    await ready(page, 'C');
    const m0 = await page.evaluate(() => document.getElementById('model').classList.contains('on'));
    await draw(page, templateStrokes(P, '|'));
    await until(page, () => window.__pisz.current() === 'path', null, 15000, 'back on the path');
    await page.evaluate(() => window.__pisz.runItem(1));
    await sleep(150);
    const m1 = await page.evaluate(() => document.getElementById('model').classList.contains('on'));
    ok(m0 && !m1, 'after copying "|", the road for "-" no longer shows "|" above the pad', JSON.stringify({ m0, m1 }));
    ok(!errors.length, 'no errors', errors.join(' | '));
    await page.context().close();
  }
  {
    // a miss while copying: she watches it shown again, then writes it, helped
    const { page, errors, said } = await open(b, { seed: { name: 'ADA', lang: 'pl' }, log: seedLog([...SHAPES2, ['L', 2]]) });
    await enter(page);
    await sitting(page, [{ g: 'L', steps: ['C'] }]);
    await ready(page, 'C');
    await draw(page, scribble(4, 9).map(s => s.map(p => ({ x: p.x * 0.6, y: p.y }))));
    await until(page, () => window.__said.includes('popatrz jeszcze raz.'), null, 8000, 'the miss');
    const live = await page.evaluate(() => window.__pisz.STEP.ready);
    await until(page, () => window.__said.includes('spróbujmy jeszcze raz.'), null, 12000, 'the replay over');
    await draw(page, templateStrokes(P, 'L'));
    await until(page, () => window.__pisz.current() !== 'write', null, 8000, 'item end');
    const r = (await rowsOf(page, 'L')).filter(x => x.st === 'C');
    ok(!live && r.map(x => x.st + x.ok).join(' ') === 'C0 C1' && r[1].h === 1, 'after a miss she watches it shown again, then writes it — counted as helped', JSON.stringify({ live, r }));
    ok(!errors.length, 'no errors', errors.join(' | '));
    await page.context().close();
  }
  {
    // ✏️ in her book: a letter she chooses
    const { page, errors } = await open(b, { seed: { name: 'ADA', lang: 'pl' } });
    await enter(page);
    const n0 = await page.evaluate(() => window.__pisz.SES.items.length);
    await page.click('#tobook'); await sleep(300);
    await page.evaluate(() => { const cards = [...document.querySelectorAll('#cards .card')]; const ids = window.__pisz.P.allFor('pl', false); cards[ids.indexOf('A')].click(); });
    await sleep(200);
    ok(await page.isVisible('#detailwrite'), 'the letter A in her book has a ✏️');
    await page.click('#detailwrite'); await sleep(300);
    const r = await page.evaluate(() => ({ screen: window.__pisz.current(), g: window.__pisz.RUN && window.__pisz.RUN.item.g, steps: window.__pisz.RUN && window.__pisz.RUN.item.steps.join(''),
                                           n: window.__pisz.SES.items.length }));
    ok(r.screen === 'write' && r.g === 'A' && r.steps === 'RTC' && r.n === n0 + 1, 'tapping it starts A now — road, dots, copy, as a new letter — added to this sitting', JSON.stringify(r));
    for (const st of ['R', 'T']) { await ready(page, st); await draw(page, templateStrokes(P, 'A')); }
    await ready(page, 'C'); await draw(page, templateStrokes(P, 'A'));
    await until(page, () => window.__pisz.current() === 'path', null, 15000, 'back on the path');
    const rows = await rowsOf(page, 'A');
    ok(rows.map(x => x.st + x.ok).join(' ') === 'R1 T1 C1', 'her A counts like any letter', JSON.stringify(rows));
    ok(!errors.length, 'no errors', errors.join(' | '));
    await page.context().close();
  }
  {
    // after the day's last sitting the ✏️ is not offered; after an earlier one it starts the next sitting
    const { page, errors } = await open(b, { seed: { name: 'ADA', lang: 'pl', day: '', sessionsToday: 0, maxS: 3 } });
    await page.evaluate(() => { const a = window.__pisz; a.S.sessionsToday = 3; a.openBook('end'); });
    await page.evaluate(() => document.querySelector('#cards .card').click()); await sleep(200);
    ok(!(await page.isVisible('#detailwrite')), 'after the last sitting of the day: no ✏️');
    await page.evaluate(() => { document.getElementById('detail').classList.remove('on'); const a = window.__pisz; a.S.sessionsToday = 1; a.openBook('end'); });
    await page.evaluate(() => { const cards = [...document.querySelectorAll('#cards .card')]; const ids = window.__pisz.P.allFor('pl', false); cards[ids.indexOf('A')].click(); });
    await sleep(200);
    await page.click('#detailwrite'); await sleep(300);
    const r = await page.evaluate(() => ({ g: window.__pisz.RUN && window.__pisz.RUN.item.g, first: window.__pisz.SES.items[0].g, dup: window.__pisz.SES.items.filter(x => x.g === 'A').length }));
    ok(r.g === 'A' && r.first === 'A' && r.dup === 1, 'after an earlier sitting: the next sitting starts, with her A first', JSON.stringify(r));
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
