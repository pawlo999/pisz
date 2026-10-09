// Browser harness: the real app in WebKit (Safari's engine) or Chromium,
// at iPad size, with the speech engine replaced by a recorder.
import { webkit, chromium } from 'playwright-core';

export const BASE = process.env.PISZ_URL || 'http://localhost:8765/';
export const IPAD = { width: 820, height: 1180 };          // iPad 10th gen, portrait
export const IPAD_LAND = { width: 1180, height: 820 };

export async function launch(engine = 'webkit') {
  process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = '1';
  return (engine === 'chromium' ? chromium : webkit).launch();
}

/**
 * opts: { viewport, seed: {settings}, log: [...], query, engine }
 * returns { page, errors, said(), ctx }
 */
export async function open(browser, opts = {}) {
  // service workers off: once one controls the page, the fake sync server
  // routed below no longer sees its requests (WebKit). Offline has its own test.
  const ctx = await browser.newContext({ viewport: opts.viewport || IPAD, hasTouch: true, deviceScaleFactor: 2, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.addInitScript(({ seed, log }) => {
    if (seed && !sessionStorage.getItem('seeded')) {
      localStorage.setItem('pisz.child.v1', JSON.stringify(seed));
      if (log) localStorage.setItem('pisz.child.log', JSON.stringify(log));
      sessionStorage.setItem('seeded', '1');
    }
    /* a voice that takes time to speak, queues like the real one, and
       remembers anything cut off mid-sentence or dropped before it began */
    window.__said = []; window.__cuts = []; window.__dropped = [];
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
    const V = { cur: null, q: [], t: null };
    const dur = u => 250 + String(u.text).length * 60 / (u.rate || 0.7);   // ~86 ms a character at 0.7
    const next = () => {
      V.cur = V.q.shift() || null;
      if (!V.cur) return;
      V.cur.onstart && V.cur.onstart();
      if (window.__failText && V.cur.text === window.__failText) {
        V.t = setTimeout(() => { const u = V.cur; V.cur = null; window.__cuts.push(u.text); u.onerror && u.onerror({ error: 'interrupted' }); next(); }, 120);
        return;
      }
      V.t = setTimeout(() => { const u = V.cur; V.cur = null; u.onend && u.onend(); next(); }, dur(V.cur));
    };
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        getVoices: () => [{ name: 'PL', lang: 'pl-PL', localService: true }, { name: 'NB', lang: 'nb-NO', localService: true }],
        get speaking() { return !!V.cur; }, get pending() { return V.q.length > 0; },
        speak: u => { window.__said.push(u.text); V.q.push(u); if (!V.cur) next(); },
        cancel: () => {
          const cur = V.cur, q = V.q;
          if (cur) window.__cuts.push(cur.text);
          q.forEach(u => window.__dropped.push(u.text));
          V.q = []; clearTimeout(V.t); V.cur = null;
          cur && cur.onerror && cur.onerror({ error: 'interrupted' });
          q.forEach(u => u.onerror && u.onerror({ error: 'canceled' }));
        },
        onvoiceschanged: null,
      },
    });
  }, { seed: opts.seed || null, log: opts.log || null });
  await page.goto(BASE + 'index.html' + (opts.query === undefined ? '?dev=probe&c=0' : opts.query));
  await page.waitForTimeout(300);
  return { page, ctx, errors, said: () => page.evaluate(() => window.__said.slice()),
           speech: () => page.evaluate(() => ({ cuts: window.__cuts.slice(), dropped: window.__dropped.slice() })) };
}

export const sleep = ms => new Promise(r => setTimeout(r, ms));

// draw strokes given in letter units, as a finger would: pointer events
// from the page itself (WebKit has no touch-drag API in Playwright)
export async function draw(page, strokes, { pointerType = 'touch', stepMs = 4, pauseMs = 120 } = {}) {
  await page.evaluate(async ({ strokes, pointerType, stepMs, pauseMs }) => {
    const pad = document.getElementById('pad');
    const wait = ms => new Promise(r => setTimeout(r, ms));
    let id = 10;
    for (const s of strokes) {
      id++;
      const pt = p => window.__pisz.toClient(p.x, p.y);
      const fire = (type, p) => {
        const c = pt(p);
        pad.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType, isPrimary: true, bubbles: true, cancelable: true,
          clientX: c.x, clientY: c.y, button: 0, buttons: type === 'pointerup' ? 0 : 1 }));
      };
      fire('pointerdown', s[0]);
      for (let i = 1; i < s.length; i++) { fire('pointermove', s[i]); if (stepMs && i % 3 === 0) await wait(stepMs); }
      fire('pointerup', s[s.length - 1]);
      await wait(pauseMs);
    }
  }, { strokes, pointerType, stepMs, pauseMs });
}

// wait until a predicate in the page is true (or fail with a message)
export async function until(page, fn, arg, ms = 8000, what = 'condition') {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await page.evaluate(fn, arg)) return true;
    await sleep(60);
  }
  throw new Error('timed out waiting for ' + what);
}

export function templateStrokes(P, id, { reverse = false, step = 3 } = {}) {
  return P.G[id].strokes.map(st => {
    let pts = st.dot ? [st.pts[0]] : P.geo.bySpacing(st.pts, step);
    if (reverse) pts = pts.slice().reverse();
    return pts;
  });
}
