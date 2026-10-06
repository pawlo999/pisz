import { webkit, chromium } from 'playwright-core';
for (const [name, bt] of [['webkit', webkit], ['chromium', chromium]]) {
  try {
    const b = await bt.launch();
    const ctx = await b.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: name === 'chromium' ? false : undefined, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    await p.setContent('<canvas id=c width=400 height=400 style="touch-action:none"></canvas><script>window.ev=[];c.addEventListener("pointerdown",e=>ev.push("down:"+e.pointerType));c.addEventListener("pointermove",e=>ev.push("move:"+e.pointerType));c.addEventListener("pointerup",e=>ev.push("up:"+e.pointerType));</script>');
    const info = await p.evaluate(() => ({ ua: navigator.userAgent, pe: !!window.PointerEvent, coal: !!(window.PointerEvent && PointerEvent.prototype.getCoalescedEvents), tts: 'speechSynthesis' in window, touch: 'ontouchstart' in window }));
    console.log(name, JSON.stringify(info));
    // touch drag via the platform-neutral API
    await p.touchscreen.tap(50, 50);
    console.log(name, 'events after tap', await p.evaluate(() => ev.join(',')));
    await b.close();
  } catch (e) { console.log(name, 'FAILED', e.message.split('\n').slice(0, 6).join(' | ')); }
}
