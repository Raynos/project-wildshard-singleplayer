import * as THREE from 'three';
import { modelContext } from '@wildshard/engine/models/model';
import { place, type Placed } from '@wildshard/engine/models/place';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import { lowPolyMaterial } from '@wildshard/engine/world/lowpolyKit';
import type { ColliderDesc, WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { swayDepthMaterial } from '@wildshard/engine/world/wind';
import { rockMaterial } from './rockKit';
import { shipwreck, wreckSiteKind } from '../models/shipwreck';
import type { WreckAnchor, HoldBounds, WreckSpec } from '../assets/contracts/wreck';
import { barrel as barrelModel, crate as crateModel, ropeCoil } from '../models/cargo';
import { driftLog } from '../models/driftLog';
import { reefRock } from '../models/reefRock';
import { WRECK_KIT_GEOMETRY, WRECK_GLOW_GEOMETRY, WRECK_ROCKS_GEOMETRY } from '../boot/fixedGeometry';
import bake from '../data/wreckBake.json' with { type: 'json' };
import { wreckFloorHeight } from './wreckFloor';

const n = (value: number | undefined): number => { if (value === undefined) throw new Error('Wreck collider lacks a number'); return value; };
const end = (value: {x:number;y:number;z:number} | undefined) => { if (value === undefined) throw new Error('Wreck tread lacks an endpoint'); return {...value}; };
const bakedDescs = (): ColliderDesc[] => bake.descs.map((row): ColliderDesc => {
  if (row.kind === 'treads') return {kind:'treads',from:end(row.from),to:end(row.to),width:n(row.width),count:n(row.count)};
  const at = {x:n(row.x),y:n(row.y),z:n(row.z),...(row.rot === undefined ? {} : {rot:{...row.rot}}),...(row.yaw === undefined ? {} : {yaw:row.yaw})};
  if (row.kind === 'box') return {...at,kind:'box',hx:n(row.hx),hy:n(row.hy),hz:n(row.hz)};
  if (row.kind === 'capsule') return {...at,kind:'capsule',radius:n(row.radius),halfHeight:n(row.halfHeight)};
  throw new Error('Unsupported baked wreck collider');
});

/** Wreck Cove's authored draw, native floor query and existing model/registry ownership. */
export class Wreck {
  group = new THREE.Group();
  mesh: THREE.Mesh | null = null;
  glow: THREE.Mesh | null = null;
  colliders: Collider[] = [];
  anchors: Record<string, WreckAnchor> = {};
  holdBounds: HoldBounds = {x:0,z:0,r:0,yMin:0,yMax:0};
  readonly placed: Placed[] = [];
  constructor(private sky: Sky, spec: WreckSpec) {
    if (wreckSiteKind(spec) !== 'world') throw new Error('Wreck Cove requires its authored world site');
  }
  place(registry: WorldRegistry): this { return this.draw(registry); }
  build(): this { return this.draw(null); }
  private draw(registry: WorldRegistry | null): this {
    this.mesh = new THREE.Mesh(WRECK_KIT_GEOMETRY.copy(),lowPolyMaterial(this.sky));
    this.mesh.castShadow = true; this.mesh.receiveShadow = true; this.mesh.customDepthMaterial = swayDepthMaterial();
    this.glow = new THREE.Mesh(WRECK_GLOW_GEOMETRY.copy(),new THREE.MeshBasicMaterial({vertexColors:true})); this.glow.name='wreck-lanterns';
    const reef = new THREE.Mesh(WRECK_ROCKS_GEOMETRY.copy(),rockMaterial(this.sky)); reef.name='wreck-rocks';reef.castShadow=true;reef.receiveShadow=true;
    this.group.add(reef,this.mesh,this.glow);
    this.colliders=structuredClone(bake.colliders);this.anchors=structuredClone(bake.anchors);this.holdBounds={...bake.holdBounds};
    // ── the Wreck cove's models, drawn into the site's meshes ──
    const ctx = modelContext(this.sky), s = bake.spec;
    const into = (boxes: number[], colliders?: ColliderDesc[]): { object: THREE.Object3D; boxes: Float32Array; colliders?: ColliderDesc[] } =>
      ({ object: this.group, boxes: Float32Array.from(boxes), ...(colliders ? { colliders } : {}) });
    // the vessel: the site's every collider (the hold's stacks, the piles', the strays', the rocks', the hull's, the floors), as they always were
    const shipBox = bake.shipBox;
    this.placed.push(place(shipwreck, [{ x: s.x, y: bake.floorY, z: s.z, yaw: s.heading, params: { site: s, ground: heightAt } }], { ctx, draw: 'merged', registry,
      drawnInto: into(shipBox, this.colliderDescs()), piece: { id: 'wreck', floor: (px, pz) => this.floorHeightAt(px, pz), solidFloor: true } }));
    // Catalogue copies borrow the existing wreck draw; the author already grouped their positions and boxes.
    const {barrels,crates,coils,logs,rocks}=bake.catalogue;
    this.placed.push(place(barrelModel,barrels.placements,{ctx,draw:'merged',registry,drawnInto:into(barrels.boxes),piece:{id:'wreck-barrels'}}));
    this.placed.push(place(crateModel,crates.placements,{ctx,draw:'merged',registry,drawnInto:into(crates.boxes),piece:{id:'wreck-crates'}}));
    this.placed.push(place(ropeCoil,coils.placements,{ctx,draw:'merged',registry,drawnInto:into(coils.boxes),piece:{id:'wreck-coils'}}));
    this.placed.push(place(driftLog,logs.placements,{ctx,draw:'merged',registry,drawnInto:into(logs.boxes),piece:{id:'wreck-drift-logs'}}));
    this.placed.push(place(reefRock,rocks.placements,{ctx,draw:'merged',registry,drawnInto:into(rocks.boxes),piece:{id:'wreck-reef-rocks'}}));
    return this;
  }

  /** The authored walls, timber, mast, ramps and treads retain their existing collision owner. */
  colliderDescs(): ColliderDesc[] { return bakedDescs(); }
  floorHeightAt(x:number,z:number):number|undefined { return wreckFloorHeight(bake.floor,x,z); }
}
