/**
 * A toon cascade as a look-family system (SHARD-PLATFORM M3): a stepped faceted water curtain in the Wind Waker / Sea of
 * Thieves manner. Nothing here knows a shard: the shard passes its GLSL rows (`glsl`, spliced with the shared
 * `ShaderFamily`: `@{HASH}`, and `@{SHELF}` / `@{DROP}` / `@{BRINK}`, the shelf's fractions of a terrace, which this
 * system passes) and the id its fog patch registers under.
 *
 *   const fall = new Cascade({ lip, foot, width: 2.2, ground: heightAt, poolRadius: 2.3, glsl, patchId }).build();
 *   scene.add(fall.group);
 *   game.onUpdate((dt) => fall.update(dt));
 *
 * `lip` is the centre of the brink the water pours over, `foot` the centre of the plunge pool's surface. The water runs
 * from the lip to the foot in `steps` terraces: each is a short flat shelf (the pour-over lip, or the ledge the step
 * above lands on) and then a ballistic drop. `ground` keeps every vertex a hand above the terrain. Three draws, all unlit
 * (the sun's colour and direction come through the fog uniforms, so they follow the day / night clock), all fogged:
 * - **sheet**: the curtain, pleated into flat facets (the shard's sheet program shades it).
 * - **pool rings**: faceted (9-sided) foam rings spreading on the plunge pool.
 * - **puffs**: low-poly foam balls boiling at the foot and at each landing, and spray chunks thrown up that shrink away,
 *   every puff a 20-face icosahedron, all of them one merged mesh posed in the vertex shader.
 */
import * as THREE from 'three';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { attachFogUniforms } from '@wildshard/engine/world/Atmosphere';
import { ShaderFamily } from './shaderFamily';

/** a cascade's programs as GLSL rows: the hash every program splices, and each part's vertex / fragment source */
export interface CascadeGlsl {
  readonly HASH: string;
  readonly curtainVertex: string;
  readonly curtainFragment: string;
  readonly poolVertex: string;
  readonly poolFragment: string;
  readonly puffVertex: string;
  readonly puffFragment: string;
}

export interface CascadeSpec {
  lip: THREE.Vector3;
  foot: THREE.Vector3;
  /** width at the lip (m); the curtain spreads ~35 % by the foot */
  width: number;
  /** the terrain's height: the curtain never dips under it (v3) */
  ground?: (x: number, z: number) => number;
  /** the plunge pool's radius (m): the foam rings stay inside it (v3; default 1.1 × width) */
  poolRadius?: number;
  /** terraces from the lip to the foot (v3; default 3) */
  steps?: number;
  /** the shard's GLSL rows */
  glsl: CascadeGlsl;
  /** the id the fog patch registers under (the shader-patch inventory lists it) */
  patchId: string;
}

/** what a caller keeps of the cascade */
export interface CascadeLike {
  readonly group: THREE.Group;
  build: () => CascadeLike;
  update: (dt: number) => void;
}

/** the shelf's share of each terrace (the flat run before the drop) */
const SHELF = 0.28;
/** the rows of one terrace, as fractions of it: two across the shelf, the rest down the drop */
const ROWS_F = [0, 0.14, SHELF, 0.42, 0.56, 0.7, 0.85, 1];
/** the columns across the curtain; the odd ones stand proud, so the sheet is pleated into flat facets */
const COLS = 6;

/** A terraced waterfall: its curtain, pool rings and foam puffs, from a shard's cascade row. */
export class Cascade implements CascadeLike {
  group = new THREE.Group();
  private u = { uTime: { value: 0 } };
  private readonly family: ShaderFamily;

  constructor(private spec: CascadeSpec) {
    this.family = new ShaderFamily({ ...spec.glsl, SHELF: SHELF.toFixed(2), DROP: (1 - SHELF).toFixed(2), BRINK: (SHELF + 0.08).toFixed(2) }, {});
  }

  build(): this {
    this.group.add(this.buildSheet(), this.buildRings(), this.buildPuffs());
    return this;
  }

  update(dt: number): void { this.u.uTime.value += dt; }

