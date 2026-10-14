import type { EyeSpot } from '@wildshard/engine/entities/species/look';
import type { BoneDef, VariantDef } from '@wildshard/engine/entities/species/registry';
/**
 * Pine Hollow's thralls on their rigged hulls (`@wildshard/sdk/looks/riggedHulls`' `extras`): a thrall
 * (VariantDef.traits.thrall) gets glowing glass eyes and a few rigid fern clumps on the spine: geometry in the same single
 * draw, flagged per vertex by `aOvergrown` (x = own vertex colour instead of the atlas, y = glow).
 */
import * as THREE from 'three';

/** the hull plus a thrall's eyes and ferns; null for any other variant (it wears the bare hull) */
export function pineThrallExtras(hull: THREE.BufferGeometry, bones: readonly BoneDef[], eyes: readonly EyeSpot[], v: VariantDef): THREE.BufferGeometry | null {
  const thrall = Boolean(v.traits?.['thrall']);
  return thrall ? withThrallExtras(hull, bones, eyes, v) : null;
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// The thralls' extras: glass eyes + fern clumps, rigid on one bone each
// ─────────────────────────────────────────────────────────────────────────────────────────

/** a part appended to the hull: positions / normals / colours, bound wholly to `bone`; own = 1 (vertex colour), glow */
interface Part { pos: number[]; nrm: number[]; col: number[]; idx: number[]; bone: number; glow: number }

const boneIdx = (bones: readonly BoneDef[], name: string): number => Math.max(0, bones.findIndex((b) => b.name === name));

/** the hull's vertex nearest `p` whose normal faces `dir` (dot > minDot) */
function nearestSurface(geo: THREE.BufferGeometry, p: THREE.Vector3, dir: THREE.Vector3 | null, minDot: number): { p: THREE.Vector3; n: THREE.Vector3 } | null {
  const P = geo.getAttribute('position'), N = geo.getAttribute('normal');
  let best = -1, bd = Infinity;
  for (let i = 0; i < P.count; i++) {
    if (dir && N.getX(i) * dir.x + N.getY(i) * dir.y + N.getZ(i) * dir.z < minDot) continue;
    const d = (P.getX(i) - p.x) ** 2 + (P.getY(i) - p.y) ** 2 + (P.getZ(i) - p.z) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  if (best < 0) return null;
  return { p: new THREE.Vector3(P.getX(best), P.getY(best), P.getZ(best)), n: new THREE.Vector3(N.getX(best), N.getY(best), N.getZ(best)).normalize() };
}

/** the top of the hull's back at z (the highest vertex within ±w of the midline, ±dz of z) */
function backAt(geo: THREE.BufferGeometry, z: number, w: number, dz: number): THREE.Vector3 | null {
  const P = geo.getAttribute('position');
  let best = -1, by = -Infinity;
  for (let i = 0; i < P.count; i++) {
    if (Math.abs(P.getX(i)) > w || Math.abs(P.getZ(i) - z) > dz) continue;
    if (P.getY(i) > by) { by = P.getY(i); best = i; }
  }
  return best < 0 ? null : new THREE.Vector3(P.getX(best), P.getY(best), P.getZ(best));
}

/** a glowing glass eye: a small sphere sunk half into the hull's socket */
function eyePart(at: THREE.Vector3, n: THREE.Vector3, r: number, bone: number): Part {
  const s = new THREE.SphereGeometry(r, 10, 8);
  s.translate(at.x - n.x * r * 0.35, at.y - n.y * r * 0.35, at.z - n.z * r * 0.35);
  const P = s.getAttribute('position'), N = s.getAttribute('normal'), I = s.getIndex();
  const part: Part = { pos: [], nrm: [], col: [], idx: I ? Array.from(I.array) : [], bone, glow: 1 };
  for (let i = 0; i < P.count; i++) { part.pos.push(P.getX(i), P.getY(i), P.getZ(i)); part.nrm.push(N.getX(i), N.getY(i), N.getZ(i)); part.col.push(0.55, 0.95, 1.0); }
  s.dispose();
  return part;
}

/**
 * A fern clump: `fronds` pinnate fronds rising from `at` and arching outward — a rachis ribbon with leaflet triangles on
 * each side, both faces (the hull's material is single-sided). Solid geometry, no alpha: it stays in the one draw and
 * casts the same depth as the body.
 */
function fernPart(at: THREE.Vector3, up: THREE.Vector3, size: number, fronds: number, seed: number, bone: number): Part {
  const part: Part = { pos: [], nrm: [], col: [], idx: [], bone, glow: 0 };
  let s = seed;
  const rnd = (): number => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const side = new THREE.Vector3(), fwd = new THREE.Vector3(), q = new THREE.Vector3(), t = new THREE.Vector3(), nn = new THREE.Vector3(), out = new THREE.Vector3();
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, col: [number, number, number]): void => {
    nn.subVectors(b, a).cross(t.subVectors(c, a)).normalize();
    const base = part.pos.length / 3;
    for (const v of [a, b, c]) { part.pos.push(v.x, v.y, v.z); part.nrm.push(nn.x, nn.y, nn.z); part.col.push(...col); }
    part.idx.push(base, base + 1, base + 2);
    const back = part.pos.length / 3;   // the other face
    for (const v of [a, c, b]) { part.pos.push(v.x, v.y, v.z); part.nrm.push(-nn.x, -nn.y, -nn.z); part.col.push(...col); }
    part.idx.push(back, back + 1, back + 2);
  };
  for (let f = 0; f < fronds; f++) {
    const ang = (f / fronds) * Math.PI * 2 + rnd() * 0.8;
    out.set(Math.cos(ang), 0, Math.sin(ang));
    const len = size * (0.7 + 0.5 * rnd()), lift = 0.9 + 0.5 * rnd();
    const green: [number, number, number] = [0.09 + 0.05 * rnd(), 0.2 + 0.08 * rnd(), 0.05 + 0.03 * rnd()];
    const SEG = 7;
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= SEG; k++) {
      const u = k / SEG;
      // up first, then out and drooping at the tip
      pts.push(new THREE.Vector3().copy(at).addScaledVector(up, len * (lift * u - 0.9 * u * u)).addScaledVector(out, len * u * 0.95));
    }
    for (let k = 0; k < SEG; k++) {
      const a = pts[k], b = pts[k + 1];
      if (!a || !b) continue;
      const u = (k + 0.5) / SEG;
      fwd.subVectors(b, a).normalize();
      side.crossVectors(fwd, up).normalize();
      if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
      const leaf = len * 0.2 * Math.sin(Math.PI * Math.min(1, u * 1.15)) * (1 - 0.3 * u);
      const tip: [number, number, number] = [green[0] + 0.1 * u, green[1] + 0.06 * u, green[2]];
      for (const sgn of [1, -1]) {
        // a leaflet: from the rachis, angled forward and down
        q.copy(a).addScaledVector(side, sgn * leaf).addScaledVector(fwd, leaf * 0.45).addScaledVector(up, -leaf * 0.25);
        tri(a, b, q, tip);
      }
      // the rachis itself, a thin ribbon
      q.copy(b).addScaledVector(side, len * 0.012);
      tri(a, b, q, [0.12, 0.16, 0.06]);
    }
  }
  return part;
}

