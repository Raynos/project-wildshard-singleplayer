/** Frozen native cabin world/specimen topology; all merging ends at author time. */
import * as THREE from 'three';
import * as v from 'valibot';
import type { WorldSceneWeld, WorldSceneWeldNode } from '@wildshard/format/worldSceneWeld';
import { WorldSceneSurfaceSchema } from '@wildshard/format/worldSceneSurface';
import { BakedBuildingLookSchema, type BuildingAssemblyRows } from '@wildshard/format/buildings';
import type { CabinRows, BakedBuilding, PropKind } from './cabinShapes';
import look from '../data/buildingLook.json' with { type: 'json' };
import plumbing from '../data/plumbing.json' with { type: 'json' };
import { CabinAuthorAssembly, CabinAuthorResources } from './cabinSceneAssembly';
import { CabinAuthorWeld, CabinUnitParts, CabinWeldBatch, CabinWeldView, cabinNearProxy, cabinTwoSidedPositions } from './cabinWeld';

interface SourceModel { readonly scene: THREE.Group; readonly descriptors: readonly { readonly url: string; readonly part: number; readonly material: number; readonly name: string }[] }
/** Geometry-only source intake retains the original parts and hierarchy. */
export interface CabinSceneSources {
  readonly tier: 'phone' | 'desktop'; readonly rows: CabinRows;
  readonly geometry: ReadonlyMap<number, THREE.BufferGeometry>;
  readonly props: Readonly<Record<PropKind, { readonly geometry: THREE.BufferGeometry; readonly matrix: readonly number[]; readonly partCount: number }>>;
  readonly firePit: SourceModel; readonly lantern: SourceModel;
}
interface Hosted { readonly meshes: readonly THREE.InstancedMesh[]; readonly lists: readonly { readonly unit: number; readonly matrices: Float32Array }[] }
interface Owner { readonly record: BakedBuilding; readonly assembly: CabinAuthorAssembly; readonly resources: CabinAuthorResources }
interface GeometryRef { readonly library: string; readonly model: string }
/** Independent Explorer graph; the consumer maps building ids to its existing variants. */
export interface CabinSpecimen {
  readonly id: string; readonly kind: 'building' | 'prop' | 'drawn'; readonly tier: 'phone' | 'desktop'; readonly shadow: boolean;
  readonly scene: WorldSceneWeld;
}
type Distance = number | { readonly knob: string; readonly multiply: number; readonly add: number };
const propKinds = ['crate', 'barrel', 'bucket', 'hatchet'] as const;
const propIds = { crate: 'wooden-crate', barrel: 'wine-barrel', bucket: 'wooden-bucket', hatchet: 'hatchet' };
const partKeys = ['log', 'endGrain', 'chink', 'roof', 'beam', 'deck', 'door', 'stone', 'bark', 'iron', 'cloth', 'char'] as const;
const particleKeys = ['flame', 'ember', 'smoke'] as const;
const words = (values: Float32Array): number[] => [...new Uint32Array(values.buffer, values.byteOffset, values.length)];
const bits = (values: readonly number[]): number[] => [...new Uint32Array(Float64Array.from(values).buffer)];
const boxValues = (box: THREE.Box3): [number, number, number, number, number, number] => [box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z];
const sphereValues = (sphere: THREE.Sphere): [number, number, number, number] => [sphere.center.x, sphere.center.y, sphere.center.z, sphere.radius];
const distance = (multiply = 1, add = 0): Distance => ({ knob: 'pine.cabinDetailDist', multiply, add });
function detailFor(tier: 'phone' | 'desktop'): number {
  const row = plumbing.knobs.find(entry => entry.id === 'pine.cabinDetailDist');
  if (row === undefined || typeof row[tier] !== 'number') throw new Error('Cabin detail distance fact missing');
  return row[tier];
}
function surfaceMap(): Map<string, THREE.Material> {
  const result = new Map<string, THREE.Material>();
  for (const key of [...partKeys, 'glass']) { const material = new THREE.MeshStandardMaterial(); material.name = `materials.timber.${key}`; result.set(key, material); }
  for (const key of [...particleKeys, 'glow']) { const material = new THREE.MeshBasicMaterial(); material.name = `materials.cabin.${key}`; result.set(key, material); }
  return result;
}
function sceneMesh(value: THREE.Object3D): value is THREE.Mesh { return value instanceof THREE.Mesh; }
function sceneObject(value: unknown): value is THREE.Object3D { return value instanceof THREE.Object3D; }
function need<T>(value: T | undefined, label: string): T { if (value === undefined) throw new Error(label); return value; }

