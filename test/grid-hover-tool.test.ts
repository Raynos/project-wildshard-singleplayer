// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the real crossing's stow with the shipped physics binary.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { PerspectiveCamera } from 'three';
import { App } from '../src/engine/app/app';
import { Scope } from '../src/engine/app/scope';
import { withOwner } from '../src/engine/app/ownership';
import { EquipmentService } from '../src/engine/combat/EquipmentService';
import { Tool } from '../src/engine/combat/Tool';
import type { EquipContext } from '../src/engine/combat/Equipment';
import type { Action } from '../src/engine/input/InputService';
import { loadRapier } from '../src/engine/physics/rapier';
import { ReadinessWalls } from '../src/engine/physics/readinessWalls';
import { createSimHost } from '../src/engine/sim';
import { SaveStore } from '../src/engine/saves/store';
import { EmptyEquipment } from '../src/game/shardfile/emptyEquipment';
import { GridAssembly } from '../src/game/grid/assembly';
import { LiveGridSession } from '../src/game/grid/liveSession';
import { PageResidency } from '../src/game/grid/pageResidency';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import { MemoryStorage } from './setup';

it('keeps platform HOVER callable at the home stow fence while disabling cell-owned tools', async () => {
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')).buffer);
  const host = createSimHost({ ...SIM_LEVEL, ground: { size: 600, height: 0 }, entities: [], quests: [] }, { rapier });
  const originals = ['window', 'document'].map(name => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value: new EventTarget() });
    return () => { if (previous === undefined) Reflect.deleteProperty(globalThis, name); else Object.defineProperty(globalThis, name, previous); };
  });
  const scope = new Scope('hover.road'), app = new App(), owner = new PageResidency();
  scope.onDispose(() => { owner.dispose(); });
  const assembly = new GridAssembly({ developer: false, devserver: false }), home = assembly.cell('driftwood-isle');
  const camera = new PerspectiveCamera(), traveller = { position: host.player.position, yaw: 0, motor: host.releasePlayerMotor(), camera, hoverSpeedLimit: null,
    bindFrame: (_physics: typeof host.physics, motor: typeof host.player.motor) => { traveller.motor = motor; } };
  let mounted = false;
  class FixtureTool extends Tool {
    readonly slot = 'tool'; enabled = true; holster = 0;
    constructor(readonly id: `tool.${string}`, readonly actions: readonly Action[]) { super({ ...new EmptyEquipment().row, id }); }
    override install(ctx: EquipContext): void {
      super.install(ctx);
      for (const action of this.actions) app.input.bind(action, () => { mounted = !mounted; }, ctx.scope, () => this.enabled);
    }
    update(): void { /* The crossing fence, not a render update, owns this test. */ }
  }
  const equipment = new EquipmentService(new EmptyEquipment(), { scope });
  const board = new FixtureTool('tool.hoverboard', ['hover']), local = new FixtureTool('tool.local', ['use']);
  equipment.add(board, { locked: false }); equipment.add(local, { locked: false });
  const pre: (() => void)[] = [], post: (() => void)[] = [];
  try {
    const session = withOwner(scope, () => new LiveGridSession({ assembly, home, physics: host.physics, scope, strips: [], allocator: owner.allocator,
      residency: owner.admitHome(home.instance, 1_000_000), walls: new ReadinessWalls(host.physics, [], scope), neighbourEdges: () => [], rimEdges: () => [] }, {
      traveller, health: host.player.health, equipment, events: host.events, saves: new SaveStore({ local: new MemoryStorage(), session: null }),
      checkpoint: () => false, catalogue: [], setPhysics: () => undefined, onFixedPre: run => { pre.push(run); },
      onFixedPost: run => { post.push(run); }, onInput: () => undefined, onUpdate: () => undefined,
    }));
    traveller.position.set(270, 0, 270);
    for (let tick = 0; tick < 20; tick++) { for (const run of pre) run(); for (const run of post) run(); await Promise.resolve(); }
    expect(session.state().crossing.phase).toBe('save-failed');
    expect(equipment.stowed).toBe(true); expect(local.enabled).toBe(false); expect(board.enabled).toBe(true);
    app.input.press('hover'); expect(mounted).toBe(true);
    app.input.press('hover'); expect(mounted).toBe(false);
    equipment.setEnabled(false); app.input.press('hover'); expect(mounted).toBe(false);
  } finally {
    try { scope.dispose(); traveller.motor.dispose(); host.dispose(); } finally { for (const restore of originals) restore(); }
  }
});
