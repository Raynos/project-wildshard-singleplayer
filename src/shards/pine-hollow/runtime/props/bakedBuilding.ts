import * as THREE from 'three';
import { flatPositions, shadowProxy, twoSidedPositions, type WeldBuild, type WeldPart } from '@wildshard/engine/models/weld';
import type { BoxSpec } from '@wildshard/engine/physics/box';
import { boxDesc, type ColliderDesc } from '@wildshard/engine/world/registry';
import type { SkyRig } from '@wildshard/engine/world/skyRig';
import type { BuildingDoor, BuildingFlicker, BuildingFloor, BuildingLightAnchor, BuildingLightKind, BuildingRoom, BuildingSwing } from './buildingLife';

/**
 * A baked building assembled where it stands (SHARD-PLATFORM M3, the props system). An offline builder writes each
 * building as a record: its walls, corners, roof and openings merged per kit material (`parts`, geometries named by index
 * in a geometry pack), its window groups, the fittings that draw on their own (`nodes`: a door on its pivot, a glow, a
 * fire pit's model copy, a particle cloud, a hung lantern, a wheel, a light), its legacy boxes, static solids, floors and
 * rooms. This turns the record into a root with the fittings under it, its parts per material for the weld
 * (src/engine/models/weld.ts) in distance bands, and its live parts handed to its owner (@wildshard/sdk/props/buildingLife
 * runs them) in the order the builder emitted them. Every look number is the shard's row; nothing here knows a shard.
 */

type Xyz = readonly [number, number, number];

/** A light as a building record holds it: colour, intensity, range, decay, where (in its parent's frame), seed, kind, rank. */
export interface BakedBuildingLight {
  readonly color: number; readonly intensity: number; readonly distance: number; readonly decay: number; readonly at: Xyz;
  readonly seed: number; readonly kind: BuildingLightKind; readonly rank: number;
}

/**
 * What a building adds to its root, in the order it added it (a number names a geometry in the pack): a swinging door
 * (leaf, hinges, battens on its pivot; `collider` its legacy box, `top` that box's closed top, `use` its prompt's spot,
 * `slab` the leaf's box in the pivot's frame), a glow, a fire pit's model copy, a particle cloud (`seeds` its instance
 * seeds, `mat` its program), a hung lantern (its pivot, ring and light), a wheel on its pivot, and a light on the root.
 */
export type BakedBuildingNode<P extends string> =
  | { readonly t: 'door'; readonly pivot: Xyz; readonly leaf: number; readonly iron: number; readonly batten: number; readonly id: string; readonly collider: number; readonly top: number; readonly use: Xyz; readonly slab: ColliderDesc }
  | { readonly t: 'glow'; readonly g: number; readonly at: Xyz; readonly yaw: number }
  | { readonly t: 'pit'; readonly at: Xyz; readonly yaw: number }
  | { readonly t: 'particles'; readonly mat: P; readonly seeds: number; readonly at: Xyz; readonly order: number; readonly detail: boolean }
  | { readonly t: 'lantern'; readonly pivot: Xyz; readonly ring: number; readonly light: BakedBuildingLight; readonly swing: number }
  | { readonly t: 'wheel'; readonly g: number; readonly at: Xyz; readonly yaw: number }
  | { readonly t: 'light'; readonly light: BakedBuildingLight };

/** One building as its bake wrote it (world space unless said); `K` names its kit materials, `P` its particle programs. */
export interface BakedBuildingRecord<K extends string, P extends string> {
  readonly at: Xyz;
  readonly rot: number;
  /** its parts per kit material, in the order they first came: one geometry each */
  readonly parts: readonly (readonly [K, number])[];
  /** its window groups, one geometry each */
  readonly glass: readonly number[];
  readonly nodes: readonly BakedBuildingNode<P>[];
  /** its legacy boxes (the door's among them) */
  readonly colliders: readonly BoxSpec[];
  /** its static solids (`prop`: a prop model's own box, which its model registers) */
  readonly solids: readonly { readonly d: ColliderDesc; readonly prop: boolean }[];
  readonly floors: readonly BuildingFloor[];
  /** its rooms, in its own frame */
  readonly rooms: readonly BuildingRoom[];
  readonly doorAt: readonly [number, number];
  /** where its fire pit stands (world space), handed to its owner */
  readonly firePit: Xyz | null;
}

