/**
 * Cove — Wreck Cove's dressing (Driftwood Isle, remaster M2): the SEA CAVE, tidepools, the cascade.
 *
 * The sea cave sits in the low notch at the crag foot north-west of the wreck: a vault of faceted boulders (grass and
 * moss on the outer tops, wet dark rock inside, stalactites) over a level rock-slab floor you walk on, vines hanging over
 * the mouth, a torch beside it. Inside: an antechamber with a tide pool, a narrow passage (the adventure's sluice gate
 * fits it: 2.5 m wide), then a raised alcove lit by glowing cyan crystals. Crystal and torch light are baked into the
 * vertex colours (no runtime light); the flames / crystals are one unlit draw. Tidepools among rock rims on the cove flats
 * (a ripple shader, the reef crabs' homes) and the cascade (the look-agent's Waterfall curtain, W5) over the crag into its plunge pool.
 *
 * Draws: rocks + cave (one LowPolyKit mesh on lowPolyMaterial), glow, pools, cascade.
 *
 * E306 / E315 M1 (second pass): the cove is WORLD — the sea cave is welded into the crag (its floor cuts the physics
 * terrain, `terrainCuts`), the pools and the cascade are water. Its loose outdoor rocks (the tidepool rims, the plunge
 * pool's ring, the cascade's banks) are the reef-rock model (src/shards/driftwood-isle/models/reefRock.ts), placed
 * `drawnInto` the smooth-rock mesh they are welded in. `place` registers the cove's own piece (`cove`: drawn, its
 * colliders and floors; no card); the Wreck cove set (src/shards/driftwood-isle/world/places.ts) lists these rocks.
 *
 *   const cove = new Cove(sky).place(registry, Cove.forIsland());   // the game: piece `cove` (world) + the reef rocks' card
 *   const cove = new Cove(sky).build(Cove.forIsland());                          // a dev page / the navmesh bake: not registered
 *   scene.add(cove.group); its registry piece.push(...cove.colliders);
 *   player.platforms.push((x, z) => cove.floorHeightAt(x, z));      // the cave floor (antechamber, ramp, alcove)
 *   game.onUpdate((dt) => cove.update(dt));
 *   enemies: new Enemies(animals, { crabSites: cove.crabSites, … })   // the tidepool groups the Reef Crabs live at
 *
 * Cave frame: `spec.cave` {x, z} is the middle of the MOUTH, the interior runs along local +z, world = origin +
 * R_y(yaw) · local (the adventure's POI frame convention). `anchors` (world coords, y = floor, yaw = world facing,
 * 0 = +Z): caveFloor (the antechamber), plateA / plateB (on the sand in front of the mouth), barrelStart (the beach by
 * the wreck's bow), gate (the passage — faces the mouth), alcove (the crystal alcove behind the gate).
 * `caveBounds` {x, z, r, yMin, yMax} (the cave reverb) — also on `Cove.forIsland()` for the ambience.
 */
