/** Native card snapshots over the same fixed geometry and rest scenes as the entered people. */
import { Box3, BufferGeometry, Group, Material, Mesh, MeshBasicMaterial, type Object3D, Vector3 } from 'three';
import { figureColliderRows } from '@wildshard/sdk/bake/placement';
import { worldSceneModels as parseWorldSceneModels, worldSceneWeldRows as parseWorldSceneWeld, worldSceneRecipe } from '@wildshard/sdk/worldScenes';

import { FIGURE_CATALOGUE } from './figureCatalogue';
import { COUNTER_TOP } from './counterLayout';
import { TRADER_SCENE } from './npcScenes';

type WorldSceneModels = ReturnType<typeof parseWorldSceneModels>;
type WorldSceneWeldNode = ReturnType<typeof parseWorldSceneWeld>['nodes'][number];

const LIBRARY = 'native-specimens';
const words = (values: readonly number[]): number[] => [...new Uint32Array(Float64Array.from(values).buffer)];

/** Compile this authored rest hierarchy from borrowed geometry/material ports, with no live scene owner. */
function nativeTraderRest(geometry: ReadonlyMap<string, BufferGeometry>, coat: Material): Object3D {
  const row = worldSceneRecipe({ scene: TRADER_SCENE, imports: [] }).scene;
  if (row.textures.length > 0) throw new Error('Native specimen requires borrowed material ports');
  const materials = new Map<string, Material>(), parts = new Map<string, Object3D>();
  for (const material of row.materials) {
    if (material.kind !== 'port' || material.source !== 'coat') throw new Error('Native specimen uses an undeclared source');
    materials.set(material.id, coat);
  }
  for (const node of row.nodes) {
    let object: Object3D;
    if (node.kind === 'group') object = new Group();
    else if (node.kind === 'mesh') {
      if (node.instances !== undefined) throw new Error('Native specimen requires split mesh draws');
      const source: unknown = geometry.get(node.geometry), material = materials.get(node.material);
      if (source !== null && !(source instanceof BufferGeometry)) throw new Error('Private geometry port differs from its declaration');
      if (material === undefined) throw new Error('Private mesh material disappeared');
      object = new Mesh(source ?? new BufferGeometry(), material);
    } else throw new Error('Native specimen contains a live service');
    if (node.visibleWhen !== undefined || ('whenTexture' in node && node.whenTexture !== undefined)) throw new Error('Native rest hierarchy requires unconditional authored parts');
    if (node.name !== undefined) object.name = node.name;
    if (node.position !== undefined) object.position.set(...node.position);
    if (node.rotation !== undefined) object.rotation.set(...node.rotation, node.order ?? object.rotation.order);
    if (node.scale !== undefined) object.scale.set(...node.scale);
    if (node.visible !== undefined) object.visible = node.visible;
    if (node.castShadow !== undefined) object.castShadow = node.castShadow;
    if (node.receiveShadow !== undefined) object.receiveShadow = node.receiveShadow;
    if (node.frustumCulled !== undefined) object.frustumCulled = node.frustumCulled;
    if (node.renderOrder !== undefined) object.renderOrder = node.renderOrder;
    parts.set(node.id, object);
  }
  for (const node of row.nodes) {
    const parent = parts.get(node.id); if (parent === undefined) throw new Error('Native rest parent unavailable');
    for (const id of node.children) {
      const child = parts.get(id); if (child === undefined) throw new Error('Native rest child unavailable');
      parent.add(child);
    }
  }
  const root = parts.get(row.root); if (root === undefined) throw new Error('Native rest root unavailable');
  return root;
}

