/** Authored cable/deck geometry and static colliders; declared CableTraversal owns all ride state and motion. */
import * as THREE from 'three';
import { modelContext } from '@wildshard/engine/models/model';
import { place, type Placed } from '@wildshard/engine/models/place';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import { lowPolyLookMaterial } from '@wildshard/engine/world/lowpolyKit';
import type { ColliderDesc, WorldRegistry } from '@wildshard/engine/world/registry';
import type { Flags } from '@wildshard/engine/world/interact/flags';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { zipline, ziplineGeometry } from '../runtime/models/zipline';
import { CableTraversal, CableLayout, type ZiplineSpec } from '@wildshard/sdk/movers';
import { floorAtRects } from '@wildshard/engine/physics/box';

export class Zipline {
  readonly group = new THREE.Group();
  readonly prompt: Interactable;
  /** the cable's two ends (world) */
  readonly a: THREE.Vector3;
  readonly b: THREE.Vector3;
  private readonly carriage = new THREE.Mesh();
  readonly cables: CableTraversal;
  readonly mode: string;
  private readonly sky: Sky;
  private readonly spec: ZiplineSpec;
  private readonly lay: CableLayout;
  /** its placements (the named places' sets read them, src/shards/driftwood-isle/world/places.ts) */
  placed: Placed | null = null;

  constructor(sky: Sky, spec: ZiplineSpec, row: ConstructorParameters<typeof CableTraversal>[0][number], flags: Flags, rider: { position: THREE.Vector3; velocity: THREE.Vector3; carried: boolean }) {
    this.sky = sky; this.spec = spec; this.mode = row.id;
    const lay = this.lay = new CableLayout(spec);
    this.a = lay.a; this.b = lay.b;
    this.cables = new CableTraversal([row], flags);
    const flat = lay.flat, position = new THREE.Vector3(this.a.x - flat.x * 0.6, lay.deck.y + 1.0, this.a.z - flat.z * 0.6);
    this.prompt = this.cables.bindView(row.id, this.carriage, rider, { position, radius: 2.4, label: 'Ride the zipline' });
  }

  build(): this {
    const { rig, trolley } = ziplineGeometry(this.lay);
    const mat = lowPolyLookMaterial(this.sky, 'still');
    const mesh = new THREE.Mesh(rig, mat);
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = 'zipline';
    this.carriage.geometry = trolley; this.carriage.material = mat; this.carriage.castShadow = true;
    this.group.add(mesh, this.carriage);
    return this;
  }

  /** the game's: the zipline model's card on what it draws, and the deck's colliders (piece `zipline`); add `group` to the scene */
  place(registry: WorldRegistry): this {
    const t = this.spec.top, b = this.spec.bottom;
    const box = new THREE.Box3().setFromObject(this.group);
    this.placed = place(zipline, [{ x: t.x, y: t.y, z: t.z, params: { top: { x: t.x, y: t.y, z: t.z }, bottom: { x: b.x, y: b.y, z: b.z } } }], { ctx: modelContext(this.sky), draw: 'merged', registry,
      drawnInto: { object: this.group, boxes: Float32Array.from([box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z]), colliders: this.colliderDescs() },
      piece: { id: 'zipline', floor: (x, z) => this.floorHeightAt(x, z), solidFloor: true } });
    return this;
  }

  /** the deck is walkable */
  floorHeightAt(x: number, z: number): number | undefined {
    const d = this.lay.deck;
    return floorAtRects([{ x: d.x, z: d.z, hw: d.hw, hd: d.hd, y: d.y, rot: d.yaw }], x, z, 'first');
  }

  /**
   * PHYSICS P4: this builder's static collision in world space — every floor `floorHeightAt` describes, as real
   * geometry (it has no legacy boxes). src/engine/physics/pieces.ts turns it into Rapier colliders. The launch deck: a 0.2 m
   * slab, its top the deck floor, its footprint the deck's. The deck stands 0.37–0.85 m off the rock (DECK_H); the old
   * 0.5 m step-up climbed it only on its +x side (0.37–0.47 m, the side toward the lookout path; the back has the rail,
   * the front is the cliff), so that side gets one tread 0.24 m under the deck, 0.45 m deep, down into the rock.
   */
  colliderDescs(): ColliderDesc[] {
    const d = this.lay.deck, hy = 0.1, c = Math.cos(d.yaw), s = Math.sin(d.yaw);
    const step = 0.24, depth = 0.45, lx = d.hw + depth / 2, bottom = d.y - 1.6, th = (d.y - step - bottom) / 2;
    return [
      { kind: 'box', x: d.x, y: d.y - hy, z: d.z, hx: d.hw, hy, hz: d.hd, yaw: d.yaw },
      { kind: 'box', x: d.x + lx * c, y: bottom + th, z: d.z - lx * s, hx: depth / 2, hy: th, hz: d.hd, yaw: d.yaw },
    ];
  }

}
