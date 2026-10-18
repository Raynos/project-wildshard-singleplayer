/** Author-only native building operations, isolated from all live owners/services.
 * The independent native assembly oracle checks these geometry and append-order
 * operations; this module never imports runtime, engine or game code. */
import * as THREE from 'three';
import { admitBuildingAssembly, emptyBuildingLifeRows, type BuildingAssemblyRows, type BakedBuildingLight, type BakedBuildingNode, type BakedBuildingRecord, type BakedBuildingLook, type BakedBuildingRole, type BakedBuildingTier, type BuildingFloor, type BuildingRoom, type BuildingBox, type BuildingCollider, type BuildingCloudRow, type Xyz } from '@wildshard/format/buildings';
import { cabinShadowProxy, cabinFlatPositions, cabinTwoSidedPositions, type CabinWeldPart, type CabinWeldCopy } from './cabinWeld';

const isMesh = (node: THREE.Object3D): node is THREE.Mesh => node instanceof THREE.Mesh;
interface BuildingLightAnchor { readonly anchor: THREE.Object3D; readonly color: number; readonly intensity: number; readonly distance: number; readonly decay: number; readonly seed: number; readonly kind: 'fire' | 'lamp'; readonly rank: number }
interface CabinBuiltWeld extends CabinWeldCopy { readonly colliders: readonly BuildingCollider[]; readonly box: (target: THREE.Box3) => THREE.Box3 }
export interface CabinDerivedMaterial { readonly material: THREE.Material; readonly source: THREE.Material | undefined; readonly properties: Readonly<Record<string, number | boolean | readonly number[]>> }

/** Pure author resource names; no page scope, registry, texture load or renderer. */
export class CabinAuthorResources {
  private readonly values = new Map<string, THREE.Object3D | THREE.Material | THREE.BufferGeometry>();
  private readonly names = new Map<THREE.Object3D | THREE.Material | THREE.BufferGeometry, string>();
  readonly materials: CabinDerivedMaterial[] = [];
  readonly clouds = new Map<THREE.Mesh, Float32Array>();
  readonly sky = { setupMaterial(material: THREE.Material): void { void material; } };
  constructor(readonly prefix: string, readonly shadow: THREE.Material) {}
  register(id: string, value: THREE.Object3D | THREE.Material | THREE.BufferGeometry): string {
    if (this.values.has(id)) throw new Error('Duplicate cabin author resource');
    this.values.set(id, value); this.names.set(value, id); return id;
  }
  lend(value: THREE.Object3D | THREE.Material | THREE.BufferGeometry): string {
    const previous = this.names.get(value);
    return previous ?? this.register(`${this.prefix}.resource-${String(this.values.size)}`, value);
  }
  /** Borrow named native objects for the live-scene recorder only. */
  entries(): readonly (readonly [string, THREE.Object3D | THREE.Material | THREE.BufferGeometry])[] { return [...this.values.entries()]; }
  geometry(id: string): THREE.BufferGeometry { const value = this.values.get(id); if (!(value instanceof THREE.BufferGeometry)) throw new Error('Missing cabin author geometry'); return value; }
  object(id: string): THREE.Object3D { const value = this.values.get(id); if (!(value instanceof THREE.Object3D)) throw new Error('Missing cabin author object'); return value; }
  material(id: string): THREE.Material { const value = this.values.get(id); if (!(value instanceof THREE.Material)) throw new Error('Missing cabin author material'); return value; }
  standard(id: string): THREE.MeshStandardMaterial { const value = this.material(id); if (!(value instanceof THREE.MeshStandardMaterial)) throw new Error('Expected cabin standard material'); return value; }
  basic(id: string): THREE.MeshBasicMaterial { const value = this.material(id); if (!(value instanceof THREE.MeshBasicMaterial)) throw new Error('Expected cabin basic material'); return value; }
  derived(material: THREE.Material, source: THREE.Material | undefined, properties: CabinDerivedMaterial['properties']): void { this.materials.push({ material, source, properties }); }
}
function boxDesc(box: BuildingBox): BuildingCollider {
  return { kind: 'box', x: box.x, y: (box.yTop + box.yBottom) / 2, z: box.z, hx: box.hw, hy: Math.max(0.005, (box.yTop - box.yBottom) / 2), hz: box.hd, yaw: -box.rot };
}
function createCabinCloud(resources: CabinAuthorResources, row: BuildingCloudRow): THREE.Mesh {
  if (!Array.isArray(row.at) || row.parent !== undefined) throw new Error('Cabin author cloud requires its local point');
  const source = resources.geometry(row.geometry), seed = source.getAttribute('seed');
  if (!row.seeds || seed.itemSize !== 4) throw new Error('Native cabin cloud omitted four-float seeds');
  const quad = new THREE.PlaneGeometry(1, 1), geometry = new THREE.InstancedBufferGeometry();
  geometry.index = quad.index; geometry.setAttribute('position', quad.getAttribute('position')); geometry.setAttribute('uv', quad.getAttribute('uv'));
  const seeds = Float32Array.from({ length: seed.count * 4 }, (_, i) => seed.getComponent(Math.floor(i / 4), i % 4));
  geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4)); geometry.instanceCount = seed.count;
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(...row.center), row.radius);
  const mesh = new THREE.Mesh(geometry, row.material === null ? undefined : resources.material(row.material));
  mesh.name = row.name; mesh.position.fromArray(row.at); mesh.renderOrder = row.order; mesh.visible = row.visible;
  resources.clouds.set(mesh, seeds); return mesh;
}

