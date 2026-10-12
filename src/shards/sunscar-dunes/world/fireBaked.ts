import { AdditiveBlending, BufferGeometry, DataTexture, Float32BufferAttribute, LinearFilter, LinearMipmapLinearFilter, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, Points, PointsMaterial, Quaternion, SRGBColorSpace, Sprite, SpriteMaterial, Texture, Vector3, Vector4, type Group, type Object3D } from 'three';
import type { FIRE_STYLE } from '../data/fire';

/**
 * G345 "Signal look" B: Signal's fires on standard materials, no shader of their own. The flame is the flipbook on basic
 * materials (the page turned on the CPU, the quads turned to the camera about Y), the glow a sprite, the pool a draped disc,
 * the smoke a camera-facing column: each over a radial texture baked once from the fire rows; the embers are points the
 * CPU moves. `lights` is the firelight uniform the sand and the camp's materials read (up to four burning fires).
 */
type Style = typeof FIRE_STYLE;
type Rgb = readonly [number, number, number];
export interface FireSize { readonly flame: number; readonly glow: number; readonly smoke: number; readonly embers: number; readonly wisp?: boolean }

const N = 64, fract = (x: number): number => x - Math.floor(x), smooth = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** A 64² linear RGBA texture baked from `f(r, u, v)` (r the distance from the centre, 1 at the edge). */
function baked(f: (r: number, u: number, v: number) => readonly [number, number, number, number]): DataTexture {
  const d = new Uint8Array(N * N * 4);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const u = (i + 0.5) / N, v = (j + 0.5) / N, c = f(Math.hypot(u - 0.5, v - 0.5) * 2, u, v);
    for (let k = 0; k < 4; k++) d[(j * N + i) * 4 + k] = Math.round(Math.min(1, Math.max(0, c[k] ?? 0)) * 255);
  }
  const t = new DataTexture(d, N, N); t.magFilter = LinearFilter; t.minFilter = LinearFilter; t.needsUpdate = true;
  return t;
}
const mix = (a: Rgb, b: Rgb, k: number, i: number): number => (a[i] ?? 0) * (1 - k) + (b[i] ?? 0) * k;

const at = new Vector3(), eye = new Vector3(), turn = new Quaternion(), UP = new Vector3(0, 1, 0), size = new Vector3(), m = new Matrix4();
/** Turns a quad about Y to face the camera as it draws (its parents unscaled). */
function billboard(mesh: Mesh): Mesh {
  mesh.onBeforeRender = (_r, _s, camera) => {
    at.setFromMatrixPosition(mesh.matrixWorld); eye.setFromMatrixPosition(camera.matrixWorld);
    turn.setFromAxisAngle(UP, Math.atan2(eye.x - at.x, eye.z - at.z));
    mesh.matrixWorld.copy(m.compose(at, turn, size.copy(mesh.scale)));
  };
  return mesh;
}

/** The fires' verbs (`world/fireFx.ts` re-exports them): see `addFire`, `addLampGlow`, `fireLight` there. */
export interface BakedFire {
  readonly lights: { value: Vector4[] }; readonly resources: readonly { dispose: () => void }[]; geometries: () => BufferGeometry[];
  addFire: (group: Group, s: FireSize, ground?: { at: Vector3; groundAt: (x: number, z: number) => number }) => Object3D[];
  addLampGlow: (group: Group, r: number, ground: (lx: number, lz: number) => number) => void;
  fireLight: (p: Vector3) => (lit: boolean, gain?: number) => void; resetLights: () => void; tick: (t: number) => void; loadBook: () => () => void;
}

