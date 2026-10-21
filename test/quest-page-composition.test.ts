// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import { Group, Vector3 } from 'three';
import * as v from 'valibot';
import { Scope } from '../src/engine/app/scope';
import { WorldRegistry } from '../src/engine/world/registry';
import type { Interactable } from '../src/engine/world/interact/types';
import type { ShardContext } from '../src/game/plugin/context';
import { SceneHandles } from '../src/game/shardfile/sceneHandles';
import { FigureRows } from '../src/game/systems/npc/figureRows';
import { registerQuestPageWorld, questPageWorld } from '../src/game/quest/pageResources';
import { installQuestTrader } from '../src/game/quest/trader';
import { QuestPageCompositionSchema } from '../src/format/questPageComposition';
import rows from '../src/shards/driftwood-isle/data/questPageComposition.json' with { type: 'json' };

// The orchard fixture has a borrowed keeper, a fruit counter and an existing
// shop. It supplies no factory, reflected method or per-frame callback to a host.
test('an orchard page borrows entered figures and its existing shop by ids', () => {
  const scope = new Scope('orchard.page'), registry = new WorldRegistry(), prompts: Interactable[] = [];
  const figure = new FigureRows(new SceneHandles({ setupMaterial: () => undefined }), {
    id: 'orchard.keeper', name: 'Fruit keeper', feet: [6, 0, 3], yaw: 0, talkHeight: 1.4,
    collider: { kind: 'box', half: .3, top: 1.8, bottom: 0 }, rig: { skeleton: 'npc.legs.v1', clips: ['idle'], sockets: [] },
    visible: [], joints: [], sockets: [], drawDistance: 80, pointAt: [0, 0, 0], points: false,
  }, scope);
  const player = { position: new Vector3(6, 1, 5), yaw: 0, pitch: .4 };
  const systems = new Map<string, Parameters<ShardContext['system']>[0]>();
  scope.run(() => { registry.add({ id: 'orchard.counter', name: 'Fruit counter', category: 'props', file: 'test/quest-page-composition.test.ts', object: new Group() }); });
  const ctx = { scope, game: { runtime: { world: { player, registry }, play: {}, interactables: prompts } },
    system: (row: Parameters<ShardContext['system']>[0]) => { systems.set(row.id, row); } };
  const stall = installQuestTrader(ctx, { name: 'Lena', reopen: false,
    placement: { feet: { poi: 'world', x: 6, z: 3, yaw: 0 }, npc: 'orchard.keeper', counter: 'orchard.counter', counterAhead: 1, tradeAhead: 2, tradeHeight: 1, system: 'orchard.shop' },
    view: { pitch: -.2, closeDistance: 4 } }, {
    figure: 'orchard.keeper', counter: 'orchard.counter', offer: 'offer-fruit', at: { x: 6, y: 1, z: 5 }, prompt: { label: 'Buy fruit', radius: 2 }, before: [],
  });
  try {
    const prompt = prompts[0]; if (prompt === undefined) throw new Error('Missing declared trader prompt');
    expect(prompt.radius).toBe(0);
    let open = false, opens = 0;
    stall.shop = { get isOpen() { return open; }, open: () => { open = true; opens++; }, close: () => { open = false; } };
    expect(prompt.radius).toBe(2); prompt.onInteract();
    expect(opens).toBe(1); expect(prompt.radius).toBe(0); expect(player.pitch).toBe(-.2);
    expect(FigureRows.entered(scope, 'orchard.keeper')).toBe(figure);
    expect(figure.takeSignal('offer-fruit')).toBe(true); expect(figure.takeSignal('offer-fruit')).toBe(false);
    stall.open(); expect(opens).toBe(1);
    player.position.x += 5; systems.get('orchard.shop')?.run(.1, .1);
    expect(open).toBe(false); expect(player.pitch).toBe(.4);
    scope.dispose(); stall.open(); expect(opens).toBe(1); expect(prompts).toEqual([]);
    expect(() => FigureRows.entered(scope, 'orchard.keeper')).toThrow('not entered');
  } finally { scope.dispose(); }
});

test('world and figure channels are scoped, and page intake refuses code', () => {
  const scope = new Scope('orchard.resources'), world = { pois: { hut: { anchors: { door: { x: 2, y: 0, z: 5 } } } }, flock: null };
  registerQuestPageWorld(scope, 'orchard.world', world); expect(questPageWorld(scope, 'orchard.world')).toBe(world);
  expect(() => registerQuestPageWorld(scope, 'orchard.world', world)).toThrow();
  const page = { ...rows, id: 'orchard.page', world: 'orchard.world', frames: {}, events: [], deaths: [] };
  expect(v.parse(QuestPageCompositionSchema, page).world).toBe('orchard.world');
  expect(() => v.parse(QuestPageCompositionSchema, { ...page, events: [() => undefined] })).toThrow('JSON');
  expect(() => v.parse(QuestPageCompositionSchema, { ...page, figures: [{ id: 'orchard.keeper', approach: { owner: 'keeper', path: ['wave'] } }] })).toThrow();
  scope.dispose(); expect(() => questPageWorld(scope, 'orchard.world')).toThrow('Missing');
});


test('page composition admits an authored place frame rather than a fixed island vocabulary', () => {
  const orchard = { ...rows, events: [], deaths: [], frames: { orchard: { x: 5, z: 8, rot: .3 } },
    boss: { ...rows.boss, pool: { poi: 'orchard', x: 6, z: 7 } } };
  expect(v.parse(QuestPageCompositionSchema, orchard).frames).toEqual(orchard.frames);
  expect(() => v.parse(QuestPageCompositionSchema, { ...orchard, frames: { orchard: { x: 5, z: 8, rot: Number.NaN } } })).toThrow();
});
