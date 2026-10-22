// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest';
import { BoxGeometry, BufferGeometry, Group, Material, Mesh, MeshBasicMaterial, Object3D, Vector3, WebGLRenderer } from 'three';
import { Scope } from '@wildshard/engine/app/scope';
import { SkyRig } from '@wildshard/engine/world/skyRig';
import { lowPolyLookMaterial } from '@wildshard/engine/world/lowpolyKit';
import { modelContext, specimenReady, type ModelBuild, type ModelDef } from '@wildshard/engine/models/model';
import { Rng } from '@wildshard/engine/core/rng';
import { SceneHandles } from '@wildshard/game/shardfile/sceneHandles';
import { bindWorldSceneModelSources, defineWorldSceneCatalogue } from '../src/game/models/worldSceneCatalogue';
import { collectionCosmetic } from '../src/game/models/collectionDisplay';
import { nativeSpecimenCatalogue } from '../src/shards/driftwood-isle/generators/nativeSpecimens';
import { captainHat, sailclothCape, trader, tradeCounter, traderOf as originalTraderOf } from './fixtures/driftwoodNativeFactories';
import { kitFigureCards, questFigure, type QuestFigurePorts } from '@wildshard/game/quest/figures';
import type { QuestFigureRows } from '@wildshard/format/questFigures';
import { driftwoodQuestFigures } from '../src/shards/driftwood-isle/generators/questFigures';
import { driftwoodKitFigureCards } from '../src/shards/driftwood-isle/generators/kitFigureCards';
import { FigureRows } from '@wildshard/game/systems/npc/figureRows';
import { ownQuestTree } from '@wildshard/game/quest/chapter';
import { clientMaterials } from '../src/game/shardfile/clientMaterials';
import { emptyShardfile } from '../src/sdk/author';
import { parseFamilyMaterial } from '../src/format/materialFamilies';
import { driftwoodProduct, driftwoodRows } from '../src/shards/driftwood-isle/runtime/boot/rows';
import { lendLooks } from '@wildshard/game/shardfile/lentLooks';
import { FIGURES, fixedDrawLibrary, loadFixedGeometry } from '../src/shards/driftwood-isle/runtime/boot/blobAssets';
import { DRIFTWOOD_ASSET_NAMES } from '../src/shards/driftwood-isle/generators/assets';
import inventory from '../src/shards/driftwood-isle/data/fixedGeometry.json' with { type: 'json' };
import { admitDriftwoodFixtureRows } from './fixtures/driftwoodRows';