export function createBakedFire(style: Style, lights: { value: Vector4[] }): BakedFire {
  const [bx, bz] = style.breeze, cells = style.book, frames = cells.columns * cells.rows, add = { blending: AdditiveBlending, transparent: true, depthWrite: false, fog: false } as const;
  const glowTex = baked((r) => { const g = Math.exp(-r * r * 5) * (1 - smooth(0.85, 1, r)); return [g, g, g, 1]; });
  const pool = style.pool, poolTex = baked((r) => { const g = (Math.max(0, 1 - r) ** 1.8 * pool.wide + Math.max(0, 1 - r) ** 6 * pool.hot) / (pool.wide + pool.hot); return [g, g, g, 1]; });
  const smokeTex = (s: Style['plume'] | Style['wisp']): DataTexture => baked((_r, u, v) => {
    const k = smooth(0, s.fade, v);
    return [mix(s.foot, s.top, k, 0), mix(s.foot, s.top, k, 1), mix(s.foot, s.top, k, 2), Math.exp(-(((u - 0.5) * 3) ** 2) * 2) * smooth(0, 0.06, v) * (1 - smooth(0.35, 0.95, v)) * s.alpha];
  });
  // two flipbook pages half a book apart, so the overlapping tongues never play in step
  // until the book loads a black page stands in (additive: nothing shows), so the flame's program is prepared with the level's
  const blank = new DataTexture(new Uint8Array(4), 1, 1), flameOf = (): MeshBasicMaterial => { const f = new MeshBasicMaterial({ ...add, map: blank }); f.color.setRGB(...style.bookGrade.tint); return f; };
  blank.needsUpdate = true;
  const flames = [flameOf(), flameOf()] as const;
  const [plumeTex, wispTex] = [smokeTex(style.plume), smokeTex(style.wisp)], textures = [glowTex, poolTex, plumeTex, wispTex];
  const plume = new MeshBasicMaterial({ map: plumeTex, transparent: true, depthWrite: false, fog: false });
  const wisp = new MeshBasicMaterial({ map: wispTex, transparent: true, depthWrite: false, fog: false });
  const glowOf = (gain: number): SpriteMaterial => { const s = new SpriteMaterial({ ...add, map: glowTex }); s.color.setRGB(...style.glow.colour).multiplyScalar(gain); return s; };
  const glow = glowOf(style.glow.gain), lampGlow = glowOf(style.glow.lampGain);
  const poolMaterial = new MeshBasicMaterial({ ...add, map: poolTex, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  poolMaterial.color.setRGB(...pool.colour).multiplyScalar(pool.wide + pool.hot);
  const embers = new PointsMaterial({ ...add, map: glowTex, size: 0.3, vertexColors: true });
  const quad = new PlaneGeometry(1, 1); quad.translate(0, 0.5, 0);
  const emberCache = new Map<number, BufferGeometry>();
  const sparks = (n: number): BufferGeometry => {
    let g = emberCache.get(n);
    if (g === undefined) { g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('color', new Float32BufferAttribute(new Float32Array(n * 3), 3)); emberCache.set(n, g); }
    return g;
  };
  const drape = (r: number, n: number, y: (x: number, z: number) => number): Mesh => {
    const g = new PlaneGeometry(r * 2, r * 2, n, n); g.rotateX(-Math.PI / 2);
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) p.setY(i, y(p.getX(i), p.getZ(i)));
    const disc = new Mesh(g, poolMaterial); disc.frustumCulled = false; return disc;
  };
  const slots = { next: 0 };
  let bookGen = 0;
  return {
    lights,
    resources: [...flames, plume, wisp, glow, lampGlow, poolMaterial, embers, quad, ...textures],
    geometries: () => [...emberCache.values()],
    addFire: (group: Group, s: FireSize, ground?: { at: Vector3; groundAt: (x: number, z: number) => number }): Object3D[] => {
      const parts: Object3D[] = [];
      const put = (o: Object3D, x: number, y: number, z: number): void => { o.position.set(x, y, z); o.frustumCulled = false; group.add(o); parts.push(o); };
      for (const [w, h, x, z, page] of [[0.56, 1, 0, 0, 0], [0.34, 0.8, 0.05, 0.05, 1], [0.26, 0.62, -0.11 * s.flame, -0.07, 1], [0.26, 0.72, 0.11 * s.flame, 0.07, 0]] as const) {
        const tongue = billboard(new Mesh(quad, flames[page])); tongue.scale.set(s.flame * w, s.flame * h, 1); put(tongue, x, -0.08, z);
      }
      const halo = new Sprite(glow); halo.scale.setScalar(s.glow * 2); halo.renderOrder = 2; put(halo, 0, s.flame * 0.4, 0);
      const dots = new Points(sparks(s.embers), embers); dots.scale.setScalar(s.flame * 0.9); put(dots, 0, s.flame * 0.3, 0);
      const smoke = billboard(new Mesh(quad, s.wisp === true ? wisp : plume)); smoke.scale.set(s.smoke * (s.wisp === true ? 0.06 : 0.2), s.smoke, 1); smoke.renderOrder = 1; put(smoke, 0, s.flame * 0.7, 0);
      if (ground) { const g = ground; put(drape(Math.max(s.glow * 2.3, s.flame * 2.4), 16, (x, z) => g.groundAt(g.at.x + x, g.at.z + z) + 0.06 - g.at.y), 0, 0, 0); }
      return parts;
    },
    addLampGlow: (group: Group, r: number, ground: (lx: number, lz: number) => number): void => {
      const halo = new Sprite(lampGlow); halo.scale.setScalar(r * 2); halo.renderOrder = 2; halo.frustumCulled = false; group.add(halo);
      group.add(drape(r * 1.6, 10, (x, z) => ground(x, z) + 0.06));
    },
    fireLight: (p: Vector3): ((lit: boolean, gain?: number) => void) => {
      const v = lights.value[slots.next % lights.value.length] ?? new Vector4(); slots.next++;
      v.set(p.x, p.y, p.z, 0);
      return (lit, gain = 1) => { v.w = lit ? gain : 0; };
    },
    resetLights: (): void => { slots.next = 0; for (const v of lights.value) v.w = 0; },
    tick: (t: number): void => {
      flames.forEach((f, k) => { const i = Math.floor(t * cells.fps + k * frames / 2) % frames; f.map?.offset.set((i % cells.columns) / cells.columns, (cells.rows - 1 - Math.floor(i / cells.columns)) / cells.rows); });
      glow.opacity = lampGlow.opacity = 0.86 + 0.08 * Math.sin(t * 13) + 0.06 * Math.sin(t * 29 + 1.3);
      poolMaterial.opacity = 0.85 + 0.1 * Math.sin(t * 11) + 0.05 * Math.sin(t * 23);
      const { hot, cool, gain } = style.embers;
      for (const [n, g] of emberCache) {
        const p = g.getAttribute('position'), c = g.getAttribute('color');
        for (let i = 0; i < n; i++) {
          const seed = (i * 0.618034) % 1, life = fract(t * (0.22 + 0.18 * fract(seed * 7.13)) + seed), a = seed * 40 + t * (1 + fract(seed * 3.7)), r = 0.22 * (1 + life * 3), drift = life * (0.6 + life) * 4.5, fade = (1 - smooth(0.6, 1, life)) * gain;
          p.setXYZ(i, Math.cos(a) * r + bx * drift, life * 6.5, Math.sin(a) * r + bz * drift);
          c.setXYZ(i, mix(hot, cool, life, 0) * fade, mix(hot, cool, life, 1) * fade, mix(hot, cool, life, 2) * fade);
        }
        p.needsUpdate = true; c.needsUpdate = true;
      }
    },
    loadBook: (): (() => void) => {
      const gen = ++bookGen;
      void (async () => {
        try {
          const response = await fetch(cells.url);
          if (!response.ok) throw new Error(`${String(response.status)} ${cells.url}`);
          const tex = new Texture(await createImageBitmap(await response.blob(), { imageOrientation: 'flipY' }));
          tex.colorSpace = SRGBColorSpace; tex.name = cells.name; tex.minFilter = LinearMipmapLinearFilter; tex.repeat.set(1 / cells.columns, 1 / cells.rows); tex.needsUpdate = true;
          if (gen !== bookGen) { tex.dispose(); return; }
          flames.forEach((f, k) => { f.map = k === 0 ? tex : tex.clone(); });
        } catch (error: unknown) { console.warn('[fireFx] fire flipbook not loaded:', error); }
      })();
      return () => { bookGen++; for (const f of flames) { if (f.map !== blank) f.map?.dispose(); f.map = blank; } };
    },
  };
}
