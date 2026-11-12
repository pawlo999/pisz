// b15 screenshots: the copy model with its starts (one-stroke, multi-stroke,
// accented letter) and her name without the model. node test/shot-b15.mjs <outdir>
import { createRequire } from 'module';
import { launch, open, sleep, until } from './harness.mjs';
const require = createRequire(import.meta.url);
const P = require('../engine.js');
const out = process.argv[2] || 'test/out';
const DAY = 86400000;
const b = await launch(process.argv[3] || 'chromium');
const rows = (g, lv, t) => [['R', 1], ['T', 2], ['C', 3]].filter(([, n]) => lv >= n).map(([st], i) => ({ t: t + i, l: 'pl', g, st, ok: 1 }));
const t0 = Date.now() - 5 * DAY;
let log = ['|', '-', 'o', '/', '\\'].flatMap((g, i) => rows(g, 2, t0 + i * 10)).concat(rows('C', 4, t0 + 100), rows('E', 2, t0 + 200), rows('L', 2, t0 + 300));
log.push({ t: t0 + DAY, l: 'pl', g: 'C', st: 'M', ok: 1 });
for (const [g, lv] of [['A', 3], ['D', 3]]) log = log.concat(rows(g, lv, t0 + 400));
['A', 'D', 'A'].forEach((g, i) => { log.push({ t: t0 + 2 * DAY + i, l: 'pl', g, st: 'N', ok: 1 }, { t: t0 + 3 * DAY + i, l: 'pl', g, st: 'N', ok: 1 }); });
const { page, errors } = await open(b, { seed: { name: 'ADA', lang: 'pl' }, log });
await page.click('#avatar'); await sleep(2100);
await page.click('.flag[data-lang="pl"]'); await sleep(300);
for (const g of ['L', 'E', 'Ć']) {
  await page.evaluate(g => { const s = window.__pisz.SES; s.items = [{ g, why: 'test', steps: ['C'] }]; s.done = {}; window.__pisz.runItem(0); }, g);
  await until(page, () => { const a = window.__pisz; return a.STEP && a.STEP.ready && !a.STEP.intro; }, null, 20000, 'copy ready');
  await sleep(300);
  await page.screenshot({ path: `${out}/b15-model-${g === 'Ć' ? 'C-acute' : g}.png` });
  await page.evaluate(() => document.getElementById('wback').click()); await sleep(300);
}
await page.evaluate(() => { const s = window.__pisz.SES; s.items = [{ g: 'ADA', why: 'name', steps: ['N'], name: true }]; s.done = {}; window.__pisz.runItem(0); });
await until(page, () => { const a = window.__pisz; return a.STEP && a.STEP.ready; }, null, 20000, 'name ready');
await sleep(400);
await page.screenshot({ path: `${out}/b15-name-bare.png` });
console.log(JSON.stringify({ bare: await page.evaluate(() => window.__pisz.RUN && window.__pisz.RUN.bare), modelOn: await page.evaluate(() => document.getElementById('model').classList.contains('on')), errors }));
await b.close();
