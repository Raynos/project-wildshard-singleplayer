// Lab P3 "facade" (E169): a street canyon of 10 towers + a Well shaft of 4, dressed by the facade grammar, rendered in
// a simple Jiehua Neon. window.__ndFacade (no URL switches): ready, shot(name), stats(), bench(frames), shots().
import { Group, Mesh, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';
import { buildFacade, type FacadeStats } from './batch';
import { Builder, K } from './geo';
import { Dressing, type DressOptions, dressTower, dressWall, spanStreet, type TowerSpec } from './grammar';
import { jiehuaMaterial, sharedUniforms } from './material';
import { Pipeline } from './post';
import { Rng } from './rng';

interface Shot { pos: readonly [number, number, number]; look: readonly [number, number, number]; hfov: number; set: 'canyon' | 'shaft' }

const SHAFT_X = 300;
const SHOTS: Readonly<Record<string, Shot>> = {
  // street level, looking up the canyon (comp-C's stair-street walls)
  'canyon': { pos: [0.5, 1.7, 14], look: [0, 17, -40], hfov: 64, set: 'canyon' },
  // an oblique look at the west wall from mid-height (round-4 A's right-hand towers)
  'wall': { pos: [4.5, 16, -22], look: [-6, 22, -44], hfov: 58, set: 'canyon' },
  'wall-high': { pos: [3, 38, -12], look: [-6, 36, -40], hfov: 58, set: 'canyon' },
  // the canyon from the plaza end, a little up: the pale layered towers of round-4 A
  'spawn': { pos: [2, 3, 34], look: [-2, 20, -30], hfov: 62, set: 'canyon' },
  // across and down the Well shaft (comp-B's shaft walls)
  'shaft': { pos: [SHAFT_X - 2, 3.5, 12.5], look: [SHAFT_X + 1.5, -7, -16], hfov: 64, set: 'shaft' },
  'shaft-across': { pos: [SHAFT_X - 9, 2, 12.5], look: [SHAFT_X + 12, -2, -6], hfov: 62, set: 'shaft' },
};

interface FacadeLabApi {
  ready: Promise<void>;
  shot: (name: string) => Promise<void>;
  shots: () => string[];
  stats: () => { calls: number; triangles: number; width: number; height: number; facade: FacadeStats; buildMs: number };
  bench: (frames: number) => Promise<number>;
}
declare global { interface Window { __ndFacade?: FacadeLabApi } }

const nextFrames = (n: number): Promise<void> => new Promise((resolve) => {
  let k = 0;
  const tick = (): void => { k++; if (k >= n) resolve(); else requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
});

/** the street canyon: 5 towers a side along a 12 m street (fronts at x = ±6), closed by a far pair */
function canyonTowers(): { t: TowerSpec; o: DressOptions; seed: number }[] {
  const out: { t: TowerSpec; o: DressOptions; seed: number }[] = [];
  const r = new Rng(4);
  for (const side of [-1, 1] as const) {
    let z = 18;
    for (let i = 0; i < 5; i++) {
      const w = r.pick([12, 16, 16, 20, 24]);
      const d = 14;
      const zc = z - w / 2;
      const floors = r.int(13, 28);
      const dist = Math.abs(zc - 14);
      const lod: 0 | 1 | 2 = dist > 150 ? 2 : dist > 95 ? 1 : 0;
      const front = side < 0 ? 4 : 8;
      out.push({
        t: { x: side * (6 + d / 2), z: zc, w: d, d: w, y0: 0, h: floors * 3, faces: front | 1 | 2 },
        o: { shops: true, street: 0, lod, gallery: 0.06, detailY: [0, 40] }, seed: 100 + i * 17 + (side > 0 ? 7 : 0),
      });
      z -= w + r.pick([0, 0, 1.5, 3]);
    }
  }
  out.push({ t: { x: -10, z: -150, w: 26, d: 14, y0: 0, h: 96, faces: 1 }, o: { lod: 2 }, seed: 901 });
  out.push({ t: { x: 16, z: -160, w: 22, d: 14, y0: 0, h: 78, faces: 1 }, o: { lod: 2 }, seed: 902 });
  return out;
}

/** the Well: four towers round a 24 × 30 m void, their inner faces dressed from 60 m below to 60 m above the street */
function shaftTowers(): { t: TowerSpec; o: DressOptions; seed: number }[] {
  const X = SHAFT_X;
  const o: DressOptions = { gallery: 0.4, street: 0, setbacks: false, timber: 0.75, lit: 0.55 };
  return [
    { t: { x: X, z: -15 - 8, w: 40, d: 16, y0: -60, h: 120, faces: 1 }, o, seed: 501 },
    { t: { x: X, z: 15 + 8, w: 40, d: 16, y0: -60, h: 114, faces: 2 }, o, seed: 502 },
    { t: { x: X - 12 - 8, z: 0, w: 16, d: 30, y0: -60, h: 126, faces: 4 }, o, seed: 503 },
    { t: { x: X + 12 + 8, z: 0, w: 16, d: 30, y0: -60, h: 108, faces: 8 }, o, seed: 504 },
  ];
}

function ground(shared: ReturnType<typeof sharedUniforms>, x0: number, x1: number, z0: number, z1: number, y: number): Mesh {
  const b = new Builder();
  b.quad(new Vector3(x0, y, z1), new Vector3(1, 0, 0), new Vector3(0, 0, -1), x1 - x0, z1 - z0, { wash: 0x6b6f75, kind: K.slats, p1: 0.74, line: 0.6, edges: 0 });
  return new Mesh(b.build(), jiehuaMaterial(shared));
}

function main(): void {
  const canvas = document.getElementById('lab-canvas');
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('no canvas');
  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' });
  renderer.autoClear = false;
  const shared = sharedUniforms();
  const scene = new Scene();
  const camera = new PerspectiveCamera(60, 1, 0.1, 900);
  const pipe = new Pipeline(renderer, shared.uSilk.value);
  pipe.clearColor.copy(shared.uFogCol.value);

  const t0 = performance.now();
  const sets: Record<'canyon' | 'shaft', Group> = { canyon: new Group(), shaft: new Group() };
  const statsBy: Partial<Record<'canyon' | 'shaft', FacadeStats>> = {};
  for (const [name, list] of [['canyon', canyonTowers()], ['shaft', shaftTowers()]] as const) {
    const d = new Dressing();
    for (const e of list) dressTower(e.t, e.seed, e.o, d);
    if (name === 'canyon') {
      // the far end of the street, built through the plane adapter the clean room would use (dressWall)
      dressWall(d, new Vector3(-24, 0, -140), new Vector3(0, 0, 1), 20, 0, 90, 903, { lod: 1 });
      dressWall(d, new Vector3(8, 0, -146), new Vector3(0, 0, 1), 24, 0, 72, 904, { lod: 1 });
      // the ceiling of clutter strung across the street
      const r = new Rng(77);
      for (let z = 4; z > -120; z -= r.range(3.5, 8)) {
        const ya = r.range(5, 30);
        spanStreet(d, new Vector3(-5.8, ya, z), new Vector3(5.8, ya + r.range(-2, 2), z + r.range(-3, 3)), 1000 + Math.round(z * 10));
      }
    } else {
      const r = new Rng(78);
      // across the Well east–west (never toward the ledge the camera stands on)
      for (let i = 0; i < 12; i++) {
        const ya = r.range(-40, -5), z = r.range(-12, 4);
        spanStreet(d, new Vector3(SHAFT_X - 11.5, ya, z), new Vector3(SHAFT_X + 11.5, ya + r.range(-3, 3), z + r.range(-4, 4)), 2000 + i);
      }
    }
    const { group, stats } = buildFacade(d, shared);
    sets[name].add(group);
    statsBy[name] = stats;
    scene.add(sets[name]);
  }
  sets.canyon.add(ground(shared, -30, 30, -200, 60, 0));
  const shaftFloor = ground(shared, SHAFT_X - 12, SHAFT_X + 12, -15, 15, -60);
  sets.shaft.add(shaftFloor);
  const buildMs = performance.now() - t0;

  let current: Shot = SHOTS['canyon'] ?? { pos: [0, 2, 10], look: [0, 10, -20], hfov: 60, set: 'canyon' };
  let pr = Math.min(window.devicePixelRatio, 3);
  const apply = (): void => {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.aspect = aspect;
    camera.fov = (2 * Math.atan(Math.tan((current.hfov * Math.PI) / 360) / aspect) * 180) / Math.PI;
    camera.position.set(...current.pos);
    camera.lookAt(new Vector3(...current.look));
    camera.updateProjectionMatrix();
    shared.uLinePx.value = 0.72 * pr;
    pipe.setSize(Math.round(w * pr), Math.round(h * pr), 0.5 * pr);
    sets.canyon.visible = current.set === 'canyon';
    sets.shaft.visible = current.set === 'shaft';
    // the silk band sits in the Well's depth; the canyon's street only has the thin haze
    shared.uFogBand.value.set(current.set === 'shaft' ? -18 : -60, 14, current.set === 'shaft' ? 0.035 : 0, 0);
  };
  apply();
  window.addEventListener('resize', apply);
  const renderFrame = (): void => {
    shared.uCam.value.copy(camera.position);
    renderer.info.reset();
    renderer.info.autoReset = false;
    pipe.render(scene, camera, 6.5);
  };
  const loop = (): void => { renderFrame(); requestAnimationFrame(loop); };

  window.__ndFacade = {
    ready: nextFrames(3),
    shot: async (name) => {
      const s = SHOTS[name];
      if (s === undefined) throw new Error(`no shot ${name}`);
      current = s;
      apply();
      await nextFrames(3);
    },
    shots: () => Object.keys(SHOTS),
    stats: () => {
      renderFrame();
      const f = statsBy[current.set];
      if (f === undefined) throw new Error('no stats');
      return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, width: renderer.domElement.width, height: renderer.domElement.height, facade: f, buildMs };
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
  };
  void pr;
  pr = Math.min(window.devicePixelRatio, 3);
  requestAnimationFrame(loop);
}

main();