import * as THREE from 'three';
import { copyCoveGeometry } from '../boot/coveGeometry';
import { ANTE, PASS, ALC, STEPS, ANTE_FLOOR, ALC_FLOOR, CUT, BACKFILL, coveFloorAt, coveHalfWidth, coveWorld, islandCoveSpec, type CoveSpec, type CaveBounds, type CoveAnchor } from './coveLayout';
import { waterfallFor, type WaterfallLike } from './Waterfall';
import { rockMaterial } from './rockKit';
import { reefRock } from '../models/reefRock';
import { modelContext } from '@wildshard/engine/models/model';
import { place, type Placed } from '@wildshard/engine/models/place';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { attachFogUniforms } from '@wildshard/engine/world/Atmosphere';
import { lowPolyMaterial } from '@wildshard/engine/world/lowpolyKit';
import { boxDesc, type ColliderDesc, type WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';

export class Cove {
  group = new THREE.Group();
  colliders: Collider[] = [];
  crabSites: { x: number; z: number }[] = [];
  anchors: Record<string, CoveAnchor> = {};
  caveBounds: CaveBounds = { x: 0, z: 0, r: 0, yMin: 0, yMax: 0 };
  private uniforms = { uTime: { value: 0 } };
  private t = 0;
  private fall: WaterfallLike | null = null;
  private cave: CoveSpec['cave'] = { x: 0, z: 0, yaw: 0, w: 0, h: 0, depth: 0 };
  /** the loose reef rocks as built: each copy's matrix, radius, squash, moss, world box */
  private rocks: { m: THREE.Matrix4; r: number; squash: number; moss: number; box: THREE.Box3 }[] = [];
  private rockMesh: THREE.Mesh | null = null;
  /** the reef rocks' placement (the Wreck cove set's member) */
  readonly placed: Placed[] = [];

  constructor(private sky: Sky) {}

  static forIsland(): CoveSpec { return islandCoveSpec(); }

  /**
   * The game's: build it, register the cove (piece `cove`: the sea cave, the pools and the cascade are world, drawn and
   * colliding as always — no card) and its reef rocks' placements (drawnInto their mesh; `placed`, the Wreck cove set's).
   */
  place(registry: WorldRegistry, spec: CoveSpec): this {
    this.build(spec);
    registry.add({ id: 'cove', name: 'Wreck cove', category: 'nature', file: 'src/shards/driftwood-isle/world/Cove.ts', object: this.group, colliders: this.colliderDescs(), surface: 'rock',
      floor: (x, z) => this.floorHeightAt(x, z), solidFloor: true });
    if (this.rockMesh !== null && this.rocks.length > 0) {
      const boxes: number[] = [], at = new THREE.Vector3();
      const pls = this.rocks.map((k) => {
        boxes.push(k.box.min.x, k.box.min.y, k.box.min.z, k.box.max.x, k.box.max.y, k.box.max.z);
        at.setFromMatrixPosition(k.m);
        return { x: at.x, y: at.y, z: at.z, matrix: k.m, params: { r: k.r, squash: k.squash, moss: k.moss } };
      });
      this.placed.push(place(reefRock, pls, { ctx: modelContext(this.sky), draw: 'merged', registry, drawnInto: { object: this.rockMesh, boxes: Float32Array.from(boxes) }, piece: { id: 'wreck-cove-reef-rocks' } }));
    }
    return this;
  }

  /** cave-local (lx, lz) → world (x, z) */
  private W(lx: number, lz: number): [number, number] {
    return coveWorld(this.cave, lx, lz);
  }
  private L(x: number, z: number): [number, number] {
    const c = this.cave, cs = Math.cos(c.yaw), sn = Math.sin(c.yaw), dx = x - c.x, dz = z - c.z;
    return [dx * cs - dz * sn, dx * sn + dz * cs];
  }
  build(spec: CoveSpec): this {
    const built = copyCoveGeometry(spec);
    this.crabSites = spec.crabSites;
    this.cave = spec.cave;
    this.caveBounds = spec.caveBounds;
    this.rocks = built.placements;
    const cave = spec.cave, W = (lx: number, lz: number) => this.W(lx, lz);
    const rocks = new THREE.Mesh(built.geometry.structure, lowPolyMaterial(this.sky));
    rocks.castShadow = true; rocks.receiveShadow = true;
    this.group.add(rocks);
    const sm = new THREE.Mesh(built.geometry.rocks, rockMaterial(this.sky));
    sm.name = 'cove-rocks'; sm.castShadow = true; sm.receiveShadow = true;
    this.group.add(sm); this.rockMesh = sm;
    const glowMesh = new THREE.Mesh(built.geometry.glow, new THREE.MeshBasicMaterial({ vertexColors: true }));
    glowMesh.name = 'cove-glow'; this.group.add(glowMesh);
    const pmat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#0a2540'), roughness: 0.4, metalness: 0, transparent: true, opacity: 0.9, flatShading: true });
    this.patchRipple(pmat, 'cove-pool');
    this.sky.setupMaterial(pmat);
    const poolMesh = new THREE.Mesh(built.geometry.pools, pmat);
    poolMesh.receiveShadow = true; poolMesh.renderOrder = 1;
    this.group.add(poolMesh);

    {
      const [tx, tz] = spec.fall.top, [fx, fz] = spec.fall.foot, dx = fx - tx, dz = fz - tz, len = Math.hypot(dx, dz);
      const px = fx + (dx / len) * 1.2, pz = fz + (dz / len) * 1.2;
      // E150: the toon cascade in three terraces; its foam rings stay inside the 2.4 m pool
      this.fall = waterfallFor({ lip: new THREE.Vector3(tx, heightAt(tx, tz) + 0.3, tz), foot: new THREE.Vector3(px, heightAt(fx, fz) + 0.06, pz), width: 2.2, ground: heightAt, poolRadius: 2.3, steps: 3 }).build();
      this.group.add(this.fall.group);
    }

    // ── colliders: the cave walls (a 2.5 m throat at the passage), the back wall, the outer mass ──
    const box = (lx: number, lz: number, hw: number, hd: number, y0: number, y1: number): void => {
      const [x, z] = W(lx, lz);
      this.colliders.push({ x, z, hw, hd, rot: -cave.yaw, yTop: y1, yBottom: y0 });
    };
    for (const side of [-1, 1]) {
      box(side * (ANTE.hw + 0.6), ANTE.z1 / 2 - 0.3, 0.6, ANTE.z1 / 2 + 0.3, ANTE_FLOOR - 2, ANTE_FLOOR + 7);
      box(side * (PASS.hw + 1.0), (PASS.z0 + PASS.z1) / 2, 1.0, (PASS.z1 - PASS.z0) / 2, ANTE_FLOOR - 2, ANTE_FLOOR + 7);
      box(side * (ALC.hw + 0.6), (ALC.z0 + cave.depth) / 2, 0.6, (cave.depth - ALC.z0) / 2, ANTE_FLOOR - 2, ANTE_FLOOR + 7);
      box(side * (ANTE.hw + 2.6), cave.depth / 2, 1.5, cave.depth / 2 + 0.8, ANTE_FLOOR - 2, ANTE_FLOOR + 7);
    }
    box(0, cave.depth + 0.6, ALC.hw + 1, 0.6, ANTE_FLOOR - 2, ANTE_FLOOR + 7);

    // ── anchors ──
    const anchor = (lx: number, lz: number, yaw: number, floor = true): CoveAnchor => {
      const [x, z] = W(lx, lz);
      return { x, z, y: floor && lz >= -0.3 && lz <= cave.depth ? coveFloorAt(lz) : heightAt(x, z), yaw: cave.yaw + yaw };
    };
    this.anchors['caveFloor'] = anchor(0, 2.8, Math.PI);
    this.anchors['gate'] = anchor(0, PASS.z0 + 0.25, Math.PI);
    this.anchors['alcove'] = anchor(0, 7.9, Math.PI);
    this.anchors['plateA'] = anchor(-2.9, -4.6, 0, false);
    this.anchors['plateB'] = anchor(2.9, -4.6, 0, false);
    // the barrel that washed up by the wreck's bow, ~8 m from the plates
    this.anchors['barrelStart'] = { x: 147.5, y: heightAt(147.5, 3.5), z: 3.5, yaw: 0 };
    return this;
  }

  /**
   * PHYSICS P4: this builder's static collision in world space — its walls / posts (the legacy boxes) and every floor
   * `floorHeightAt` describes, as real geometry. src/engine/physics/pieces.ts turns it into Rapier colliders.
   *
   * The nine wall boxes; the floor as three slabs (the antechamber and the passage at 1.2 m, the alcove at 2.2 m); the
   * ramp between them as the four steps the mesh draws (0.25 m rise), alcove-wide so the upper ones meet the alcove's
   * wider floor; and a back-fill block behind the back wall over the far side of `terrainCuts()` — the heightfield
   * under the cave must be cut for any of this floor to be the floor.
   *
   * The drawn ramp is 45° (1 m up over lz 5.8–6.8): four treads 0.25 deep are narrower than the 0.38 m capsule, which
   * then rides their edges as a 45° slope and stops. So the treads run 0.375 m each (34°), lz 5.65–7.15 — from just
   * behind the sluice door (its leaf ends at lz ≈ 5.61) to 0.35 m into the alcove, whose floor the top tread is flush
   * with; the collision is within one rise (0.25 m) of the drawn steps all along.
   */
  colliderDescs(): ColliderDesc[] {
    const c = this.cave, out: ColliderDesc[] = this.colliders.map((b) => boxDesc(b, 'rock'));
    const slab = (hw: number, lz0: number, lz1: number, top: number, bottom: number): ColliderDesc => {
      const [x, z] = this.W(0, (lz0 + lz1) / 2);
      return { kind: 'box', x, y: (top + bottom) / 2, z, hx: hw, hy: (top - bottom) / 2, hz: (lz1 - lz0) / 2, yaw: c.yaw, surface: 'rock' };
    };
    const base = CUT.below - 0.4;
    out.push(slab(ANTE.hw + 0.1, -0.3, PASS.z0, ANTE_FLOOR, base));
    out.push(slab(PASS.hw + 0.1, PASS.z0, STEPS.z0, ANTE_FLOOR, base));
    out.push(slab(ALC.hw + 0.1, STEPS.z1, c.depth, ALC_FLOOR, base));
    const at = (lz: number, y: number) => { const [x, z] = this.W(0, lz); return { x, y, z }; };
    out.push({ kind: 'treads', from: at(STEPS.z0, ANTE_FLOOR), to: at(STEPS.z1, ALC_FLOOR), width: (ALC.hw + 0.1) * 2, count: 4, surface: 'rock' });
    out.push(slab(BACKFILL.hw, c.depth + 0.8, BACKFILL.z1, ANTE_FLOOR + 7, base));
    return out;
  }

  /**
   * PHYSICS P4: where the terrain heightfield must be pushed down for the cave to be walkable — every heightfield
   * vertex inside a rectangle (centre x, z; half-extents hw across, hd along; turned `yaw` about +Y like a
   * ColliderDesc) takes min(its height, `below`). `below` is under the cave floor.
   */
  terrainCuts(): { x: number; z: number; hw: number; hd: number; yaw: number; below: number }[] {
    const [x, z] = this.W(0, (CUT.z0 + CUT.z1) / 2);
    return [{ x, z, hw: CUT.hw, hd: (CUT.z1 - CUT.z0) / 2, yaw: this.cave.yaw, below: CUT.below }];
  }

  /** the cave's walkable floor under (x, z), else undefined */
  floorHeightAt(x: number, z: number): number | undefined {
    const [lx, lz] = this.L(x, z);
    if (lz < -0.3 || lz > this.cave.depth) return undefined;
    if (Math.abs(lx) > coveHalfWidth(lz) + 0.1) return undefined;
    return coveFloorAt(lz);
  }

  /** the pools: concentric ripple rings drift outward, the sun catches their crests */
  private patchRipple(mat: THREE.MeshStandardMaterial, key: string) {
    const u = this.uniforms;
    patchShader(mat, 'driftwood.cove', PATCH_ORDER.material, (shader) => {
      attachFogUniforms(shader);
      shader.uniforms['uTime'] = u.uTime;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uTime; varying vec3 vWp;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          {
            float r = length(fract(vWp.xz * 0.11) - 0.5) * 9.0;          // a ripple centre per 9 m cell (each pool gets its own)
            float w = 0.5 + 0.5 * sin(r * 6.0 - uTime * 2.2) * sin(vWp.x * 3.1 + uTime) ;
            float crest = smoothstep(0.75, 1.0, w);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.12, 0.4, 0.5), crest * 0.4 + 0.06 * sin(vWp.z * 5.0 + uTime * 1.7));
          }`);
    }, { mode: 'replace', key });
  }

  update(dt: number): void {
    this.t += dt;
    this.uniforms.uTime.value = this.t;
    this.fall?.update(dt);
  }
}
