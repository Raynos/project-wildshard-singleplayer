// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Vitest executes in Node; happy-dom supplies only DOM globals.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the installed WASM outside a symlinked clean export in this Node test.
import { createRequire } from 'node:module';
import { Vector3 } from 'three';
import { App } from '../../../src/engine/app/app';
import { Scope } from '../../../src/engine/app/scope';
import { Tool } from '../../../src/engine/combat/Tool';
import type { EquipmentHost } from '../../../src/engine/combat/view/EquipmentHost';
import type { HudVerbs } from '../../../src/engine/level/context';
import type { DiscSpot, TouchRelabel } from '../../../src/engine/ui/hudSlots';
import type { ShardContext } from '../../../src/game/shard/context';
import { FeiZhua } from '../../../src/shards/nine-dragon-stack/grapple/FeiZhua';
import { FEI_ZHUA_ROW } from '../../../src/shards/nine-dragon-stack/grapple/row';
import { toolEntries } from '../../../src/game/bag/equipment';
import { Physics } from '../../../src/engine/physics/Physics';
import { CharacterMotor } from '../../../src/engine/physics/CharacterMotor';
import { loadRapier } from '../../../src/engine/physics/rapier';
import { groups } from '../../../src/engine/physics/groups';
import { FakeGame, legacyDouble } from '../../fake/FakeGame';
import type { Player } from '../../../src/engine/player/Player';
import type { SwordArms } from '../../../src/engine/combat/view/melee';
import type { LockOnSystem } from '../../../src/engine/player/LockOnTarget';