/** Source slots are decoded with the runtime's owned-geometry intake before this native job runs. */
export function nativeSpecimenCatalogue(geometry: ReadonlyMap<string, BufferGeometry>, groups: {
  readonly trader: Readonly<Record<string, string>>;
}): WorldSceneModels {
  const get = (slot: string): BufferGeometry => {
    const value = geometry.get(slot);
    if (value === undefined) throw new Error(`Missing native specimen source: ${slot}`);
    return value;
  };
  const coat = new MeshBasicMaterial(), still = new MeshBasicMaterial();
  const materials = new Map<object, string>([[coat, 'kit'], [still, 'still']]);
  const sources = new Map<object, string>([...geometry].map(([id, source]) => [source, id]));
  const models: WorldSceneModels['models'][number][] = [];
  const add = (key: string, id: string, name: string, category: 'gear' | 'people' | 'props', surface: 'felt' | 'flesh' | 'wood', root: Object3D,
    defaults: Record<string, number> = {}, specimenYaw?: number, colliders: readonly unknown[] = [], draw?: { geometry: string; material: string }): void => {
    root.updateMatrixWorld(true);
    const nodes: WorldSceneWeldNode[] = [], names = new Map<Object3D, string>();
    root.traverse(object => { names.set(object, `part-${names.size}`); });
    root.traverse(object => {
      const nodeId = names.get(object), parent = object.parent === null ? 'root' : names.get(object.parent);
      if (nodeId === undefined || parent === undefined) throw new Error('Native specimen hierarchy escaped its root');
      const common = { id: nodeId, parent, name: object.name, matrixBits: words(object.matrix.elements),
        transformBits: words([...object.position, ...object.quaternion, ...object.scale]), matrixAutoUpdate: object.matrixAutoUpdate,
        layers: object.layers.mask, visible: object.visible, frustumCulled: object.frustumCulled,
        castShadow: object.castShadow, receiveShadow: object.receiveShadow, renderOrder: object.renderOrder };
      if (object instanceof Mesh) {
        const shape: unknown = object.geometry, material: unknown = object.material;
        if (!(shape instanceof BufferGeometry) || !(material instanceof Material)) throw new Error('Native specimen requires split mesh materials');
        const source = sources.get(shape), slot = materials.get(material);
        if (source === undefined || slot === undefined) throw new Error('Native specimen uses an undeclared source');
        shape.computeBoundingBox(); shape.computeBoundingSphere();
        const sphere = shape.boundingSphere, box = shape.boundingBox;
        if (sphere === null || box === null) throw new Error('Native specimen omitted source bounds');
        nodes.push({ ...common, kind: 'mesh', geometry: { library: LIBRARY, model: source }, material: slot,
          sphere: [sphere.center.x, sphere.center.y, sphere.center.z, sphere.radius], box: [box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z] });
      } else {
        if (!(object instanceof Group)) throw new Error('Native specimen contains a live service');
        nodes.push({ ...common, kind: 'group' });
      }
    });
    const scene = parseWorldSceneWeld({ id: `native-${key}`, root: 'root', result: 'part-0', nodes });
    const size = new Box3().setFromObject(root).getSize(new Vector3());
    models.push({ key, id: `driftwood-isle/${id}`, name, file: 'src/shards/driftwood-isle/data/nativeSpecimens.generated.json',
      category, pipeline: 'code', surface, defaults, variants: [], assembly: draw === undefined ? 'scene' : 'parts', ...(specimenYaw === undefined ? {} : { specimenYaw }),
      choices: [{ id: 'native', params: defaults, size: [size.x, size.y, size.z], draws: draw === undefined ? [] : [{ id: key, library: LIBRARY, model: draw.geometry, material: draw.material, castShadow: true, receiveShadow: true, renderOrder: 0 }], lods: [], colliders: [...colliders], ...(draw === undefined ? { scene } : {}) }] });
  };
  try {
    for (const [key, id, name, slot, yaw] of [
      ['captainHat', 'captain-hat', "Captain's hat", 'hat', 0],
      ['sailclothCape', 'sailcloth-cape', 'Sailcloth cape', 'cape', Math.PI],
    ] as const) {
      const mesh = new Mesh(get(slot), coat); mesh.castShadow = true; mesh.receiveShadow = true;
      add(key, id, name, 'gear', 'felt', new Group().add(mesh), { size: 1 }, yaw, [], { geometry: slot, material: 'kit' });
    }
    const counter = new Mesh(get('tradeCounter'), still); counter.castShadow = true; counter.receiveShadow = true;
    add('tradeCounter', 'trade-counter', "The trader's counter", 'props', 'wood', new Group().add(counter), {}, undefined,
      [{ kind: 'box', x: 0, y: COUNTER_TOP.y / 2, z: 0, hx: COUNTER_TOP.w / 2, hy: COUNTER_TOP.y / 2, hz: COUNTER_TOP.d / 2 + 0.02 }], { geometry: 'tradeCounter', material: 'still' });
    const kit = (rows: Readonly<Record<string, string>>): Map<string, BufferGeometry> => new Map(Object.entries(rows).map(([part, slot]) => [part, get(slot)]));
    const trader = nativeTraderRest(kit(groups.trader), coat);
    add('trader', 'trader', 'The trader', 'people', 'flesh', trader, {}, undefined, figureColliderRows(FIGURE_CATALOGUE.figures['trader']?.phone));
    return parseWorldSceneModels({ product: 'driftwood-isle', models });
  } finally { coat.dispose(); still.dispose(); }
}