  /** the fogged unlit material the three parts share the setup of */
  private material(vert: string, frag: string, extra: Record<string, THREE.IUniform> = {}, side: THREE.Side = THREE.DoubleSide): THREE.ShaderMaterial {
    const m = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, extra]),
      vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, fog: true, side,
    });
    Object.assign(m.uniforms, this.u);
    patchShader(m, this.spec.patchId, PATCH_ORDER.material, (shader) => { attachFogUniforms(shader); }, { mode: 'replace' });
    return m;
  }

  /** the curtain's frame: forward (away from the cliff) and sideways unit vectors, the run and the drop */
  private frame(): { fx: number; fz: number; sx: number; sz: number; run: number; drop: number } {
    const { lip, foot } = this.spec;
    const dx = foot.x - lip.x, dz = foot.z - lip.z, run = Math.max(0.5, Math.hypot(dx, dz)), drop = Math.max(1, lip.y - foot.y);
    const fx = dx / run, fz = dz / run;
    return { fx, fz, sx: -fz, sz: fx, run, drop };
  }

  /** a point on the curtain: terrace k, fraction f down it, s ∈ [-0.5, 0.5] across; `proud` pushes it off the sheet */
  private at(k: number, f: number, s: number, proud: number, jitter: number): THREE.Vector3 {
    const { lip, width } = this.spec, steps = this.spec.steps ?? 3;
    const { fx, fz, sx, sz, run, drop } = this.frame();
    const t = (k + f) / steps;
    const onShelf = f <= SHELF;
    // a shelf barely falls; the drop below it is ballistic (∝ the square of the time since the brink)
    const g = onShelf ? 0.05 * (f / SHELF) : 0.05 + 0.95 * ((f - SHELF) / (1 - SHELF)) ** 2;
    const out = run * t + (onShelf ? 0 : proud);
    const w = width * (1 + 0.35 * t);
    const x = lip.x + fx * out + sx * s * w, z = lip.z + fz * out + sz * s * w;
    let y = lip.y - (drop * (k + g)) / steps + (onShelf ? proud : 0) + jitter;
    if (this.spec.ground) y = Math.max(y, this.spec.ground(x, z) + 0.12);
    return new THREE.Vector3(x, y, z);
  }

  private buildSheet(): THREE.Mesh {
    const steps = this.spec.steps ?? 3, rows = ROWS_F.length - 1;
    // one grid of corners, row r global (the last row of a terrace is the first of the next), so the facets are watertight
    const hash = (a: number, b: number): number => { const v = Math.sin(a * 91.7 + b * 47.3) * 43758.5453; return v - Math.floor(v) - 0.5; };
    const corner = (k: number, ri: number, c: number): THREE.Vector3 => {
      const row = k * rows + ri, edge = c === 0 || c === COLS, brink = ri === 0 || ri === rows || ROWS_F[ri] === SHELF;
      const proud = c % 2 === 1 ? 0.07 : 0;
      const f = ROWS_F[ri] ?? 0;
      return this.at(k, f, c / COLS - 0.5, proud, edge || brink ? 0 : hash(row, c) * 0.08);
    };
    const pos: number[] = [], uv: number[] = [], stp: number[] = [];
    const push = (k: number, ri: number, c: number): void => {
      const p = corner(k, ri, c);
      pos.push(p.x, p.y, p.z);
      uv.push(c / COLS, (k + (ROWS_F[ri] ?? 0)) / steps);
      stp.push(ROWS_F[ri] ?? 0, k);
    };
    for (let k = 0; k < steps; k++) for (let ri = 0; ri < rows; ri++) for (let c = 0; c < COLS; c++) {
      push(k, ri, c); push(k, ri + 1, c); push(k, ri, c + 1);
      push(k, ri, c + 1); push(k, ri + 1, c); push(k, ri + 1, c + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('aStep', new THREE.Float32BufferAttribute(stp, 2));
    g.computeBoundingSphere();
    const mat = this.material(this.family.glsl(this.spec.glsl.curtainVertex), this.family.glsl(this.spec.glsl.curtainFragment));
    const mesh = new THREE.Mesh(g, mat);
    mesh.name = 'waterfall-sheet';
    mesh.renderOrder = 5; // after the sea
    return mesh;
  }

  private buildRings(): THREE.Mesh {
    const { foot, width } = this.spec;
    const R = this.spec.poolRadius ?? width * 1.1;
    const g = new THREE.CircleGeometry(R, 18);
    g.rotateX(-Math.PI / 2);
    g.translate(foot.x, foot.y + 0.05, foot.z);
    const mat = this.material(this.family.glsl(this.spec.glsl.poolVertex), this.family.glsl(this.spec.glsl.poolFragment), { uCentre: { value: foot.clone() }, uR: { value: R } });
    const mesh = new THREE.Mesh(g, mat);
    mesh.name = 'waterfall-rings';
    mesh.renderOrder = 6;
    return mesh;
  }

  private buildPuffs(): THREE.Mesh {
    const { foot, width } = this.spec, steps = this.spec.steps ?? 3;
    const { fx, fz, sx, sz } = this.frame();
    const ico = new THREE.IcosahedronGeometry(1, 0);
    const local = ico.getAttribute('position');
    // [centre, radius, seed, kind (0 foam at the foot, 1 foam on a landing, 2 spray), out dir x/z]
    const puffs: { c: THREE.Vector3; r: number; seed: number; kind: number; ox: number; oz: number }[] = [];
    let seed = 11;
    const rnd = (): number => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const wFoot = width * 1.35;
    for (let i = 0; i < 12; i++) {
      const s = (i / 11 - 0.5) * wFoot * 0.95, fwd = (rnd() - 0.35) * 0.9;
      const c = new THREE.Vector3(foot.x + sx * s + fx * fwd, foot.y + 0.1, foot.z + sz * s + fz * fwd);
      const ox = sx * Math.sign(s) * 0.5 + fx * 0.8, oz = sz * Math.sign(s) * 0.5 + fz * 0.8;
      puffs.push({ c, r: 0.32 + rnd() * 0.3, seed: rnd(), kind: 0, ox, oz });
    }
    for (let k = 1; k < steps; k++) for (let i = 0; i < 4; i++) {
      const s = (i / 3 - 0.5) * 0.75 + (rnd() - 0.5) * 0.1;
      const c = this.at(k, 0.06, s, 0, 0.05);
      puffs.push({ c, r: 0.18 + rnd() * 0.12, seed: rnd(), kind: 1, ox: fx * 0.5, oz: fz * 0.5 });
    }
    for (let i = 0; i < 8; i++) {
      const s = (rnd() - 0.5) * wFoot, fwd = rnd() * 0.8;
      const c = new THREE.Vector3(foot.x + sx * s + fx * fwd, foot.y + 0.3, foot.z + sz * s + fz * fwd);
      puffs.push({ c, r: 0.14 + rnd() * 0.1, seed: rnd(), kind: 2, ox: fx + sx * (rnd() - 0.5), oz: fz + sz * (rnd() - 0.5) });
    }
    const n = local.count, N = puffs.length;
    const pos = new Float32Array(N * n * 3), centre = new Float32Array(N * n * 3), info = new Float32Array(N * n * 4);
    puffs.forEach((p, j) => {
      for (let v = 0; v < n; v++) {
        const o = (j * n + v) * 3, q = (j * n + v) * 4;
        pos[o] = local.getX(v); pos[o + 1] = local.getY(v) * 0.8; pos[o + 2] = local.getZ(v); // a little squat
        centre[o] = p.c.x; centre[o + 1] = p.c.y; centre[o + 2] = p.c.z;
        info[q] = p.r; info[q + 1] = p.seed; info[q + 2] = p.kind; info[q + 3] = Math.atan2(p.oz, p.ox);
      }
    });
    ico.dispose();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aCentre', new THREE.BufferAttribute(centre, 3));
    g.setAttribute('aInfo', new THREE.BufferAttribute(info, 4));
    g.boundingSphere = new THREE.Sphere(foot.clone().lerp(this.spec.lip, 0.5), foot.distanceTo(this.spec.lip) * 0.5 + width + 4);
    const mat = this.material(this.family.glsl(this.spec.glsl.puffVertex), this.family.glsl(this.spec.glsl.puffFragment), {}, THREE.FrontSide);
    const mesh = new THREE.Mesh(g, mat);
    mesh.name = 'waterfall-puffs';
    mesh.renderOrder = 7;
    return mesh;
  }
}