/** Accumulate every tier/shadow variant into one native geometry inventory. */
export class CabinSceneRecorder {
  readonly geometry = new Map<string, THREE.BufferGeometry>();
  readonly sourceMaterials = new Map<string, { readonly id: string; readonly url: string; readonly part: number }>();
  private readonly references = new WeakMap<THREE.BufferGeometry, GeometryRef>();
  private readonly materialIds = new Map<THREE.Material, string>();
  private readonly shadow = new THREE.MeshBasicMaterial({ colorWrite: false });
  private shape(shape: THREE.BufferGeometry): GeometryRef {
    const previous = this.references.get(shape);
    if (previous !== undefined) return previous;
    const index = this.geometry.size, id = `shape-${String(index)}`;
    const ref = { library: `cabin-shapes-${String(Math.floor(index / 128))}`, model: id };
    this.geometry.set(id, shape); this.references.set(shape, ref); return ref;
  }
  private material(material: THREE.Material): string { return material === this.shadow ? '$shadow' : need(this.materialIds.get(material), 'Missing cabin material slot'); }
  private surfaces(source: CabinSceneSources): Map<string, THREE.Material> {
    const result = surfaceMap();
    for (const material of result.values()) this.materialIds.set(material, material.name);
    for (const kind of propKinds) {
      const material = new THREE.MeshStandardMaterial(), id = `materials.cabin.prop.${kind}`;
      material.name = id; result.set(`prop.${kind}`, material); this.materialIds.set(material, id);
      this.sourceMaterials.set(id, { id, url: `/assets/models/${{ crate: 'wooden_crate_02', barrel: 'wine_barrel_01', bucket: 'wooden_bucket_01', hatchet: 'hatchet' }[kind]}/${{ crate: 'wooden_crate_02', barrel: 'wine_barrel_01', bucket: 'wooden_bucket_01', hatchet: 'hatchet' }[kind]}.gltf`, part: 0 });
    }
    for (const [name, model] of [['pit', source.firePit], ['lantern', source.lantern]] as const) {
      let part = 0;
      model.scene.traverse(node => {
        if (!(sceneMesh(node)) || Array.isArray(node.material)) return;
        const id = `materials.cabin.${name}.${String(part)}`, descriptor = need(model.descriptors[part], 'Cabin source material descriptor absent');
        this.materialIds.set(node.material, id);
        this.sourceMaterials.set(id, { id, url: name === 'lantern' ? '/assets/models/Lantern_01/Lantern_01_lod.glb' : descriptor.url, part });
        part++;
      });
    }
    return result;
  }
  private assembly(source: CabinSceneSources, record: BakedBuilding, shadow: boolean, role: 'standalone' | 'member' | 'specimen', surfaces: ReadonlyMap<string, THREE.Material>): Owner {
    const resources = new CabinAuthorResources(`cabins.${record.id}`, this.shadow), geometry: Record<string, string> = {}, parts: Record<string, string> = {}, particles: Record<string, string> = {};
    for (const [ordinal, shape] of source.geometry) geometry[String(ordinal)] = resources.register(`cabins.live.${String(ordinal)}`, shape);
    for (const key of partKeys) parts[key] = resources.register(`materials.timber.${key}`, need(surfaces.get(key), 'Cabin material absent'));
    for (const key of particleKeys) particles[key] = resources.register(`materials.cabin.${key}`, need(surfaces.get(key), 'Cabin particle material absent'));
    const input: BuildingAssemblyRows<string, 'flame' | 'ember' | 'smoke'> = { id: record.id, record, geometry,
      materials: { parts, particles: { flame: need(particles['flame'], 'Flame absent'), ember: need(particles['ember'], 'Ember absent'), smoke: need(particles['smoke'], 'Smoke absent') },
        glass: resources.register('materials.timber.glass', need(surfaces.get('glass'), 'Glass absent')), glow: resources.register('materials.cabin.glow', need(surfaces.get('glow'), 'Glow absent')) },
      models: { firePit: resources.register('source.pit', source.firePit.scene), lantern: resources.register('source.lantern', source.lantern.scene) },
      role, look: v.parse(BakedBuildingLookSchema, look), tier: { detailDist: detailFor(source.tier), detailShadows: shadow, sharedLights: source.tier === 'phone' } };
    const assembly = new CabinAuthorAssembly(resources, input);
    let part = 0;
    assembly.lanternObj?.traverse(node => {
      if (!(sceneMesh(node)) || Array.isArray(node.material)) return;
      this.materialIds.set(node.material, `cabins.${record.id}.lantern.material-${String(part)}`); part++;
    });
    return { record, assembly, resources };
  }
  private graph(id: string, rootId: string, parent: THREE.Group, owned: ReadonlySet<THREE.Object3D>, names: ReadonlyMap<THREE.Object3D, string>, owners: readonly Owner[], detail: number, pad: number): WorldSceneWeld {
    const nodes: WorldSceneWeldNode[] = [], emitted = new Set<THREE.Object3D>(), clouds = new Map<THREE.Mesh, Float32Array>();
    for (const owner of owners) for (const [mesh, seeds] of owner.resources.clouds) clouds.set(mesh, seeds);
    const symbolic = (value: unknown, cluster: boolean): Distance | undefined => {
      if (value === undefined) return undefined;
      if (typeof value !== 'number') throw new Error('Cabin native band differs');
      const add = cluster ? pad : 0, multiple = (value - add) / detail;
      if (multiple !== 1 && multiple !== 2) throw new Error('Unexpected cabin detail multiplier');
      return distance(multiple, add);
    };
    const emit = (object: THREE.Object3D): void => {
      if (!owned.has(object) || emitted.has(object)) return;
      const parentObject = object.parent;
      if (parentObject === null) throw new Error('Cabin captured node has no parent');
      emit(parentObject);
      if (object instanceof CabinWeldView) emit(object.batch);
      const nodeId = need(names.get(object), 'Missing cabin node identity'), parentName = need(names.get(parentObject), 'Missing cabin parent identity');
      const until = symbolic(object.userData['until'], parentName === 'cabins.cluster'), castFrom = symbolic(object.userData['castFrom'], false);
      const common = { id: nodeId, parent: parentName, name: object.name, matrixBits: bits(object.matrix.elements),
        transformBits: bits([...object.position, ...object.quaternion, ...object.scale]), matrixAutoUpdate: object.matrixAutoUpdate,
        layers: object.layers.mask, visible: object.visible, frustumCulled: object.frustumCulled, castShadow: object.castShadow, receiveShadow: object.receiveShadow,
        renderOrder: object.renderOrder, ...(until === undefined ? {} : { until }), ...(castFrom === undefined ? {} : { castFrom }) };
      let row: WorldSceneWeldNode;
      if (sceneMesh(object)) {
        const seeds = clouds.get(object);
        if (Array.isArray(object.material)) throw new Error('Cabin captured mesh has multiple materials');
        if (seeds !== undefined) {
          row = { ...common, kind: 'cloud', material: this.material(object.material), seedWords: words(seeds), sphere: sphereValues(need(object.geometry.boundingSphere ?? undefined, 'Cabin cloud sphere absent')) };
        } else {
          if (object.geometry.boundingSphere === null) object.geometry.computeBoundingSphere();
          const sphere = sphereValues(need(object.geometry.boundingSphere ?? undefined, 'Cabin draw sphere absent'));
          const box = object.geometry.boundingBox === null ? undefined : boxValues(object.geometry.boundingBox);
          if (object instanceof CabinWeldView) row = { ...common, kind: 'view', batch: need(names.get(object.batch), 'Cabin batch identity absent'), start: object.start, count: object.vertexCount, sphere, box: need(box, 'Cabin view box absent') };
          else {
            const draw = { geometry: this.shape(object.geometry), material: this.material(object.material), sphere, ...(box === undefined ? {} : { box }) };
            if (object instanceof THREE.InstancedMesh) {
              if (!(object.instanceMatrix.array instanceof Float32Array)) throw new Error('Cabin instances are not Float32');
              if (object.boundingSphere === null) object.computeBoundingSphere();
              row = { ...common, ...draw, kind: 'instances', capacity: object.instanceMatrix.count, count: object.count, matrixWords: words(object.instanceMatrix.array), instanceSphere: sphereValues(need(object.boundingSphere ?? undefined, 'Cabin instance sphere absent')),
                ...(object.boundingBox === null ? {} : { instanceBox: boxValues(object.boundingBox) }) };
            } else row = { ...common, ...draw, kind: object instanceof CabinWeldBatch ? 'batch' : 'mesh' };
          }
        }
      } else if (object instanceof THREE.PointLight) row = { ...common, kind: 'light', color: object.color.getHex(), intensity: object.intensity, distance: object.distance, decay: object.decay };
      else row = { ...common, kind: object instanceof THREE.Group ? 'group' : 'anchor' };
      nodes.push(row); emitted.add(object);
    };
    // Batches physically follow the borrowed building roots and owned cluster.
    // Declare those parent children first so views can reference earlier batches
    // without changing the native order of children under any parent.
    for (const child of parent.children) if (owned.has(child)) emit(child);
    parent.traverse(emit);
    return { id, root: rootId, nodes, materials: [], resources: [], placements: [], sets: [], culls: [] };
  }
  /** World draws preserve borrowed live building roots and exact hosted runs. */
  world(source: CabinSceneSources, shadow: boolean): { readonly graph: WorldSceneWeld; readonly registrations: readonly unknown[]; readonly live: readonly WorldSceneWeld['resources'][number][] } {
    const detail = detailFor(source.tier), surfaces = this.surfaces(source), parent = new THREE.Group(), names = new Map<THREE.Object3D, string>([[parent, 'cabins.root']]);
    const cluster = new THREE.Group(), hamlet = need(source.rows.hamlet ?? undefined, 'Cabin cluster absent');
    cluster.name = 'cabin-cluster'; cluster.position.fromArray(hamlet.at); cluster.updateMatrixWorld(true); names.set(cluster, 'cabins.cluster');
    const before = new Set<THREE.Object3D>(), owners: Owner[] = [];
    for (const record of [...source.rows.buildings.filter(row => !row.hamlet), ...source.rows.buildings.filter(row => row.hamlet)]) {
      const owner = this.assembly(source, record, shadow, record.hamlet ? 'member' : 'standalone', surfaces), assembly = owner.assembly;
      owners.push(owner); parent.add(assembly.root); names.set(assembly.root, `cabins.${record.id}.root`);
      if (record.hamlet) assembly.root.name = record.id;
      if (!record.hamlet && assembly.casters !== null) {
        const inverse = assembly.root.matrixWorld.clone().invert(), matrix = new THREE.Matrix4();
        for (const kind of propKinds) {
          const part = source.props[kind];
          for (let partIndex = 0; partIndex < part.partCount; partIndex++) for (const values of record.props[kind])
            assembly.casters.push(cabinTwoSidedPositions(part.geometry, matrix.multiplyMatrices(inverse, new THREE.Matrix4().fromArray(values)).multiply(new THREE.Matrix4().fromArray(part.matrix))));
        }
      }
      assembly.root.traverse(node => before.add(node));
    }
    parent.add(cluster);
    const copyWeld = new CabinAuthorWeld({ unit: 'copy', parent, detail, near: shadow }, this.shadow), wholeWeld = new CabinAuthorWeld({ unit: 'whole', parent, root: cluster, pad: hamlet.pad, detail }, this.shadow);
    for (const owner of owners) (owner.record.hamlet ? wholeWeld : copyWeld).join(owner.assembly.weldBuild());
    copyWeld.finish(); wholeWeld.finish();
    const registrations: unknown[] = [];
    for (const { record, assembly } of owners) registrations.push({ kind: 'building', id: record.id, part: record.hamlet ? 'cabins.cluster' : `cabins.${record.id}.root`, root: `cabins.${record.id}.root`, boxWords: words(Float32Array.from(boxValues(assembly.weldBuild().box(new THREE.Box3())))), colliders: assembly.colliderDescs(), floors: assembly.floors });
    const hosted = [[], []] as [Hosted[], Hosted[]];
    for (const kind of propKinds) {
      const part = source.props[kind];
      const shapes = Array.from({ length: part.partCount }, () => part.geometry.clone().applyMatrix4(new THREE.Matrix4().fromArray(part.matrix)));
      for (const shape of shapes) shape.computeBoundingBox();
      for (const inHamlet of [false, true]) {
        const selected = owners.filter(owner => owner.record.hamlet === inHamlet), lists: { unit: number; matrices: Float32Array }[] = [], matrices: THREE.Matrix4[] = [];
        for (const [index, owner] of selected.entries()) {
          const values = owner.record.props[kind];
          if (values.length === 0) continue;
          const lane = new Float32Array(values.length * 16);
          for (const [at, value] of values.entries()) { const matrix = new THREE.Matrix4().fromArray(value); matrix.toArray(lane, at * 16); matrices.push(matrix); }
          lists.push({ unit: inHamlet ? 0 : index, matrices: lane });
        }
        if (matrices.length === 0) continue;
        const meshes = shapes.map(shape => {
          const mesh = new THREE.InstancedMesh(shape, need(surfaces.get(`prop.${kind}`), 'Cabin prop material absent'), matrices.length);
          mesh.castShadow = false; mesh.receiveShadow = true;
          if (!(mesh.instanceMatrix.array instanceof Float32Array)) throw new Error('Cabin native instance storage differs');
          let at = 0;
          for (const list of lists) { mesh.instanceMatrix.array.set(list.matrices, at * 16); at += list.matrices.length / 16; }
          mesh.computeBoundingSphere(); return mesh;
        });
        const object = meshes.length === 1 ? need(meshes[0], 'Cabin prop mesh absent') : new THREE.Group();
        if (meshes.length > 1) object.add(...meshes);
        object.name = `pine-hollow/${propIds[kind]}`; parent.add(object); hosted[inHamlet ? 1 : 0].push({ meshes, lists });
        const shape = need(shapes[0], 'Cabin prop parts absent');
        const boxes = new Float32Array(matrices.length * 6), own = need(shape.boundingBox ?? undefined, 'Cabin prop box absent');
        matrices.forEach((matrix, index) => { boxes.set(boxValues(own.clone().applyMatrix4(matrix)), index * 6); });
        registrations.push({ kind: 'prop', prop: kind, hamlet: inHamlet, object, matrices: matrices.map(matrix => bits(matrix.elements)), boxWords: words(boxes) });
    }
    }
    parent.updateMatrixWorld(true);
    for (const { record, assembly } of owners) for (const which of ['firePitObj', 'lanternObj'] as const) {
      const object = assembly[which];
      if (object === null) continue;
      object.updateWorldMatrix(true, false);
      registrations.push({ kind: 'drawn', id: record.id, which, part: `cabins.${record.id}.${which === 'firePitObj' ? 'firePit' : 'lantern'}`, matrixBits: bits(object.matrixWorld.elements), boxWords: words(Float32Array.from(boxValues(new THREE.Box3().setFromObject(object)))) });
    }
    const owned = new Set<THREE.Object3D>(); let next = 0;
    parent.traverse(node => { if (node !== parent && !before.has(node)) { owned.add(node); if (!names.has(node)) names.set(node, `cabins.draw-${String(next++)}`); } });
    const graph = this.graph(`cabins.${source.tier}.${String(shadow)}`, 'cabins.root', parent, owned, names, owners, detail, hamlet.pad);
    const culls = [false, true].map((inHamlet, side) => {
      const selected = owners.filter(owner => owner.record.hamlet === inHamlet), roots = selected.map(owner => `cabins.${owner.record.id}.root`), origins = selected.flatMap(owner => [...owner.assembly.root.position]);
      if (inHamlet) { roots.push('cabins.cluster'); origins.push(...cluster.position); }
      return { roots, origins, units: inHamlet ? [selected.length] : selected.map((_, index) => index), details: inHamlet ? [distance(1, hamlet.pad)] : selected.map(() => distance()), hosted: hosted[side]?.map(set => ({ meshes: set.meshes.map(mesh => need(names.get(mesh), 'Cabin hosted identity absent')), lists: set.lists.map(run => ({ unit: run.unit, matrixWords: words(run.matrices) })) })) ?? [] };
    });
    const resources: WorldSceneWeld['resources'][number][] = [], ordinals = new Set<number>();
    for (const record of source.rows.buildings) for (const node of record.nodes) {
      const indices = node.t === 'door' ? [node.leaf, node.iron, node.batten] : node.t === 'glow' || node.t === 'wheel' ? [node.g] : node.t === 'lantern' ? [node.ring] : node.t === 'particles' ? [node.seeds] : [];
      for (const ordinal of indices) ordinals.add(ordinal);
    }
    for (const ordinal of ordinals) {
      const shape = need(source.geometry.get(ordinal), 'Cabin live shape absent'), id = `cabins.live.${String(ordinal)}`;
      if (shape.hasAttribute('seed')) { const seed = shape.getAttribute('seed'); if (!(seed instanceof THREE.BufferAttribute) || !(seed.array instanceof Float32Array)) throw new Error('Cabin live seeds differ'); resources.push({ id, kind: 'seeds', words: words(seed.array) }); }
      else resources.push({ id, kind: 'geometry', source: this.shape(shape) });
    }
    const resolvedRegistrations = registrations.map(value => {
      if (typeof value !== 'object' || value === null || !('object' in value)) return value;
      const { object, ...plain } = value; if (!sceneObject(object)) throw new Error('Cabin prop object missing'); return Object.assign(plain, { part: need(names.get(object), 'Cabin prop publication missing') });
    });
    return { graph: { ...graph, culls, resources }, registrations: resolvedRegistrations, live: resources };
  }

