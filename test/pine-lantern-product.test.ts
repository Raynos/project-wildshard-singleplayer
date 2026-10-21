import { expect, test, vi } from 'vitest';
import { Vector3 } from 'three';
import { readProjectAssets } from '../src/sdk/project';
import { parseQuestPageInteractions, parseInteractionRows } from '../src/format/questInteractions';
import { bindQuestPageInteractions } from '../src/game/plugin/ui';
import { Flags } from '../src/engine/world/interact/flags';
import { Scope } from '../src/engine/app/scope';
import { QuestState } from '../src/engine/quest/core';
import type { Interactable } from '../src/engine/world/interact/types';
import { PINE_LANTERN_ROWS } from '../src/shards/pine-hollow/generators/interactions';

test('the admitted lantern bytes keep prompt order and complete the pending quest without replaying effects', async () => {
  const loaded = await readProjectAssets('src/shards/pine-hollow');
  const file = loaded.output.namedFiles?.find(row => row.name === 'quests/lanterns.json');
  if (file?.kind !== 'json') throw new Error('Missing admitted lantern JSON');
  const bytes = loaded.assets.get(file.hash);
  if (bytes === undefined) throw new Error('Missing immutable lantern bytes');
  const rows = parseQuestPageInteractions(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  expect(rows.actions.map(action => action.id)).toEqual(['pond', 'ridge', 'den', 'all-resin', 'all-tokens']);
  const questRow = loaded.shard.quests.quests.find(row => row.id === 'wardens-hollow');
  if (questRow === undefined) throw new Error('Missing real quest');
  const flags = new Flags('published-lantern-test', false);
  // Isolate the three pending lantern beats; unrelated ride/fight/dawn prerequisites are already complete.
  flags.restore(['talked:ranger', 'taken:pond-glass', 'taken:ridge-flint', 'used:ph-zip', 'followed:stag', 'dead:king', 'seen:dawn']);
  const quest = new QuestState(questRow, flags), scope = new Scope('published-lantern-test');
  const prompts: Interactable[] = [], events: string[] = [], lamps: string[] = [], shelf = { visible: true };
  const points = { pond: new Vector3(1, 2, 3), ridge: new Vector3(4, 5, 6), den: new Vector3(7, 8, 9) };
  const owners = new Map<string, unknown>([['points', points],
    ['sound', { shot: (id: string) => { events.push(id); } }], ['sfx', { interact: (id: string) => { events.push(id); } }],
    ['floor', { setLantern: (id: string, lit: boolean) => { lamps.push(`${id}:${String(lit)}`); } }], ['shelf', shelf]]);
  vi.useFakeTimers();
  try {
    const ports = { flags, interactions: parseInteractionRows({ marks: [], rows: PINE_LANTERN_ROWS }), timer: scope,
      promptIds: ['pond', 'ridge', 'den'], owners, interactables: prompts, toast: (text: string) => { events.push(text); } };
    const page = bindQuestPageInteractions(rows, ports);
    expect(prompts).toEqual(['pond', 'ridge', 'den'].map(id => page.prompt(id)));
    expect(lamps).toEqual(['waystone.pond:false', 'waystone.ridge:false', 'waystone.den:false']); expect(shelf.visible).toBe(false);
    lamps.length = 0;
    for (const id of ['pond', 'ridge', 'den']) {
      expect(quest.current?.id).toBe(id);
      const prompt = page.prompt(id); expect(prompt.label).toBe(`Relight the ${id} lantern`);
      expect(prompt.radius).toBeGreaterThan(0); events.length = 0; prompt.onInteract();
      expect(flags.has(`lit:${id}`)).toBe(true); expect(prompt.radius).toBe(0);
      expect(events).toEqual(['lanternCreak', 'ignite', `The ${id} lantern burns again`]); expect(lamps.splice(0)).toEqual([`waystone.${id}:true`]);
      await vi.advanceTimersByTimeAsync(350); expect(events.at(-1)).toBe('lanternLight');
      events.length = 0; prompt.onInteract(); expect(events).toEqual([]);
    }
    expect(quest.isComplete).toBe(true);
    // a full collection's notice and the token shelf wait on every pickup flag
    for (let i = 1; i <= 7; i++) flags.set(`token:${String(i)}`);
    events.length = 0; expect(page.run('all-tokens')).toBe(false); expect(events).toEqual([]); expect(shelf.visible).toBe(false);
    flags.set('token:8'); expect(page.run('all-tokens')).toBe(true); expect(shelf.visible).toBe(true);
    expect(events).toEqual(["All eight carved tokens — they're on the ranger's mantel now"]);
    const saved = flags.all.slice(); events.length = 0; shelf.visible = false;
    const restored = bindQuestPageInteractions(rows, { ...ports, interactables: [] });
    expect(flags.all).toEqual(saved); expect(shelf.visible).toBe(true);
    for (const id of ['pond', 'ridge', 'den']) expect(restored.prompt(id).radius).toBe(0);
    expect(events).toEqual([]); expect(lamps).toEqual([]);
  } finally { scope.dispose(); quest.dispose(); vi.useRealTimers(); }
}, 30_000);
