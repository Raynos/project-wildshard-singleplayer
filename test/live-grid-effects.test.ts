// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the real fixed-step cell boundary on shipped native physics.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { PerspectiveCamera } from 'three';
import { Scope } from '../src/engine/app/scope';
import { SaveStore } from '../src/engine/saves/store';
import { EquipmentService } from '../src/engine/combat/EquipmentService';
import { EffectService, bindPlayerEffects } from '../src/engine/combat/effects/EffectService';
import type { EffectDef } from '../src/engine/combat/effects/types';
import { loadRapier } from '../src/engine/physics/rapier';
import { ReadinessWalls } from '../src/engine/physics/readinessWalls';
import { createSimHost } from '../src/engine/sim';
import { EmptyEquipment } from '../src/game/shardfile/emptyEquipment';
import { GridAssembly } from '../src/game/grid/assembly';
import { LiveGridSession } from '../src/game/grid/liveSession';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { PageResidency } from '../src/game/grid/pageResidency';
import { STARTER_EFFECTS } from '../src/kit/effects/starter';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import { MemoryStorage } from './setup';

it('clears poison and slow at all four cell edges while the source motor frame stays active, preserving buffs', async () => {
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')).buffer);
  const page = createSimHost({ ...SIM_LEVEL, entities: [], quests: [] }, { rapier });
  const restoreGlobals = ['window', 'document'].map(name => {
    const before = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value: new EventTarget() });
    return () => { if (before === undefined) Reflect.deleteProperty(globalThis, name); else Object.defineProperty(globalThis, name, before); };
  });
  const scope = new Scope('live.effects'), allocator = new ResidencyAllocator();
  const assembly = new GridAssembly({ developer: false, devserver: false }), home = assembly.cell('driftwood-isle');
  const owner = new PageResidency(allocator), residency = owner.admitHome(home.instance, 1_000_000);
  scope.onDispose(() => { owner.dispose(); });
  const traveller = { position: page.player.position, yaw: 0, motor: page.releasePlayerMotor(), camera: new PerspectiveCamera(), hoverSpeedLimit: null,
    effectMoveLocked: false, effectMoveScale: 1,
    bindFrame: (_physics: typeof page.physics, motor: typeof page.player.motor) => { traveller.motor = motor; } };
  const buff: EffectDef = { id: 'effect.fixture-speed', kind: 'timed', duration: 20, stacking: 'refresh', tags: ['buff.speed'],
    modifiers: [{ attr: 'moveSpeedMul', op: 'mul', value: 1.2 }] };
  const effects = new EffectService([...STARTER_EFFECTS, buff], scope, page.events);
  bindPlayerEffects({ effects, target: page.player.health, movement: traveller, combat: page.combat, position: () => traveller.position, scope });
  const post: (() => void)[] = [];
  let clears = 0;
  const session = new LiveGridSession({ assembly, home, physics: page.physics, scope, strips: [], allocator, residency,
    walls: new ReadinessWalls(page.physics, [], scope), neighbourEdges: () => [], rimEdges: () => [] }, {
    traveller, health: page.player.health, equipment: new EquipmentService(new EmptyEquipment(), { scope }), events: page.events,
    saves: new SaveStore({ local: new MemoryStorage(), session: null }), checkpoint: () => true, catalogue: [], setPhysics: () => undefined,
    onSafeZone: () => { clears++; effects.clearHarmful(page.player.health); },
    onFixedPre: () => undefined, onFixedPost: fn => { post.push(fn); }, onInput: () => undefined, onUpdate: () => undefined,
  });
  const tick = () => { for (const run of post) run(); };
  try {
    effects.apply(page.player.health, buff.id);
    for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      traveller.position.set(x * 249.99, 1, z * 249.99); tick();
      effects.apply(page.player.health, 'effect.poison'); effects.apply(page.player.health, 'effect.slow');
      tick(); expect(effects.active(page.player.health)).toHaveLength(3);
      expect(traveller.effectMoveScale).toBe(0.72);
      const before = clears, hp = page.player.health.attributes.health;
      traveller.position.set(x * 250.01, 1, z * 250.01); tick();
      expect(session.frame()).toBe(home.instance); expect(clears).toBe(before + 1);
      expect(effects.active(page.player.health).map(effect => effect.def.id)).toEqual([buff.id]);
      expect(traveller.effectMoveScale).toBe(1.2);
      tick(); expect(clears).toBe(before + 1);
      effects.update(1); expect(page.player.health.attributes.health).toBe(hp);
    }
    expect(effects.active(page.player.health)[0]?.remaining).toBe(16);
  } finally {
    try { scope.dispose(); expect(allocator.entries()).toEqual([]); }
    finally { page.attachPlayerMotor(traveller.motor); page.dispose(); for (const restore of restoreGlobals) restore(); }
  }
});
