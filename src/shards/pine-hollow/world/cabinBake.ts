/**
 * Pine Hollow's log buildings drawn from their offline bake (G285, SF72 "bake the code-built worlds"). The shapes are built
 * at build time (`../generators/logCabin.ts`, `scripts/bake-pine-cabins.mjs`): the binary holds every geometry (zlib, read
 * behind the loading screen), `../data/cabins.json` every building's record. Here a record becomes the building the
 * homestead (./homestead.ts) and `place` (./cabins.ts) work with: its root with what draws on its own (the door on its pivot,
 * the glows, the fire pit and lantern model copies, smoke and flames, the wheel, its lights or the phone's anchors), its
 * parts per material for the weld, its colliders, floors and live parts handed to its owner, in the order the builder
 * handed them.
 */
import * as THREE from 'three';
import * as v from 'valibot';
import { TIER_CONFIG } from '@wildshard/engine/core/tier';
import { flatPositions, shadowProxy, twoSidedPositions, type WeldBuild, type WeldPart } from '@wildshard/engine/models/weld';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import { boxDesc, type ColliderDesc } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import rows from '../data/cabins.json' with { type: 'json' };
import { CabinRowsSchema, type CabinRows, type BakedBuilding, type BakedLight, type BakedNode, type Door, type Fire, type Floor, type KitMat, type LightAnchor, type PropKind, type Room, type Swing } from './logKit';
import type { Mats } from './homestead';

/** the bake's binary (`scripts/bake-pine-cabins.mjs`); listed in the boot's world reads (../boot/files.ts) */
export const CABIN_BAKE_URL = '/assets/pine-hollow/baked/cabins.bin';
/** the bake's rows, parsed strictly once */
export const CABIN_ROWS: CabinRows = v.parse(CabinRowsSchema, rows);

/** The decoded binary: each geometry's blocks, read fresh for every building built from it (nothing is shared). */
export class CabinGeometries {
  private readonly at: number[] = [];
  private readonly buffer: ArrayBuffer;
  constructor(bytes: Uint8Array) {
    if (bytes.length !== CABIN_ROWS.bytes) throw new Error(`[cabins] the bake holds ${String(bytes.length)} bytes, its rows ${String(CABIN_ROWS.bytes)}`);
    this.buffer = new ArrayBuffer(bytes.length); new Uint8Array(this.buffer).set(bytes);
    let offset = 0;
    const pad = (n: number): number => Math.ceil(n / 4) * 4;
    for (const g of CABIN_ROWS.geometries) {
      this.at.push(offset);
      for (const [, size] of g.attrs) offset += pad(g.unique * size * 4);
      offset += pad(g.indexCount * (g.own === 'u32' || (g.own === null && g.unique >= 65536) ? 4 : 2));
    }
    if (offset !== bytes.length) throw new Error('[cabins] the bake does not match its rows');
  }
  /** geometry `i` as the builder made it: a copy its caller owns */
  geometry(i: number): THREE.BufferGeometry {
    const row = CABIN_ROWS.geometries[i], start = this.at[i];
    if (row === undefined || start === undefined) throw new Error(`[cabins] no baked geometry ${String(i)}`);
    let offset = start;
    const blocks = row.attrs.map(([, size]) => { const a = new Float32Array(this.buffer, offset, row.unique * size); offset += Math.ceil(a.byteLength / 4) * 4; return a; });
    const wide = row.own === 'u32' || (row.own === null && row.unique >= 65536);
    const index = wide ? new Uint32Array(this.buffer, offset, row.indexCount) : new Uint16Array(this.buffer, offset, row.indexCount);
    const g = new THREE.BufferGeometry();
    row.attrs.forEach(([name, size], k) => {
      const block = blocks[k];
      if (block === undefined) return;
      if (row.own !== null) { g.setAttribute(name, new THREE.BufferAttribute(block.slice(), size)); return; }
      const out = new Float32Array(row.count * size);
      for (let j = 0; j < row.count; j++) { const src = (index[j] ?? 0) * size; for (let c = 0; c < size; c++) out[j * size + c] = block[src + c] ?? 0; }
      g.setAttribute(name, new THREE.BufferAttribute(out, size));
    });
    if (row.own !== null) g.setIndex(new THREE.BufferAttribute(index.slice(), 1));
    return g;
  }
}