interface Place { readonly x: number; readonly y: number; readonly z: number; readonly yaw?: number }
/** The live figure of a kit's row, its feet and fire at these places (the page's composition places). */
function figure(kit: string, sky: SkyRig, scope: Scope, feet: Place, fire: Place = feet): ReturnType<typeof questFigure> {
  const row = driftwoodQuestFigures().figures.find(candidate => candidate.kit === kit);
  if (row === undefined) throw new Error(`Missing figure row ${kit}`);
  const at = (place: Place): ReturnType<QuestFigurePorts['place']> => ({ ...place, yaw: place.yaw ?? 0 });
  return questFigure(row, { sky, scope, resources: new SceneHandles(sky), draws: fixedDrawLibrary(),
    catalogue: FIGURES, channels: driftwoodProduct().shardfile.clientChannels, place: (p: QuestFigureRows['feet']) => at(p === row.feet ? feet : fire) });
}

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
    bindWorldSceneModelSources(ctx, 'driftwood-isle', { catalogue: baked, geometries: sourceGeometry, materials }, owner);
    const native = defineWorldSceneCatalogue(baked);
    const compare = async <P extends object>(key: string, model: ModelDef<P>): Promise<void> => {
      const before = owner.run(() => group(model.build(ctx, model.defaults, new Rng(0))));
      await specimenReady(before);
      const row = baked.models.find(candidate => candidate.key === key), actual = native.model(key);
      if (row === undefined) throw new Error('Missing native card');
      const after = owner.run(() => group(actual.build(ctx, actual.defaults, new Rng(0))));
      await specimenReady(after);
      expect(snapshot(after), key).toEqual(snapshot(before));
      expect(row.id).toBe(model.id);
      expect(row.defaults).toEqual(model.defaults);
      expect(row.choices[0]?.colliders).toEqual(model.colliders?.(model.defaults, ctx) ?? []);
    };
    await compare('captainHat', captainHat); await compare('sailclothCape', sailclothCape);
    await compare('tradeCounter', tradeCounter); await compare('trader', trader);
    // The native card must not replace the entered gesture/offer owner.
    const oldScope = owner.child('original-live-trader'), liveScope = owner.child('entered-live-trader');
    const oldBody = oldScope.run(() => group(trader.build(ctx, trader.defaults, new Rng(0))));
    const liveRig = liveScope.run(() => figure('trader', sky, liveScope, { x: 0, y: 0, z: 0 })), liveBody = liveRig.group;
    const oldRig = originalTraderOf(oldBody);
    if (oldRig === null) throw new Error('Missing actual live trader owner');
    expect(FigureRows.entered(liveScope, 'trader')).toBe(liveRig.presentation);
    const oldCounter = new Group(), liveCounter = new Group();
    oldRig.companions.push(oldCounter); liveRig.companions.push(liveCounter);
    for (const [time, distance, talking] of [[0, 100, false], [1, 14, false], [4, 3, true], [7, 100, false]] as const) {
      oldRig.talking = talking; liveRig.talking = talking;
      oldRig.presentation.signal('offer'); liveRig.presentation.signal('offer');
      const player = new Vector3(distance, 1.8, 0);
      oldRig.update(0.5, time, player); liveRig.update(0.5, time, player);
      expect(snapshot(liveBody)).toEqual(snapshot(oldBody));
      expect(liveCounter.visible).toBe(oldCounter.visible);
    }
    liveScope.dispose(); oldScope.dispose();
    expect(liveRig.presentation.active).toBe(false);
    expect(() => FigureRows.entered(liveScope, 'trader')).toThrow();
    // Keep single-mesh pickup/socket roots and names, not only Explorer images.
    for (const [key, original] of [['captainHat', captainHat], ['sailclothCape', sailclothCape]] as const) {
      const old = owner.run(() => collectionCosmetic(original, ctx));
      const card = native.model(key);
      const bound: ModelDef<Record<string, unknown>> = { ...card,
        build: (_context, params, rng) => card.build({ ...ctx, specimenScope: owner }, params, rng) };
      const fresh = owner.run(() => collectionCosmetic(bound, ctx));
      expect(fresh).toBeInstanceOf(Mesh);
      expect(snapshot(fresh)).toEqual(snapshot(old));
    }
    expect(baked.models.map(row => row.key)).toEqual(['captainHat', 'sailclothCape', 'tradeCounter', 'trader']);
    // The real card is the entered rigid figure at its card pose. Its smoke is a
    // Mesh, hidden before a look is lent and borrowing that exact look afterward.
    const smokeRows = driftwoodRows('custom/fixedLayouts').nativeView;
    const castaway = kitFigureCards(driftwoodKitFigureCards(), { draws: fixedDrawLibrary(), catalogue: FIGURES, channels: driftwoodProduct().shardfile.clientChannels })('castaway');
    const compareCastaway = (visible: boolean, material?: Material): void => {
      const before = owner.run(() => figure('castaway', sky, owner, { x: 0, y: 0, z: 0 }, { x: -1.2, y: 0, z: -1.1 }).group);
      const after = owner.run(() => group(castaway.build(ctx, castaway.defaults, new Rng(0))));
      expect(snapshot(after)).toEqual(snapshot(before));
      const smoke = after.getObjectByName(smokeRows.CASTAWAY_SMOKE.name);
      if (!(smoke instanceof Mesh)) throw new Error('Castaway requires its actual smoke mesh');
      expect(smoke.visible).toBe(visible);
      if (material !== undefined) expect(smoke.material).toBe(material);
      let flames = 0;
      after.traverse(node => { if (node instanceof Mesh && node.material instanceof MeshBasicMaterial && node.material.color.r === 1.8) flames++; });
      expect(flames).toBe(1);
    };
    compareCastaway(false);
    const entered = owner.child('entered-smoke'), source = emptyShardfile({ slug: 'camp-fixture', name: 'Camp', author: 'Test', seed: 1, revision: 1 });
    source.look.materials[smokeRows.SMOKE_LOOK] = parseFamilyMaterial({ family: 'pbr' });
    const renderer: unknown = Object.create(WebGLRenderer.prototype);
    if (!(renderer instanceof WebGLRenderer)) throw new Error('Missing fixture renderer');
    const compiled = await clientMaterials(source, new Map(), renderer, entered, { graphs: false });
    lendLooks(entered, compiled);
    const smokeLook = compiled.materials.get(smokeRows.SMOKE_LOOK);
    if (smokeLook === undefined) throw new Error('Missing compiled fixture smoke');
    compareCastaway(true, smokeLook);
    const disposedLook = vi.spyOn(smokeLook, 'dispose'), borrower = entered.child('castaway-borrower');
    borrower.run(() => {
      const live = figure('castaway', sky, borrower, { x: 12, y: 3, z: -9, yaw: 1 }, { x: 10, y: 3, z: -8 });
      ownQuestTree(live.group, borrower);
    });
    borrower.dispose(); expect(disposedLook).not.toHaveBeenCalled();
    entered.dispose();
    expect(disposedLook).toHaveBeenCalledTimes(1);
    compareCastaway(false);

  } finally {
    owner.dispose();
    for (const shape of geometry.values()) shape.dispose();
    vi.restoreAllMocks();
  }
});