export class CabinAuthorAssembly<K extends string = string, P extends string = string> {
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
  private readonly legacy: BuildingBox[];
  private readonly doorBoxes = new Set<BuildingBox>();
  private readonly role: BakedBuildingRole;
  readonly lifeRows = emptyBuildingLifeRows();
  private readonly id: string;
  private readonly mats: { parts: Record<K, THREE.Material>; particles: Record<P, THREE.Material>; glass: THREE.MeshStandardMaterial; glow: THREE.MeshBasicMaterial };
  private readonly sky: CabinAuthorResources['sky'];
  private readonly solids: BakedBuildingRecord<K, P>['solids'];
  private readonly look: BakedBuildingLook<K>;
  private readonly tier: BakedBuildingTier;

  /** `input` the record, its pack, materials, sky, models, role, look row and tier */
  constructor(private readonly resources: CabinAuthorResources, input: BuildingAssemblyRows<K, P>) {
    admitBuildingAssembly(input);
    const { record: b, role } = input;
    const ordinals = [...b.parts.map(([, index]) => index), ...b.glass,
      ...b.nodes.flatMap(node => node.t === 'door' ? [node.leaf, node.iron, node.batten] : node.t === 'glow' || node.t === 'wheel' ? [node.g] : node.t === 'particles' ? [node.seeds] : node.t === 'lantern' ? [node.ring] : [])];
    for (const ordinal of ordinals) { const id = input.geometry[String(ordinal)]; if (id === undefined) throw new Error('Missing building geometry id'); resources.geometry(id); }
    for (const node of b.nodes) if (node.t === 'door' && b.colliders[node.collider] === undefined) throw new Error(`[buildings] ${node.id}: no box ${String(node.collider)}`);
    const partKeys = [...b.parts.map(([key]) => key), ...b.nodes.flatMap(node => node.t === 'door' ? [input.look.door.leaf, input.look.door.hinges, input.look.door.battens] : node.t === 'wheel' ? [input.look.wheel] : node.t === 'lantern' ? [input.look.lantern.ring] : [])];
    for (const key of partKeys) if (!Object.hasOwn(input.materials.parts, key)) throw new Error('Missing building part material');
    for (const node of b.nodes) if (node.t === 'particles' && !Object.hasOwn(input.materials.particles, node.mat)) throw new Error('Missing building particle material');
    const geometry = (index: number): THREE.BufferGeometry => {
      const id = input.geometry[String(index)]; if (id === undefined) throw new Error('Missing building geometry id');
      return resources.geometry(id).clone();
    };
    const geometries = { geometry };
    const entries = <T extends string>(refs: Readonly<Record<T, string>>): Record<T, THREE.Material> => Object.fromEntries(Object.entries<string>(refs).map(([key, id]) => [key, resources.material(id)])) as Record<T, THREE.Material>;
    const mats = { parts: entries(input.materials.parts), particles: entries(input.materials.particles), glass: resources.standard(input.materials.glass), glow: resources.basic(input.materials.glow) };
    const sky = resources.sky, models = { firePit: resources.object(input.models.firePit), lantern: resources.object(input.models.lantern) };
    this.id = input.id;
    this.casters = input.tier.detailShadows ? [] : null;
    this.mats = mats; this.sky = sky; this.role = role; this.solids = b.solids; this.look = input.look; this.tier = input.tier;
    const [cx, cy, cz] = b.at;
    this.root.position.set(cx, cy, cz);
    this.root.rotation.y = b.rot;
    this.root.updateMatrixWorld(true);
    this.rooms = b.rooms; this.doorAt = [b.doorAt[0], b.doorAt[1]];
    this.floors = b.floors.map((f) => ({ ...f }));
    this.legacy = b.colliders.map((c) => ({ ...c }));
    this.parts = b.parts.map(([key, g]) => [key, geometries.geometry(g)]);
    this.glass = b.glass.map((g) => geometries.geometry(g));
    for (const node of b.nodes) {
      switch (node.t) {
        case 'door': this.door(node, geometries); break;
        case 'glow': {
          const glow = new THREE.Mesh(geometries.geometry(node.g), mats.glow);
          glow.position.set(...node.at); glow.rotation.y = node.yaw;
          this.root.add(glow); this.detail.push(glow);
          break;
        }
        case 'pit': this.firePit(models.firePit, node.at, node.yaw); break;
        case 'particles': {
          const source = input.geometry[String(node.seeds)]; if (source === undefined) throw new Error('Missing building cloud geometry');
          const p = createCabinCloud(resources, { geometry: source, material: resources.lend(mats.particles[node.mat]),
            seeds: true, name: '', at: node.at, center: this.look.particles.center, radius: this.look.particles.radius, order: node.order, visible: true });
          this.root.add(p); if (node.detail) this.detail.push(p);
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
          this.lifeRows.wheels.push({ id: `${this.id}.wheel-${String(this.lifeRows.wheels.length)}`, object: resources.lend(wheel) });
          break;
        }
        case 'light': this.pointLight(this.root, node.light); break;
        default: break;
      }
    }
    // The door has already validated its legacy box; audio floors and fire emitters are separate product rows.
    // All static boxes remain on this assembly's weld; the life owner does not register them.
    this.band();
  }