/** How a shard's baked buildings dress and band (a shard's data row); `K` names its kit materials. */
export interface BakedBuildingLook<K extends string = string> {
  /** small parts drawn only within the detail distance, their depth only through the near proxy */
  readonly detail: readonly K[];
  /** merged parts drawn within twice the detail distance */
  readonly far: readonly K[];
  /** a door's leaf, hinge and batten materials, its prompt's reach (m) and its prompts closed and open */
  readonly door: { readonly leaf: K; readonly hinges: K; readonly battens: K; readonly reach: number; readonly open: string; readonly close: string };
  /** a wheel's material */
  readonly wheel: K;
  /**
   * The hung lantern: its ring's material and drop (m); the model copy's drop (m) and scale on its pivot; the material name
   * (any case) that marks its glass; the glass and the frame rebuilt as plain standard materials (the glTF's physical
   * brass and tangents gave NaN fragments): the glass lit by the clock at its emissive intensity.
   */
  readonly lantern: {
    readonly ring: K; readonly ringY: number; readonly drop: number; readonly scale: number; readonly glassName: string;
    readonly glass: { readonly color: number; readonly emissive: Xyz; readonly emissiveIntensity: number; readonly roughness: number; readonly metalness: number; readonly opacity: number };
    readonly frame: { readonly metalness: number; readonly roughness: number; readonly color: number };
  };
  /** every particle cloud's bounding sphere in its own frame */
  readonly particles: { readonly center: Xyz; readonly radius: number };
  /** a building's box reaches this far below and above each of its floors (m) */
  readonly deck: readonly [below: number, above: number];
}

/** The tier's settings a building reads, live: its detail distance, whether its detail casts, whether its lights are pooled. */
export interface BakedBuildingTier {
  readonly detailDist: number;
  readonly detailShadows: boolean;
  readonly sharedLights: boolean;
}

/** The materials a building draws with: its kit materials, its particle programs, its glass and its glow. */
export interface BakedBuildingMats<K extends string, P extends string> {
  readonly parts: Readonly<Record<K, THREE.MeshStandardMaterial>>;
  readonly particles: Readonly<Record<P, THREE.ShaderMaterial>>;
  readonly glass: THREE.MeshStandardMaterial;
  readonly glow: THREE.MeshBasicMaterial;
}

/** A geometry pack (@wildshard/sdk/kit/geometryPack): each geometry by index, read fresh. */
export interface BakedBuildingGeometries { readonly geometry: (index: number) => THREE.BufferGeometry }

/**
 * What a building hands its owner as it is assembled (its live parts: doors, fires, lamps, wheels, floors, static boxes);
 * a specimen's owner keeps nothing (`NO_BUILDING_OWNER`).
 */
export interface BakedBuildingOwner {
  readonly _collider: (c: BoxSpec) => void;
  readonly _solid: (d: ColliderDesc, prop: boolean) => void;
  readonly _floor: (f: BuildingFloor) => void;
  readonly _door: (d: BuildingDoor) => void;
  /** a door's use: the owner moves it (`toggle`) unless it is barred, and tells its listeners */
  readonly _doorUse: (d: BuildingDoor, toggle: () => void) => void;
  readonly _fire: (f: BuildingFlicker) => void;
  readonly _lamp: (mat: THREE.MeshStandardMaterial, full: number) => void;
  readonly _swing: (sw: BuildingSwing) => void;
  readonly _particles: (m: THREE.ShaderMaterial) => void;
  readonly _wheel: (o: THREE.Object3D) => void;
  readonly _firePit: (at: { x: number; y: number; z: number }) => void;
}

/** The owner that keeps nothing (a specimen's): a door toggles on use. */
export const NO_BUILDING_OWNER: BakedBuildingOwner = {
  _collider: () => undefined, _solid: () => undefined, _floor: () => undefined, _door: () => undefined, _doorUse: (_d, toggle) => { toggle(); }, _fire: () => undefined,
  _lamp: () => undefined, _swing: () => undefined, _particles: () => undefined, _wheel: () => undefined, _firePit: () => undefined,
};

