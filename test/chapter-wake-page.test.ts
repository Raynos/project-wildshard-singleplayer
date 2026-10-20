// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import { Vector3 } from 'three';
import { App } from '../src/engine/app/app';
import { Scope } from '../src/engine/app/scope';
import { Flags } from '../src/engine/world/interact/flags';
import { QuestState } from '../src/engine/quest/core';
import { overrideTerrain } from '../src/engine/world/Heightfield';
import { nameBlob } from '../src/sdk/blobs';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { manager } from './fake/manager';
import { publishBoundQuest } from '../src/game/quest/boundState';
import { installChapterStory } from '../src/game/quest/chapter';
import { installChapterWakeEncounter } from '../src/game/quest/chapterDirector';
import type { ShardContext } from '../src/game/plugin/context';
import { parseChapterWake } from '../src/format/chapterDirector';
import { PAGE_STORY } from '../src/shards/driftwood-isle/generators/pageStory';
import { WAKE_ENCOUNTER } from '../src/shards/driftwood-isle/generators/wakeEncounter';
import source from '../src/shards/driftwood-isle/shard.config';
import { CHAPTER_DIRECTOR } from '../src/shards/driftwood-isle/generators/chapterDirector';
import declaration from '../src/shards/driftwood-isle/data/director.json';
import module from '../src/shards/driftwood-isle/behaviour/director.json';
import stages from '../src/shards/driftwood-isle/data/finaleStages.json';
import bindings from '../src/shards/driftwood-isle/data/directorBindings.json';

test('salt-marsh chapter binds cue effects and the baseline boss bar through data', async () => {
  const runtime = source.runtime, spawns = runtime?.spawns, original = spawns?.bosses[0];
  if (spawns === undefined || original === undefined) throw new Error('Missing declared fixture spawn');
  const blobs = [nameBlob('directors/main.json', 'json', new TextEncoder().encode(JSON.stringify({
    declaration, module: { module: module.module, bytes: module.bytes }, stages, bindings, seed: 357,
  }))), nameBlob('quests/chapter-director.json', 'json', new TextEncoder().encode(JSON.stringify(CHAPTER_DIRECTOR)))];
  const bytes = new Map(blobs.map(blob => [blob.file.hash, blob.bytes]));
  const product = createShardProduct({ slug: 'salt-marsh', revision: 1,
    shardfile: { ...source, identity: { ...source.identity, slug: 'salt-marsh' },
      runtime: { ...runtime, spawns: { ...spawns, bosses: [{ ...original, id: 'marsh.sentry', kind: 'boar', look: 'boar', at: [4, -3] }] } } },
    sections: new Map(), files: new Map(blobs.map(blob => [blob.file.name ?? '', { hash: blob.file.hash, url: `/${blob.file.path}` }])),
    read: hash => { const value = bytes.get(hash); return value === undefined ? Promise.reject(new Error('Missing fixture bytes')) : Promise.resolve(value); }, check: false });
  const scope = new Scope('marsh-chapter'), app = new App(), flags = new Flags('marsh-chapter', false);
  const definition = product.shardfile.quests.quests[0]; if (definition === undefined) throw new Error('Missing fixture quest');
  const quest = new QuestState(definition, flags), events: string[] = [];
  publishBoundQuest(scope, quest);
  const player = { position: new Vector3(), velocity: new Vector3(), yaw: 0, pitch: 0, carried: false };
  const systems = new Map<string, Parameters<ShardContext['system']>[0]>();
  const restoreTerrain = overrideTerrain({ heightAt: () => 0, normalAt: () => [0, 1, 0], waterLevel: () => -100 });
  const animals = manager().manager, context = { scope, product, app } as ShardContext;
  Object.defineProperties(context, {
    game: { value: { runtime: { world: { player, sky: { dayNight: null } }, play: {
      animals, weapons: { visible: true }, inventory: { add: () => undefined, take: () => false },
      hud: { toast: (text: string) => { events.push(text); } },
      music: { sting: (name: string) => { events.push(name); }, combat: (n: number) => { events.push(`combat:${String(n)}`); } },
      fullMap: { setQuest: () => undefined },
    } } } },
    system: { value: (row: Parameters<ShardContext['system']>[0]) => { systems.set(row.id, row); } },
    on: { value: (name: 'player.died', run: () => void) => { app.events.on(name, run, scope); } },
  });
  const rows = parseChapterWake({ ...WAKE_ENCOUNTER, spawn: 'marsh.sentry',
    encounter: { ...WAKE_ENCOUNTER.encounter, id: 'boss.sentry', level: 'salt-marsh', kind: 'boar', name: 'The Reed Sentry',
      fields: { ...WAKE_ENCOUNTER.encounter.fields, poolX: 'postX', poolZ: 'postZ', arena: 'leash' } },
    cues: WAKE_ENCOUNTER.cues.map(row => Object.assign(structuredClone(row), { effects: [{ kind: 'toast', text: row.operation }] })),
  });
  try {
    const chapter = scope.run(() => installChapterStory(context, PAGE_STORY));
    expect(chapter.quest.flags).toBe(flags);
    const binding = await scope.run(() => installChapterWakeEncounter(context, rows, { x: 4, z: -3 }));
    expect(binding.actor).toBeNull(); expect(animals.animals).toEqual([]);
    flags.set('used:altar');
    systems.get(rows.systems.director)?.run(.1, .1);
    expect(binding.actor).toBe(animals.animals[0]); expect(binding.actor?.kind).toBe('boar'); expect(binding.actor?.herd).toBe(-1);
    expect(binding.actor?.mem).toMatchObject({ postX: 4, postZ: -3, leash: 22, awake: 1 });
    expect(events).toEqual(['wake', 'combat:1']);
    flags.set('dead:captain'); systems.get(rows.systems.director)?.run(.1, .2); expect(events.at(-1)).toBe('effects');
    expect([...systems.keys()]).toEqual([rows.systems.encounter, rows.systems.director]);
    const before = [...events]; scope.dispose(); flags.clear('used:altar'); flags.set('used:altar'); expect(events).toEqual(before);
    expect(() => parseChapterWake({ ...rows, cues: [...rows.cues, rows.cues[0]] })).toThrow();
    expect(() => parseChapterWake({ ...rows, hooks: {} })).toThrow();
  } finally { scope.dispose(); quest.dispose(); animals.animals.slice().forEach(animal => { animals.retire(animal); }); restoreTerrain(); document.body.replaceChildren(); }
});