/** the hamlet's roofs for the map: each building's footprint (+1 m of eave), turned with it */
export function hamletRoofs(): { x: number; z: number; rot: number; w: number; d: number }[] {
  return CABIN_ROWS.buildings.filter((b) => b.hamlet).map((b) => ({ x: b.at[0], z: b.at[2], rot: b.rot, w: b.size[1] + 1, d: b.size[0] + 1 }));
}

/** Fetch and inflate the bake; a bake that fails to load is a page fault (`console.error`), and the buildings stand absent. */
export async function loadCabinBake(): Promise<CabinGeometries | null> {
  try {
    const response = await fetch(CABIN_BAKE_URL);
    if (!response.ok || response.body === null) throw new Error(`${String(response.status)} ${CABIN_BAKE_URL}`);
    return new CabinGeometries(new Uint8Array(await new Response(response.body.pipeThrough(new DecompressionStream('deflate'))).arrayBuffer()));
  } catch (error: unknown) {
    console.error('[pine-hollow] the baked log buildings did not load:', error);
    return null;
  }
}

/**
 * What a log building hands its owner as it is assembled (its live parts: doors, fires, lamps, the mill wheel, the floors
 * and the static boxes): the homestead (./homestead.ts `Cabins`). A specimen's owner keeps nothing (`NO_OWNER`).
 */
export interface BuildingOwner {
  readonly _collider: (c: Collider) => void;
  readonly _solid: (d: ColliderDesc, prop: boolean) => void;
  readonly _floor: (f: Floor) => void;
  readonly _door: (d: Door) => void;
  /** a door's use: the owner moves it (`toggle`) unless it is barred, and tells its listeners */
  readonly _doorUse: (d: Door, toggle: () => void) => void;
  readonly _fire: (f: Fire) => void;
  readonly _lamp: (mat: THREE.MeshStandardMaterial, full: number) => void;
  readonly _swing: (sw: Swing) => void;
  readonly _particles: (m: THREE.ShaderMaterial) => void;
  readonly _wheel: (o: THREE.Object3D) => void;
  readonly _firePit: (at: { x: number; y: number; z: number }) => void;
}

export const NO_OWNER: BuildingOwner = {
  _collider: () => undefined, _solid: () => undefined, _floor: () => undefined, _door: () => undefined, _doorUse: (_d, toggle) => { toggle(); }, _fire: () => undefined,
  _lamp: () => undefined, _swing: () => undefined, _particles: () => undefined, _wheel: () => undefined, _firePit: () => undefined,
};

/**
 * `cabin`: one of the three, its lights real on a tier with them; `member`: a mill-hamlet building (welded into the
 * hamlet's one unit), its lights anchors only; `specimen`: the Model Explorer's copy, lights as anchors, drawn alone.
 */
export type BuildingRole = 'cabin' | 'member' | 'specimen';

/** small parts drawn only within the detail distance (TIER_CONFIG.cabinDetailDist): their depth only through the near proxy */
export const DETAIL_KEYS = new Set<KitMat>(['iron', 'cloth', 'char', 'chink']);
/** merged parts that go past 2× the detail distance (log ends, woodpile bark, door frame) */
export const FAR_KEYS = new Set<KitMat>(['endGrain', 'bark', 'door']);

const isMesh = (o: THREE.Object3D): o is THREE.Mesh => 'isMesh' in o;
const matrix = (e: readonly number[]): THREE.Matrix4 => new THREE.Matrix4().fromArray(e);
const PARTICLE_SPHERE = new THREE.Sphere(new THREE.Vector3(0, 5, 0), 18);

/**
 * One log building assembled from its record where it stands: its root with what draws on its own, its parts per material
 * for `place` to merge (src/engine/models/weld.ts), its live parts handed to its owner.
 */