  /** the door on its pivot: the leaf (far band), its hinges and battens (detail); one shadow proxy with detail shadows */
  private door(node: Extract<BakedBuildingNode<P>, { t: 'door' }>, geometries: { geometry: (index: number) => THREE.BufferGeometry }): void {
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
      const proxy = cabinShadowProxy([doorMesh, ironMesh, battenMesh].map((m) => cabinFlatPositions(m.geometry)), this.resources.shadow);
      if (proxy !== null) { pivot.add(proxy); this.detail.push(proxy); this.swap.push(doorMesh); }
      else doorMesh.castShadow = true;
    }
    const col = this.legacy[node.collider];
    if (col === undefined) throw new Error(`[buildings] ${node.id}: no box ${String(node.collider)}`);
    this.doorBoxes.add(col);
    this.lifeRows.doors.push({ id: node.id, pivot: this.resources.lend(pivot),
      at: [...node.use], reach: look.reach, open: look.open, close: look.close, slab: { ...node.slab } });
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
        casters.push(cabinTwoSidedPositions(mesh.geometry, m.multiplyMatrices(toRoot, mesh.matrixWorld)));
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
        this.resources.derived(glassMat, undefined, { color: g.color, emissive: [...g.emissive], emissiveIntensity: g.emissiveIntensity, roughness: g.roughness, metalness: g.metalness, transparent: true, opacity: g.opacity });
        this.lifeRows.lamps.push({ material: this.resources.lend(glassMat), full: g.emissiveIntensity });
        mesh.castShadow = false;
      } else {
        const f = look.frame;
        mesh.material = new THREE.MeshStandardMaterial({ map: mat.map, normalMap: mat.normalMap, roughnessMap: mat.roughnessMap, metalnessMap: mat.metalnessMap, aoMap: mat.aoMap, metalness: f.metalness, roughness: f.roughness, color: f.color });
        this.resources.derived(mesh.material, mat, { metalness: f.metalness, roughness: f.roughness, color: f.color });
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
    this.lifeRows.swings.push({ pivot: this.resources.lend(pivot), seed: swing });
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
    this.lifeRows.flickers.push({ light: this.resources.lend(light), base: l.intensity, seed: l.seed, kind: l.kind });
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
  weldParts(): CabinWeldPart[] {
    const dd = this.tier.detailDist, out: CabinWeldPart[] = [];
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
  colliderDescs(): BuildingCollider[] {
    return [...this.legacy.filter((c) => !this.doorBoxes.has(c)).map((c) => boxDesc(c)), ...this.solids.filter((s) => !s.prop).map((s) => s.d)];
  }

  /** what it hands `place` (src/engine/models/weld.ts `WeldBuild`) */
  weldBuild(): CabinBuiltWeld {
    const root = this.root, floors = this.floors, deck = this.look.deck;
    return { root, parts: this.weldParts(), ...(this.casters === null ? {} : { casters: this.casters }), colliders: this.colliderDescs(),
      box: (target) => buildingBox(root, floors, deck, target) };
  }
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
