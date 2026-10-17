// Exact shipping cyan-edge ribbon, authored once into the named weapon blob.
import { AddEquation, BufferGeometry, Color, CustomBlending, DoubleSide, Float32BufferAttribute, OneFactor, ShaderMaterial, Uint32BufferAttribute, Vector2, Vector3, ZeroFactor } from 'three';

const v3 = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);
export const JIAN = {
  /** blade root (just above the dragon's crown) */
  root: 0.05,
  len: 0.76,
  /** half width at the root and where the tip's ogive starts */
  hw0: 0.022,
  hw1: 0.0165,
  /** the ogive tip length */
  tip: 0.085,
  thick: 0.0058,
  /** the neon edge band as a share of the half width */
  glow: 0.15,
  /** the neon's emission (HDR; the bloom threshold is 1) */
  emit: 1.5,
} as const;
export const TIP_Y = JIAN.root + JIAN.len;

function halfWidth(y: number): number {
  const { root, len, hw0, hw1, tip } = JIAN;
  const yT = root + len - tip;
  if (y <= yT) return hw0 + (hw1 - hw0) * ((y - root) / (yT - root));
  const u = Math.min(1, (y - yT) / tip);
  // a pointed tip with a slight belly (a jian's 劍尖), not a round spatula
  return hw1 * Math.max(0, 1 - u) ** 0.72;
}

export function edgeLine(sx: number, n: number): Vector3[] {
  const out: Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const y = JIAN.root + JIAN.len * (1 - (1 - i / n) ** 1.3);
    out.push(v3(sx * halfWidth(y), y, 0));
  }
  return out;
}

export function buildHalo(n = 48): { geo: BufferGeometry; mat: ShaderMaterial } {
  const pos: number[] = [], tan: number[] = [], side: number[] = [], out: number[] = [], idx: number[] = [];
  let vi = 0;
  for (const sx of [1, -1]) {
    const pts = edgeLine(sx, n);
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i] ?? v3(0, 0, 0);
      const q = pts[Math.min(pts.length - 1, i + 1)] ?? p, o = pts[Math.max(0, i - 1)] ?? p;
      const t = new Vector3().subVectors(q, o).normalize();
      for (const s of [-1, 1]) {
        pos.push(p.x, p.y, p.z);
        tan.push(t.x, t.y, t.z);
        side.push(s, p.y - JIAN.root);
        out.push(sx);
      }
      if (i < pts.length - 1) {
        const a = vi + i * 2, b = a + 1, c = a + 2, d = a + 3;
        idx.push(a, c, b, b, c, d);
      }
    }
    vi += pts.length * 2;
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('aTan', new Float32BufferAttribute(tan, 3));
  geo.setAttribute('aSide', new Float32BufferAttribute(side, 2));
  geo.setAttribute('aOut', new Float32BufferAttribute(out, 1));
  geo.setIndex(new Uint32BufferAttribute(idx, 1));
  const mat = new ShaderMaterial({
    uniforms: { uRes: { value: new Vector2(1, 1) }, uPx: { value: 14 }, uTime: { value: 0 }, uColor: { value: new Color(0x9fe9ff) }, uGain: { value: 1.0 } },
    vertexShader: '',
    fragmentShader: '',
    transparent: true,
    depthWrite: false,
    // additive colour; the target's alpha (the clean room's inverse depth, the lab's vm mask) is left alone
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: OneFactor,
    blendDst: OneFactor,
    blendEquationAlpha: AddEquation,
    blendSrcAlpha: ZeroFactor,
    blendDstAlpha: OneFactor,
    side: DoubleSide,
  });
  return { geo, mat };
}
