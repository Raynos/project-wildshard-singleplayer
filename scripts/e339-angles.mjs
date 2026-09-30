#!/usr/bin/env node
// e339-angles.mjs — E339: every generated head from all round, in the game, as the iPhone draws it at midday. Jake: "I need
// to see these heads from more angles".
//
// Per face variant (a Debug option, set before the load with debugSettings) it boots the shard as the phone (390×844 CSS
// at 3×, touch, tier=phone, time=13, clear), finds each target (its feet, facing and head, in the page), and takes over
// the game's camera for the shot (a late system that places it after the player's own camera: no player collision, no
// walking into the NPC). The player stands 4 m in front of the target so it keeps facing forward. Per target it saves
// square crops round the head (native 3× pixels, nothing upscaled):
//   <out>/<variant>-<target>-far-<angle>.jpg     at --dist (default 2.5 m, the in-game talk distance), eye level, orbiting
//                                                 to the target's left: 0 front · 45 · 90 side · 135 · 180 back
//   <out>/<variant>-<target>-near-<angle>.jpg    at --near (default 0.8 m): 0 · 45 · 90 (the projection's weak side)
//   <out>/<variant>-<target>-frame.jpg           the whole portrait frame, front, at --dist
//
//   node scripts/e339-angles.mjs --url=http://127.0.0.1:4403 --shard=pine-hollow --key=pineFaces --variants=hunyuan,current \
//        --targets=ranger,trader,miller [--out=progress/e339-faces/raw]
//   node scripts/e339-angles.mjs --url=… --shard=nalati-grasslands --key=nalatiFaces --variants=hunyuan,paint --targets=elder,herderGate,herderRail,child,cook
//   node scripts/e339-angles.mjs --url=… --shard=nalati-grasslands --key=nalatiFaces --variants=hunyuan,paint --targets=king   (alone: spawned by the start)
//
// Run it inside scripts/browser-lane.sh. One headless Chromium on Metal (--mute-audio, mute=1), closed at the end.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { debugSettings } from './debug-settings.mjs';

