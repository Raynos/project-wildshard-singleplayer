/**
 * Balbals — where the kurgan field's stone warriors stand, and B11's handle on them (the model is
 * src/shards/nalati-grasslands/models/balbal.ts: the TRELLIS.2 stele, two carved code variants drawn until it lands).
 * Static for now — B11 wakes them at dusk.
 *
 *   const balbals = buildBalbals(ctx, spots);           // spots: { x, z, yaw }[]  (yaw: the way it faces, 0 = −z)
 *   balbals.statues[i] → { x, y, z, yaw, scale, collider }
 *   balbals.setAwake(i, true)   // B11: hide statue i (the live warrior takes its place) — its collider is disabled too
 *   balbals.setAwake(i, false)  // back to stone
 *
 * The statues are placed with the model contract (E306 / E315 M3: `place`, instanced — one InstancedMesh per carved
 * variant, so the shard's balbals are two draw calls) when the POI registers; each statue collides as its own piece.
 */
import * as THREE from 'three';
import { M, poiMaterial } from './paint';
import type { Placement } from '@wildshard/engine/models/model';
import { place } from '@wildshard/engine/models/place';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import { boxDesc, type WorldRegistry } from '@wildshard/engine/world/registry';
import type { Box } from './solid';
import type { PoiCtx, PoiPiece } from './types';
import { MODEL_TRIS } from './glbPaint';
import { balbal, wearGenerated, type BalbalCarving, type BalbalParams } from '../models/balbal';

export interface Statue { x: number; y: number; z: number; yaw: number; scale: number; tilt: number; variant: number; slot: number; collider: Collider }

export class Balbals {
  statues: Statue[] = [];
  meshes: THREE.InstancedMesh[] = [];
  private awake: boolean[] = [];

  isAwake(i: number): boolean { return this.awake[i] === true; }

  /**
   * NALATI-MERGE P1: each statue is its own registry piece — a stone box on a body that follows the (never moving)
   * balbal group, solid only while the statue stands (`active`): a woken warrior carries its own hitboxes.
   */
  register(registry: WorldRegistry, group: THREE.Object3D): void {
    group.updateWorldMatrix(true, false);
    this.statues.forEach((s, i) => {
      registry.add({
        id: `nalati-balbal-${i}`, name: 'Balbal', category: 'props', file: 'src/shards/nalati-grasslands/world/Balbals.ts', surface: 'stone',
        follows: group, colliders: [boxDesc({ ...s.collider, yTop: s.y + 2.2 * s.scale, yBottom: s.y - 1 })], active: () => !this.isAwake(i),
      });
    });
  }

  setAwake(i: number, awake: boolean): void {
    const s = this.statues[i], mesh = this.meshes[s?.variant ?? -1];
    if (!s || !mesh || this.awake[i] === awake) return;
    this.awake[i] = awake;
    mesh.setMatrixAt(s.slot, awake ? new THREE.Matrix4().makeScale(0, 0, 0) : M(s.x, s.y, s.z, s.yaw, s.scale, s.scale, s.scale, 0, s.tilt));
    mesh.instanceMatrix.needsUpdate = true;
    // an awake statue's collider no longer blocks (the warrior carries its own)
    s.collider.yTop = awake ? -1e9 : s.y + 2.2 * s.scale;
    s.collider.yBottom = awake ? -1e9 - 1 : s.y - 1;
  }
}

/** place balbals at the given spots (y from the terrain), `tilt` leans a few of them like weathered stones */
export function buildBalbals(ctx: PoiCtx, spots: { x: number; z: number; yaw: number; scale?: number; tilt?: number }[]): { piece: PoiPiece; balbals: Balbals } {
  const { sky, ground } = ctx;
  const b = new Balbals();
  const colliders: Box[] = [];
  const counts = [0, 0];
  const CARVING: readonly BalbalCarving[] = ['bare', 'capped'];
  const placements: Placement<BalbalParams>[] = [];
  const group = new THREE.Group();
  group.name = 'nalati-balbals';
  spots.forEach((s, i) => {
    const variant = (i * 7 + 3) % 3 === 0 ? 1 : 0;
    const slot = counts[variant] ?? 0; counts[variant] = slot + 1;
    const scale = s.scale ?? 1;
    const y = ground(s.x, s.z) - 0.18 * scale;
    // data only here: `Balbals.register` makes each statue its own piece (a woken one stops colliding)
    const collider: Box = { x: s.x, z: s.z, hw: 0.42 * scale, hd: 0.33 * scale, rot: -s.yaw, yBottom: y - 1, yTop: y + 2.2 * scale, ghost: true };
    placements.push({ x: s.x, y, z: s.z, matrix: M(s.x, y, s.z, s.yaw, scale, scale, scale, 0, s.tilt ?? 0), variant: CARVING[variant] ?? 'bare' });
    b.statues.push({ x: s.x, y, z: s.z, yaw: s.yaw, scale, tilt: s.tilt ?? 0, variant, slot, collider });
    colliders.push(collider);
  });
  return {
    piece: {
      name: 'balbals', object: group, colliders, surface: 'stone', tris: MODEL_TRIS.balbal * spots.length,
      // one InstancedMesh per carved variant (the model contract's instanced path), wearing the generated model once it lands
      register: ({ registry, ctx: mctx }) => {
        const placed = place(balbal, placements, { ctx: mctx, draw: 'instanced', registry });
        group.add(placed.object); // (the registry's scene listener parented it to the scene: back under the POIs' group)
        const isInstanced = (o: THREE.Object3D | undefined): o is THREE.InstancedMesh => o instanceof THREE.InstancedMesh;
        const mesh = (c: BalbalCarving): THREE.InstancedMesh => {
          const name = `${balbal.id}:${c}:0`, m = placed.object.name === name ? placed.object : placed.object.getObjectByName(name);
          return isInstanced(m) ? m : new THREE.InstancedMesh(new THREE.BufferGeometry(), poiMaterial(sky), 0);
        };
        b.meshes = CARVING.map(mesh);
        wearGenerated(b.meshes, sky);
        return [placed];
      },
    },
    balbals: b,
  };
}
