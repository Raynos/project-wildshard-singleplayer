// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest';
import { BoxGeometry, BufferGeometry, Group, Material, Mesh, Object3D, Vector3 } from 'three';
import { Scope } from '@wildshard/engine/app/scope';
import { SkyRig } from '@wildshard/engine/world/skyRig';
import { lowPolyLookMaterial } from '@wildshard/engine/world/lowpolyKit';
import { modelContext, specimenReady, type ModelBuild, type ModelDef } from '@wildshard/engine/models/model';
import { Rng } from '@wildshard/engine/core/rng';
import { SceneHandles } from '@wildshard/game/shardfile/sceneHandles';
import { hydrateWorldSceneWeld } from '../src/game/shardfile/worldSceneWeld';
import { nativeSpecimenCatalogue } from '../src/shards/driftwood-isle/generators/nativeSpecimens';
import { captainHat, sailclothCape } from '../src/shards/driftwood-isle/runtime/models/captainHat';
import { trader, tradeCounter } from '../src/shards/driftwood-isle/runtime/models/trader';
import { loadFixedGeometry } from '../src/shards/driftwood-isle/runtime/boot/blobAssets';
import { DRIFTWOOD_ASSET_NAMES } from '../src/shards/driftwood-isle/generators/assets';
import inventory from '../src/shards/driftwood-isle/data/fixedGeometry.json' with { type: 'json' };
import { admitDriftwoodFixtureRows } from './fixtures/driftwoodRows';

function isGeometry(value: unknown): value is BufferGeometry { return value instanceof BufferGeometry; }
function isMaterial(value: unknown): value is Material { return value instanceof Material; }

function group(built: ModelBuild): Object3D {
  if (built instanceof Object3D) return built;
  return new Group().add(...built.map(part => {
    const mesh = new Mesh(part.geometry, part.material);
    mesh.castShadow = part.castShadow ?? false; mesh.receiveShadow = part.receiveShadow ?? false;
    return mesh;
  }));
}

function snapshot(root: Object3D): unknown {
  const nodes: unknown[] = [];
  root.traverse(object => {
    const result: Record<string, unknown> = { name: object.name, kind: object.type, position: [...object.position],
      rotation: [...object.quaternion], scale: [...object.scale], visible: object.visible, castShadow: object.castShadow,
      receiveShadow: object.receiveShadow, renderOrder: object.renderOrder, children: object.children.map(child => child.name) };
    if (object instanceof Mesh) {
      const geometry: unknown = object.geometry, material: unknown = object.material;
      if (!isGeometry(geometry) || !isMaterial(material)) throw new Error('Unexpected native card mesh');
      const channels: Record<string, unknown> = {};
      for (const name of Object.keys(geometry.attributes)) {
        const attribute = geometry.getAttribute(name);
        channels[name] = { width: attribute.itemSize, normalized: attribute.normalized,
          values: Array.from({ length: attribute.count * attribute.itemSize }, (_, index) => attribute.getComponent(Math.floor(index / attribute.itemSize), index % attribute.itemSize)) };
      }
      const color: unknown = Reflect.get(material, 'color');
      Object.assign(result, { channels, index: geometry.index === null ? null : [...geometry.index.array], material: material.type,
        color, vertexColors: material.vertexColors, side: material.side, depthWrite: material.depthWrite });
    }
    nodes.push(result);
  });
  return nodes;
}

test('native card rows preserve the actual factories, pivots, colliders and shadows', async () => {
  admitDriftwoodFixtureRows();
  const owner = new Scope('native-card-parity');
  const sky: unknown = Object.create(SkyRig.prototype);
  if (!(sky instanceof SkyRig)) throw new Error('Missing fixture sky');
  Reflect.set(sky, 'csm', { lights: [] }); Reflect.set(sky, 'sunDir', new Vector3(0, 1, 0));
  vi.spyOn(sky, 'setupMaterial').mockImplementation(() => undefined);
  const geometry = new Map<string, BufferGeometry>(), inputs = new Map<string, BufferGeometry>();
  for (const [index, draw] of inventory.draws.entries()) {
    const shape = new BoxGeometry(0.2 + index / 1000, 0.3, 0.4).translate(index / 1000, 0, 0);
    geometry.set(draw.slot, shape);
    const name = DRIFTWOOD_ASSET_NAMES[`fixed:${draw.slot}`];
    if (name === undefined) throw new Error('Missing fixture draw alias');
    inputs.set(name, shape);
  }
  try {
    await loadFixedGeometry(inputs);
    const baked = nativeSpecimenCatalogue(geometry, inventory.groups.npc);
    const sourceGeometry = new Map([...geometry].map(([id, shape]) => [JSON.stringify(['native-specimens', id]), shape]));
    const ctx = modelContext(sky);
    const materials = new Map([['kit', lowPolyLookMaterial(sky)], ['still', lowPolyLookMaterial(sky, 'still')]]);
    const compare = async <P extends object>(key: string, model: ModelDef<P>): Promise<void> => {
      const before = owner.run(() => group(model.build(ctx, model.defaults, new Rng(0))));
      await specimenReady(before);
      const row = baked.models.find(candidate => candidate.key === key), scene = row?.choices[0]?.scene;
      if (row === undefined || scene === undefined || !('nodes' in scene)) throw new Error('Missing native scene');
      const handles = new SceneHandles(sky); handles.publish(scene.root, new Group());
      const after = hydrateWorldSceneWeld(scene, handles, { geometry: sourceGeometry, materials }, owner);
      expect(snapshot(after), key).toEqual(snapshot(before));
      expect(row.id).toBe(model.id);
      expect(row.defaults).toEqual(model.defaults);
      expect(row.choices[0]?.colliders).toEqual(model.colliders?.(model.defaults, ctx) ?? []);
    };
    await compare('captainHat', captainHat); await compare('sailclothCape', sailclothCape);
    await compare('tradeCounter', tradeCounter); await compare('trader', trader);
    expect(baked.models.map(row => row.key)).toEqual(['captainHat', 'sailclothCape', 'tradeCounter', 'trader']);
  } finally {
    owner.dispose();
    for (const shape of geometry.values()) shape.dispose();
    vi.restoreAllMocks();
  }
});
