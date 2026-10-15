/**
 * The toon cascade's geometry, generated offline (SHARD-PLATFORM C2): a stepped faceted water curtain in the Wind Waker /
 * Sea of Thieves manner, baked with the cove's other fixed draws against the admitted native ground. Its three draws
 * wear the shard's material graphs (data/waterfallLook.ts), which read the channels built here; world/Waterfall.ts
 * loads the baked templates and hands them their materials.
 *
 * `lip` is the centre of the brink the water pours over, `foot` the centre of the plunge pool's surface. The water runs
 * from the lip to the foot in `steps` terraces: each is a short flat shelf (the pour-over lip, or the ledge the step
 * above lands on) and then a ballistic drop. `ground` keeps every vertex a hand above the terrain. Three draws:
 * - **sheet**: the curtain, pleated into flat facets (face normals, `uv`, `aStep`).
 * - **rings**: a disc on the plunge pool (its own `uv`).
 * - **puffs**: low-poly foam balls at the foot and at each landing, and spray chunks, every puff a 20-face icosahedron,
 *   all of them one merged mesh (`aCentre`, `aInfo`, squat face normals) the graph poses.
 */
import * as THREE from 'three';
import { CASCADE_SHELF as SHELF } from '../data/waterfallLook';

export interface CascadeSpec {
  lip: THREE.Vector3;
  foot: THREE.Vector3;
  /** width at the lip (m); the curtain spreads ~35 % by the foot */
  width: number;
  /** the terrain's height: the curtain never dips under it */
  ground: (x: number, z: number) => number;
  /** the plunge pool's radius (m): the foam rings stay inside it */
  poolRadius: number;
  /** terraces from the lip to the foot */
  steps: number;
}

/** the rows of one terrace, as fractions of it: two across the shelf, the rest down the drop */
const ROWS_F = [0, 0.14, SHELF, 0.42, 0.56, 0.7, 0.85, 1];
/** the columns across the curtain; the odd ones stand proud, so the sheet is pleated into flat facets */
const COLS = 6;

