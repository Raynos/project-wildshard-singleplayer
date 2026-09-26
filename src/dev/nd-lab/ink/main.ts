// Lab P1 "ink" (E169): dev/nd-lab-ink.html — the 界画 surface look on a street canyon, with the line techniques
// switchable for the comparison. Driven headless through window.__ink (no URL switches):
//   ready · set({ lines, sil, wash }) · u(name, value) · cam(t) · pixelRatio(r) · bench(n) · stats()
// lines: 'face' (A, aFace edge distance) · 'bary' (B, barycentric) · 'fat' (D, crease edges as LineSegments2) ·
//        'post' (E, no material lines; post depth + normal-hash creases) · 'none'
// sil:   'alpha' (MSAA-resolved inverse depth in alpha) · 'depth' (depth texture) · 'sobel' · 'none'
import { Color, EdgesGeometry, type IUniform, Mesh, PerspectiveCamera, Scene, SphereGeometry, Vector2, Vector3, Vector4, WebGLRenderer } from 'three';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { toBary } from './kit';
import { type Band, jiehuaMaterial, Shared, skyMaterial } from './jiehua';
import { InkPost, type SilMode } from './post';
import { buildCanyon } from './scene';

type LineMode = 'face' | 'bary' | 'fat' | 'post' | 'none';
interface SetOpts { lines?: LineMode; sil?: SilMode; wash?: 'flat' | 'painted'; preset?: 'silk' | 'blue' }
interface InkApi {
  ready: Promise<void>;
  set: (o: SetOpts) => void;
  u: (name: string, value: number | number[]) => void;
  cam: (t: number, shot?: string) => void;
  pixelRatio: (r: number) => void;
  bench: (frames: number) => Promise<number>;
  stats: () => { calls: number; triangles: number; width: number; height: number };
  /** render one frame and return the canvas as a PNG data URL (no compositor round trip) */
  grab: () => string;
  /** GPU-synced ms of each pass, amortised over n repeats: { world, post } */
  benchParts: (n: number) => { world: number; post: number };
}
declare global { interface Window { __ink?: InkApi } }

function nextFrames(n: number): Promise<void> {
  return new Promise((resolve) => {
    let k = 0;
    const f = (): void => { k++; if (k >= n) resolve(); else requestAnimationFrame(f); };
    requestAnimationFrame(f);
  });
}

