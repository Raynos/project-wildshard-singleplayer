import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { onPaintedDispose } from '../look/image';
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3, type Texture } from 'three';

/**
 * The card-branch fir (E392; the judge, four loops running: "faceted low-poly cone pines; the mockup's are layered
 * conifers"). A tapered trunk and tiers of drooping branch cards, each a painted bough from the branch sheet
 * (`public/assets/far-reach/tex/branches.webp`, codex image_gen: four boughs on a magenta key, cut to alpha by
 * `textures/pack.py`), alpha-tested, double-sided, lit like the leaves they are. One geometry for instancing; the cards
 * carry a vertex colour so the inner, lower tiers sit in shade and the tips catch the sun. Without the sheet the builder
 * is not used (world/shapes.ts keeps the code pine).
 *
 * Local frame: base at y 0, about 8 m tall before the instance's scale (the code pine's height).
 */
export const FIR = { height: 6.6, tiers: 12, perTier: 10, base: 2.7, cell: 2 } as const;

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function firGeometry(): BufferGeometry {
  const rnd = seeded(4417), pos: number[] = [], uv: number[] = [], nor: number[] = [], col: number[] = [];
  const c = new Color(), shade = new Color(0x4a6656), sun = new Color(0xd6f0d2), bark = new Color(0x6b4a34);
  const quad = (p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, u0: number, v0: number, u1: number, v1: number, n: Vector3, tint: Color): void => {
    const v = [[p0, u0, v0], [p1, u1, v0], [p2, u1, v1], [p0, u0, v0], [p2, u1, v1], [p3, u0, v1]] as const;
    for (const [p, u, w] of v) { pos.push(p.x, p.y, p.z); uv.push(u, w); nor.push(n.x, n.y, n.z); col.push(tint.r, tint.g, tint.b); }
  };
  // the trunk: an 8-sided taper, mapped to a bark-coloured corner of nothing (u, v outside the cards: the shader skips
  // the alpha test when the vertex colour says bark), a plain vertex colour
  const sides = 8, h = FIR.height * 0.92;
  for (let i = 0; i < sides; i++) {
    const a0 = (i / sides) * Math.PI * 2, a1 = ((i + 1) / sides) * Math.PI * 2, r0 = 0.32, r1 = 0.06;
    const p0 = new Vector3(Math.cos(a0) * r0, 0, Math.sin(a0) * r0), p1 = new Vector3(Math.cos(a1) * r0, 0, Math.sin(a1) * r0);
    const p2 = new Vector3(Math.cos(a1) * r1, h, Math.sin(a1) * r1), p3 = new Vector3(Math.cos(a0) * r1, h, Math.sin(a0) * r1);
    const n = new Vector3(Math.cos((a0 + a1) / 2), 0.1, Math.sin((a0 + a1) / 2)).normalize();
    quad(p0, p1, p2, p3, -1, -1, -1, -1, n, bark);
  }
  // the tiers: boughs radiating out and drooping, longer low down; two crossed cards per bough for volume
  const cellW = 1 / FIR.cell;
  for (let t = 0; t < FIR.tiers; t++) {
    const f = t / (FIR.tiers - 1), y = 1.1 + f * (FIR.height - 1.8), len = FIR.base * (1 - f * 0.78) + 0.35, droop = 0.5 + (1 - f) * 0.45;
    const n = FIR.perTier - Math.round(f * 2);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + t * 0.9 + rnd() * 0.5, dir = new Vector3(Math.cos(a), 0, Math.sin(a));
      const side = new Vector3(-dir.z, 0, dir.x), w = len * 0.85;
      const cell = Math.floor(rnd() * FIR.cell * FIR.cell), cu = (cell % FIR.cell) * cellW, cv = 1 - (Math.floor(cell / FIR.cell) + 1) * cellW;
      const root = new Vector3(0, y, 0), tip = dir.clone().multiplyScalar(len).add(new Vector3(0, y - droop * len * 0.45, 0));
      c.copy(shade).lerp(sun, 0.35 + 0.65 * f);
      // flat card (the bough seen from above) and a vertical one (its depth), the sheet's left edge at the trunk
      const lift = new Vector3(0, w * 0.3, 0);
      quad(root.clone().addScaledVector(side, -w * 0.5), tip.clone().addScaledVector(side, -w * 0.5), tip.clone().addScaledVector(side, w * 0.5), root.clone().addScaledVector(side, w * 0.5),
        cu, cv, cu + cellW, cv + cellW, new Vector3(0, 1, 0), c);
      quad(root.clone().sub(lift), tip.clone().sub(lift), tip.clone().add(lift), root.clone().add(lift), cu, cv, cu + cellW, cv + cellW, side, c.clone().multiplyScalar(0.85));
    }
  }
  // the leader: a small upright card cross at the top
  const top = new Vector3(0, FIR.height - 0.6, 0);
  for (const s of [new Vector3(0.45, 0, 0), new Vector3(0, 0, 0.45)]) {
    quad(top.clone().sub(s), top.clone().add(s), top.clone().add(s).add(new Vector3(0, 1.3, 0)), top.clone().sub(s).add(new Vector3(0, 1.3, 0)), 0, 1 - cellW, cellW, 1, new Vector3(s.z, 0, s.x).normalize(), sun);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3)); g.setAttribute('color', new Float32BufferAttribute(col, 3));
  return g;
}

/** The branch sheet, set by the plugin behind the loading screen; null keeps the code pine. */
let SHEET: Texture | null = null;
export function setFirSheet(t: Texture | null): void {
  SHEET = t;
  onPaintedDispose(t, () => { if (SHEET === t) SHEET = null; });
}
export const firSheet = (): Texture | null => SHEET;

/** The firs at `at` ([x, y, z, scale]), one instanced draw. */
export function firs(at: readonly (readonly [number, number, number, number])[], sheet: Texture): InstancedMesh {
  // the trunk's uv is (-1, -1): the map's border texel is clear, so the bark is drawn from the vertex colour alone
  // a faint emissive canopy: the low sun barely lights the up-facing cards, and from above the firs read as black discs
  const material = new MeshStandardMaterial({ map: sheet, emissiveMap: sheet, emissive: 0x6a7a44, vertexColors: true, alphaTest: 0.45, side: DoubleSide, roughness: 0.9, metalness: 0 });
  patchShader(material, 'far.fir', PATCH_ORDER.decorate, (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#ifdef USE_MAP
  vec4 farTex = texture2D(map, vMapUv);
  if (vMapUv.x < 0.0) farTex = vec4(1.0);
  diffuseColor *= farTex;
#endif`);
  }, { key: (prior) => `${prior}|far.fir` });
  const mesh = new InstancedMesh(firGeometry(), material, at.length), m = new Matrix4(), q = new Quaternion(), up = new Vector3(0, 1, 0);
  at.forEach(([x, y, z, s], i) => { q.setFromAxisAngle(up, i * 1.7); m.compose(new Vector3(x, y, z), q, new Vector3(s, s, s)); mesh.setMatrixAt(i, m); });
  mesh.computeBoundingSphere();
  return mesh;
}