/** The cascade's three geometries, in world space. */
export function cascadeGeometry(spec: CascadeSpec): { sheet: THREE.BufferGeometry; rings: THREE.BufferGeometry; puffs: THREE.BufferGeometry } {
  const { lip, foot, width, steps } = spec;
  const dx = foot.x - lip.x, dz = foot.z - lip.z, run = Math.max(0.5, Math.hypot(dx, dz)), drop = Math.max(1, lip.y - foot.y);
  const fx = dx / run, fz = dz / run, sx = -fz, sz = fx;
  /** a point on the curtain: terrace k, fraction f down it, s ∈ [-0.5, 0.5] across; `proud` pushes it off the sheet */
  const at = (k: number, f: number, s: number, proud: number, jitter: number): THREE.Vector3 => {
    const t = (k + f) / steps, onShelf = f <= SHELF;
    // a shelf barely falls; the drop below it is ballistic (∝ the square of the time since the brink)
    const g = onShelf ? 0.05 * (f / SHELF) : 0.05 + 0.95 * ((f - SHELF) / (1 - SHELF)) ** 2;
    const out = run * t + (onShelf ? 0 : proud), w = width * (1 + 0.35 * t);
    const x = lip.x + fx * out + sx * s * w, z = lip.z + fz * out + sz * s * w;
    const y = lip.y - (drop * (k + g)) / steps + (onShelf ? proud : 0) + jitter;
    return new THREE.Vector3(x, Math.max(y, spec.ground(x, z) + 0.12), z);
  };

  // the sheet: one grid of corners, row r global (the last row of a terrace is the first of the next), so the facets are watertight
  const rows = ROWS_F.length - 1;
  const hash = (a: number, b: number): number => { const v = Math.sin(a * 91.7 + b * 47.3) * 43758.5453; return v - Math.floor(v) - 0.5; };
  const pos: number[] = [], uv: number[] = [], stp: number[] = [];
  const push = (k: number, ri: number, c: number): void => {
    const f = ROWS_F[ri] ?? 0, edge = c === 0 || c === COLS, brink = ri === 0 || ri === rows || f === SHELF;
    const p = at(k, f, c / COLS - 0.5, c % 2 === 1 ? 0.07 : 0, edge || brink ? 0 : hash(k * rows + ri, c) * 0.08);
    pos.push(p.x, p.y, p.z); uv.push(c / COLS, (k + f) / steps); stp.push(f, k);
  };
  for (let k = 0; k < steps; k++) for (let ri = 0; ri < rows; ri++) for (let c = 0; c < COLS; c++) {
    push(k, ri, c); push(k, ri + 1, c); push(k, ri, c + 1);
    push(k, ri, c + 1); push(k, ri + 1, c); push(k, ri + 1, c + 1);
  }
  const sheet = new THREE.BufferGeometry();
  sheet.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  sheet.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  sheet.setAttribute('aStep', new THREE.Float32BufferAttribute(stp, 2));
  sheet.computeVertexNormals(); // unindexed: each facet's own normal

  const rings = new THREE.CircleGeometry(spec.poolRadius, 18);
  rings.rotateX(-Math.PI / 2);
  rings.translate(foot.x, foot.y + 0.05, foot.z);

  // the puffs: [centre, radius, seed, kind (0 foam at the foot, 1 foam on a landing, 2 spray), out dir x/z]
  const ico = new THREE.IcosahedronGeometry(1, 0), local = ico.getAttribute('position');
  const puffs: { c: THREE.Vector3; r: number; seed: number; kind: number; ox: number; oz: number }[] = [];
  let seed = 11;
  const rnd = (): number => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const wFoot = width * 1.35;
  for (let i = 0; i < 12; i++) {
    const s = (i / 11 - 0.5) * wFoot * 0.95, fwd = (rnd() - 0.35) * 0.9;
    const c = new THREE.Vector3(foot.x + sx * s + fx * fwd, foot.y + 0.1, foot.z + sz * s + fz * fwd);
    puffs.push({ c, r: 0.32 + rnd() * 0.3, seed: rnd(), kind: 0, ox: sx * Math.sign(s) * 0.5 + fx * 0.8, oz: sz * Math.sign(s) * 0.5 + fz * 0.8 });
  }
  for (let k = 1; k < steps; k++) for (let i = 0; i < 4; i++) {
    const c = at(k, 0.06, (i / 3 - 0.5) * 0.75 + (rnd() - 0.5) * 0.1, 0, 0.05);
    puffs.push({ c, r: 0.18 + rnd() * 0.12, seed: rnd(), kind: 1, ox: fx * 0.5, oz: fz * 0.5 });
  }
  for (let i = 0; i < 8; i++) {
    const s = (rnd() - 0.5) * wFoot, fwd = rnd() * 0.8;
    const c = new THREE.Vector3(foot.x + sx * s + fx * fwd, foot.y + 0.3, foot.z + sz * s + fz * fwd);
    puffs.push({ c, r: 0.14 + rnd() * 0.1, seed: rnd(), kind: 2, ox: fx + sx * (rnd() - 0.5), oz: fz + sz * (rnd() - 0.5) });
  }
  const n = local.count, N = puffs.length;
  const ppos = new Float32Array(N * n * 3), centre = new Float32Array(N * n * 3), info = new Float32Array(N * n * 4);
  puffs.forEach((p, j) => {
    for (let v = 0; v < n; v++) {
      const o = (j * n + v) * 3, q = (j * n + v) * 4;
      ppos[o] = local.getX(v); ppos[o + 1] = local.getY(v) * 0.8; ppos[o + 2] = local.getZ(v); // a little squat
      centre[o] = p.c.x; centre[o + 1] = p.c.y; centre[o + 2] = p.c.z;
      info[q] = p.r; info[q + 1] = p.seed; info[q + 2] = p.kind; info[q + 3] = Math.atan2(p.oz, p.ox);
    }
  });
  ico.dispose();
  const puffGeometry = new THREE.BufferGeometry();
  puffGeometry.setAttribute('position', new THREE.BufferAttribute(ppos, 3));
  puffGeometry.setAttribute('aCentre', new THREE.BufferAttribute(centre, 3));
  puffGeometry.setAttribute('aInfo', new THREE.BufferAttribute(info, 4));
  puffGeometry.computeVertexNormals(); // unindexed: each squat facet's own normal (the graph only scales and moves a puff)
  return { sheet, rings, puffs: puffGeometry };
}