/**
 * `standalone`: drawn alone, its lights real on a tier without pooled lights; `member`: welded into a settlement's one
 * unit, its lights anchors only; `specimen`: a viewer's copy, lights as anchors, drawn alone.
 */
export type BakedBuildingRole = 'standalone' | 'member' | 'specimen';

/** Everything a building is assembled from. */
export interface BakedBuildingInput<K extends string, P extends string> {
  readonly owner: BakedBuildingOwner;
  readonly record: BakedBuildingRecord<K, P>;
  readonly geometries: BakedBuildingGeometries;
  readonly mats: BakedBuildingMats<K, P>;
  readonly sky: Pick<SkyRig, 'setupMaterial'>;
  /** the fire pit's and the lantern's models, copied per building */
  readonly models: { readonly firePit: THREE.Object3D; readonly lantern: THREE.Object3D };
  readonly role: BakedBuildingRole;
  readonly look: BakedBuildingLook<K>;
  readonly tier: BakedBuildingTier;
}

const isMesh = (o: THREE.Object3D): o is THREE.Mesh => 'isMesh' in o;

/** A baked building assembled from its record where it stands (see the module comment). */
export class BakedBuildingAssembly<K extends string, P extends string> {
  readonly root = new THREE.Group();
  /** small parts drawn only within the detail distance (tagged `userData.until` by `band`) */
  readonly detail: THREE.Object3D[] = [];
  /** mid parts drawn only within twice the detail distance */
  readonly far: THREE.Object3D[] = [];
  /** with detail shadows: its double-sided dressing's depth for its near proxy (the fire pit here, its owner's props); null
   *  without, when its detail casts no shadow */
  readonly casters: THREE.BufferGeometry[] | null;
  /** casters whose shadow a near proxy draws while the detail band is on: they cast only past it (tagged `castFrom`) */
  readonly swap: THREE.Object3D[] = [];
  /** with pooled lights: where its point lights would be */
  readonly anchors: BuildingLightAnchor[] = [];
  readonly rooms: readonly BuildingRoom[];
  readonly doorAt: [number, number];
  /** its walkable floors and decks, world space */
  readonly floors: readonly BuildingFloor[];
  firePitObj: THREE.Object3D | null = null;
  lanternObj: THREE.Object3D | null = null;
  private readonly parts: [K, THREE.BufferGeometry][];
  private readonly glass: THREE.BufferGeometry[];
  private readonly legacy: BoxSpec[];
  private doorBox: BoxSpec | null = null;
  private readonly role: BakedBuildingRole;
  private readonly owner: BakedBuildingOwner;
  private readonly mats: BakedBuildingMats<K, P>;
  private readonly sky: Pick<SkyRig, 'setupMaterial'>;
  private readonly solids: BakedBuildingRecord<K, P>['solids'];
  private readonly look: BakedBuildingLook<K>;
  private readonly tier: BakedBuildingTier;

