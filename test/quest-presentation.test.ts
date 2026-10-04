// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { app, Flags, Scope, practiceRoom, type FullMapPoi, type MapMark, type MapQuest, type SystemSpec, type Interactable } from '@wildshard/engine';
import { installQuestPresentation, presentQuest, QuestState, type QuestPresentationContext, type PresentedQuestDef } from '@wildshard/game';
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
