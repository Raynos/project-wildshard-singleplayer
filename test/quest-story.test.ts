// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import { Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import { app } from '../src/engine/app/runtime';
import { Flags } from '../src/engine/world/interact/flags';
import { parseQuestStory } from '../src/format/questStory';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import type { Progress } from '../src/game/Progress';
import { progressSave } from '../src/game/saves';
import { bindStoryAchievements, readQuestStory, observeStoryFlags, bindStoryBench } from '../src/game/quest/story';
import { questBenchPose } from '../src/game/quest/storyLaw';
import { PAGE_STORY as driftStory } from '../src/shards/driftwood-isle/generators/pageStory';
import { PAGE_STORY as pineStory } from '../src/shards/pine-hollow/generators/pageStory';
import { DRIFTWOOD_FEAT_COUNTERS } from '../src/shards/driftwood-isle/generators/questInventory';
import { PINE_FEAT_COUNTERS } from '../src/shards/pine-hollow/generators/questInventory';
import drift from '../src/shards/driftwood-isle/shard.config';
import pine from '../src/shards/pine-hollow/shard.config';

function product(source: typeof drift, story: typeof driftStory, counters: typeof DRIFTWOOD_FEAT_COUNTERS | typeof PINE_FEAT_COUNTERS) {
  const policy = { ...counters, feats: counters.feats.map(({ id, count, ...row }) => ({ id, count,
    ...('kind' in row ? { kind: row.kind } : {}), ...('event' in row ? { event: row.event } : {}), ...('variant' in row ? { variant: row.variant } : {}) })) };
  const values = new Map<string, unknown>([['quests/story.json', story], ['quests/achievements.json', policy]]);
  return createShardProduct({ slug: source.identity.slug, revision: source.identity.revision, shardfile: source, sections: new Map(),
    files: new Map([...values.keys()].map(name => [name, { hash: name, url: name }])),
    read: name => Promise.resolve(new TextEncoder().encode(JSON.stringify(values.get(name)))) });
}

test('DW imports old Progress counts, reloads ledger counts and pays each identity once', async () => {
  const instance = 'story-drift-progress', scope = new Scope(instance), next = new Scope(`${instance}-reload`);
  const p = product(drift, driftStory, DRIFTWOOD_FEAT_COUNTERS), refreshed: string[] = [];
  let view: Parameters<Progress['bindLedger']>[0] | undefined;
  const progress = { rows: [{ def: { id: 'crab10' }, count: 4 }], refreshLedger: () => { refreshed.push('refresh'); }, bindLedger: (value: NonNullable<typeof view>) => { view = value; } };
  try {
    const story = await readQuestStory({ product: p });
    const bound = await bindStoryAchievements({ app, scope, product: p }, story, progress, instance);
    expect(view?.count('crab10')).toBe(4); expect(refreshed).toHaveLength(4);
    bound.kill('crab'); expect(view?.count('crab10')).toBe(5);
    expect(view?.checkpoint()).toBe(true);
    scope.dispose();
    const reload = await bindStoryAchievements({ app, scope: next, product: p }, story, { ...progress, rows: [] }, instance);
    expect(view?.count('crab10')).toBe(5);
    reload.kill('crab'); expect(view?.count('crab10')).toBe(6);
    expect(reload.facts.achievement('crab10')?.count).toBe(6);
  } finally { scope.dispose(); next.dispose(); }
});

test('Pine replays its old saved counters, retains its record and prefixed ledger view', async () => {
  const instance = 'story-pine-progress', scope = new Scope(instance), next = new Scope(`${instance}-reload`);
  const previous = progressSave.read(instance);
  expect(progressSave.write({ ...previous, counts: { deer5: 2 } }, instance)).toBe(true);
  const p = product(pine, pineStory, PINE_FEAT_COUNTERS);
  let refreshes = 0;
  try {
    const first = await bindStoryAchievements({ app, scope, product: p }, pineStory, { refreshLedger: () => { refreshes++; } }, instance);
    expect(first.facts.achievement('pine-hollow.deer5')?.count).toBe(2); expect(refreshes).toBe(0);
    first.kill('deer'); expect(refreshes).toBe(1);
    expect(first.facts.achievement('pine-hollow.deer5')?.count).toBe(3);
    scope.dispose();
    progressSave.write({ ...previous, counts: {} }, instance);
    const reload = await bindStoryAchievements({ app, scope: next, product: p }, pineStory, undefined, instance);
    expect(reload.facts.achievement('pine-hollow.deer5')?.count).toBe(3);
    reload.kill('deer'); expect(reload.facts.achievement('pine-hollow.deer5')?.count).toBe(4);
  } finally { scope.dispose(); next.dispose(); }
});

test('story flag effects keep sync-before-notice order, filtering and entry disposal', () => {
  const scope = new Scope('story-flags'), flags = new Flags('story-flags', false), events: string[] = [];
  const story = parseQuestStory({ ...driftStory, notices: [{ prefix: 'glass:', total: 2, text: 'Every piece' }] });
  observeStoryFlags(story, scope, flags, new Map<string, unknown>([['counters', { syncFlags: () => { events.push('sync'); } }], ['hud', { toast: (text: string) => { events.push(text); } }]]));
  flags.set('plate:test'); flags.set('lever:test'); expect(events).toEqual(['sync']);
  flags.set('glass:1'); flags.set('glass:2'); expect(events).toEqual(['sync', 'sync', 'sync', 'Every piece']);
  scope.dispose(); flags.set('after:dispose'); expect(events).toHaveLength(4);
  expect(() => parseQuestStory({ ...story, journal: { ...story.journal, refresh: 'later' } })).toThrow();
  expect(() => parseQuestStory({ ...story, bench: { ...story.bench, forward: Infinity } })).toThrow();
});

test('page and native seats retain the original two floor laws, yaw, pitch and velocity reset', () => {
  const at = new Vector3(4, 6, 8), yaw = .7;
  const player = { position: new Vector3(), velocity: new Vector3(3, 4, 5), yaw: 0, pitch: 0 };
  const kit: { onSit?: (point: Vector3, angle: number) => void } = {}, toasts: string[] = [];
  bindStoryBench(driftStory, kit, player, new Map<string, unknown>([['hud', { toast: (text: string) => { toasts.push(text); } }], ['placement', { floorAt: (x: number, z: number) => x + z }]]));
  kit.onSit?.(at, yaw);
  expect(player.position.toArray()).toEqual([at.x + Math.sin(yaw) * .2, (at.x + Math.sin(yaw) * .2) + (at.z + Math.cos(yaw) * .2), at.z + Math.cos(yaw) * .2]);
  expect(player.velocity.length()).toBe(0); expect(player.yaw).toBe(yaw + Math.PI); expect(player.pitch).toBe(.04);
  expect(toasts).toEqual(['You sit a while. The sea goes on and on.']);
  const native = questBenchPose(pineStory.bench, at, yaw);
  bindStoryBench(pineStory, kit, player, new Map([['hud', { toast: () => undefined }]])); kit.onSit?.(at, yaw);
  expect(player.position.toArray()).toEqual([native.x, 6.02, native.z]); expect(player.pitch).toBe(.05);
  expect(() => questBenchPose(driftStory.bench, at, yaw)).toThrow('floor');
});