/** the hull geometry + a thrall's eyes and fern clumps, `aOvergrown` = (own colour, glow) per vertex */
function withThrallExtras(hull: THREE.BufferGeometry, bones: readonly BoneDef[], eyes: readonly EyeSpot[], v: VariantDef): THREE.BufferGeometry {
  const box = hull.boundingBox ?? new THREE.Box3().setFromBufferAttribute(hull.getAttribute('position') as THREE.BufferAttribute);
  const H = box.max.y - box.min.y, halfW = Math.max(0.05, (box.max.x - box.min.x) * 0.5);
  const parts: Part[] = [];
  const head = boneIdx(bones, 'head');
  for (const e of eyes) {
    const dir = new THREE.Vector3(Math.sign(e.centre.x) || 1, 0.1, 0.35).normalize();
    const hit = nearestSurface(hull, e.centre, dir, 0.15);
    if (hit) parts.push(eyePart(hit.p, hit.n, e.radius * 1.25, head));
  }
  const body = bones.find((b) => b.name === 'body'), neck = bones.find((b) => b.name === 'neck1');
  if (body && neck) {
    const up = new THREE.Vector3(0, 1, 0);
    const size = H * 0.28 * Number(v.traits?.['fern'] ?? 1);   // traits.fern: the clumps' size (1 = 28 % of the height)
    // withers (on neck1), mid-back and rump (on the body): the clumps ride the spine bones rigidly
    const spots: [number, string, number][] = [[neck.pos[2] - 0.1 * H, 'neck1', 6], [body.pos[2] + 0.05 * H, 'body', 5], [body.pos[2] - 0.35 * H, 'body', 4]];
    spots.forEach(([z, bone, fronds], k) => {
      const top = backAt(hull, z, halfW * 0.35, 0.06 * H);
      if (top) parts.push(fernPart(top.addScaledVector(up, -0.01 * H), up, size * (k === 0 ? 1.1 : 0.9), fronds, 977 + k * 131, boneIdx(bones, bone)));
    });
  }
  // merge: the hull's attributes + the parts (uv: a small patch — the aOvergrown.x = 1 texels ignore the atlas and its normals)
  const n0 = hull.getAttribute('position').count;
  const extra = parts.reduce((s, p) => s + p.pos.length / 3, 0);
  const n = n0 + extra;
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3).fill(1);
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), thr = new Float32Array(n * 2);
  const copy = (name: string, dst: Float32Array | Uint16Array, k: number): void => { const a = hull.getAttribute(name); for (let i = 0; i < n0; i++) for (let c = 0; c < k; c++) dst[i * k + c] = a.getComponent(i, c); };
  copy('position', pos, 3); copy('normal', nrm, 3); copy('uv', uv, 2); copy('skinIndex', si, 4); copy('skinWeight', sw, 4);
  const idx: number[] = Array.from(hull.getIndex()?.array ?? []);
  let o = n0;
  for (const p of parts) {
    const m = p.pos.length / 3;
    for (let i = 0; i < m; i++) {
      const j = o + i;
      for (let c = 0; c < 3; c++) { pos[j * 3 + c] = p.pos[i * 3 + c] ?? 0; nrm[j * 3 + c] = p.nrm[i * 3 + c] ?? 0; col[j * 3 + c] = p.col[i * 3 + c] ?? 1; }
      uv[j * 2] = 0.5 + 0.01 * (i % 7); uv[j * 2 + 1] = 0.5 + 0.01 * ((i * 3) % 5);
      si[j * 4] = p.bone; sw[j * 4] = 1;
      thr[j * 2] = 1; thr[j * 2 + 1] = p.glow;
    }
    for (const t of p.idx) idx.push(o + t);
    o += m;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  g.setAttribute('aOvergrown', new THREE.BufferAttribute(thr, 2));
  g.setIndex(idx);
  g.addGroup(0, idx.length, 0);
  g.computeBoundingBox();
  g.computeBoundingSphere();
  if (g.boundingSphere !== null) g.boundingSphere.radius += 0.6;
  return g;
}
