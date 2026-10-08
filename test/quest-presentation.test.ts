// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { app } from '../src/engine/app/runtime';
import { Scope } from '../src/engine/app/scope';
import type { SystemSpec } from '../src/engine/app/systems';
import { practiceRoom } from '../src/engine/core/practiceRoom';
import type { MapPoi as FullMapPoi, MapQuest } from '../src/engine/ui/Map';
import type { MapMark } from '../src/engine/ui/Minimap';
import { Flags } from '../src/engine/world/interact/flags';
import type { Interactable } from '../src/engine/world/interact/types';
import { QuestState } from '../src/engine/quest/core';
import { installEnteredQuestPresentation, installQuestPresentation, presentQuest, type QuestPresentationContext, type PresentedQuestDef } from '../src/game/quest/presentation';
import { createLevelInstallation } from '../src/engine/level/installation';
import { shardContext } from '../src/game/shard/context';
import type { ShardRuntime } from '../src/game/shard/runtime';
import { RetainedRuntimeHooks, installEnteredRuntimeInput } from '../src/game/shard/retainedHooks';
import { emptyShardfileSource } from '../src/game/shardfile/loader';
import { emptyShardfile } from '../src/sdk/author';
import { legacyDouble } from './fake/FakeGame';
import { DRIFTWOOD_QUEST } from '../src/shards/driftwood-isle/quest/questLine';

const scopes: Scope[] = [];
afterEach(() => { for (const scope of scopes.splice(0)) scope.dispose(); practiceRoom.open = false; document.body.replaceChildren(); });

function host() {
  const scope = new Scope('quest.test'); scopes.push(scope);
  const player = { position: new Vector3(0, 4, 0), velocity: new Vector3(), yaw: 0, pitch: 0, carried: false };
  const pins: { at: Vector3 | (() => Vector3 | null); root: HTMLElement }[] = [];
  const systems: SystemSpec[] = [], marks = new Set<() => readonly MapMark[]>(), pois = new Set<() => FullMapPoi[]>();
  let card: (() => MapQuest | null) | null = null;
  const toast = vi.fn<(text: string) => void>(), sting = vi.fn<(name: 'chunk') => void>();
  const weapons = { visible: true, stowed: false };
  const interactables: Interactable[] = [];
  const runtime = {
    world: { player, sky: { dayNight: { phase: 0.1 } } },
    play: { hud: { toast }, music: { sting }, weapons, minimap: {
      addMarks: (source: () => readonly MapMark[]) => { marks.add(source); return () => { marks.delete(source); }; },
    }, fullMap: {
      addQuest: (source: () => MapQuest | null) => { card = source; return () => { card = null; }; },
      addPois: (source: () => FullMapPoi[]) => { pois.add(source); return () => { pois.delete(source); }; },
    } }, interactables,
  };
  const ctx: QuestPresentationContext = { scope, app, manifest: { slug: 'quest-test' }, game: { runtime },
    system: (spec) => { systems.push(spec); }, hud: { pin: (at, root) => { pins.push({ at, root }); document.body.append(root); } } };
  return { scope, ctx, player, pins, marks, pois, systems, toast, sting, weapons, runtime, card: () => card?.() };
}

const definition = (): PresentedQuestDef => ({ id: 'bells', title: 'The Bells', completeFlag: 'bells.done', steps: [
  { id: 'first', title: 'Find the bell', done: { all: ['bell.first'] }, target: { position: new Vector3(0, 4, -12), label: 'THE BELL' } },
  { id: 'second', title: 'Ring the bell', done: { all: ['bell.second'] }, target: { position: new Vector3(0, 4, -30), label: 'THE TOWER' } },
] });