export class LogBuilding {
  readonly root = new THREE.Group();
  /** small parts drawn only within TIER_CONFIG.cabinDetailDist (tagged `userData.until` by `band`) */
  readonly detail: THREE.Object3D[] = [];
  /** mid parts drawn only within 2× cabinDetailDist */
  readonly far: THREE.Object3D[] = [];
  /** desktop: its double-sided dressing's depth for its near proxy (the fire pit here, its props from the homestead); null on
   *  the phone, whose detail casts no shadow */
  readonly casters: THREE.BufferGeometry[] | null = TIER_CONFIG.cabinDetailShadows ? [] : null;
  /** casters whose shadow a near proxy draws while the detail band is on: they cast only past it (tagged `castFrom`) */
  readonly swap: THREE.Object3D[] = [];
  /** phone tier: where this cabin's point lights would be (see Cabins.sharedLights) */
  readonly anchors: LightAnchor[] = [];
  readonly rooms: readonly Room[];
  readonly doorAt: [number, number];
  /** its walkable floors and decks, world space (Cabins.floorHeightAt; its piece's floor) */
  readonly floors: readonly Floor[];
  /** the props it set about (world matrices) */
  readonly props: Record<PropKind, THREE.Matrix4[]>;
  firePitObj: THREE.Object3D | null = null;
  lanternObj: THREE.Object3D | null = null;
  private readonly parts: [KitMat, THREE.BufferGeometry][];
  private readonly glass: THREE.BufferGeometry[];
  private readonly legacy: Collider[];
  private doorBox: Collider | null = null;
  private readonly role: BuildingRole;
  private readonly owner: BuildingOwner;
  private readonly mats: Mats;
  private readonly sky: Pick<Sky, 'setupMaterial'>;
  private readonly solids: BakedBuilding['solids'];

  constructor(owner: BuildingOwner, b: BakedBuilding, geometries: CabinGeometries, mats: Mats, sky: Pick<Sky, 'setupMaterial'>, models: { firePit: THREE.Object3D; lantern: THREE.Object3D }, role: BuildingRole) {
    this.owner = owner; this.mats = mats; this.sky = sky; this.role = role; this.solids = b.solids;
    const [cx, cy, cz] = b.at;
    this.root.position.set(cx, cy, cz);
    this.root.rotation.y = b.rot;
    this.root.updateMatrixWorld(true);
    this.rooms = b.rooms; this.doorAt = [b.doorAt[0], b.doorAt[1]];
    this.floors = b.floors.map((f) => ({ ...f }));
    this.legacy = b.colliders.map((c) => ({ ...c }));
    this.parts = b.parts.map(([key, g]) => [key, geometries.geometry(g)]);
    this.glass = b.glass.map((g) => geometries.geometry(g));
    this.props = { crate: b.props.crate.map(matrix), barrel: b.props.barrel.map(matrix), bucket: b.props.bucket.map(matrix), hatchet: b.props.hatchet.map(matrix) };
    let door: Door | null = null;
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
          const p = particles(mats[node.mat], geometries.geometry(node.seeds));
          p.position.set(...node.at); p.renderOrder = node.order;
          this.root.add(p); if (node.detail) this.detail.push(p);
          owner._particles(mats[node.mat]);
          break;
        }
        case 'lantern': this.lantern(models.lantern, node.pivot, geometries.geometry(node.ring), node.light, node.swing); break;
        case 'wheel': {
          const pivot = new THREE.Group();
          pivot.position.set(...node.at); pivot.rotation.y = node.yaw;
          const geo = geometries.geometry(node.g); geo.computeBoundingSphere();
          const wheel = new THREE.Mesh(geo, mats.beam);
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

  /** the door on its pivot: the leaf (far band), its strap hinges and battens (detail); one shadow proxy on the desktop */
  private door(node: Extract<BakedNode, { t: 'door' }>, geometries: CabinGeometries): Door {
    const pivot = new THREE.Group();
    pivot.position.set(...node.pivot);
    const doorMesh = new THREE.Mesh(geometries.geometry(node.leaf), this.mats.door);
    doorMesh.castShadow = this.casters === null; doorMesh.receiveShadow = true;
    pivot.add(doorMesh);
    const ironMesh = new THREE.Mesh(geometries.geometry(node.iron), this.mats.iron);
    ironMesh.castShadow = this.casters === null;
    pivot.add(ironMesh); this.detail.push(ironMesh);
    const battenMesh = new THREE.Mesh(geometries.geometry(node.batten), this.mats.beam);
    battenMesh.castShadow = this.casters === null;
    pivot.add(battenMesh); this.detail.push(battenMesh);
    this.root.add(pivot); this.far.push(doorMesh);
    if (this.casters !== null) {
      // desktop: the leaf, its strap hinges and its battens cast as ONE proxy in the pivot (it swings with the door) while
      // the detail LOD is on (3 → 1 shadow draw per cascade); past it the leaf casts alone again, as before (this.swap)
      const proxy = shadowProxy([doorMesh, ironMesh, battenMesh].map((m) => flatPositions(m.geometry)));
      if (proxy !== null) { pivot.add(proxy); this.detail.push(proxy); this.swap.push(doorMesh); }
      else doorMesh.castShadow = true;
    }
    const col = this.legacy[node.collider];
    if (col === undefined) throw new Error(`[cabins] ${node.id}: no box ${String(node.collider)}`);
    this.doorBox = col;
    const top = node.top;
    const d: Door = {
      id: node.id, pivot, open: false, t: 0, collider: col, slab: { ...node.slab },
      interactable: { position: new THREE.Vector3(...node.use), radius: 2.4, label: 'Open door', onInteract: () => { /* bound below, once `d` exists */ } },
    };
    d.interactable.onInteract = () => {
      this.owner._doorUse(d, () => {
        d.open = !d.open;
        d.interactable.label = d.open ? 'Close door' : 'Open door';
        col.yTop = d.open ? -1e4 : top;
      });
    };
    return d;
  }

  /** the stone fire pit's model copy (its depth into the near proxy on the desktop) */
  private firePit(model: THREE.Object3D, at: readonly [number, number, number], yaw: number): void {
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
      // desktop: its depth goes into the building's double-sided near proxy (its weld's), in the root's frame
      pit.updateMatrixWorld(true);
      const toRoot = this.root.matrixWorld.clone().invert(), m = new THREE.Matrix4();
      pit.traverse((mesh) => {
        if (!isMesh(mesh)) return;
        mesh.castShadow = false;
        casters.push(twoSidedPositions(mesh.geometry, m.multiplyMatrices(toRoot, mesh.matrixWorld)));
      });
    }
  }

