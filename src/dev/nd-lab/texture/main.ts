// Nine Dragon lab P5 "texture" (E169, round-9-lab-texture): painted surface textures under the Jiehua ink, in a
// corner of Lantern Square at blue hour. dev/nd-lab-texture.html. Driven through window.__tex (no URL switches):
//   ready, cam(name), cams(), paint(k: [master, flag, walls, wood/lacquer/tiles]), paint2(k2), tilePitch(x, y),
//   pixelRatio(r), bench(n), stats(), snapshot(w, h, q), paintInfo().
import { Mesh, PerspectiveCamera, Scene, SphereGeometry, Vector3, Vector4, WebGLRenderer } from 'three';
import { bakeSpill } from './emitters';
import { buildFacade } from './facade/batch';
import { Dressing } from './facade/grammar';
import { facadeUniforms } from './facade/material';
import { Kit } from './kit';
import { Lanterns } from './lanterns';
import { LAYERS, loadPaint } from './paint';
import { Pipeline } from './post';
import { Y0, buildCorner } from './scene';
import { SignAtlas, SignBuilder } from './signs';
import { buildStreaks } from './streaks';
import { Shared, jiehuaMaterial, neonMaterial, skyMaterial } from './style';

interface Cam { eye: [number, number, number]; at: [number, number, number]; hfov?: number }
/** the test cameras (portrait); eye height 1.62 m */
const CAMS: Readonly<Record<string, Cam>> = {
  // the corner: balustrade left, flagstones, the lacquer gate ahead, shopfronts right
  corner: { eye: [2.2, Y0 + 1.62, 0.5], at: [6.2, Y0 + 2.6, -21] },
  // a balustrade panel face on, close (target-2's panel crop)
  panel: { eye: [1.75, Y0 + 1.62, -5.6], at: [-0.2, Y0 + 0.5, -5.6] },
  // looking down past the balustrade cap onto the flagstones (target-6)
  down: { eye: [1.6, Y0 + 1.62, -3.6], at: [-0.3, Y0 - 0.2, -5.0] },
  // the shopfronts: posters, timber, tiles, the lightbox (target-3's shop crop)
  shop: { eye: [7.4, Y0 + 1.62, -3.5], at: [14, Y0 + 2.4, -12.5] },
  // the lacquer gate close (posts, plinth)
  gate: { eye: [5.0, Y0 + 1.62, -16.5], at: [3.3, Y0 + 2.6, -21] },
  // the gate's azurite roof and a lean-to from above (a raised camera: the tiles are above eye height on foot)
  roof: { eye: [7.5, Y0 + 9.5, -15.5], at: [6.2, Y0 + 5.2, -21] },
  // the tower wall over the shops (target-3's tower crop)
  tower: { eye: [4, Y0 + 1.62, -8], at: [14, Y0 + 12, -24] },
  // the far test: 90 m of flagstones and the backdrop walls
  far: { eye: [6.0, Y0 + 1.62, 14], at: [6.0, Y0 + 0.2, -40] },
};

interface TexApi {
  ready: Promise<void>;
  cam: (name: string) => Promise<void>;
  cams: () => string[];
  paint: (k: [number, number, number, number]) => void;
  paint2: (k: [number, number, number, number]) => void;
  tilePitch: (x: number, y: number) => void;
  pixelRatio: (r: number) => void;
  bench: (frames: number) => Promise<number>;
  stats: () => { calls: number; triangles: number; width: number; height: number };
  snapshot: (w: number, h: number, q: number) => string;
  paintInfo: () => { layers: number; size: number; jpegBytes: number; gpuBytes: number };
}
declare global { interface Window { __tex?: TexApi } }

async function loadFonts(): Promise<void> {
  const specs = ['700 64px "LXGW WenKai TC"', '900 64px "Noto Serif TC"'];
  const all = Promise.all(specs.map((s) => document.fonts.load(s, '九龍麵茶藥房旅館牙科')));
  await Promise.race([all.then(() => undefined), new Promise<void>((resolve) => { setTimeout(resolve, 6000); })]);
}

