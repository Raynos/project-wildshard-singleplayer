// oxlint-disable-next-line import/no-nodejs-modules -- Recovery uses the real owned highway world and shipped native motor.
import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import * as v from 'valibot';
import { PerspectiveCamera } from 'three';
import { Scope } from '../src/engine/app/scope';
import { SaveStore } from '../src/engine/saves/store';
import { EquipmentService } from '../src/engine/combat/EquipmentService';
import { loadRapier } from '../src/engine/physics/rapier';
import { ReadinessWalls } from '../src/engine/physics/readinessWalls';
import { createSimHost } from '../src/engine/sim';
import { EmptyEquipment } from '../src/game/shardfile/emptyEquipment';
import { clientCheckpoint } from '../src/game/shardfile/clientState';
import { GridAssembly } from '../src/game/grid/assembly';
import { gridHomeSim } from '../src/game/grid/boot';
import { LiveGridSession } from '../src/game/grid/liveSession';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { PageResidency } from '../src/game/grid/pageResidency';
import { GridWallet } from '../src/game/grid/wallet';
import { gridRecovery } from '../src/game/grid/recovery';
import { resetNewGame, previewNewGame } from '../src/game/newGame';
import { instanceSave } from '../src/game/instanceSaves';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import { MemoryStorage } from './setup';

const flagsKey = { key: 'flags', scope: 'shard' as const, version: 1, schema: v.array(v.string()), initial: (): string[] => [] };
it('recovers GPU/background to the highway and a successful New game cannot resurrect coins or quest state', async () => {
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')).buffer);
  const host = createSimHost({ ...SIM_LEVEL, entities: [], quests: [] }, { rapier });
  const baseline = { bodies: host.physics.world.bodies.len(), colliders: host.physics.world.colliders.len() };
  const restoreGlobals = ['window', 'document'].map(name => {
    const before = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value: Object.assign(new EventTarget(), { performance }) });
    return () => { if (before === undefined) Reflect.deleteProperty(globalThis, name); else Object.defineProperty(globalThis, name, before); };
  });
  const scope = new Scope('live.recovery'), allocator = new ResidencyAllocator(), owner = new PageResidency(allocator);
  const assembly = new GridAssembly({ developer: false, devserver: false }), home = assembly.cell('driftwood-isle');
  const residency = owner.admitHome(home.instance, 1_000_000);
  scope.onDispose(() => { owner.dispose(); });
  const traveller = { position: host.player.position, yaw: 0.5, onGround: true, motor: host.releasePlayerMotor(), camera: new PerspectiveCamera(), hoverSpeedLimit: null,
    bindFrame: (_physics: typeof host.physics, motor: typeof host.player.motor) => { traveller.motor = motor; } };
  const store = new SaveStore({ local: new MemoryStorage(), session: new MemoryStorage() }), identity = { id: home.instance, shard: home.slug };
  const wallet = new GridWallet(store, identity), flags = instanceSave(store, flagsKey, identity);
  wallet.addCoins(7); flags.write(['quest.fixture.done']);
  const flush = vi.fn(() => wallet.flush() && flags.write(['quest.fixture.done']));
  let durable = true;
  const saver = clientCheckpoint({ ledger: { flush: () => durable }, purse: { flush }, encounters: () => true, continuation: () => true });
  const post: (() => void)[] = [], equipment = new EquipmentService(new EmptyEquipment(), { scope });
  let highway: typeof host.physics | undefined;
  const session = new LiveGridSession({ assembly, home, physics: host.physics, scope, strips: [], allocator, residency,
    walls: new ReadinessWalls(host.physics, [], scope), neighbourEdges: () => [], rimEdges: () => [] }, {
    traveller, health: host.player.health, equipment, events: host.events, saves: store, checkpoint: saver.checkpoint, catalogue: [],
    setPhysics: physics => { if (physics !== host.physics) highway = physics; }, onFixedPre: () => undefined, onFixedPost: fn => { post.push(fn); }, onInput: () => undefined, onUpdate: () => undefined,
  });
  const record = gridRecovery(store);
  const suppress = vi.fn(saver.suppress);
  gridHomeSim.offer({ residency, checkpoint: saver.checkpoint, suppressCheckpoint: suppress,
    setActive: () => undefined, disposed: () => scope.disposed });
  try {
    durable = false; expect(session.prepareRecovery('gpu')).toBe(false); expect(record.consume(assembly)).toEqual({ kind: 'none' });
    durable = true;
    const road = { x: 281.1, z: 12, yaw: traveller.yaw };
    await session.resumeRoad(road);
    expect(session.frame()).toBeNull(); expect(session.worldFeet()).toEqual({ x: road.x, y: 0.5, z: road.z });
    expect(equipment.stowed).toBe(true); expect(session.state().crossing.current).toBeNull();
    for (const reason of ['gpu', 'background'] as const) {
      expect(session.prepareRecovery(reason)).toBe(true);
      expect(record.consume(assembly)).toMatchObject({ kind: 'resume', record: { road, reason } });
      expect(record.consume(assembly)).toEqual({ kind: 'none' });
      record.clearLoop(); // Each branch below represents a new explicit player attempt, not a second failing resume.
    }
    const afterReset = session.prepareNewGameRecovery();
    expect(record.consume(assembly)).toEqual({ kind: 'none' });
    expect(resetNewGame(store, identity).applied).toBe(true);
    afterReset(); expect(suppress).toHaveBeenCalledOnce();
    expect(record.consume(assembly)).toMatchObject({ kind: 'resume', record: { road, reason: 'new-game' } });
    flush.mockClear();
    expect(session.checkpoint()).toBe(false); expect(saver.checkpoint()).toBe(false);
    window.dispatchEvent(new Event('pagehide')); document.dispatchEvent(new Event('visibilitychange'));
    for (let tick = 0; tick < 600; tick++) for (const run of post) run();
    expect(flush).not.toHaveBeenCalled();
    expect(previewNewGame(store, identity).before).toMatchObject({ flags: [], inventory: { coins: 0, quantity: 0 } });
    if (highway === undefined) throw new Error('No owned highway');
    const disposeHighway = vi.spyOn(highway, 'dispose');
    scope.dispose(); expect(allocator.entries()).toEqual([]);
    expect(disposeHighway).toHaveBeenCalledOnce();
    expect(host.physics.world.bodies.len()).toBe(baseline.bodies);
    expect(host.physics.world.colliders.len()).toBe(baseline.colliders);
  } finally {
    try { scope.dispose(); host.attachPlayerMotor(traveller.motor); host.dispose(); }
    finally { for (const restore of restoreGlobals) restore(); }
  }
});