  /** the hanging porch lantern: the model copy (its materials plain standard ones, its glass lit by the clock) on a pivot */
  private lantern(model: THREE.Object3D, at: readonly [number, number, number], ringGeo: THREE.BufferGeometry, light: BakedLight, swing: number): void {
    const lan = model.clone(true);
    lan.traverse((mesh) => {
      if (!isMesh(mesh) || !(mesh.material instanceof THREE.MeshStandardMaterial)) return;
      mesh.castShadow = true;
      // rebuild the materials as plain MeshStandardMaterials (the glTF's physical brass + tangents
      // produced NaN fragments that bloom smeared over the whole frame)
      mesh.geometry = mesh.geometry.clone();
      mesh.geometry.deleteAttribute('tangent');
      const mat = mesh.material;
      if (mat.transparent || /glass/i.test(mat.name)) {
        const glassMat = new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: new THREE.Color(1.0, 0.72, 0.4), emissiveIntensity: 3.0, roughness: 0.2, metalness: 0, transparent: true, opacity: 0.85 });
        mesh.material = glassMat;
        this.sky.setupMaterial(glassMat); // lit like everything else: one shared program instead of its own non-CSM one
        this.owner._lamp(glassMat, 3.0);
        mesh.castShadow = false;
      } else {
        mesh.material = new THREE.MeshStandardMaterial({ map: mat.map, normalMap: mat.normalMap, roughnessMap: mat.roughnessMap, metalnessMap: mat.metalnessMap, aoMap: mat.aoMap, metalness: 0.9, roughness: 1, color: 0xd8b070 });
        this.sky.setupMaterial(mesh.material);
      }
    });
    const pivot = new THREE.Group();
    pivot.position.set(...at);
    lan.position.set(0, -0.46, 0);
    lan.scale.setScalar(1.35);
    const ring = new THREE.Mesh(ringGeo, this.mats.iron);
    ring.position.y = -0.03;
    pivot.add(lan, ring);
    this.pointLight(pivot, light);
    this.root.add(pivot);
    this.detail.push(lan, ring); // never the pivot: its light must stay visible (a changing light count recompiles every shader)
    this.lanternObj = lan;
    this.owner._swing({ pivot, seed: swing });
  }

  /** a flickering point light under `parent` — a real light on desktop, an anchor for the shared set on the phone (and for a
   *  hamlet building or a specimen on every tier) */
  private pointLight(parent: THREE.Object3D, l: BakedLight): void {
    const [x, y, z] = l.at;
    if (TIER_CONFIG.sharedCabinLights || this.role !== 'cabin') {
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
   * depth nearer). On a tier without detail shadows, the detail set casts none.
   */
  private band(): void {
    const dd = TIER_CONFIG.cabinDetailDist;
    for (const o of this.detail) o.userData['until'] = dd;
    for (const o of this.far) o.userData['until'] = dd * 2;
    for (const o of this.swap) o.userData['castFrom'] = dd;
    if (this.role !== 'specimen' && !TIER_CONFIG.cabinDetailShadows) for (const o of this.detail) o.traverse((c) => { c.castShadow = false; });
  }

  /**
   * Its parts for `place` to merge, per material in the order they first came, then the glass: the detail set within
   * the detail distance (its depth only in the near proxy), the far set within twice it, the rest at every distance —
   * those two cast through their band's position-only proxy. The glass casts none.
   */
  weldParts(): WeldPart[] {
    const dd = TIER_CONFIG.cabinDetailDist, out: WeldPart[] = [];
    for (const [key, geometry] of this.parts) {
      const material = this.mats[key], geometries = [geometry];
      if (DETAIL_KEYS.has(key)) out.push({ material, geometries, until: dd, depth: 'near', receiveShadow: true, castShadow: this.role === 'specimen' && this.casters === null });
      else if (FAR_KEYS.has(key)) out.push({ material, geometries, until: dd * 2, depth: 'proxy', receiveShadow: true });
      else out.push({ material, geometries, depth: 'proxy', receiveShadow: true });
    }
    // a building drawn alone draws each window group as its own mesh; a hamlet building's panes join the hamlet's one
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
    const root = this.root, floors = this.floors;
    return { root, parts: this.weldParts(), ...(this.casters === null ? {} : { casters: this.casters }), colliders: this.colliderDescs(),
      box: (target) => buildingBox(root, floors, target) };
  }
}