function main(): void {
  const canvas = document.getElementById('ink-canvas');
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('no canvas');
  const renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  const shared = new Shared();
  const post = new InkPost(renderer, shared);
  const scene = new Scene();
  const camera = new PerspectiveCamera(60, 1, 0.1, 1500);

  const skyMat = skyMaterial(shared, 0xb3b3b1, 0xc9c7c0, 0xa7a7a6);
  const sky = new Mesh(new SphereGeometry(1400, 32, 16), skyMat);
  sky.frustumCulled = false;
  scene.add(sky);

  // two silks: 'silk' = raw / aged silk (what codex paints this frame into), 'blue' = the blue-hour silk of the
  // round-4/6 mockups and the clean room. The drop reads as stacked bands, each a shade deeper down the scroll.
  const PRESETS: Record<string, { bands: Band[]; fog: number; sky: [number, number, number]; tint: [number, number, number] }> = {
    silk: {
      bands: [
        { y: -12, w: 3.5, d: 0.11, col: 0xc6baa7 }, { y: -40, w: 4, d: 0.11, col: 0xaba396 },
        { y: -70, w: 5, d: 0.13, col: 0x8f8a82 }, { y: 52, w: 9, d: 0.012, col: 0xcbc0ad },
      ],
      fog: 0xc0b5a3, sky: [0xb5a893, 0xc7bba6, 0xa79e90], tint: [1.04, 0.99, 0.9],
    },
    blue: {
      bands: [
        { y: -12, w: 3.5, d: 0.11, col: 0xc4c7cc }, { y: -40, w: 4, d: 0.11, col: 0xa9b0bb },
        { y: -70, w: 5, d: 0.13, col: 0x8e97a6 }, { y: 52, w: 9, d: 0.012, col: 0xc9ced6 },
      ],
      fog: 0xb6bcc6, sky: [0xa9b2c0, 0xc6cbd3, 0x9fa7b4], tint: [0.97, 1.0, 1.05],
    },
  };
  const preset = (name: string): void => {
    const p = PRESETS[name];
    if (p === undefined) throw new Error(`no preset ${name}`);
    shared.setBands(p.bands);
    shared.u.uFogBaseCol.value.setHex(p.fog);
    const su: Record<string, IUniform> = skyMat.uniforms;
    const set = (k: string, hex: number): void => { const v: unknown = su[k]?.value; if (v instanceof Color) v.setHex(hex); };
    set('uZenith', p.sky[0]);
    set('uHorizon', p.sky[1]);
    set('uNadir', p.sky[2]);
    shared.u.uWashTint.value.set(...p.tint);
  };
  preset('silk');

  const { kit } = buildCanyon();
  const geo = kit.build();
  const matFace = jiehuaMaterial(shared);
  const matBary = jiehuaMaterial(shared, { bary: true });
  const city = new Mesh(geo, matFace);
  scene.add(city);
  let baryMesh: Mesh | null = null;
  let fat: LineSegments2 | null = null;
  const fatMat = new LineMaterial({ color: 0x17191e, linewidth: 2, worldUnits: false, alphaToCoverage: false });

  let prOverride = 0;
  const resize = (): void => {
    const pr = prOverride > 0 ? prOverride : Math.min(window.devicePixelRatio, 3);
    renderer.setPixelRatio(pr);
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    const hfov = 58;
    camera.fov = aspect < 1 ? (2 * Math.atan(Math.tan((hfov * Math.PI) / 360) / aspect) * 180) / Math.PI : 56;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    const bw = renderer.domElement.width, bh = renderer.domElement.height;
    post.setSize(bw, bh);
    shared.u.uDpr.value = pr / 3;
    fatMat.resolution.set(bw, bh);
    fatMat.linewidth = 2 * (pr / 3);
  };
  window.addEventListener('resize', resize);
  resize();

  // the hero frame and a slow walk for the motion test (t in seconds, 1.4 m/s forward, a slight yaw drift)
  // the shots, each with a slow walk for the motion test (t in seconds, 1.4 m/s along `walk`, a slight yaw drift)
  const SHOTS: Record<string, { at: [number, number, number]; walk: [number, number]; yaw: number; pitch: number }> = {
    street: { at: [-3.6, 1.65, 4], walk: [0, -1], yaw: -2, pitch: 17 }, // down the canyon, balustrade left, the gate
    drop: { at: [-7.4, 2.2, -10], walk: [0, -1], yaw: -72, pitch: -30 }, // leaning out over the balustrade: the fog bands
    stair: { at: [0.6, 1.65, -52], walk: [0, -1], yaw: 4, pitch: 2 }, // the stair's ground lines, the far towers
  };
  let shotName = 'street';
  const camAt = (t: number): void => {
    const s = SHOTS[shotName] ?? SHOTS['street'];
    if (s === undefined) return;
    const p = new Vector3(s.at[0] + s.walk[0] * 1.4 * t, s.at[1], s.at[2] + s.walk[1] * 1.4 * t);
    camera.position.copy(p);
    const yaw = (s.yaw + 1.5 * t) * (Math.PI / 180); // 0 = down the street (-z), negative = toward the drop
    const pitch = s.pitch * (Math.PI / 180);
    const dir = new Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    camera.lookAt(p.clone().add(dir));
    camera.updateMatrixWorld();
  };
  camAt(0);

  const setLines = (m: LineMode): void => {
    city.visible = m !== 'bary';
    city.material = matFace;
    if (m === 'bary') {
      if (baryMesh === null) { baryMesh = new Mesh(toBary(geo), matBary); scene.add(baryMesh); }
      baryMesh.visible = true;
    } else if (baryMesh !== null) baryMesh.visible = false;
    if (m === 'fat') {
      if (fat === null) {
        const edges = new EdgesGeometry(geo, 20);
        const lg = new LineSegmentsGeometry().fromEdgesGeometry(edges);
        fat = new LineSegments2(lg, fatMat);
        fat.frustumCulled = false;
        scene.add(fat);
      }
      fat.visible = true;
      matFace.polygonOffset = true;
      matFace.polygonOffsetFactor = 1;
      matFace.polygonOffsetUnits = 1;
    } else {
      if (fat !== null) fat.visible = false;
      matFace.polygonOffset = false;
    }
    shared.u.uLineMode.value = m === 'face' ? 0 : m === 'bary' ? 1 : 2;
    shared.u.uDepthAlpha.value = m === 'post' ? 0 : 1;
    if (m === 'post') post.setSilhouette('sobel');
  };

  let t0 = performance.now();
  let frozen = -1;
  renderer.info.autoReset = false; // count every pass of the frame, not only the last
  const renderFrame = (): void => {
    renderer.info.reset();
    const t = frozen >= 0 ? frozen : (performance.now() - t0) / 1000;
    shared.u.uTime.value = t;
    shared.u.uCam.value.copy(camera.position);
    shared.u.uNear.value = camera.near;
    shared.u.uFar.value = camera.far;
    sky.position.copy(camera.position);
    post.render(scene, camera);
  };
  const loop = (): void => { renderFrame(); requestAnimationFrame(loop); };

  const uniformMap: Record<string, IUniform> = shared.u;
  const postMap: Record<string, IUniform> = post.u;
  window.__ink = {
    ready: nextFrames(3),
    set: (o) => {
      if (o.lines !== undefined) setLines(o.lines);
      if (o.sil !== undefined) post.setSilhouette(o.sil);
      if (o.wash !== undefined) shared.u.uWashMode.value = o.wash === 'painted' ? 1 : 0;
      if (o.preset !== undefined) preset(o.preset);
    },
    u: (name, value) => {
      const un = uniformMap[name] ?? postMap[name];
      if (un === undefined) throw new Error(`no uniform ${name}`);
      const cur: unknown = un.value;
      if (typeof value === 'number') { un.value = value; return; }
      const [a = 0, b = 0, c = 0, d = 0] = value;
      if (cur instanceof Color) cur.setRGB(a, b, c);
      else if (cur instanceof Vector2) cur.set(a, b);
      else if (cur instanceof Vector3) cur.set(a, b, c);
      else if (cur instanceof Vector4) cur.set(a, b, c, d);
    },
    cam: (t, shot) => { frozen = 6.5; if (shot !== undefined) shotName = shot; camAt(t); },
    pixelRatio: (r) => { prOverride = r; resize(); },
    bench: async (frames) => {
      const gl = renderer.getContext();
      const px = new Uint8Array(4);
      renderFrame();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      await nextFrames(2);
      const tb = performance.now();
      for (let i = 0; i < frames; i++) {
        renderFrame();
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      }
      return (performance.now() - tb) / frames;
    },
    benchParts: (n) => {
      const gl = renderer.getContext();
      const px = new Uint8Array(4);
      const sync = (): void => { renderer.setRenderTarget(null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
      renderFrame();
      sync();
      let tb = performance.now();
      for (let i = 0; i < n; i++) post.renderWorld(scene, camera);
      post.composite(camera);
      sync();
      const world = (performance.now() - tb) / n;
      tb = performance.now();
      for (let i = 0; i < n; i++) post.composite(camera);
      sync();
      const pst = (performance.now() - tb) / n;
      return { world, post: pst };
    },
    grab: () => { renderFrame(); return renderer.domElement.toDataURL('image/png'); },
    stats: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, width: renderer.domElement.width, height: renderer.domElement.height }),
  };
  t0 = performance.now();
  requestAnimationFrame(loop);
}

main();
