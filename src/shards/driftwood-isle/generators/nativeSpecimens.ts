/** Native card snapshots over the same fixed geometry and rest scenes as the entered people. */
import { Box3, BufferGeometry, Group, Material, Mesh, MeshBasicMaterial, type Object3D, Vector3 } from 'three';
import { createClientScene } from '@wildshard/game/plugin/ui';
import { FigureRows } from '@wildshard/game/systems/npc/figureRows';
import { parseWorldSceneModels, type WorldSceneModels } from '@wildshard/format/worldSceneModels';
import { parseWorldSceneWeld, type WorldSceneWeldNode } from '@wildshard/format/worldSceneWeld';
import { FIGURE_CATALOGUE } from './figureCatalogue';
import { COUNTER_TOP } from './counterLayout';
import { TRADER_SCENE } from './npcScenes';

const LIBRARY = 'native-specimens';
const words = (values: readonly number[]): number[] => [...new Uint32Array(Float64Array.from(values).buffer)];

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
    const trader = createClientScene(TRADER_SCENE, { geometry: kit(groups.trader), materials: new Map([['coat', coat]]) }).root;
    add('trader', 'trader', 'The trader', 'people', 'flesh', trader, {}, undefined, FigureRows.collidersFor(FIGURE_CATALOGUE.figures['trader']?.phone));
    return parseWorldSceneModels({ product: 'driftwood-isle', models });
  } finally { coat.dispose(); still.dispose(); }
}
