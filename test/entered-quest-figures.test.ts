// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest';
import { BufferGeometry, Group, Material, Mesh, MeshBasicMaterial, MeshStandardMaterial, type Object3D, Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import { SkyRig } from '../src/engine/world/skyRig';
import { WorldRegistry } from '../src/engine/world/registry';
import { defineModel, sharedModelContext } from '../src/engine/models/model';
import { place as placeModel } from '../src/engine/models/place';
import * as lowPolyKit from '../src/engine/world/lowpolyKit';
import type { ShardContext } from '../src/game/plugin/context';
import { installQuestFigures } from '../src/game/quest/figures';
import { SceneHandles } from '../src/game/shardfile/sceneHandles';
import { lendLooks } from '../src/game/shardfile/lentLooks';
import { fixedDraws } from '../src/game/models/fixedDraws';
import { ProductFigureCatalogue } from '../src/game/models/figureCatalogue';
import { KitFigure } from '../src/game/systems/npc/kitFigure';
import { FigureRows } from '../src/game/systems/npc/figureRows';
import { ownQuestTree } from '../src/game/quest/chapter';
import * as runtimeProduct from '../src/game/shardfile/runtimeProduct';
import { driftwoodQuestFigures } from '../src/shards/driftwood-isle/generators/questFigures';
import { castawayFigure } from './fixtures/driftwoodCastawayOracle';
import { enteredTrader, traderOf } from './fixtures/driftwoodTraderOracle';
import { loadFixedGeometry } from '../src/shards/driftwood-isle/runtime/boot/blobAssets';
import { driftwoodFixedProduct } from './fixtures/driftwoodFixedProduct';
import { legacyDouble } from './fake/FakeGame';

type Runtime = NonNullable<ShardContext['game']['runtime']>;
type World = NonNullable<Runtime['world']>;

const isGeometry = (value: unknown): value is BufferGeometry => value instanceof BufferGeometry;
const isMaterial = (value: unknown): value is Material => value instanceof Material;

function drawState(root: Object3D, bytes = false): unknown {
  root.updateMatrixWorld(true);
  const result: unknown[] = [];
  root.traverse(object => {
    if (!(object instanceof Mesh)) return;
    const geometry: unknown = object.geometry, material: unknown = object.material;
    if (!isGeometry(geometry) || !isMaterial(material)) throw new Error('Unexpected figure mesh');
    result.push({ name: object.name, world: object.matrixWorld.toArray(), visible: object.visible,
      attributes: bytes ? Object.fromEntries(Object.keys(geometry.attributes).map(id => { const attr = geometry.getAttribute(id); return [id, [attr.itemSize, attr.normalized, Array.from(attr.array)]]; })) : undefined,
      index: bytes ? geometry.index === null ? null : Array.from(geometry.index.array) : undefined, groups: geometry.groups,
      sphere: geometry.boundingSphere === null ? null : [geometry.boundingSphere.center.toArray(), geometry.boundingSphere.radius],
      material: [material.type, material.name], order: object.renderOrder });
  });
  return result;
}

test.each([false, true])('entered figures preserve real cold/hot meshes, poses and borrowed smoke (hot: %s)', async hot => {
  const product = await driftwoodFixedProduct(), material = new MeshStandardMaterial(), smokeMaterial = new MeshBasicMaterial();
  const mocked = vi.spyOn(runtimeProduct, 'loadFirstPartyProduct').mockResolvedValue(product);
  const borrowed = vi.spyOn(lowPolyKit, 'lowPolyLookMaterial').mockReturnValue(material);
  const resident = new Scope('figure-resident'), oldScope = resident.child('old-figures'), scope = resident.child('declared-figures');
  let smokeDisposed = 0; smokeMaterial.addEventListener('dispose', () => { smokeDisposed++; });
  const data = driftwoodQuestFigures(), castaway = data.figures[0], trader = data.figures[1];
  if (castaway === undefined || trader?.counter === undefined || trader.card === undefined || trader.piece === undefined || trader.name === undefined || castaway.fire === undefined) throw new Error('Missing fixture rows');
  const fire = castaway.fire, counterRow = trader.counter, piece = { id: trader.piece, name: trader.name };
  if (hot) lendLooks(resident, { materials: new Map([['driftwood-castaway-smoke', smokeMaterial]]), setParam: () => undefined, setTexture: () => undefined, bindMeshMap: () => smokeMaterial });
  const sky = SkyRig.prototype, registry = new WorldRegistry(), oldRegistry = new WorldRegistry(); registry.scope = scope; oldRegistry.scope = oldScope;
  const systems: Parameters<ShardContext['system']>[0][] = [];
  const native = defineModel({ id: 'fixture/trader', name: 'Trader', category: 'people', pipeline: 'code', file: 'test/entered-quest-figures.test.ts', defaults: {}, build: () => { const group = new Group(); group.name = 'native specimen'; return group; } });
  const counter = defineModel({ id: 'fixture/counter', name: 'Counter', category: 'props', pipeline: 'code', file: 'test/entered-quest-figures.test.ts', defaults: {}, build: () => new Group(), colliders: () => [{ kind: 'box', x: 0, y: 0.3, z: 0, hx: 1, hy: 0.3, hz: 0.4 }] });
  const floorAt = (x: number, z: number): number => x * 0.03 + z * 0.07;
  const place = (p: typeof castaway.feet) => ({ x: p.x + 27, y: p.y ?? floorAt(p.x + 27, p.z - 19) + (p.dy ?? 0), z: p.z - 19, yaw: p.yaw ?? 0.9 });
  const player = { position: new Vector3(35, 2, -20) };
  const ctx = legacyDouble<ShardContext>({ scope, product, game: legacyDouble<ShardContext['game']>({ runtime: legacyDouble<Runtime>({ world: legacyDouble<World>({ sky, registry, player: legacyDouble<World['player']>(player) }) }) }), system: (row: Parameters<ShardContext['system']>[0]) => { systems.push(row); } });
  try {
    await loadFixedGeometry();
    const draws = fixedDraws(product, product.section<{ fixedDraws: unknown }>('custom/fixedLayouts').fixedDraws); await draws.load();
    const catalogue = await ProductFigureCatalogue.fromProduct(product, 'people/catalogue.json');
    const resources = new SceneHandles(sky), oldResources = new SceneHandles(sky);
    const npc = oldScope.run(() => castawayFigure(sky, place(castaway.feet), place(fire), oldResources, oldScope));
    const feet = place(trader.feet), cx = feet.x + Math.sin(feet.yaw) * counterRow.ahead, cz = feet.z + Math.cos(feet.yaw) * counterRow.ahead;
    const oldRig = oldScope.run(() => {
      const context = { ...sharedModelContext(sky), specimenScope: oldScope };
      const placed = placeModel(enteredTrader(native), [feet], { ctx: context, draw: 'single', registry: oldRegistry, piece });
      const table = placeModel(counter, [{ x: cx, y: floorAt(cx, cz), z: cz, yaw: feet.yaw }], { ctx: context, draw: 'single', registry: oldRegistry, piece: { id: counterRow.piece, name: counterRow.name, solidFloor: counterRow.solidFloor } });
      ownQuestTree(placed.object, oldScope); ownQuestTree(table.object, oldScope);
      const rig = traderOf(placed.object); if (rig === null) throw new Error('Missing original trader'); rig.companions.push(table.object); return rig;
    });
    oldScope.onDispose(() => { npc.dispose(); oldRig.dispose(); });
    installQuestFigures(ctx, data, { draws, catalogue, resources, placement: { place, floorAt }, models: { model: id => id === trader.card ? native : counter } });
    const enteredNpc = FigureRows.entered(scope, castaway.kit), enteredTraderRows = FigureRows.entered(scope, trader.kit);
    await Promise.all([npc.presentation.ready, oldRig.presentation.ready, enteredNpc.ready, enteredTraderRows.ready]);
    expect(systems.map(row => [row.id, row.phase, row.before])).toEqual(data.figures.map(row => [row.system.id, 'update', row.system.before]));
    expect(registry.pieceList().map(row => ({ id: row.id, colliders: row.colliders, solidFloor: row.solidFloor })))
      .toEqual(oldRegistry.pieceList().map(row => ({ id: row.id, colliders: row.colliders, solidFloor: row.solidFloor })));
    const placed = registry.get(trader.piece), table = registry.get(counterRow.piece);
    if (placed?.object === undefined || table?.object === undefined) throw new Error('Missing declared trader and counter');
    expect(placed.object.position.toArray()).toEqual(oldRig.group.position.toArray());
    expect(drawState(resources.object('castaway.source'), true)).toEqual(drawState(npc.group, true));
    expect(drawState(placed.object, true)).toEqual(drawState(oldRig.group, true));
    const smoke = resources.object('castaway.smoke.source'); expect(smoke.visible).toBe(hot);
    if (hot && smoke instanceof Mesh) expect(smoke.material).toBe(smokeMaterial);
    for (let i = 0; i < 90; i++) {
      const dt = i % 2 === 0 ? 1 / 30 : 1 / 60, time = i / 30;
      if (i === 12) { npc.presentation.signal('wave'); enteredNpc.signal('wave'); oldRig.presentation.signal('offer'); enteredTraderRows.signal('offer'); }
      const distance = i < 20 ? 100 : i < 40 ? 14 : i < 60 ? 3 : 100;
      player.position.set(feet.x + distance, feet.y + 1.8, feet.z);
      oldRig.talking = i >= 40 && i < 60; enteredTraderRows.talking = oldRig.talking;
      npc.update(dt, time, player.position); oldRig.update(dt, time, player.position);
      for (const row of systems) row.run(dt, time);
      expect(drawState(resources.object('castaway.source'))).toEqual(drawState(npc.group));
      expect(drawState(placed.object)).toEqual(drawState(oldRig.group));
      expect(table.object.visible).toBe(oldRig.companions[0]?.visible);
    }
    expect(registry.models().find(row => row.id === native.id)?.object().getObjectByName('native specimen')).toBeDefined();
    const order: string[] = [], dispose = vi.spyOn(KitFigure.prototype, 'dispose').mockImplementation(function retireFigure(this: KitFigure) { order.push(this === npc || this === oldRig ? 'old' : this.group === placed.object ? 'trader' : 'castaway'); this.presentation.dispose(); });
    scope.dispose(); expect(order).toEqual(['castaway', 'trader']); dispose.mockRestore();
    expect(() => FigureRows.entered(scope, castaway.kit)).toThrow('not entered');
    expect(enteredTraderRows.active).toBe(false);
    expect(() => FigureRows.entered(scope, trader.kit)).toThrow('not entered');
    expect(smokeDisposed).toBe(0);
  } finally { resident.dispose(); mocked.mockRestore(); borrowed.mockRestore(); material.dispose(); smokeMaterial.dispose(); }
});

test('a partial placed descriptor refuses before any figure allocation', () => {
  const scope = new Scope('bad-figures'), data = driftwoodQuestFigures(), row = data.figures[0];
  if (row === undefined) throw new Error('Missing castaway');
  const ctx = legacyDouble<ShardContext>({ scope, game: legacyDouble<ShardContext['game']>({ runtime: legacyDouble<Runtime>({ world: legacyDouble<World>({}) }) }) });
  try { expect(() => installQuestFigures(ctx, { figures: [{ ...row, card: 'card' }] }, legacyDouble({}))).toThrow('requires its card'); }
  finally { scope.dispose(); }
});