describe('one-call quest presentation', () => {
  it('recreates entered quest/input bindings twice while state persists and 600 parked ticks leave no presentation', () => {
    const h = host(), previous = app.levelAdapters;
    app.levelAdapters = { ...previous, hud: {
      widget: () => () => undefined, disc: () => ({ button: document.createElement('button'), dispose: () => undefined }),
      verb: () => () => undefined, relabel: () => () => undefined,
      pin: (at, root) => { h.pins.push({ at, root }); document.body.append(root); return () => { root.remove(); }; },
    } };
    const manifest = emptyShardfileSource(emptyShardfile({ slug: 'fixture', name: 'Fixture', author: 'Fixture', seed: 1, revision: 1 }));
    const base = createLevelInstallation(app, h.scope, app.levelAdapters, () => ({ set: () => undefined, detail: () => undefined }));
    type World = NonNullable<ShardRuntime['world']>;
    type Play = NonNullable<ShardRuntime['play']>;
    const runtime = legacyDouble<ShardRuntime>({
      world: legacyDouble<World>({ player: legacyDouble<World['player']>(h.runtime.world.player),
        sky: legacyDouble<World['sky']>({ dayNight: legacyDouble<NonNullable<World['sky']['dayNight']>>(h.runtime.world.sky.dayNight) }) }),
      play: legacyDouble<Play>({ hud: legacyDouble<Play['hud']>(h.runtime.play.hud), music: legacyDouble<Play['music']>({ sting: name => {
        if (name !== 'chunk') throw new Error(`Unexpected presentation sting: ${name}`);
        h.sting(name);
      } }),
        weapons: legacyDouble<Play['weapons']>(h.weapons), fullMap: legacyDouble<Play['fullMap']>(h.runtime.play.fullMap),
        minimap: { ...h.runtime.play.minimap, setMarks: () => undefined } }),
      interactables: h.runtime.interactables,
    });
    const hooks = new RetainedRuntimeHooks(shardContext(base.context, manifest, { shard: manifest, rows: new Map(),
      bag: { tab: () => () => undefined, fragment: () => () => undefined }, runtime }));
    const quest = new QuestState({ id: 'entered', title: 'Entered', completeFlag: 'entered.done', steps: [{ id: 'first', objective: 'First',
      done: { all: ['first.done'] }, markers: [{ id: 'first', label: 'First', at: { poi: 'world', x: 0, y: 4, z: -12 } }] }] }, new Flags('entered', false));
    const read = installEnteredQuestPresentation(hooks.context, quest, { reward: false });
    installEnteredRuntimeInput(hooks.context, { id: 'entered.test', actions: ['far.gust'], keys: { 'far.gust': ['KeyG'] } },
      { rows: [{ group: 'combat', id: 'far.gust', label: 'Gust', actions: ['far.gust'] }] });
    try {
      let previousView: ReturnType<typeof read> = null;
      for (let visit = 0; visit < 2; visit++) {
        hooks.activate(); const view = read(); if (view === null) throw new Error('Missing entered presentation');
        expect(view).not.toBe(previousView); previousView = view;
        expect(view.quest).toBe(quest); expect(view.chip.line.root.isConnected).toBe(true);
        expect(h.marks.size).toBe(1); expect(h.card()?.title).toBe('Entered');
        app.input.push('entered.test', h.scope); expect(app.input.allowed('far.gust')).toBe(true);
        const updates = app.systemsByPhase().update.filter(system => system.id === 'game.quest.entered');
        expect(updates).toHaveLength(1);
        updates[0]?.run(1 / 60, visit);
        hooks.deactivate();
        expect(read()).toBeNull(); expect(view.chip.line.root.isConnected).toBe(false);
        expect(h.pins.every(pin => !pin.root.isConnected)).toBe(true);
        expect(h.marks.size).toBe(0); expect(h.pois.size).toBe(0); expect(h.card()).toBeUndefined();
        expect(() => app.input.push('entered.test', h.scope)).toThrow('Unknown input context');
        expect(app.systemsByPhase().update.some(system => system.id === 'game.quest.entered')).toBe(false);
        const toasts = h.toast.mock.calls.length;
        for (let tick = 0; tick < 600; tick++) for (const system of app.systemsByPhase().update) system.run(1 / 60, tick);
        expect(h.toast.mock.calls).toHaveLength(toasts);
        expect(h.scope.census.listeners).toBe(0); expect(h.scope.census.timers).toBe(0);
      }
      quest.flags.set('first.done'); expect(quest.isComplete).toBe(true);
    } finally { h.scope.dispose(); quest.dispose(); app.levelAdapters = previous; }
  });
  it('drives the chip, active diamonds, styled world pin and MAP card from the same target', () => {
    const h = host(), view = installQuestPresentation(h.ctx, definition(), { reward: false });
    view.update(0.1, 1);
    expect(view.chip.line.root.textContent).toContain('Find the bell');
    expect(view.chip.line.root.textContent).toContain('THE BELL12 m');
    expect([...h.marks][0]?.()).toEqual([{ x: 0, z: -12, color: '#8fe3ff' }]);
    expect(h.card()).toEqual({ title: 'The Bells', objective: 'Find the bell', hint: '' });
    const first = h.pins[0];
    expect(first?.root.className).toBe('ws-quest-pin');
    expect(typeof first?.at === 'function' ? first.at()?.toArray() : null).toEqual([0, 6.2, -12]);
    view.update(0.1, 1.2);
    expect(first?.root.textContent).toBe('THE BELL12 m');
    view.quest.flags.set('bell.first');
    expect(view.markers().map((m) => m.label)).toEqual(['THE TOWER']);
    expect(typeof first?.at === 'function' ? first.at() : undefined).toBeNull();
    expect(h.toast.mock.calls.map(([message]) => message)).toContain('Step complete · Find the bell');
    expect(h.card()?.objective).toBe('Ring the bell');
    view.dispose();
    expect(h.marks.size).toBe(0); expect(h.pois.size).toBe(0); expect(h.card()).toBeUndefined();
    expect(first?.root.isConnected).toBe(false); expect(view.chip.line.root.isConnected).toBe(false);
  });

  it('discovers targets once, persists the flag, and pauses presentation in practice', () => {
    const h = host(), view = installQuestPresentation(h.ctx, definition(), { reward: false });
    practiceRoom.open = true; h.player.position.z = -12; view.update(0.1, 1);
    expect(h.toast).not.toHaveBeenCalled();
    practiceRoom.open = false; view.update(0.1, 2); view.update(0.1, 3);
    expect(h.toast.mock.calls).toEqual([['Discovered · THE BELL']]);
    expect(view.quest.flags.has('seen:bells.first')).toBe(true);
    expect([...h.pois][0]?.().find((p) => p.kind === 'place')?.label).toBe('THE BELL');
  });

  it('runs a reward hold on completion, once, and skips it for an already completed save', () => {
    const h = host(), view = installQuestPresentation(h.ctx, definition());
    view.quest.flags.set('bell.first'); view.quest.flags.set('bell.second');
    view.update(0.1, 1);
    expect(h.player.carried).toBe(true); expect(h.weapons.visible).toBe(false);
    expect(document.querySelector('.ws-quest-reward.show')?.textContent).toContain('The Bells');
    view.update(7.1, 9); view.update(1, 10);
    expect(h.player.carried).toBe(false); expect(h.weapons.visible).toBe(true); expect(view.reward?.active).toBe(false);
    view.dispose();
    const resumed = installQuestPresentation(h.ctx, definition()); resumed.update(1, 11);
    expect(resumed.quest.isComplete).toBe(true); expect(resumed.reward?.active).toBe(false);
  });

  it('uses an existing QuestState flag store, chains callbacks and removes them on dispose', () => {
    const h = host(), flags = new Flags('existing', false);
    const q = new QuestState({ id: 'q', title: 'Q', completeFlag: 'q.done', steps: [{ id: 's', objective: 'S', done: { all: ['s.done'] } }] }, flags);
    h.scope.onDispose(() => q.dispose());
    const complete = vi.fn<() => void>(); q.onComplete = complete;
    const view = installQuestPresentation(h.ctx, q, { reward: false });
    q.flags.set('s.done');
    expect(complete).toHaveBeenCalledOnce(); expect(h.toast).toHaveBeenCalledWith('Quest complete · Q');
    view.dispose(); expect(q.onComplete).toBe(complete);
  });

  it('does not discover a target on a higher floor, and offers an NPC only at its active step', () => {
    const h = host(), def = definition();
    const second = def.steps[1];
    if (second === undefined) throw new Error('Second fixture step is missing');
    second.target.position.set(0, 44, 0);
    second.target.npc = { npc: { id: 'keeper', name: 'Keeper', dialogue: [{ lines: ['Ring it'], sets: ['bell.second'] }] },
      at: new Vector3(0, 45, 0), label: 'Talk to Keeper', speaker: { talking: false } };
    const view = installQuestPresentation(h.ctx, def, { reward: false }); view.update(0.1, 1);
    expect(view.quest.flags.has('seen:bells.second')).toBe(false);
    const prompt = h.runtime.interactables[0]; expect(prompt?.radius).toBe(0);
    view.quest.flags.set('bell.first'); expect(prompt?.radius).toBe(3.2);
    h.player.position.y = 44; view.update(0.1, 2);
    expect(view.quest.flags.has('seen:bells.second')).toBe(true);
    view.dispose(); expect(h.runtime.interactables).toHaveLength(0);
  });

  it('preserves Wendell chip, markers, card title and exact beat strings across the whole quest', () => {
    const h = host(), flags = new Flags('wendell.test', false), quest = new QuestState(DRIFTWOOD_QUEST, flags);
    h.scope.onDispose(() => quest.dispose());
    const cardHost = { setQuest: (source: () => MapQuest | null) => { h.runtime.play.fullMap.addQuest(source); } };
    const view = presentQuest({ scope: h.scope, player: h.player, toast: h.toast, sting: () => h.sting('chunk'), fullMap: cardHost }, quest,
      { place: (at) => ({ x: at.x, y: 0, z: at.z }), introTitle: 'Driftwood Isle', worldPins: false, mapMarkers: false, minimapMarks: false,
        stepToast: (step, prev) => prev === null && step.id === 'shards' ? `New quest · ${DRIFTWOOD_QUEST.title}` : `Objective · ${quest.objective()}` });
    expect(h.card()?.title).toBe('Driftwood Isle'); expect(view.markers().map((m) => m.short)).toEqual(['CASTAWAY']);
    flags.set('talked:castaway'); flags.set('shard:lookout'); flags.set('shard:wreck'); flags.set('shard:cave'); flags.set('used:altar'); flags.set('dead:captain'); flags.set('seen:reward');
    expect(h.toast.mock.calls.map(([message]) => message)).toEqual([
      'New quest · The Sealed Ring', 'Objective · Set the shards in the Ring Shrine', 'Objective · Defeat the Drowned Captain', 'Objective · Stand in the ring', 'Quest complete · The Sealed Ring',
    ]);
    expect(h.sting).toHaveBeenCalledTimes(5); expect(h.card()?.hint).toBe('');
  });
});
