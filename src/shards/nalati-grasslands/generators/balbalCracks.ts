import * as THREE from 'three';

const clamp = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x));
const boneIndex = (bones: readonly { readonly name: string }[]) => (name: string): number => {
  const at = bones.findIndex(bone => bone.name === name); if (at === -1) throw new Error('Missing crack joint'); return at;
};
/** Offline tapered crack tubes with rigid skin rows; only their typed geometry ships. */
function tube(points: [number, number, number][], r0: number, r1: number, joint: number, _part: string, _paint: unknown, sides: number): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)), false, 'catmullrom', .3), steps = points.length * 4;
  const geometry = new THREE.TubeGeometry(curve, steps, r0, sides, false), position = geometry.getAttribute('position');
  const centre = new THREE.Vector3(), p = new THREE.Vector3();
  for (let i = 0; i <= steps; i++) {
    curve.getPointAt(i / steps, centre); const scale = (r0 + (r1 - r0) * (i / steps) ** .8) / r0;
    for (let ring = 0; ring <= sides; ring++) { const at = i * (sides + 1) + ring; p.fromBufferAttribute(position, at).sub(centre).multiplyScalar(scale).add(centre); position.setXYZ(at, p.x, p.y, p.z); }
  }
  geometry.computeVertexNormals();
  const indices = new Uint16Array(position.count * 4), weights = new Float32Array(position.count * 4);
  for (let i = 0; i < position.count; i++) { indices[i * 4] = joint; weights[i * 4] = 1; }
  geometry.setAttribute('skinIndex', new THREE.BufferAttribute(indices, 4)); geometry.setAttribute('skinWeight', new THREE.BufferAttribute(weights, 4)); return geometry;
}

export function buildCracks(bones: readonly { readonly name: string }[]): THREE.BufferGeometry {
  const B = boneIndex(bones);
  const paint = null;
  const parts: THREE.BufferGeometry[] = [];
  let seed = 7;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  // the stele's section at height y (matches the loft above), pushed out a hair so the crack sits proud of the stone
  const surf = (th: number, y: number): [number, number, number] => {
    const k = clamp((y - 0.74) / 0.88, 0, 1);
    const rx = y > 1.56 ? 0.26 : 0.33 + 0.04 * Math.sin(k * Math.PI * 0.9), rz = y > 1.56 ? 0.19 : 0.24 + 0.02 * Math.sin(k * Math.PI * 0.9);
    return [Math.sin(th) * (rx + 0.012), y, Math.cos(th) * (rz + 0.012)];
  };
  const boneAt = (y: number) => (y > 1.3 ? B('chest') : y > 1.02 ? B('spine') : B('body'));
  const crack = (th0: number, y0: number, dy: number, steps: number, r0: number) => {
    let th = th0, y = y0;
    const pts: [number, number, number][] = [surf(th, y)];
    for (let i = 0; i < steps; i++) {
      y += dy * (0.7 + rnd() * 0.6); th += (rnd() - 0.5) * 0.5;
      pts.push(surf(th, y));
      if (rnd() < 0.3 && steps > 3) { // a branch
        const bth = th + (rnd() < 0.5 ? -1 : 1) * 0.35;
        parts.push(tube([surf(th, y), surf(bth, y + dy * 0.8), surf(bth + (rnd() - 0.5) * 0.3, y + dy * 1.5)], r0 * 0.6, r0 * 0.15, boneAt(y), 'crack', paint, 5));
      }
    }
    parts.push(tube(pts, r0, r0 * 0.25, boneAt((y0 + y) / 2), 'crack', paint, 5));
  };
  // around each weak point a burst of cracks (the chest seam, the back, the right shoulder), plus a few long ones
  crack(0.1, 1.5, -0.07, 6, 0.016); crack(-0.05, 1.3, 0.06, 4, 0.014); crack(0.3, 1.22, -0.08, 5, 0.013);   // chest, front
  crack(Math.PI - 0.1, 1.42, -0.07, 6, 0.015); crack(Math.PI + 0.25, 1.1, 0.07, 4, 0.012);                    // back
  crack(-1.2, 1.5, -0.06, 5, 0.013); crack(-0.7, 0.98, -0.05, 4, 0.011); crack(1.1, 1.1, 0.07, 5, 0.011);     // sides
  // the right shoulder's cluster rides the arm; a crack across the brow
  parts.push(tube([[-0.36, 1.44, 0.1], [-0.33, 1.36, 0.11], [-0.37, 1.27, 0.1], [-0.36, 1.18, 0.12]], 0.013, 0.004, B('armR_sh'), 'crack', paint, 5));
  parts.push(tube([[0.1, 1.94, 0.2], [0.02, 1.9, 0.235], [-0.07, 1.93, 0.215], [-0.13, 1.88, 0.19]], 0.011, 0.004, B('head'), 'crack', paint, 5));
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    parts.push(tube([[sx * 0.2, 0.7, 0.12], [sx * 0.17, 0.58, 0.13], [sx * 0.2, 0.46, 0.125]], 0.011, 0.004, B(`leg${side}_hip`), 'crack', paint, 5));
  }
  for (const p of parts) for (const k of Object.keys(p.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'skinIndex' && k !== 'skinWeight') p.deleteAttribute(k);
  const merged = parts.length > 0 ? mergeParts(parts) : new THREE.BufferGeometry();
  return merged;
}
function mergeParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // a small merge (indexed parts, same attributes) — three's BufferGeometryUtils is not imported by species files
  const out = new THREE.BufferGeometry();
  const names = ['position', 'normal', 'skinIndex', 'skinWeight'] as const;
  let vtx = 0, idxN = 0;
  for (const p of parts) { vtx += p.getAttribute('position').count; idxN += p.index ? p.index.count : p.getAttribute('position').count; }
  const idx = new Uint32Array(idxN);
  let vo = 0, io = 0;
  for (const name of names) {
    const first = parts[0]?.getAttribute(name);
    const size = first?.itemSize ?? 3;
    const arr = new Float32Array(vtx * size);
    let o = 0;
    for (const p of parts) { const a = p.getAttribute(name); for (let i = 0; i < a.count * size; i++) arr[o + i] = (a.array[i] ?? 0); o += a.count * size; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  for (const p of parts) {
    const n = p.getAttribute('position').count;
    if (p.index) for (let i = 0; i < p.index.count; i++) idx[io++] = p.index.getX(i) + vo;
    else for (let i = 0; i < n; i++) idx[io++] = i + vo;
    vo += n;
  }
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