let R: Awaited<ReturnType<typeof loadRapier>>;
const cleanup: (() => void)[] = [];
beforeAll(async () => {
  const path = createRequire(import.meta.url).resolve('@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm');
  R = await loadRapier(new Uint8Array(readFileSync(path)).buffer);
});
afterEach(() => { for (const fn of cleanup.splice(0)) fn(); document.body.replaceChildren(); });
function setup(hooks = [new Vector3(0, 1.6, -10)], enemy = false) {
  const app = new App(), scope = new Scope('fei-zhua'), physics = new Physics(R), fake = new FakeGame();
  app.levelScope = scope; app.physics = physics; app.setState('play');
  physics.world.createCollider(R.ColliderDesc.cuboid(4, 0.5, 4).setTranslation(0, -0.5, -10).setCollisionGroups(groups('WORLD')));
  const motor = new CharacterMotor(physics, { radius: 0.38, height: 1.8, step: 0.35, maxClimbDeg: 40, snap: 0.3, group: 'PLAYER', blockedBy: ['WORLD'], owner: {}, weight: 80 });
  const position = new Vector3(0, 0.12, 0), velocity = new Vector3();
  fake.camera.position.set(0, 1.72, 0); fake.camera.updateMatrixWorld(true);
  const game = fake.asGame(); Object.assign(game, { app });
  const unlock = vi.fn<() => void>(), playLeft = vi.fn<NonNullable<SwordArms['playLeft']>>(), setClawVisible = vi.fn<NonNullable<SwordArms['setClawVisible']>>();
  const host: EquipmentHost = { game, physics, viewmodel: fake.viewmodel, player: legacyDouble<Player>({ position, velocity, motor, onGround: true }),
    arms: legacyDouble<SwordArms>({ playLeft, setClawVisible }), lock: legacyDouble<LockOnSystem>({ unlock, hasTarget: () => enemy }), toast: vi.fn<(message: string) => void>(), enabled: () => true };
  app.registerEquipmentHost(host, scope);
  let labels: Partial<Record<DiscSpot, TouchRelabel>> = {};
  app.input.touchSink((next) => { labels = next; }, scope);
  const pins: HTMLElement[] = [];
  const ctx = legacyDouble<ShardContext>({ app, scope, debug: { expose: () => undefined }, hud: legacyDouble<HudVerbs>({ relabel: () => () => undefined, pin: (_at, el) => { pins.push(el); document.body.append(el); scope.onDispose(() => el.remove()); } }) });
  const tool = new FeiZhua(ctx, { name: 'test', hooks }); tool.install({ scope, events: app.events });
  physics.step();
  const phase = (name: 'input' | 'update' | 'fixed.post'): void => {
    for (const system of app.systemsByPhase()[name]) if (system.when?.(app) !== false) system.run(1 / 60, 0);
  };
  const update = (): void => phase('update');
  const press = (action: 'lock' | 'jump'): void => { app.input.press(action); phase('input'); };
  cleanup.push(() => { scope.dispose(); app.engineScope.dispose(); physics.dispose(); });
  return { app, scope, tool, host, position, velocity, phase, update, press, pins, labels: () => labels, unlock, playLeft };
}
describe('Fei Zhua Tool on the shared input and traversal contracts', () => {
  it('pushes its context on a reachable hook, consumes LOCK/JUMP and moves the real capsule at 22 m/s', () => {
    const f = setup(); f.update(); expect(f.tool).toBeInstanceOf(Tool);
    expect(f.app.input.top).toBe('grapple'); expect(f.labels().lock?.label).toBe('Grapple');
    f.press('lock'); f.update(); expect(f.app.input.pressed('lock')).toBe(false); expect(f.unlock).toHaveBeenCalledOnce();
    expect(f.labels().lock?.label).toBe('Locked'); expect(f.labels().jump?.label).toBe('Zip');
    f.press('jump'); expect(f.app.input.pressed('jump')).toBe(false);
    let moved = 0;
    for (let step = 0; step < 45; step++) {
      const before = f.position.clone(); expect(f.app.events.ask('player.traversal', 1 / 60)).toBe(true);
      moved = before.distanceTo(f.position); if (moved > 0) break;
    }
    expect(moved).toBeCloseTo(22 / 60, 3); expect(f.velocity.length()).toBeCloseTo(22, 2);
    expect(f.playLeft).toHaveBeenCalledWith('grapple_fire'); expect(f.pins).toHaveLength(9);
    f.scope.dispose(); expect(f.app.input.top).toBe(''); expect(document.querySelector('.ws-dragon-hook')).toBeNull();
  });
  it('lets an enemy/no-hook LOCK fall through; keeps the lead-approved no-enemy miss shot', () => {
    const enemy = setup([], true); enemy.press('lock'); expect(enemy.app.input.consume('lock')).toBe(true);
    const miss = setup([]); miss.press('lock'); miss.update(); expect(miss.app.input.pressed('lock')).toBe(false);
    expect(miss.labels().lock?.label).toBe('Armed'); expect(miss.labels().jump?.label).toBe('Fire');
    miss.press('jump'); expect(miss.app.events.ask('player.traversal', 1 / 60)).toBe(true);
  });
  it('practice falls through, then a playground course restores the real tool and scope cleanup', () => {
    const f = setup(); f.app.events.emit('practice.active', true); f.app.events.flush('input');
    f.press('lock'); expect(f.app.input.consume('lock')).toBe(true);
    f.tool.setGrappleCourse({ name: 'playground', hooks: [new Vector3(0, 1.6, -10)] });
    f.update(); f.press('lock'); expect(f.app.input.pressed('lock')).toBe(false);
    f.tool.setGrappleCourse(null); f.update(); f.press('lock'); expect(f.app.input.consume('lock')).toBe(true);
  });
  it('builds the existing GEAR card from the authored Tool metadata', () => {
    const f = setup(); expect(f.tool.row).toBe(FEI_ZHUA_ROW);
    expect(toolEntries([f.tool], () => 'Fei Zhua')).toEqual([{ id: 'fei-zhua', name: 'Fei Zhua', kind: 'Grapple', how: 'Lock a hook, then jump', icon: 'grapple' }]);
  });
});