const { chromium } = await import('playwright');
const ROOT = resolvePath(new URL('..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:4400');
const SHARD = flag('shard', 'nalati-grasslands');
const KEY = flag('key', '');
const VARIANTS = flag('variants', 'default').split(',').filter(Boolean);
const IDS = flag('targets', '').split(',').filter(Boolean);
const DIST = Number(flag('dist', '2.5'));
const NEAR = Number(flag('near', '0.8'));
const OUT = resolvePath(ROOT, flag('out', 'progress/e339-faces/raw'));
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const FAR_ANGLES = [0, 45, 90, 135, 180];
const ORBIT = Number(flag('orbit', '0'));          // seconds of one in-game orbit round the head, recorded (0 = none)
const ORBIT_DIST = Number(flag('orbit-dist', '1.3'));
const ORBIT_LOOK = Number(flag('orbit-look', '0.2'));   // the orbit looks this far under the face's centre
const NO_ANGLES = argv.includes('--no-angles');
const NEAR_ANGLES = [0, 45, 90];

/** page-side locators: (id) => { feet, yaw (the way it faces, 0 = +z), head (the face's centre) } | null */
const TARGETS = {
  'nalati-grasslands': `
    const w = window.__world, p = w.player;
    if (id === 'king') {
      let a = window.__e339king;
      if (!a) {
        const yaw = p.yaw + Math.PI;
        a = w.animals.spawn('golden-king', p.position.x - Math.sin(p.yaw) * 6, p.position.z - Math.cos(p.yaw) * 6, yaw, 'king');
        a.aggressive = false; a.desiredSpeed = 0;
        window.__e339king = a;
      }
      // standing (a spawned King starts lying in his coffin: goldenKing.ts mem.pose 0), held still
      a.mem.pose = 1; a.mem.rise = 1; a.mem.lift = 0; a.mem.kneel = 0;
      a.desiredSpeed = 0; a.speed = 0; a.desiredYaw = a.yaw; a.state = 'idle';
      a.mesh.updateMatrixWorld(true);
      const hb = a.mesh.skeleton.bones.find((b) => b.name === 'head');
      const h = hb.getWorldPosition(hb.position.clone());
      return { feet: { x: a.position.x, y: a.position.y, z: a.position.z }, yaw: a.yaw, head: { x: h.x, y: h.y + 0.14 * a.scale, z: h.z } };
    }
    const f = window.__nalatiQuest.people.fig[id];
    if (!f) return null;
    return { feet: { x: f.feet.x, y: f.feet.y, z: f.feet.z }, yaw: f.yaw, head: { x: f.headWorld.x, y: f.headWorld.y, z: f.headWorld.z } };`,
  'pine-hollow': `
    const per = window.__pineQuest.people.find((q) => q.kind === id);
    if (!per) return null;
    const g = per.fig.group, t = per.fig.talkPoint;
    return { feet: { x: g.position.x, y: g.position.y, z: g.position.z }, yaw: g.rotation.y, head: { x: t.x, y: t.y + 0.03, z: t.z } };`,
  // E343: Wendell (by name) · the Drowned Sailor and the Captain spawned on the sand in front of him, stood up out of it
  'driftwood-isle': `
    const w = window.__world;
    const g = w.game.scene.getObjectByName('npc-castaway');
    if (id === 'wendell') {
      if (!g) return null;
      g.updateMatrixWorld(true);
      const h = g.localToWorld(g.position.clone().set(0, 1.66, 0.05));
      return { feet: { x: g.position.x, y: g.position.y, z: g.position.z }, yaw: g.rotation.y, head: { x: h.x, y: h.y, z: h.z } };
    }
    window.__e343 = window.__e343 || {};
    let a = window.__e343[id];
    if (!a) {
      const wy = g.rotation.y, d = id === 'sailor' ? 7 : 12;   // on open sand (4.5 m put a rock in front of the sailor)
      a = w.animals.spawn(id, g.position.x + Math.sin(wy) * d, g.position.z + Math.cos(wy) * d, wy, id === 'captain' ? 'captain' : undefined);
      a.aggressive = false; a.driven = true;   // held where it stands (the Captain awake walks at you)
      window.__e343[id] = a;
    }
    a.mem.rise = 1; a.mem.rising = 0; a.mem.sinking = 0; if (id === 'captain') a.mem.awake = 1;
    a.desiredSpeed = 0; a.speed = 0; a.desiredYaw = a.yaw;
    a.mesh.updateMatrixWorld(true);
    const hb = a.mesh.skeleton.bones.find((b) => b.name === 'head');
    const h = hb.getWorldPosition(hb.position.clone());
    return { feet: { x: a.position.x, y: a.position.y, z: a.position.z }, yaw: a.yaw, head: { x: h.x, y: h.y + 0.08 * a.scale, z: h.z } };`,
  // E343: the square's brushed figures (merged into its kit, no handle: their spots from layout.ts / stalls.ts)
  'nine-dragon-stack': `
    const T = {
      cook: { feet: { x: 18.0, y: 125, z: -16.65 }, yaw: 0, head: { x: 18.0, y: 126.72, z: -16.57 } },
      hawker: { feet: { x: 7.5, y: 125, z: -2.45 }, yaw: 0, head: { x: 7.5, y: 126.72, z: -2.37 } },
    };
    return T[id] || null;`,
};
const READY = {
  'nalati-grasslands': () => Boolean(window.__world?.game && window.__nalatiQuest?.people?.group?.children.some((o) => o.name === 'nalati-camp-people-gen')),
  'pine-hollow': () => Boolean(window.__world?.game && window.__pineQuest?.people?.length > 0),
  'driftwood-isle': () => Boolean(window.__world?.game && window.__world.game.scene.getObjectByName('npc-castaway')),
  'nine-dragon-stack': () => Boolean(window.__world?.game && window.__world?.player),
};

const locate = TARGETS[SHARD];
if (!locate) { console.error(`no TARGETS for ${SHARD}`); process.exit(2); }

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  for (const v of VARIANTS) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
    if (KEY !== '') await debugSettings(ctx, { [KEY]: v });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
    const q = [`chunk=${SHARD}`, 'touch=1', 'tier=phone', 'skipintro=1', 'nolock=1', 'mute=1', 'time=13', 'clock=0', 'weather=clear'].join('&');
    await page.goto(`${URL_BASE}/?${q}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(READY[SHARD], undefined, { timeout: 360000, polling: 1000 });
    await sleep(6000);
    await page.addStyleTag({ content: '#hud,#hud *,.ws-touch,.ws-touch *,[class*="elite"],[class*="banner"],[class*="quest"],[class*="toast"],[class*="crosshair"],[class*="reticle"],[class*="boss"],[class*="prompt"],[class*="talk"]{visibility:hidden!important}' });
    // the camera override: a late system (after the player's camera), active while window.__e339cam is set
    await page.evaluate(() => {
      const g = window.__world.game, cam = g.camera;
      g.onLate(() => {
        const o = window.__e339cam;
        if (!o) return;
        if (o.orbit) {   // { orbit: true, c: head, d, yaw0, t0, ms }: one turn to the target's left, wall-clock paced
          const yaw = o.yaw0 + Math.PI * 2 * Math.max(0, Math.min(1, (performance.now() - o.t0) / o.ms));
          o.at = { x: o.c.x + Math.sin(yaw) * o.d, y: o.c.y, z: o.c.z + Math.cos(yaw) * o.d };
          o.look = { x: o.c.x, y: o.c.y - o.low, z: o.c.z };
        }
        cam.position.set(o.at.x, o.at.y, o.at.z);
        cam.lookAt(o.look.x, o.look.y, o.look.z);
        cam.updateMatrixWorld(true);
        for (const c of cam.children) c.traverse((x) => { x.layers.disableAll(); });   // the held weapon off the shot
      }, 'e339-cam');
    });
    for (const id of IDS) {
      const expr = `((id) => { ${locate} })(${JSON.stringify(id)})`;
      let t = null;
      try { t = await page.evaluate(expr); } catch (error) { console.log(`${v} ${id}: locate failed: ${String(error).slice(0, 200)}`); }
      if (!t) { console.log(`${v} ${id}: not found`); continue; }
      // the player 4 m in front (the NPCs look at the player; the streaming stays round here)
      await page.evaluate(([tt]) => {
        const p = window.__world.player;
        p.position.set(tt.feet.x + Math.sin(tt.yaw) * 4, tt.feet.y + 0.2, tt.feet.z + Math.cos(tt.yaw) * 4);
        p.velocity?.set(0, 0, 0);
        p.yaw = tt.yaw; p.pitch = 0;
      }, [t]);
      await sleep(2500);
      if (ORBIT > 0) {
        t = await page.evaluate(expr);
        await page.evaluate(([tt, d, low]) => { window.__e339cam = { orbit: true, low, c: tt.head, d, yaw0: tt.yaw, t0: performance.now() + 1e9, ms: 1, at: tt.head, look: tt.head }; }, [t, ORBIT_DIST, ORBIT_LOOK]);
        await sleep(1500);
        await page.evaluate(() => {
          const game = window.__world.game, canvas = game.renderer.domElement, w = canvas.width, h = canvas.height;
          const flat = document.createElement('canvas'); flat.width = w; flat.height = h;
          const g = flat.getContext('2d', { alpha: false });
          const stream = flat.captureStream(0), [track] = stream.getVideoTracks();
          const type = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((x) => MediaRecorder.isTypeSupported(x)) ?? 'video/webm';
          const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 16_000_000 });
          const parts = [], state = { on: true, frames: 0 };
          rec.ondataavailable = (e) => { if (e.data.size > 0) parts.push(e.data); };
          const live = () => state.on;   // (a call: the stop flips it between awaits)
          const pull = async () => {
            while (live()) {
              const c = await game.captureFrame(w);
              if (!live()) return;
              g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.drawImage(c, 0, 0, w, h); track.requestFrame(); state.frames++;
            }
          };
          window.__e339rec = { rec, parts, state };
          const started = new Promise((resolve) => { rec.onstart = resolve; });
          rec.start(250); void pull();
          return started;
        });
        await page.evaluate((ms) => { const o = window.__e339cam; o.t0 = performance.now(); o.ms = ms; }, ORBIT * 1000);
        await sleep(ORBIT * 1000 + 300);
        const { b64, frames } = await page.evaluate(async () => {
          const r = window.__e339rec; r.state.on = false;
          await new Promise((resolve) => { r.rec.onstop = resolve; r.rec.stop(); });
          const buf = new Uint8Array(await new Blob(r.parts, { type: 'video/webm' }).arrayBuffer());
          let str = '';
          for (let i = 0; i < buf.length; i += 0x8000) str += String.fromCodePoint(...buf.subarray(i, i + 0x8000));
          return { b64: btoa(str), frames: r.state.frames };
        });
        writeFileSync(resolvePath(OUT, `${v}-${id}-orbit${flag('orbit-tag', '')}.webm`), Buffer.from(b64, 'base64'));
        console.log(`${v} ${id} orbit: ${frames} frames in ${ORBIT} s`);
        await page.evaluate(() => { window.__e339cam = null; });
      }
      const shots = NO_ANGLES ? [] : [...FAR_ANGLES.map((a) => ['far', a, DIST]), ...NEAR_ANGLES.map((a) => ['near', a, NEAR])];
      for (const [kind, ang, d] of shots) {
        t = await page.evaluate(expr);
        await page.evaluate(([tt, a, dd]) => {
          const yaw = tt.yaw + a * Math.PI / 180;   // + = round to the target's own left
          window.__e339cam = { at: { x: tt.head.x + Math.sin(yaw) * dd, y: tt.head.y, z: tt.head.z + Math.cos(yaw) * dd }, look: tt.head };
        }, [t, ang, d]);
        await sleep(ang === 0 && kind === 'far' ? 1800 : 1100);
        const b = await page.evaluate((tt) => {
          const cam = window.__world.game.camera;
          cam.updateMatrixWorld();
          const V = cam.position.constructor;
          const p0 = new V(tt.head.x, tt.head.y, tt.head.z).project(cam), p1 = new V(tt.head.x, tt.head.y + 0.3, tt.head.z).project(cam);
          const W = window.innerWidth, H = window.innerHeight;
          return { x: (p0.x + 1) / 2 * W, y: (1 - p0.y) / 2 * H, r: Math.abs((p1.y - p0.y) / 2 * H) };
        }, t);
        const s = Math.min(390, b.r * (kind === 'far' ? 3.2 : 2.4));
        const cx = Math.max(s / 2, Math.min(390 - s / 2, b.x)), cy = Math.max(s / 2, Math.min(844 - s / 2, b.y + b.r * 0.25));
        writeFileSync(resolvePath(OUT, `${v}-${id}-${kind}-${ang}.jpg`), await page.screenshot({ type: 'jpeg', quality: 92, clip: { x: cx - s / 2, y: cy - s / 2, width: s, height: s } }));
        if (kind === 'far' && ang === 0) writeFileSync(resolvePath(OUT, `${v}-${id}-frame.jpg`), await page.screenshot({ type: 'jpeg', quality: 85 }));
        console.log(`${v} ${id} ${kind} ${ang}: head r ${b.r.toFixed(0)} css px, crop ${s.toFixed(0)}`);
      }
      await page.evaluate(() => { window.__e339cam = null; });
    }
    const faces = await page.evaluate(() => performance.getEntriesByType('resource').map((e) => e.name).filter((n) => /faces-|people\/|golden-king|npcs\//u.test(n)).map((n) => n.replace(/^.*\/assets\//, '')));
    console.log(`${v} model files: ${faces.join(' ')}`);
    if (errors.length > 0) console.log(`${v} page errors:`, errors.slice(0, 4).join(' | '));
    await ctx.close();
  }
} finally {
  await browser.close();
}