  /** `input` the record, its pack, materials, sky, models, role, look row and tier */
  constructor(input: BakedBuildingInput<K, P>) {
    const { owner, record: b, geometries, mats, sky, models, role } = input;
    this.casters = input.tier.detailShadows ? [] : null;
    this.owner = owner; this.mats = mats; this.sky = sky; this.role = role; this.solids = b.solids; this.look = input.look; this.tier = input.tier;
    const [cx, cy, cz] = b.at;
    this.root.position.set(cx, cy, cz);
    this.root.rotation.y = b.rot;
    this.root.updateMatrixWorld(true);
    this.rooms = b.rooms; this.doorAt = [b.doorAt[0], b.doorAt[1]];
    this.floors = b.floors.map((f) => ({ ...f }));
    this.legacy = b.colliders.map((c) => ({ ...c }));
    this.parts = b.parts.map(([key, g]) => [key, geometries.geometry(g)]);
    this.glass = b.glass.map((g) => geometries.geometry(g));
    let door: BuildingDoor | null = null;
    for (const node of b.nodes) {
      switch (node.t) {
        case 'door': door = this.door(node, geometries); break;
        case 'glow': {
          const glow = new THREE.Mesh(geometries.geometry(node.g), mats.glow);
          glow.position.set(...node.at); glow.rotation.y = node.yaw;
          this.root.add(glow); this.detail.push(glow);
          break;
        }
        case 'pit': this.firePit(models.firePit, node.at, node.yaw); break;
        case 'particles': {
          const p = particles(mats.particles[node.mat], geometries.geometry(node.seeds), this.look.particles);
          p.position.set(...node.at); p.renderOrder = node.order;
          this.root.add(p); if (node.detail) this.detail.push(p);
          owner._particles(mats.particles[node.mat]);
          break;
        }
        case 'lantern': this.lantern(models.lantern, node.pivot, geometries.geometry(node.ring), node.light, node.swing); break;
        case 'wheel': {
          const pivot = new THREE.Group();
          pivot.position.set(...node.at); pivot.rotation.y = node.yaw;
          const geo = geometries.geometry(node.g); geo.computeBoundingSphere();
          const wheel = new THREE.Mesh(geo, mats.parts[this.look.wheel]);
          wheel.castShadow = true; wheel.receiveShadow = true;
          pivot.add(wheel); this.root.add(pivot);
          owner._wheel(wheel);
          break;
        }
        case 'light': this.pointLight(this.root, node.light); break;
        default: break;
      }
    }
    // the live parts in the order the builder handed them: its legacy boxes (its door's right after the door's box), its
    // static solids, its floors, its fire pit
    for (const c of this.legacy) {
      owner._collider(c);
      if (door?.collider === c) owner._door(door);
    }
    for (const s of b.solids) owner._solid(s.d, s.prop);
    for (const f of this.floors) owner._floor(f);
    if (b.firePit !== null) owner._firePit({ x: b.firePit[0], y: b.firePit[1], z: b.firePit[2] });
    this.band();
  }

  /** the door on its pivot: the leaf (far band), its hinges and battens (detail); one shadow proxy with detail shadows */
  private door(node: Extract<BakedBuildingNode<P>, { t: 'door' }>, geometries: BakedBuildingGeometries): BuildingDoor {
    const look = this.look.door, parts = this.mats.parts;
    const pivot = new THREE.Group();
    pivot.position.set(...node.pivot);
    const doorMesh = new THREE.Mesh(geometries.geometry(node.leaf), parts[look.leaf]);
    doorMesh.castShadow = this.casters === null; doorMesh.receiveShadow = true;
    pivot.add(doorMesh);
    const ironMesh = new THREE.Mesh(geometries.geometry(node.iron), parts[look.hinges]);
    ironMesh.castShadow = this.casters === null;
    pivot.add(ironMesh); this.detail.push(ironMesh);
    const battenMesh = new THREE.Mesh(geometries.geometry(node.batten), parts[look.battens]);
    battenMesh.castShadow = this.casters === null;
    pivot.add(battenMesh); this.detail.push(battenMesh);
    this.root.add(pivot); this.far.push(doorMesh);
    if (this.casters !== null) {
      // the leaf, its hinges and its battens cast as ONE proxy in the pivot (it swings with the door) while the detail band
      // is on (3 → 1 shadow draw per cascade); past it the leaf casts alone again (this.swap)
      const proxy = shadowProxy([doorMesh, ironMesh, battenMesh].map((m) => flatPositions(m.geometry)));
      if (proxy !== null) { pivot.add(proxy); this.detail.push(proxy); this.swap.push(doorMesh); }
      else doorMesh.castShadow = true;
    }
    const col = this.legacy[node.collider];
    if (col === undefined) throw new Error(`[buildings] ${node.id}: no box ${String(node.collider)}`);
    this.doorBox = col;
    const top = node.top;
    const d: BuildingDoor = {
      id: node.id, pivot, open: false, t: 0, collider: col, slab: { ...node.slab },
      interactable: { position: new THREE.Vector3(...node.use), radius: look.reach, label: look.open, onInteract: () => { /* bound below, once `d` exists */ } },
    };
    d.interactable.onInteract = () => {
      this.owner._doorUse(d, () => {
        d.open = !d.open;
        d.interactable.label = d.open ? look.close : look.open;
        col.yTop = d.open ? -1e4 : top;
      });
    };
    return d;
  }

