// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import { Group, Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import { WorldRegistry } from '../src/engine/world/registry';
import type { Interactable } from '../src/engine/world/interact/types';
import type { ShardContext } from '../src/game/plugin/context';
import { SceneHandles } from '../src/game/shardfile/sceneHandles';
import { FigureRows } from '../src/game/systems/npc/figureRows';
import { installQuestTrader } from '../src/game/quest/trader';
import { parseQuestPageInteractions } from '../src/format/questInteractions';
import { TRADER_PAGE } from '../src/shards/driftwood-isle/generators/traderPage';

// G1c: Driftwood's admitted trader page binds the placed prompt through the shared page binder,
// with the same reach, gating, open and teardown as the hand-built prompt.
test('a placed trader prompt binds through its admitted page rows', () => {
  const scope = new Scope('maren.page'), registry = new WorldRegistry(), prompts: Interactable[] = [];
  new FigureRows(new SceneHandles({ setupMaterial: () => undefined }), {
    id: 'maren', name: 'Maren', feet: [6, 0, 3], yaw: 0, talkHeight: 1.4,
    collider: { kind: 'box', half: .3, top: 1.8, bottom: 0 }, rig: { skeleton: 'npc.legs.v1', clips: ['idle'], sockets: [] },
    visible: [], joints: [], sockets: [], drawDistance: 80, pointAt: [0, 0, 0], points: false,
  }, scope);
  const player = { position: new Vector3(6, 1, 5), yaw: 0, pitch: .4 };
  scope.run(() => { registry.add({ id: 'maren.counter', name: 'Counter', category: 'props', file: 'test/quest-trader-page.test.ts', object: new Group() }); });
  const ctx = { scope, game: { runtime: { world: { player, registry }, play: {}, interactables: prompts } },
    system: (_row: Parameters<ShardContext['system']>[0]) => undefined };
  const stall = installQuestTrader(ctx, { name: 'Maren', reopen: false,
    placement: { feet: { poi: 'world', x: 6, z: 3, yaw: 0 }, npc: 'maren', counter: 'maren.counter', counterAhead: 1, tradeAhead: 2, tradeHeight: 1, system: 'maren.shop' } }, {
    figure: 'maren', counter: 'maren.counter', offer: 'offer', at: { x: 6, y: 1, z: 5 }, prompt: { label: 'unused', radius: 9 }, before: [],
    page: parseQuestPageInteractions(TRADER_PAGE),
  });
  try {
    const prompt = prompts[0]; if (prompt === undefined) throw new Error('Missing page trader prompt');
    expect(prompts).toHaveLength(1);
    expect(prompt.label).toBe('Trade with Maren'); expect(prompt.position.toArray()).toEqual([6, 1, 5]);
    expect(prompt.radius).toBe(0);
    let open = false, opens = 0;
    stall.shop = { get isOpen() { return open; }, open: () => { open = true; opens++; }, close: () => { open = false; } };
    expect(prompt.radius).toBe(2.8); prompt.onInteract();
    expect(opens).toBe(1); expect(prompt.radius).toBe(0);
    open = false; expect(prompt.radius).toBe(2.8);
    scope.dispose(); expect(prompts).toEqual([]);
  } finally { scope.dispose(); }
});
