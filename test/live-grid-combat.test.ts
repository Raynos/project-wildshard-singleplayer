// oxlint-disable-next-line import/no-nodejs-modules -- Test real regional worlds from shipped native physics and admitted template bytes.
import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import { SaveStore } from '../src/engine/saves/store';
import { CombatPipeline } from '../src/engine/combat/pipeline';
import { EquipmentService } from '../src/engine/combat/EquipmentService';
import { loadRapier } from '../src/engine/physics/rapier';
import { ReadinessWalls } from '../src/engine/physics/readinessWalls';
import { createSimHost } from '../src/engine/sim';
import { EmptyEquipment } from '../src/game/shardfile/emptyEquipment';
import { GridAssembly, type GridCell } from '../src/game/grid/assembly';
import { LiveGridSession } from '../src/game/grid/liveSession';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { PageResidency } from '../src/game/grid/pageResidency';
import * as products from '../src/game/grid/products';
import source from '../src/shards/_template/shard.config';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import { MemoryStorage } from './setup';

it('gates real page and fresh/restored regional combat at geometry, irrespective of which motor frame is active', async () => {
  const assets = new Map(source.files.map(file => [file.hash, readFileSync(`src/shards/_template/assets/${file.hash}`)]));
  const product = vi.spyOn(products, 'gridShardfileProduct').mockReturnValue(Promise.resolve({ admitted: { source, assets, cached: false }, release: () => undefined,
    options: { base: 'https://fixture.invalid/', offline: false, firstParty: true, fetch: () => Promise.reject(new Error('No fixture network')), hash: () => Promise.reject(new Error('Already admitted')) } }));
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')).buffer);
  const page = createSimHost({ ...SIM_LEVEL, quests: [] }, { rapier });
  const globals = ['window', 'document'].map(name => {
    const before = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value: new EventTarget() });
    return () => { if (before === undefined) Reflect.deleteProperty(globalThis, name); else Object.defineProperty(globalThis, name, before); };
  });
  const scope = new Scope('live.combat'), allocator = new ResidencyAllocator();
  const assembly = new GridAssembly({ developer: false, devserver: false }), home = assembly.cell('driftwood-isle'), target = assembly.cell('template-3');
  const owner = new PageResidency(allocator), residency = owner.admitHome(home.instance, 1_000_000);
  scope.onDispose(() => { owner.dispose(); });
  const traveller = { position: page.player.position, yaw: 0, motor: page.releasePlayerMotor(), camera: new PerspectiveCamera(), hoverSpeedLimit: null,
    bindFrame: (_physics: typeof page.physics, motor: typeof page.player.motor) => { traveller.motor = motor; } };
  const session = new LiveGridSession({ assembly, home, physics: page.physics, scope, strips: [], allocator, residency,
    walls: new ReadinessWalls(page.physics, [], scope), neighbourEdges: () => [], rimEdges: () => [] }, {
    traveller, health: page.player.health, equipment: new EquipmentService(new EmptyEquipment(), { scope }), events: page.events,
    saves: new SaveStore({ local: new MemoryStorage(), session: null }), checkpoint: () => true, catalogue: [], setPhysics: () => undefined,
    onFixedPre: () => undefined, onFixedPost: () => undefined, onInput: () => undefined, onUpdate: () => undefined,
  });
  const pageCombat = new CombatPipeline(page.events, scope);
  const pageAnimal = [...page.entities.values()][0]; if (pageAnimal === undefined) throw new Error('Missing actual home creature');
  const move = (cell: GridCell, x: number, z: number) => {
    const active = session.live.current(), origin = active === null ? { x: 0, z: 0 } : assembly.cell(active).origin;
    traveller.position.set(cell.origin.x + x - origin.x, 1, cell.origin.z + z - origin.z);
  };
  const frame = async (to: string | null) => { const transfer = await session.live.prepare(session.live.current(), to); transfer.commit(); };
  try {
    // Same geometric home boundary before and after motor ownership moves to the highway.
    for (const motorFrame of [home.instance, null]) {
      if (motorFrame === null) await frame(null);
      for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        move(home, x * 250.01, z * 250.01);
        expect(pageCombat.hit({ source: pageAnimal.combatActor(), sourceTags: [], target: page.player.health, amount: 1, point: traveller.position, dir: new Vector3() })).toBeNull();
        expect(pageCombat.hit({ source: 'env', sourceTags: ['actor.player', 'dmg.melee'], target: pageAnimal.combatActor(), amount: 1, point: pageAnimal.position, dir: new Vector3() })).toBeNull();
        move(home, x * 249.99, z * 249.99);
        expect(pageCombat.hit({ source: pageAnimal.combatActor(), sourceTags: [], target: page.player.health, amount: 1, point: traveller.position, dir: new Vector3() })?.dealt).toBe(1);
      }
    }
    const originalRefusal = new TypeError('Fixture transport refused');
    product.mockReturnValueOnce(Promise.reject(originalRefusal));
    await expect(session.live.prefetch([target.instance])).rejects.toBe(originalRefusal);
    expect(session.refusal(target.instance)).toBe(originalRefusal);
    session.live.retry(target.instance);
    expect(session.refusal(target.instance)).toBeUndefined();
    await session.live.prefetch([target.instance]);
    for (const restored of [false, true]) {
      if (restored) { expect(session.live.unload(target.instance)).toBe(true); await session.live.prefetch([target.instance]); }
      const region = session.simulation(target.instance); if (region === undefined) throw new Error('Missing admitted combat region');
      const blob = region.host.entities.get('grey-blob:1'); if (blob === undefined) throw new Error('Missing actual quest actor');
      for (const motorFrame of [null, target.instance]) {
        if (motorFrame !== session.live.current()) await frame(motorFrame);
        for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          move(target, x * 250.01, z * 250.01);
          expect(region.host.combat.hit({ source: blob.combatActor(), sourceTags: [], target: page.player.health, amount: 1, point: traveller.position, dir: new Vector3() })).toBeNull();
          expect(region.host.combat.hit({ source: 'env', sourceTags: ['actor.player', 'weapon.bow'], target: blob.combatActor(), amount: 1, point: blob.position, dir: new Vector3() })).toBeNull();
          move(target, x * 249.99, z * 249.99);
          expect(region.host.combat.hit({ source: blob.combatActor(), sourceTags: [], target: page.player.health, amount: 1, point: traveller.position, dir: new Vector3() })?.dealt).toBe(1);
          expect(region.host.combat.hit({ source: page.player.health, sourceTags: [], target: blob.combatActor(), amount: 1, point: blob.position, dir: new Vector3() })?.dealt).toBe(1);
          expect(region.host.combat.hit({ source: pageAnimal.combatActor(), sourceTags: [], target: page.player.health, amount: 1, point: traveller.position, dir: new Vector3() })).toBeNull();
        }
      }
      await frame(null);
    }
  } finally {
    try { scope.dispose(); expect(allocator.entries()).toEqual([]); }
    finally { page.attachPlayerMotor(traveller.motor); page.dispose(); for (const reset of globals) reset(); product.mockRestore(); }
  }
});
