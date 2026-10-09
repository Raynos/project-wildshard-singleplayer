import { smoothstep as sstep } from '@wildshard/engine/core/noise';
import { loft, S, mix, srgb, type Paint } from '@wildshard/engine/entities/species/loft';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt, terrainNormal as normalAt } from '@wildshard/engine/world/terrainHeight';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';




import { painterlyAnimalMaterial } from '../look/creatureMaterial';


/**
 * Marmots — the steppe's ambient sentries (docs/design/nalati/wolves-horses-taming.md "Sheep (ambient life)"): small
 * colonies of grey marmots around burrows. ONE InstancedMesh for every colony (one draw); the pose is a per-instance
 * `iPose` (stand 0..1 — up on the hind legs; sink 0..1 — down the burrow) folded into the instance matrix on the CPU,
 * so no custom shader: the plain shared painterly program.
 *
 *   const marmots = new Marmots(sky, seed).build(sites);  scene.add(marmots.mesh)     sites: {x, z}[] burrow centres
 *   marmots.update(dt, player.position, playerSpeed)
 *   marmots.onWhistle = (x, z) => …   a sentry saw you: Wildlife raises the awareness of animals within 30 m (+0.3)
 *
 * Behaviour: forage near the burrow (a slow shuffle, nose down), now and then one sits up as a sentry; the player
 * inside 35 m (walking) / 22 m (crouched) is seen by a sentry → it WHISTLES, the colony runs to the burrow and drops
 * out of sight for 10–18 s, then peeks back up.
 */

import { MarmotBrain, type MarmotState as Marmot, type MarmotSnapshot } from './marmotBrain';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _p = new THREE.Vector3(), _s = new THREE.Vector3();

const FUR = srgb(0.62, 0.50, 0.34), BACK = srgb(0.42, 0.34, 0.25), BELLY = srgb(0.78, 0.68, 0.50), DARK = srgb(0.16, 0.12, 0.09);
const paint: Paint = (out, _x, y, _z, _nx, ny, _nz, part, t) => {
  if (part === 'eye') { out.copy(DARK); return; }
  if (part === 'tail') { mix(out, BACK, DARK, sstep(0.5, 1, t)); return; }
  out.copy(FUR);
  mix(out, out, BACK, sstep(0.2, 0.9, ny) * 0.8);
  mix(out, out, BELLY, sstep(-0.2, -0.8, ny));
  if (part === 'head') mix(out, out, DARK, sstep(0.85, 0.98, t) * 0.8 + sstep(0.26, 0.3, y) * 0.2);
};

export function buildMarmotGeometry(): THREE.BufferGeometry {
  // ~0.5 m long, plump; origin at the hind feet (the stand pivot), +Z forward
  const parts = [
    loft([S(0, 0.10, -0.16, 0.02, 0.02, 0), S(0, 0.11, -0.13, 0.09, 0.08, 0), S(0, 0.12, -0.02, 0.12, 0.11, 0), S(0, 0.13, 0.10, 0.10, 0.10, 0), S(0, 0.15, 0.18, 0.07, 0.07, 0), S(0, 0.16, 0.21, 0.02, 0.02, 0)], 12, 'body', paint),
    loft([S(0, 0.16, 0.17, 0.055, 0.055, 0), S(0, 0.17, 0.22, 0.06, 0.055, 0), S(0, 0.16, 0.27, 0.042, 0.04, 0), S(0, 0.15, 0.30, 0.02, 0.02, 0)], 10, 'head', paint),
    loft([S(0, 0.11, -0.15, 0.025, 0.025, 0), S(0, 0.09, -0.23, 0.022, 0.02, 0), S(0, 0.08, -0.27, 0.01, 0.01, 0)], 6, 'tail', paint),
  ];
  for (const sx of [1, -1]) {
    parts.push(loft([S(sx * 0.07, 0.10, 0.08, 0.025, 0.025, 0), S(sx * 0.075, 0.03, 0.09, 0.02, 0.02, 0), S(sx * 0.075, 0.0, 0.1, 0.012, 0.012, 0)], 6, 'body', paint));
    const eye = new THREE.SphereGeometry(0.009, 6, 4);
    eye.translate(sx * 0.038, 0.185, 0.25);
    const n = eye.getAttribute('position').count;
    const col = new Float32Array(n * 3).fill(0.02);
    eye.setAttribute('color', new THREE.BufferAttribute(col, 3));
    parts.push(eye);
  }
  const geos = parts.map((g) => {
    const out = new THREE.BufferGeometry();
    out.setIndex(g.index);
    out.setAttribute('position', g.getAttribute('position'));
    out.setAttribute('normal', g.getAttribute('normal'));
    out.setAttribute('color', g.getAttribute('color'));
    return out;
  });
  const merged = mergeGeometries(geos, false);
  merged.computeBoundingSphere();
  return merged;
}

export class Marmots {
  mesh!: THREE.InstancedMesh;
  onWhistle?: ((x: number, z: number) => void) | undefined;
  readonly rules: MarmotBrain;
  private initial: MarmotSnapshot | null = null;
  /** Native bake metadata captured before the first Wildlife frame, never a later pose relabelled as tick zero. */
  get tickZero(): MarmotSnapshot { if (this.initial === null) throw new Error('Marmots have not been built'); return this.initial; }
  private readonly list: Marmot[];

  constructor(private readonly sky: Sky, seed: number) { this.rules = new MarmotBrain(seed, { heightAt, normalY: (x, z) => normalAt(x, z)[1] }); this.list = this.rules.rows; }

  build(sites: { x: number; z: number }[], perSite = 5): this {
    this.rules.build(sites, perSite); this.initial = this.rules.snapshot();
    const mat = painterlyAnimalMaterial(this.sky);
    this.mesh = new THREE.InstancedMesh(buildMarmotGeometry(), mat, Math.max(1, this.list.length));
    this.mesh.count = this.list.length;
    this.mesh.castShadow = false; this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.name = 'marmots';
    this.write();
    return this;
  }

  update(dt: number, player: THREE.Vector3, playerSpeed: number, crouched: boolean): void {
    this.rules.update(dt, player, playerSpeed, crouched, this.onWhistle);
    this.write(true);
  }

  private write(scheduled = false): void {
    this.list.forEach((m, i) => {
      if (scheduled && this.rules.poseDue[i] !== 1) return;
      const g = heightAt(m.x, m.z);
      _e.set(-m.stand * 1.25, m.yaw, 0);
      _q.setFromEuler(_e);
      _p.set(m.x, g - m.sink * 0.45, m.z);
      _s.setScalar(1);
      this.mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** burrow sites: `n` spots on open, gentle ground inside the given box, seeded */
  static scatter(seed: number, n: number, box: { x0: number; x1: number; z0: number; z1: number }): { x: number; z: number }[] {
    return MarmotBrain.scatter(seed, n, box, { heightAt, normalY: (x, z) => normalAt(x, z)[1] });
  }
}