/** a particle cloud: one instanced quad per seed row (the builder's `makeParticles`) */
function particles(mat: THREE.ShaderMaterial, seeds: THREE.BufferGeometry): THREE.Mesh {
  const geo = new THREE.InstancedBufferGeometry();
  const quad = new THREE.PlaneGeometry(1, 1);
  geo.setAttribute('position', quad.getAttribute('position'));
  geo.setAttribute('uv', quad.getAttribute('uv'));
  geo.setIndex(quad.index);
  const seed = seeds.getAttribute('seed');
  geo.setAttribute('seed', new THREE.InstancedBufferAttribute(Float32Array.from({ length: seed.count * 4 }, (_, i) => seed.getComponent(Math.floor(i / 4), i % 4)), 4));
  geo.instanceCount = seed.count;
  geo.boundingSphere = PARTICLE_SPHERE.clone();
  return new THREE.Mesh(geo, mat);
}

/** a building's world box: what its root draws, and its decks' rectangles up to its ridge */
function buildingBox(root: THREE.Object3D, floors: readonly Floor[], box: THREE.Box3): THREE.Box3 {
  box.setFromObject(root);
  const p = new THREE.Vector3();
  for (const f of floors) {
    const c = Math.cos(f.rot), s = Math.sin(f.rot);
    for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const) {
      const lx = sx * f.hw, lz = sz * f.hd;
      box.expandByPoint(p.set(f.x + lx * c + lz * s, f.y - 0.3, f.z - lx * s + lz * c));
      box.expandByPoint(p.set(f.x + lx * c + lz * s, f.y + 4.5, f.z - lx * s + lz * c));
    }
  }
  return box;
}
