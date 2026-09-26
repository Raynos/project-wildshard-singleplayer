// Lab P9 "grapple" (E169): the Fei Zhua in action, first person, in the Yamen Well. The page plays the two takes in a
// loop ('hook' then 'miss'); a capture script drives it through window.__ndGrapple (no URL switches):
//   ready · pixelRatio(r) · seek(take, t) (poses + renders that exact instant; the rope is stepped deterministically) ·
//   play(on) · snapshot(w, h, q) · stats() · bench(frames) · set(key, value) (tuning) · takes() · duration(take).
import { Color, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';
import { DragonHook } from './hook';
import { CAPACITOR, FeiZhua, MUZZLE } from './feizhua';
import { Flash, Sparks } from './fx';
import { Filament } from './line';
import { fontsReady } from './neon';
import { Pipeline } from './post';
import { BASE_HFOV, type Frame, type Take, Timeline } from './sequence';
import { engraveTexture, vmUniforms } from './vm-material';
import { buildWell, SET } from './well';
import { sharedUniforms } from './world/material';

interface Stats { calls: number; triangles: number; width: number; height: number; vmTris: number; worldTris: number; take: Take; t: number }
interface GrappleLabApi {
  ready: Promise<void>;
  pixelRatio: (r: number) => void;
  seek: (take: Take, t: number) => void;
  play: (on: boolean) => void;
  snapshot: (w: number, h: number, q: number) => string;
  stats: () => Stats;
  bench: (frames: number) => Promise<number>;
  set: (key: string, value: number) => void;
  takes: () => Take[];
  duration: (take: Take) => number;
  debug: () => Record<string, unknown>;
}
declare global { interface Window { __ndGrapple?: GrappleLabApi } }

const nextFrames = (n: number): Promise<void> => new Promise((resolve) => {
  let k = 0;
  const tick = (): void => { k++; if (k >= n) resolve(); else requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
});

const CYAN = new Color(0.25, 0.9, 1.0);
const GOLD = new Color(1.0, 0.72, 0.25);

async function main(): Promise<void> {
  const canvas = document.getElementById('lab-canvas');
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('no canvas');
  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' });
  renderer.autoClear = false;
  const shared = sharedUniforms();
  // the Well's fog: a thin haze in the stratum, the dense silk band below the terrace
  shared.uFogBand.value.set(-16, 12, 0.04, 0);
  shared.uFogDensity.value = 0.0075;
  const world = new Scene();
  const camera = new PerspectiveCamera(60, 1, 0.1, 900);
  const vmCamera = new PerspectiveCamera(60, 1, 0.02, 6);
  const pipe = new Pipeline(renderer, shared.uSilk.value);
  pipe.clearColor.copy(shared.uFogCol.value);

  await fontsReady();
  const set = buildWell(shared);
  world.add(set.group);
  const hook = await DragonHook.load('/assets/nine-dragon/lab/grapple/dragon-hook.glb', shared, SET.hookAt.clone(), SET.hookFace.clone(), 1.3);
  world.add(hook.body, hook.hull);
  const jade = set.signs[0];
  if (jade !== undefined) { hook.u.uSpillPos.value.copy(jade.light); hook.u.uSpillCol.value.copy(jade.color).multiplyScalar(0.8); }
  hook.u.uSpill2Pos.value.copy(SET.lantern);
  hook.u.uSpill2Col.value.set(1.0, 0.3, 0.2).multiplyScalar(1.2);

  const u = vmUniforms(shared.uSilk.value, engraveTexture());
  const fz = await FeiZhua.load('/assets/nine-dragon/lab/grapple/fei-zhua.glb', u);
  world.add(fz.clawWorld.root);
  if (hook.raw !== null) fz.setOrnament(hook.raw);
  const filament = new Filament(44);
  world.add(filament.mesh);
  const sparks = new Sparks(64, 7);
  world.add(sparks.mesh);
  const biteFlash = new Flash(new Color(1.0, 0.8, 0.45));
  world.add(biteFlash.mesh);
  const muzzle = new Flash(new Color(0.35, 0.92, 1.0));
  muzzle.mesh.position.copy(MUZZLE).add(new Vector3(0, 0, -0.03));
  fz.arm.add(muzzle.mesh);
  const click = new Flash(new Color(0.5, 0.95, 1.0));
  click.mesh.position.copy(MUZZLE);
  fz.arm.add(click.mesh);

  const tl = new Timeline({ start: SET.start.clone(), landing: SET.landing.clone(), anchor: hook.anchor.clone(), facing: hook.facing.clone() });
  const tune: Record<string, number> = { hullPx: 2.3, corePx: 2.6, haloPx: 12, bloom: 1.0, env: 1.0, ticks: 1, gain: 0.6, gamma: 1.22, sat: 1.25 };

  let pr = Math.min(window.devicePixelRatio, 3);
  let bw = 1, bh = 1;
  const resize = (): void => {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    bw = Math.round(w * pr);
    bh = Math.round(h * pr);
    tl.aspect = w / h;
    camera.aspect = w / h;
    vmCamera.aspect = w / h;
    pipe.setSize(bw, bh, 0.5 * pr);
    shared.uLinePx.value = 0.72 * pr;
    u.uRes.value.set(bw, bh);
    hook.uHull.uRes.value.set(bw, bh);
    filament.u.uRes.value.set(bw, bh);
    sparks.u.uRes.value.set(bw, bh);
  };
  resize();
  window.addEventListener('resize', resize);

  const vfov = (hfov: number, aspect: number): number => (aspect < 1 ? (2 * Math.atan(Math.tan((hfov * Math.PI) / 360) / aspect) * 180) / Math.PI : hfov * 0.9);
  let cur: Frame = tl.evaluate('hook', 0);
  let curTake: Take = 'hook';

  const apply = (take: Take, f: Frame): void => {
    cur = f;
    curTake = take;
    const s = pr / 3;
    camera.position.copy(f.camPos);
    camera.quaternion.copy(f.camQuat);
    camera.fov = vfov(f.hfov, camera.aspect);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    vmCamera.fov = vfov(BASE_HFOV, vmCamera.aspect);
    vmCamera.updateProjectionMatrix();
    shared.uCam.value.copy(camera.position);
    shared.uTime.value = f.t;
    u.uViewToWorld.value.setFromMatrix4(camera.matrixWorld);
    u.uHullPx.value = tune['hullPx'] ?? 2.3;
    u.uHullPx.value *= s;
    u.uEnv.value = tune['env'] ?? 1;
    pipe.u.uBloom.value = tune['bloom'] ?? 0.85;
    pipe.u.uTicks.value = tune['ticks'] ?? 1;
    pipe.u.uGain.value = tune['gain'] ?? 0.6;
    pipe.u.uGamma.value = tune['gamma'] ?? 1.22;
    pipe.u.uSat.value = tune['sat'] ?? 1.25;
    // the arm
    fz.pose(f.arm.wrist, f.arm.fwd, f.arm.roll);
    fz.spool.rotation.x = f.spool;
    const docked = f.claw === 'docked';
    fz.clawVm.root.visible = docked;
    fz.clawVm.setTalons(f.talon);
    fz.clawWorld.root.visible = !docked;
    if (!docked) {
      fz.clawWorld.root.position.copy(f.clawPos);
      fz.clawWorld.root.quaternion.copy(f.clawQuat);
      fz.clawWorld.root.scale.setScalar(f.clawScale);
      fz.clawWorld.setTalons(f.talon);
    }
    // glow + lights
    u.uEmitA.value.set(f.leds[0], f.leds[1], f.leds[2], f.cap);
    u.uEmitB.value.set(f.line ? 1.5 : 0.9, f.eyelet);
    for (const c of [u.uLed0.value, u.uLed1.value, u.uLed2.value]) c.copy(CYAN).lerp(GOLD, f.ledGold);
    fz.armToView(CAPACITOR, u.uCapPos.value);
    u.uCapCol.value.copy(CYAN).multiplyScalar(0.18 * f.cap);
    fz.armToView(MUZZLE, u.uFlashPos.value);
    u.uFlashPos.value.z -= 0.03;
    const fl = f.flash >= 0 ? (1 - f.flash) ** 2 : 0;
    const ck = f.click >= 0 ? (1 - f.click) ** 2 * 0.4 : 0;
    u.uFlashCol.value.setRGB(0.7, 1.0, 1.1).multiplyScalar(4.0 * fl + ck);
    muzzle.set(f.flash, 0.085, 0.4 + f.t * 3);
    click.set(f.click, 0.035, 0.2);
    // the line
    if (f.line) {
      const rope = tl.ropeAt(take, f.t);
      filament.mesh.visible = rope.active;
      filament.update(rope);
      filament.u.uPulse.value = f.pulse;
      filament.u.uI.value = f.lineI;
      filament.u.uTime.value = f.t;
      filament.u.uCorePx.value = (tune['corePx'] ?? 2.6) * s;
      filament.u.uHaloPx.value = (tune['haloPx'] ?? 12) * s;
    } else {
      filament.mesh.visible = false;
      tl.ropeAt(take, f.t);
    }
    // the bite
    sparks.update(f.sparks, hook.anchor, hook.facing.clone().add(new Vector3(0, 0.5, 0)), 1);
    sparks.u.uPx.value = 4.0 * s;
    biteFlash.mesh.position.copy(hook.anchor).addScaledVector(hook.facing, 0.15);
    biteFlash.set(f.bite, 0.42, 0.3);
    hook.setLock(f.hookLock, 0.5 + 0.5 * Math.sin(f.t * 12));
    hook.uHull.uPx.value *= s;
    hook.u.uBitePos.value.copy(hook.anchor).addScaledVector(hook.facing, 0.1);
    hook.u.uBite.value = f.bite >= 0 ? (1 - f.bite) ** 2 : 0;
    // the post
    pipe.u.uSpeed.value = f.speed;
    pipe.u.uFocus.value.copy(f.focus);
    pipe.u.uRetAt.value.copy(f.ret.at);
    pipe.u.uRetLock.value = f.ret.lock;
    pipe.u.uRetAlpha.value = f.ret.alpha;
    pipe.u.uRetSize.value = f.ret.size;
    pipe.u.uExpo.value = 0.22 * fl + (f.bite >= 0 ? 0.12 * (1 - f.bite) ** 3 : 0);
  };

  const renderFrame = (): void => {
    renderer.info.reset();
    renderer.info.autoReset = false;
    pipe.render(world, camera, fz.scene, vmCamera, cur.t);
  };

  let playing = true;
  let last = performance.now();
  let lt = 0;
  let lTake: Take = 'hook';
  const loop = (): void => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (playing) {
      lt += dt;
      if (lt > tl.duration(lTake)) { lt = 0; lTake = lTake === 'hook' ? 'miss' : 'hook'; }
      apply(lTake, tl.evaluate(lTake, lt));
      renderFrame();
    }
    requestAnimationFrame(loop);
  };

  window.__ndGrapple = {
    ready: nextFrames(3),
    pixelRatio: (r) => { pr = r; resize(); },
    seek: (take, t) => { playing = false; apply(take, tl.evaluate(take, t)); renderFrame(); },
    play: (on) => { playing = on; last = performance.now(); },
    snapshot: (w, h, q) => {
      renderFrame();
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d');
      if (g === null) throw new Error('2d');
      g.drawImage(renderer.domElement, 0, 0, w, h);
      return c.toDataURL('image/jpeg', q);
    },
    stats: () => {
      renderFrame();
      return {
        calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, width: renderer.domElement.width,
        height: renderer.domElement.height, vmTris: fz.tris.arm, worldTris: set.tris, take: curTake, t: cur.t,
      };
    },
    bench: async (frames) => {
      const gl = renderer.getContext();
      const px = new Uint8Array(4);
      renderFrame();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      await nextFrames(2);
      const t1 = performance.now();
      for (let i = 0; i < frames; i++) {
        renderFrame();
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      }
      return (performance.now() - t1) / frames;
    },
    set: (key, value) => {
      tune[key] = value;
      // 'world' 0 hides the Well set (the grapple alone: for the cost split); 'vm' 0 hides the arm
      if (key === 'world') set.group.visible = value > 0;
      if (key === 'vm') fz.arm.visible = value > 0;
      apply(curTake, tl.evaluate(curTake, cur.t));
    },
    takes: () => ['hook', 'miss'],
    duration: (take) => tl.duration(take),
    debug: () => {
      const r = tl.rope;
      const mz = tl.muzzleWorld(cur);
      return {
        line: cur.line, active: r.active, vis: filament.mesh.visible, p0: Array.from(r.p.slice(0, 3)), pN: Array.from(r.p.slice(-3)),
        mid: Array.from(r.p.slice(66, 69)), muzzle: mz.toArray(), claw: cur.clawPos.toArray(), cam: cur.camPos.toArray(), anchor: hook.anchor.toArray(),
        clawVis: fz.clawWorld.root.visible, res: filament.u.uRes.value.toArray(),
      };
    },
  };
  apply('hook', tl.evaluate('hook', 0));
  requestAnimationFrame(loop);
}

void main();