async function main(): Promise<void> {
  const canvas = document.getElementById('tex-canvas');
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('texture lab: no canvas');
  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' });
  renderer.info.autoReset = false;
  const shared = new Shared();
  shared.setLook('jiehua');
  shared.u.uGroundY.value = Y0;
  await loadFonts();
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const paint = await loadPaint('/assets/nine-dragon/lab/tex', aniso);
  shared.u.uPaint.value = paint.tex;

  const scene = new Scene();
  const atlas = new SignAtlas();
  const signs = new SignBuilder(atlas);
  const lanterns = new Lanterns(shared);
  const kit = new Kit();
  const fd = new Dressing();
  const corner = buildCorner(kit, signs, lanterns, fd);
  const geo = kit.build();
  const emitters = [...corner.emitters, ...signs.lights, ...lanterns.emitters];
  bakeSpill([geo], emitters);
  const mat = jiehuaMaterial(shared);
  scene.add(new Mesh(geo, mat));
  const facade = buildFacade(fd, facadeUniforms(shared), { clutterFar: [55, 85] });
  scene.add(facade.group);
  atlas.finish();
  scene.add(new Mesh(signs.build(), neonMaterial(shared, atlas.textures)));
  scene.add(lanterns.build());
  scene.add(buildStreaks(shared, emitters, new Vector4(-40, -80, -0.4, 40)));
  const sky = new Mesh(new SphereGeometry(900, 32, 16), skyMaterial(shared));
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  scene.add(sky);
  const vmScene = new Scene();
  const vmCamera = new PerspectiveCamera(50, 1, 0.05, 10);

  const camera = new PerspectiveCamera(60, 1, 0.1, 1200);
  let cam: Cam = CAMS['corner'] ?? { eye: [0, Y0 + 1.6, 0], at: [0, Y0 + 1.6, -1] };
  let prOverride: number | null = null;
  const pipe = new Pipeline(renderer, shared);
  const resize = (): void => {
    const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
    const pr = prOverride ?? Math.min(window.devicePixelRatio || 1, 3);
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    const aspect = w / h;
    const hf = cam.hfov ?? 62;
    camera.aspect = aspect;
    camera.fov = aspect < 1 ? (2 * Math.atan(Math.tan((hf * Math.PI) / 360) / aspect) * 180) / Math.PI : 56;
    camera.updateProjectionMatrix();
    shared.u.uDpr.value = pr / 3;
    pipe.setSize(Math.round(w * pr), Math.round(h * pr), 1, pr);
  };
  window.addEventListener('resize', resize);
  resize();
  const place = (): void => {
    camera.position.set(...cam.eye);
    camera.lookAt(new Vector3(...cam.at));
    camera.updateMatrixWorld();
    shared.u.uCam.value.copy(camera.position);
    shared.u.uNear.value = camera.near;
    shared.u.uTime.value = 6.5;
  };
  const renderFrame = (): void => {
    renderer.info.reset();
    place();
    pipe.render(scene, camera, vmScene, vmCamera);
  };
  const loop = (): void => { renderFrame(); requestAnimationFrame(loop); };
  renderer.compile(scene, camera);
  renderFrame();
  requestAnimationFrame(loop);
  const nextFrames = (n: number): Promise<void> => new Promise((resolve) => {
    let k = 0;
    const step = (): void => { k++; if (k >= n) resolve(); else requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
  window.__tex = {
    ready: nextFrames(3),
    cam: async (name) => {
      const c = CAMS[name];
      if (c === undefined) throw new Error(`no cam ${name}`);
      cam = c;
      resize();
      await nextFrames(2);
    },
    cams: () => Object.keys(CAMS),
    paint: (k) => { shared.u.uPaintK.value.set(...k); },
    paint2: (k) => { shared.u.uPaintK2.value.set(...k); },
    tilePitch: (x, y) => { shared.u.uTilePitch.value.set(x, y); },
    pixelRatio: (r) => { prOverride = r; resize(); },
    bench: async (frames) => {
      const gl = renderer.getContext();
      const px = new Uint8Array(4);
      renderFrame();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      await nextFrames(2);
      const t0 = performance.now();
      for (let i = 0; i < frames; i++) { renderFrame(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
      return (performance.now() - t0) / frames;
    },
    stats: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, width: renderer.domElement.width, height: renderer.domElement.height }),
    snapshot: (w, h, q) => {
      renderFrame();
      const out = document.createElement('canvas');
      out.width = w;
      out.height = h;
      const c2 = out.getContext('2d');
      if (c2 === null) throw new Error('2d canvas unavailable');
      c2.imageSmoothingEnabled = true;
      c2.imageSmoothingQuality = 'high';
      c2.drawImage(renderer.domElement, 0, 0, w, h);
      return out.toDataURL('image/jpeg', q);
    },
    paintInfo: () => ({ layers: LAYERS.length, size: 1024, jpegBytes: paint.bytes, gpuBytes: Math.round(1024 * 1024 * 4 * LAYERS.length * 4 / 3) }),
  };
}

main().catch((e: unknown) => { console.error('texture lab failed', e); });