  private specimen(id: string, body: THREE.Object3D, owners: readonly Owner[], detail: number): WorldSceneWeld {
    const parent = new THREE.Group(), owned = new Set<THREE.Object3D>(), names = new Map<THREE.Object3D, string>([[parent, 'specimen.root']]);
    const materials: WorldSceneWeld['materials'] = [];
    for (const owner of owners) for (const [index, row] of owner.resources.materials.entries()) {
      const local = `specimen.${owner.record.id}.material-${String(index)}`;
      this.materialIds.set(row.material, local);
      materials.push({ id: local, kind: 'standard', properties: v.parse(WorldSceneSurfaceSchema.entries.properties, row.properties), sky: true,
        ...(row.source === undefined ? {} : { source: { material: this.material(row.source), maps: ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap'] } }) });
    }
    parent.add(body); parent.updateMatrixWorld(true);
    let ordinal = 0;
    body.traverse(node => { owned.add(node); names.set(node, `specimen.node-${String(ordinal++)}`); });
    const graph = this.graph(id, 'specimen.root', parent, owned, names, owners, detail, 0);
    return { ...graph, result: need(names.get(body), 'Missing specimen result'), materials };
  }

  /** Native buildingSpecimen and dressedCopy, frozen before any living update. */
  specimens(source: CabinSceneSources, shadow: boolean): CabinSpecimen[] {
    const surfaces = this.surfaces(source), result: CabinSpecimen[] = [], detail = detailFor(source.tier);
    const firstWorld = new Map<'firePitObj' | 'lanternObj', Owner>();
    for (const record of source.rows.buildings) {
      const owner = this.assembly(source, record, shadow, 'specimen', surfaces), assembly = owner.assembly;
      const unit = new CabinUnitParts(); unit.add(assembly.weldParts());
      const drawn = unit.draw(assembly.root, assembly.casters !== null, this.shadow);
      const proxy = assembly.casters === null ? null : cabinNearProxy(drawn.front, assembly.casters, this.shadow);
      if (proxy !== null) assembly.root.add(proxy);
      const toLocal = assembly.root.matrixWorld.clone().invert();
      assembly.root.position.set(0, 0, 0); assembly.root.rotation.set(0, 0, 0); assembly.root.updateMatrixWorld(true);
      const matrix = new THREE.Matrix4();
      for (const kind of propKinds) {
        const copies = record.props[kind], part = source.props[kind];
        if (copies.length === 0) continue;
        for (let partIndex = 0; partIndex < part.partCount; partIndex++) {
          const mesh = new THREE.InstancedMesh(part.geometry, need(surfaces.get(`prop.${kind}`), 'Specimen prop material absent'), copies.length);
          copies.forEach((values, index) => { mesh.setMatrixAt(index, matrix.multiplyMatrices(toLocal, new THREE.Matrix4().fromArray(values)).multiply(new THREE.Matrix4().fromArray(part.matrix))); });
          mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); mesh.castShadow = true; mesh.receiveShadow = true;
          assembly.root.add(mesh);
        }
      }
      const id = `specimen.${record.id}.${source.tier}.${String(shadow)}`;
      result.push({ id: record.id, kind: 'building', tier: source.tier, shadow, scene: this.specimen(id, assembly.root, [owner], detail) });
      // Dressed cards clone the FIRST living owner's final material/shadow
      // state, not a fresh specimen-role building's flags.
      if (!firstWorld.has('firePitObj') || !firstWorld.has('lanternObj')) {
        const world = this.assembly(source, record, shadow, record.hamlet ? 'member' : 'standalone', surfaces);
        for (const which of ['firePitObj', 'lanternObj'] as const) if (!firstWorld.has(which) && world.assembly[which] !== null) firstWorld.set(which, world);
      }
    }
    for (const kind of propKinds) {
      const part = source.props[kind], meshes = Array.from({ length: part.partCount }, () => {
        const geometry = part.geometry.clone().applyMatrix4(new THREE.Matrix4().fromArray(part.matrix));
        const mesh = new THREE.Mesh(geometry, need(surfaces.get(`prop.${kind}`), 'Prop card material absent'));
        mesh.castShadow = true; mesh.receiveShadow = true; return mesh;
      });
      const object = meshes.length === 1 ? need(meshes[0], 'Prop card mesh absent') : new THREE.Group();
      if (meshes.length > 1) object.add(...meshes);
      object.name = `pine-hollow/${propIds[kind]}`;
      result.push({ id: propIds[kind], kind: 'prop', tier: source.tier, shadow, scene: this.specimen(`specimen.${propIds[kind]}.${source.tier}.${String(shadow)}`, object, [], detail) });
    }
    for (const [which, id] of [['firePitObj', 'stone-fire-pit'], ['lanternObj', 'porch-lantern']] as const) {
      const owner = need(firstWorld.get(which), 'Dressed cabin card owner absent'), original = owner.assembly[which];
      if (original === null) throw new Error('Dressed cabin card object absent');
      const object = original.clone(true); object.position.set(0, 0, 0); object.rotation.set(0, 0, 0);
      object.traverse(node => { node.visible = true; });
      if (which === 'lanternObj') object.scale.setScalar(1.35);
      result.push({ id, kind: 'drawn', tier: source.tier, shadow, scene: this.specimen(`specimen.${id}.${source.tier}.${String(shadow)}`, object, [owner], detail) });
    }
    return result;
  }
}