  /** the fire pit's model copy (its depth into the near proxy with detail shadows) */
  private firePit(model: THREE.Object3D, at: Xyz, yaw: number): void {
    const pit = model.clone(true);
    pit.traverse((mesh) => {
      if (isMesh(mesh)) { mesh.castShadow = true; mesh.receiveShadow = true; if (mesh.material instanceof THREE.Material) this.sky.setupMaterial(mesh.material); }
    });
    pit.position.set(...at);
    pit.rotation.y = yaw;
    this.root.add(pit); this.detail.push(pit);
    this.firePitObj = pit;
    const casters = this.casters;
    if (casters !== null) {
      // its depth goes into the building's double-sided near proxy (its weld's), in the root's frame
      pit.updateMatrixWorld(true);
      const toRoot = this.root.matrixWorld.clone().invert(), m = new THREE.Matrix4();
      pit.traverse((mesh) => {
        if (!isMesh(mesh)) return;
        mesh.castShadow = false;
        casters.push(twoSidedPositions(mesh.geometry, m.multiplyMatrices(toRoot, mesh.matrixWorld)));
      });
    }
  }

  /** the hung lantern: the model copy (its materials plain standard ones, its glass lit by the clock) on a pivot */
  private lantern(model: THREE.Object3D, at: Xyz, ringGeo: THREE.BufferGeometry, light: BakedBuildingLight, swing: number): void {
    const look = this.look.lantern, glassName = new RegExp(look.glassName, 'i');
    const lan = model.clone(true);
    lan.traverse((mesh) => {
      if (!isMesh(mesh) || !(mesh.material instanceof THREE.MeshStandardMaterial)) return;
      mesh.castShadow = true;
      mesh.geometry = mesh.geometry.clone();
      mesh.geometry.deleteAttribute('tangent');
      const mat = mesh.material;
      if (mat.transparent || glassName.test(mat.name)) {
        const g = look.glass;
        const glassMat = new THREE.MeshStandardMaterial({ color: g.color, emissive: new THREE.Color(...g.emissive), emissiveIntensity: g.emissiveIntensity, roughness: g.roughness, metalness: g.metalness, transparent: true, opacity: g.opacity });
        mesh.material = glassMat;
        this.sky.setupMaterial(glassMat); // lit like everything else: one shared program instead of its own non-CSM one
        this.owner._lamp(glassMat, g.emissiveIntensity);
        mesh.castShadow = false;
      } else {
        const f = look.frame;
        mesh.material = new THREE.MeshStandardMaterial({ map: mat.map, normalMap: mat.normalMap, roughnessMap: mat.roughnessMap, metalnessMap: mat.metalnessMap, aoMap: mat.aoMap, metalness: f.metalness, roughness: f.roughness, color: f.color });
        this.sky.setupMaterial(mesh.material);
      }
    });
    const pivot = new THREE.Group();
    pivot.position.set(...at);
    lan.position.set(0, look.drop, 0);
    lan.scale.setScalar(look.scale);
    const ring = new THREE.Mesh(ringGeo, this.mats.parts[look.ring]);
    ring.position.y = look.ringY;
    pivot.add(lan, ring);
    this.pointLight(pivot, light);
    this.root.add(pivot);
    this.detail.push(lan, ring); // never the pivot: its light must stay visible (a changing light count recompiles every shader)
    this.lanternObj = lan;
    this.owner._swing({ pivot, seed: swing });
  }

  /** a flickering point light under `parent`: a real light when standalone without pooled lights, else an anchor */
  private pointLight(parent: THREE.Object3D, l: BakedBuildingLight): void {
    const [x, y, z] = l.at;
    if (this.tier.sharedLights || this.role !== 'standalone') {
      const anchor = new THREE.Object3D(); anchor.position.set(x, y, z); parent.add(anchor);
      this.anchors.push({ anchor, color: l.color, intensity: l.intensity, distance: l.distance, decay: l.decay, seed: l.seed, kind: l.kind, rank: l.rank });
      this.anchors.sort((a, b) => a.rank - b.rank);
      return;
    }
    const light = new THREE.PointLight(l.color, l.intensity, l.distance, l.decay);
    light.position.set(x, y, z); parent.add(light);
    this.owner._fire({ light, base: l.intensity, seed: l.seed, kind: l.kind });
  }

