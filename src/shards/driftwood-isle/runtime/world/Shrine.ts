/**
 * Shrine — where the Ring Shrine stands, and what moves round it (E306 / E315 M1: the shrine itself is the model
 * src/shards/driftwood-isle/runtime/models/shrine.ts; this is the world side). It places the shrine on its knoll in the
 * north-west jungle, turned by SHRINE.rot so its back points at the planet, and runs its effects: the glyphs' pulse,
 * the pool's ripples and the firefly cloud drifting round the platform.
 *
 *   const shrine = new Shrine(sky, { x, z, rot }).place(registry);   // the game (main.ts): piece `shrine`
 *   const shrine = new Shrine(sky, { x, z, rot }).build();           // a dev page: not registered
 *   scene.add(shrine.group); its registry piece.push(...shrine.colliders);
 *   player.platforms.push((x, z) => shrine.floorHeightAt(x, z));    // the stair, the three terraces, the causeway
 *   game.onUpdate((dt) => shrine.update(dt));
 *   shrine.setDusk(k)       // 0 = broad day … 1 = dusk / night: glyph brightness + the firefly cloud (the day clock drives it)
 *
 * The fireflies are one baked mesh of quads its material graph poses on the GPU (data/fireflyLook.ts, handed over by
 * setFireflyLook before the world builds); without it (a page outside the hybrid world) the cloud is not drawn.
 *
 * `anchors` (world coords, yaw = world facing, 0 = +Z): altar, pool, stairFoot, ring (see the model).
 */
import * as THREE from 'three';
import { modelContext } from '@wildshard/engine/models/model';
import { placeModelSite, type Placed } from '@wildshard/engine/models/place';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import type { ColliderDesc, WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { SHRINE_RUNE, shrine, shrineLayout, shrineMaterials, shrineOrigin, type ShrineAnchor, type ShrineParams } from '../models/shrine';
import { FIREFLY_LOOK } from '../const';
import { SHRINE_FIREFLIES_GEOMETRY } from '../boot/fixedGeometry';

export interface ShrineSpec { x: number; z: number; rot: number }

let fireflyLook: { material: THREE.Material; dusk: (k: number) => void } | null = null;
/** hand the fireflies their compiled graph (look.materials, data/fireflyLook.ts) and its `dusk` writer */
export function setFireflyLook(materials: ReadonlyMap<string, THREE.Material>, setParam: (id: string, name: string, value: number) => void): void {
  const material = materials.get(FIREFLY_LOOK);
  if (material === undefined) throw new Error('Driftwood: look.materials lacks the firefly graph');
  fireflyLook = { material, dusk: (k) => { setParam(FIREFLY_LOOK, 'dusk', k); } };
}

export class Shrine {
  /** what it draws: the stone + jungle, the pool, the glyphs — and the firefly cloud */
  group!: THREE.Object3D;
  /** the legacy boxes (pedestals, monolith, glyph pillars, standing stones, the stair's cheek walls, the tiers) */
  colliders: Collider[] = [];
  anchors: Record<string, ShrineAnchor> = {};
  private readonly params: ShrineParams;
  /** the site's origin: own space + this = world */
  private readonly o: { x: number; y: number; z: number };
  private lay: ReturnType<typeof shrineLayout> | null = null;
  private descs: ColliderDesc[] = [];
  /** its placements (the named places' sets read them, src/shards/driftwood-isle/world/places.ts) */
  placed: Placed | null = null;
  private baseY = 0;
  private glyphMat!: THREE.MeshBasicMaterial;
  private dusk = 0.35;
  private readonly look = fireflyLook;
  private t = 0;

  constructor(private sky: Sky, private spec: ShrineSpec) {
    // the model is built for its site (where it stands, which way it faces, the terrain there) and handed over in own space
    this.params = { site: { x: spec.x, z: spec.z, rot: spec.rot }, ground: heightAt };
    this.o = shrineOrigin(this.params);
  }

  /** 0 = broad daylight (the fireflies barely show), 1 = dusk / night (the full cloud, the glyphs at their brightest) */
  setDusk(k: number): void { this.dusk = Math.max(0, Math.min(1, k)); this.look?.dusk(this.dusk); }

  /** the game's: placed and registered (piece `shrine`, the catalog's Ring shrine) */
  place(registry: WorldRegistry): this { return this.draw(registry); }

  /** a dev page's: the same shrine, not registered */
  build(): this { return this.draw(null); }

  private draw(registry: WorldRegistry | null): this {
    const y0 = this.o.y, ctx = modelContext(this.sky), lay = this.lay = shrineLayout(this.params);
    const site = placeModelSite(shrine, this.o, lay, { ctx, registry, params: this.params, piece: { id: 'shrine' } });
    this.group = site.group;
    this.placed = site.placed;
    this.descs = site.colliderDescs();
    this.baseY = y0 + lay.baseY;
    this.colliders.push(...site.colliders);
    Object.assign(this.anchors, site.anchors);
    const m = shrineMaterials(ctx);
    this.glyphMat = m.glyphs;
    this.buildFireflies(y0 + lay.terrace);
    return this;
  }

  /** the firefly cloud (an effect, not the model): the baked FIREFLY_COUNT quads (generators/fireflies.ts) the graph circles round the platform, 0.4–3 m up */
  private buildFireflies(top: number): void {
    const g = SHRINE_FIREFLIES_GEOMETRY.copy();
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, top - this.baseY, 0), 18);
    const mesh = new THREE.Mesh(g, this.look?.material);
    mesh.name = 'shrine-fireflies';
    mesh.position.set(this.spec.x - this.o.x, this.baseY - this.o.y, this.spec.z - this.o.z); // in the shrine's posed copy
    mesh.renderOrder = 4;
    mesh.visible = this.look !== null;
    this.group.add(mesh);
    this.look?.dusk(this.dusk);
    this.update(0);
  }

  update(dt: number): void {
    this.t += dt;
    const t = this.t;
    const pulse = 0.55 + 0.45 * Math.sin(t * 1.1) * Math.sin(t * 0.37 + 1);
    this.glyphMat.color.copy(SHRINE_RUNE).multiplyScalar(1.6 + 2.6 * pulse * (0.6 + 0.4 * this.dusk));
  }

  /**
   * PHYSICS P4: the shrine's static collision in world space (the model's own-space colliders, placed): the legacy boxes
   * but the tiers, the three terraces, the stair's treads, the causeway and its front treads. src/engine/physics/pieces.ts turns
   * it into Rapier colliders.
   */
  colliderDescs(): ColliderDesc[] { return this.descs.slice(); }

  /** the walkable stone under (x, z): the stair (a ramp), the three terraces, the causeway across the pool */
  floorHeightAt(x: number, z: number): number | undefined {
    const y = (this.lay ??= shrineLayout(this.params)).floorHeightAt(x - this.o.x, z - this.o.z);
    return y === undefined ? undefined : y + this.o.y;
  }
}
