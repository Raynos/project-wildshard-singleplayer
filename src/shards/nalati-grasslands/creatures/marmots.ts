import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt, terrainNormal as normalAt } from '@wildshard/engine/world/terrainHeight';
import * as THREE from 'three';




import { createPackedSpecimens } from '@wildshard/game/models/specimenCatalogue';
import { modelContext } from '@wildshard/engine/models/model';
import { TIER } from '@wildshard/engine/core/tier';
import * as v from 'valibot';
import { SpecimenMaterialSchema } from '@wildshard/format/specimenCatalogue';
import cover from '../boot/cover.generated.json' with { type: 'json' };
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

import type { ForagerPopulation } from '@wildshard/engine/ai/ambientForager';
import type { ForagerSnapshot } from '@wildshard/format/ambientLife';
import { marmotColonies, marmotSites } from './marmotBrain';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _p = new THREE.Vector3(), _s = new THREE.Vector3();

export class Marmots {
  mesh!: THREE.InstancedMesh;
  onWhistle?: ((x: number, z: number) => void) | undefined;
  readonly rules: ReturnType<typeof marmotColonies>;
  private initial: ForagerSnapshot | null = null;
  /** Native bake metadata captured before the first Wildlife frame, never a later pose relabelled as tick zero. */
  get tickZero(): ForagerSnapshot { if (this.initial === null) throw new Error('Marmots have not been built'); return this.initial; }

  constructor(private readonly sky: Sky, seed: number,private readonly owner?: ForagerPopulation) { this.rules = owner ?? marmotColonies(seed); }

  build(sites: { x: number; z: number }[] = []): this {
    const list = (this.owner === undefined ? this.rules.colonies(sites) : this.rules).rows; this.initial = this.rules.snapshot();
    const mat = painterlyAnimalMaterial(this.sky);
    this.mesh = new THREE.InstancedMesh(coverGeometry(this.sky, 'marmot'), mat, Math.max(1, list.length));
    this.mesh.count = list.length;
    this.mesh.castShadow = false; this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.name = 'marmots';
    this.write();
    return this;
  }

  update(dt: number, player: THREE.Vector3, playerSpeed: number, crouched: boolean): void {
    const alarm = this.rules.update(dt, player, playerSpeed > 5, crouched);
    if (alarm !== null) this.onWhistle?.(alarm.x, alarm.z);
    this.write(true);
  }

  /** Present the already-advanced native population without a second decision. */
  project(): void { this.write(true); }

  private write(scheduled = false): void {
    this.rules.rows.forEach((m, i) => {
      if (scheduled && this.rules.due[i] !== 1) return;
      const g = heightAt(m.x, m.z);
      _e.set(-m.sit * 1.25, m.yaw, 0);
      _q.setFromEuler(_e);
      _p.set(m.x, g - m.sink * 0.45, m.z);
      _s.setScalar(1);
      this.mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** burrow sites: `n` spots on open, gentle ground inside the given box, seeded */
  static scatter(seed: number, n: number, box: { x0: number; x1: number; z0: number; z1: number }): { x: number; z: number }[] {
    return marmotSites(seed, n, box, (x, z) => normalAt(x, z)[1]);
  }
}

const coverMaterials = v.parse(v.record(v.string(), SpecimenMaterialSchema), cover.materials);
const ambient = createPackedSpecimens((TIER === 'phone' ? cover.phone : cover.desktop).packed);
/** Prepare the immutable small-model pack before world and ambient construction. */
export function preloadCover(): Promise<void> { return ambient.load(); }
/** Decode an independently owned shape for its existing presentation owner. */
export function coverGeometry(sky: Sky, key: string): THREE.BufferGeometry {
  const part = ambient.parts(key, modelContext(sky), coverMaterials)?.[0];
  if (part === undefined) throw new Error(`Cover geometry not prepared: ${key}`);
  return part.geometry;
}
