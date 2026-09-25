#!/usr/bin/env node
// nalati-ragdoll-check.mjs — do Nalati's kills ragdoll within the tier caps? (NALATI-MERGE P4)
//
// One muted headless page per tier (phone, desktop) on Nalati. Walks the player up to the horse herd, then kills three
// horses and two wolves in the same frame (a killing hit each, from the player's side) and reads back, per victim,
// whether its death is a ragdoll (src/physics/ragdoll.ts: quadruped / rigid / upright) or the keyframed collapse (past
// the cap: phone 2 live, desktop 6), the live-ragdoll count, and the world's awake dynamic bodies (bodies.ts cap: phone
// 40) — then again once the first ragdolls have frozen into corpses (the cap frees up). Writes <out>/ragdolls.json and
// a JPEG of the corpses.
//
//   node scripts/nalati-ragdoll-check.mjs --url=http://127.0.0.1:5190 [--out=progress/nalati-merge/p34]
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

const { chromium } = await import('playwright');
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:5188');
const OUT = resolvePath(flag('out', 'progress/nalati-merge/p34'));
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const report = {};
try {
  for (const tier of ['phone', 'desktop']) {
    const ctx = await browser.newContext({ viewport: tier === 'phone' ? { width: 390, height: 844 } : { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
    await page.goto(`${URL_BASE}/?chunk=nalati-grasslands&mute=1&nolock=1&skipintro=1&tier=${tier}&time=12&clock=0&weather=clear`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__world) && !document.querySelector('.ws-load'), undefined, { timeout: 240000, polling: 1000 });
    await new Promise((resolve) => { setTimeout(resolve, 5000); });
    const probe = () => page.evaluate(() => {
      const w = window.__world, ph = w.physics.world;
      let awake = 0, dynamic = 0;
      ph.bodies.forEach((b) => { if (b.isDynamic()) { dynamic++; if (!b.isSleeping()) awake++; } });
      return { dynamic, awake };
    });
    // the victims: the three horses and two wolves nearest the herd's middle; the player 12 m off them
    const kill = (n) => page.evaluate(({ nh, nw }) => {
      const w = window.__world, list = w.animals.animals;
      const pick = (kind, k) => list.filter((a) => a.kind === kind && a.alive && a.mem.owned !== 1 && a.mem.ridden !== 1).slice(0, k);
      const horses = pick('horse', nh), wolves = pick('wolf', nw), all = [...horses, ...wolves];
      const first = all[0];
      if (first === undefined) return { error: 'no victims' };
      w.player.spawn(first.position.x + 12, first.position.z, Math.PI / 2);
      const V = first.position.constructor;
      const out = all.map((a) => {
        const dir = new V(a.position.x - w.player.position.x, 0, a.position.z - w.player.position.z).normalize();
        a.applyDamage(a.hp + 50, new V(a.position.x, a.position.y + 0.8 * a.scale, a.position.z), dir);
        return a;
      });
      window.__victims = [...(window.__victims ?? []), ...out];
      return { killed: out.map((a) => `${a.kind}`) };
    }, n);
    const read = () => page.evaluate(() => (window.__victims ?? []).map((a) => ({ kind: a.kind, ragdoll: a.ragdoll === null ? 'keyframed' : a.ragdoll.state, bodies: a.ragdoll?.bodies ?? 0 })));
    const r = { tier, before: await probe() };
    r.kill1 = await kill({ nh: 3, nw: 2 });
    await new Promise((resolve) => { setTimeout(resolve, 300); });
    r.right = { victims: await read(), world: await probe() };
    await new Promise((resolve) => { setTimeout(resolve, 9000); });
    r.settled = { victims: await read(), world: await probe() };
    r.kill2 = await kill({ nh: 1, nw: 0 });
    await new Promise((resolve) => { setTimeout(resolve, 300); });
    r.again = { victims: await read(), world: await probe() };
    r.errors = errors;
    if (tier === 'phone') {
      await page.evaluate(() => {
        const w = window.__world, v = window.__victims?.[0];
        if (!v) return;
        w.player.update = () => undefined;
        const cam = w.game.camera;
        for (const c of cam.children) c.visible = false;
        cam.position.set(v.position.x + 7, v.position.y + 5, v.position.z + 7); cam.lookAt(v.position.x, v.position.y, v.position.z); cam.updateMatrixWorld();
      });
      await page.addStyleTag({ content: '#hud,#hud *{display:none!important}' });
      await new Promise((resolve) => { setTimeout(resolve, 1500); });
      writeFileSync(resolvePath(OUT, 'ragdolls-phone.jpg'), await page.screenshot({ type: 'jpeg', quality: 72 }));
    }
    report[tier] = r;
    const cnt = (s) => s.victims.filter((v) => v.ragdoll === 'live').length;
    console.log(`${tier}: killed ${r.kill1.killed?.join(', ')} → ${r.right.victims.map((v) => `${v.kind}:${v.ragdoll}`).join(' ')} (live ${cnt(r.right)}, awake dynamic ${r.right.world.awake}); 9 s on ${r.settled.victims.map((v) => v.ragdoll).join(' ')}; one more → ${r.again.victims.at(-1)?.ragdoll}${errors.length > 0 ? ` · errors: ${errors.join(' | ')}` : ''}`);
    await ctx.close();
  }
} finally {
  await browser.close();
}
writeFileSync(resolvePath(OUT, 'ragdolls.json'), `${JSON.stringify(report, null, 1)}\n`);