  /**
   * Its own objects' bands (the weld culls them, src/engine/models/place.ts `finishWeld`): the detail set within the detail
   * distance, the far set within twice it; a swap caster casts only past the detail distance (its near proxy draws its
   * depth nearer). Without detail shadows, the detail set casts none.
   */
  private band(): void {
    const dd = this.tier.detailDist;
    for (const o of this.detail) o.userData['until'] = dd;
    for (const o of this.far) o.userData['until'] = dd * 2;
    for (const o of this.swap) o.userData['castFrom'] = dd;
    if (this.role !== 'specimen' && !this.tier.detailShadows) for (const o of this.detail) o.traverse((c) => { c.castShadow = false; });
  }

  /**
   * Its parts for `place` to merge, per material in the order they first came, then the glass: the detail set within the
   * detail distance (its depth only in the near proxy), the far set within twice it, the rest at every distance — those
   * two cast through their band's position-only proxy. The glass casts none.
   */
  weldParts(): WeldPart[] {
    const dd = this.tier.detailDist, out: WeldPart[] = [];
    for (const [key, geometry] of this.parts) {
      const material = this.mats.parts[key], geometries = [geometry];
      if (this.look.detail.includes(key)) out.push({ material, geometries, until: dd, depth: 'near', receiveShadow: true, castShadow: this.role === 'specimen' && this.casters === null });
      else if (this.look.far.includes(key)) out.push({ material, geometries, until: dd * 2, depth: 'proxy', receiveShadow: true });
      else out.push({ material, geometries, depth: 'proxy', receiveShadow: true });
    }
    // a building drawn alone draws each window group as its own mesh; a member's panes join the settlement's one
    const glass = { material: this.mats.glass, until: dd, receiveShadow: true, renderOrder: 2 };
    if (this.role === 'member') { if (this.glass.length > 0) out.push({ ...glass, geometries: this.glass }); }
    else this.glass.forEach((geometry, i) => { out.push({ ...glass, geometries: [geometry], key: `glass-${String(i)}` }); });
    return out;
  }

  /** its colliders, world space: its legacy boxes but the door's, then its static solids but its props' (their models' own) */
  colliderDescs(): ColliderDesc[] {
    return [...this.legacy.filter((c) => c !== this.doorBox).map((c) => boxDesc(c)), ...this.solids.filter((s) => !s.prop).map((s) => s.d)];
  }

  /** what it hands `place` (src/engine/models/weld.ts `WeldBuild`) */
  weldBuild(): WeldBuild {
    const root = this.root, floors = this.floors, deck = this.look.deck;
    return { root, parts: this.weldParts(), ...(this.casters === null ? {} : { casters: this.casters }), colliders: this.colliderDescs(),
      box: (target) => buildingBox(root, floors, deck, target) };
  }
}

/** a particle cloud: one instanced quad per seed row */
function particles(mat: THREE.ShaderMaterial, seeds: THREE.BufferGeometry, bounds: BakedBuildingLook['particles']): THREE.Mesh {
  const geo = new THREE.InstancedBufferGeometry();
  const quad = new THREE.PlaneGeometry(1, 1);
  geo.setAttribute('position', quad.getAttribute('position'));
  geo.setAttribute('uv', quad.getAttribute('uv'));
  geo.setIndex(quad.index);
  const seed = seeds.getAttribute('seed');
  geo.setAttribute('seed', new THREE.InstancedBufferAttribute(Float32Array.from({ length: seed.count * 4 }, (_, i) => seed.getComponent(Math.floor(i / 4), i % 4)), 4));
  geo.instanceCount = seed.count;
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(...bounds.center), bounds.radius);
  return new THREE.Mesh(geo, mat);
}

/** a building's world box: what its root draws, and its decks' rectangles from `deck[0]` below to `deck[1]` above */
function buildingBox(root: THREE.Object3D, floors: readonly BuildingFloor[], deck: BakedBuildingLook['deck'], box: THREE.Box3): THREE.Box3 {
  box.setFromObject(root);
  const p = new THREE.Vector3();
  for (const f of floors) {
    const c = Math.cos(f.rot), s = Math.sin(f.rot);
    for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const) {
      const lx = sx * f.hw, lz = sz * f.hd;
      box.expandByPoint(p.set(f.x + lx * c + lz * s, f.y - deck[0], f.z - lx * s + lz * c));
      box.expandByPoint(p.set(f.x + lx * c + lz * s, f.y + deck[1], f.z - lx * s + lz * c));
    }
  }
  return box;
}
