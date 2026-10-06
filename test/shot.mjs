// usage: node shot.mjs <url> <out.png> [w] [h] [engine]
import { chromium, webkit } from 'playwright-core';
const [url, out, w = '1500', h = '900', eng = 'chromium'] = process.argv.slice(2);
const b = await (eng === 'webkit' ? webkit : chromium).launch();
const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
p.on('console', m => console.log('console:', m.text()));
p.on('pageerror', e => console.log('PAGEERROR:', e.message));
await p.goto(url);
await p.waitForTimeout(400);
await p.screenshot({ path: out, fullPage: true });
await b.close();
