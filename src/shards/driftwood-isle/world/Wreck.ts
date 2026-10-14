import * as THREE from 'three';
import { modelContext, type Placement } from '@wildshard/engine/models/model';
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
import { barrel as barrelModel, crate as crateModel, ropeCoil, cargoBox } from '../models/cargo';
import { driftLog, driftLogBox } from '../models/driftLog';
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
    const logs = bake.logs.map(row => ({...row,a:new THREE.Vector3().fromArray(row.a),b:new THREE.Vector3().fromArray(row.b)}));
    const rocks = bake.rocks.map(row => ({...row,m:new THREE.Matrix4().fromArray(row.matrix),box:new THREE.Box3(new THREE.Vector3().fromArray(row.min),new THREE.Vector3().fromArray(row.max))}));
    this.mesh = new THREE.Mesh(WRECK_KIT_GEOMETRY.copy(),lowPolyMaterial(this.sky));
    this.mesh.castShadow = true; this.mesh.receiveShadow = true; this.mesh.customDepthMaterial = swayDepthMaterial();
    this.glow = new THREE.Mesh(WRECK_GLOW_GEOMETRY.copy(),new THREE.MeshBasicMaterial({vertexColors:true})); this.glow.name='wreck-lanterns';
    const reef = new THREE.Mesh(WRECK_ROCKS_GEOMETRY.copy(),rockMaterial(this.sky)); reef.name='wreck-rocks';reef.castShadow=true;reef.receiveShadow=true;
    this.group.add(reef,this.mesh,this.glow);
    this.colliders=structuredClone(bake.colliders);this.anchors=structuredClone(bake.anchors);this.holdBounds={...bake.holdBounds};
    // ── the Wreck cove's models, drawn into the site's meshes ──
    const ctx = modelContext(this.sky), s = bake.spec, box = new THREE.Box3();
    const into = (boxes: number[], colliders?: ColliderDesc[]): { object: THREE.Object3D; boxes: Float32Array; colliders?: ColliderDesc[] } =>
      ({ object: this.group, boxes: Float32Array.from(boxes), ...(colliders ? { colliders } : {}) });
    const push = (b: THREE.Box3, out: number[]): void => { out.push(b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z); };
    // the vessel: the site's every collider (the hold's stacks, the piles', the strays', the rocks', the hull's, the floors), as they always were
    const shipBox = bake.shipBox;
    this.placed.push(place(shipwreck, [{ x: s.x, y: bake.floorY, z: s.z, yaw: s.heading, params: { site: s, ground: heightAt } }], { ctx, draw: 'merged', registry,
      drawnInto: into(shipBox, this.colliderDescs()), piece: { id: 'wreck', floor: (px, pz) => this.floorHeightAt(px, pz), solidFloor: true } }));
    // the cargo: the hold's, then the beach's
    const cargo = bake.cargo.map((row): {kind:Parameters<typeof cargoBox>[0];size:number;matrix:THREE.Matrix4} => {
      if (row.kind !== 'barrel' && row.kind !== 'lying' && row.kind !== 'crate' && row.kind !== 'broken' && row.kind !== 'coil') throw new Error('Unknown wreck cargo');
      return {...row,kind:row.kind,matrix:new THREE.Matrix4().fromArray(row.matrix)};
    });
    const cargoOf = <P extends object>(kinds: readonly string[], pl: (c: typeof cargo[number]) => Placement<P>): { pls: Placement<P>[]; boxes: number[] } => {
      const pls: Placement<P>[] = [], boxes: number[] = [];
      for (const c of cargo) {
        if (!kinds.includes(c.kind)) continue;
        pls.push(pl(c));
        push(box.copy(cargoBox(c.kind, c.size)).applyMatrix4(c.matrix), boxes);
      }
      return { pls, boxes };
    };
    const at = (c: typeof cargo[number]): { x: number; y: number; z: number; matrix: THREE.Matrix4 } => { const p = new THREE.Vector3().setFromMatrixPosition(c.matrix); return { x: p.x, y: p.y, z: p.z, matrix: c.matrix }; };
    const barrels = cargoOf<{ lying: boolean }>(['barrel', 'lying'], (c) => ({ ...at(c), variant: c.kind === 'lying' ? 'lying' : 'standing' }));
    const crates = cargoOf<{ size: number; broken: boolean }>(['crate', 'broken'], (c) => ({ ...at(c), params: { size: c.size, broken: c.kind === 'broken' } }));
    const coils = cargoOf<{ r: number }>(['coil'], (c) => ({ ...at(c), params: { r: c.size } }));
    this.placed.push(place(barrelModel, barrels.pls, { ctx, draw: 'merged', registry, drawnInto: into(barrels.boxes), piece: { id: 'wreck-barrels' } }));
    this.placed.push(place(crateModel, crates.pls, { ctx, draw: 'merged', registry, drawnInto: into(crates.boxes), piece: { id: 'wreck-crates' } }));
    this.placed.push(place(ropeCoil, coils.pls, { ctx, draw: 'merged', registry, drawnInto: into(coils.boxes), piece: { id: 'wreck-coils' } }));
    // the piles' logs and the reef rocks
    const logBoxes: number[] = [];
    const logPls = logs.map((l) => {
      push(driftLogBox(l.a, l.b, l.r, box), logBoxes);
      const d = l.b.clone().sub(l.a);
      return { x: (l.a.x + l.b.x) / 2, y: (l.a.y + l.b.y) / 2, z: (l.a.z + l.b.z) / 2, yaw: Math.atan2(-d.z, d.x), params: { len: d.length(), r0: l.r, r1: l.r * 0.7, tone: l.tone % 3 } };
    });
    this.placed.push(place(driftLog, logPls, { ctx, draw: 'merged', registry, drawnInto: into(logBoxes), piece: { id: 'wreck-drift-logs' } }));
    const rockBoxes: number[] = [];
    const rockPls = rocks.map((k) => {
      push(k.box, rockBoxes);
      const p = new THREE.Vector3().setFromMatrixPosition(k.m);
      return { x: p.x, y: p.y, z: p.z, matrix: k.m, params: { r: k.r, squash: 0.62, moss: k.moss } };
    });
    this.placed.push(place(reefRock, rockPls, { ctx, draw: 'merged', registry, drawnInto: into(rockBoxes), piece: { id: 'wreck-reef-rocks' } }));
    return this;
  }

  /** The authored walls, timber, mast, ramps and treads retain their existing collision owner. */
  colliderDescs(): ColliderDesc[] { return bakedDescs(); }
  floorHeightAt(x:number,z:number):number|undefined { return wreckFloorHeight(bake.floor,x,z); }
}
