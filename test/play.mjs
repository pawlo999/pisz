// A child playing: drives whatever the app shows until the sitting ends.
// Exported for the test suite; run directly for a screenshot walk-through:
//   node test/play.mjs [webkit|chromium] [portrait|landscape]
import { createRequire } from 'module';
import { childify } from './childify.mjs';
import { launch, open, draw, sleep, templateStrokes, IPAD, IPAD_LAND } from './harness.mjs';
const require = createRequire(import.meta.url);
const P = require('../engine.js');

/**
 * how: { noise: 'moderate', wrongFirst: false, shots: prefix|null, maxActions }
 * returns a trace of what happened
 */
export async function playSitting(page, how = {}) {
  const trace = [];
  const shots = how.shots;
  let n = 0, seed = how.seed || 1;
  const t0 = Date.now();
  // bounded by time, not loop turns: the app waits for its voice between steps
  for (let guard = 0; Date.now() - t0 < (how.maxMs || 240000); guard++) {
    const st = await page.evaluate(() => {
      const a = window.__pisz;
      return { screen: a.current(), step: a.STEP && a.STEP.st, ready: !!(a.STEP && a.STEP.ready),
               g: a.STEP && a.STEP.g && a.STEP.g.id, item: a.RUN && a.RUN.item.g };
    });
    if (st.screen === 'end') { trace.push('end'); if (shots) await page.screenshot({ path: `${shots}-end.png` }); return trace; }
    if (st.screen === 'path') {
      await sleep(200);
      if (shots) await page.screenshot({ path: `${shots}-path${n}.png` });
      await page.evaluate(() => { const b = document.querySelector('.bub.next') || document.querySelector('.bub:not(.done)'); b && b.click(); });
      await sleep(300);
      continue;
    }
    if (st.screen !== 'write' || !st.ready) { await sleep(150); continue; }
    const id = st.g || st.item;
    let strokes;
    if (st.step === 'R' || st.step === 'T') strokes = templateStrokes(P, id);
    else {
      seed++;
      strokes = childify(P.G[id], { noise: how.noise || 'moderate', seed, place: false });
      if (how.wrongFirst && !trace.includes('wrong:' + id + st.step)) {
        trace.push('wrong:' + id + st.step);
        strokes = childify(P.G[id === 'O' ? 'L' : 'O'], { noise: 'moderate', seed, place: false });
      }
    }
    trace.push(`${id}:${st.step}`);
    if (shots && n < 40) await page.screenshot({ path: `${shots}-${String(n).padStart(2, '0')}-${st.step}.png` });
    n++;
    await draw(page, strokes);
    await sleep(st.step === 'R' || st.step === 'T' ? 400 : 1200);
    if (shots && n < 40) await page.screenshot({ path: `${shots}-${String(n - 1).padStart(2, '0')}-${st.step}-after.png` });
  }
  trace.push('gave up');
  return trace;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const eng = process.argv[2] || 'webkit', orient = process.argv[3] || 'portrait';
  const b = await launch(eng);
  const { page, errors, said } = await open(b, { seed: { name: 'ADA', lang: 'pl' }, viewport: orient === 'landscape' ? IPAD_LAND : IPAD });
  await page.click('#avatar'); await sleep(2200);
  await page.click('.flag[data-lang="pl"]'); await sleep(400);
  const t = await playSitting(page, { shots: `test/out/play-${eng}-${orient}` });
  console.log(t.join(' '));
  console.log('rows', await page.evaluate(() => window.__pisz.LOG.length), JSON.stringify(await page.evaluate(() => window.__pisz.M)));
  console.log('said', JSON.stringify(await said()));
  console.log('errors', JSON.stringify(errors));
  await b.close();
}
