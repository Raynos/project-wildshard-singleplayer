// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { Flags } from '../src/engine/world/interact/flags';
import { parseQuestHost } from '../src/format/questHost';
import { bindPageQuestStages } from '../src/game/plugin/ui';
import { QUEST_HOST as signal } from '../src/shards/sunscar-dunes/data/questHost';
import { QUEST_HOST as sky } from '../src/shards/far-reach/data/questHost';
import { FLAG } from '../src/shards/sunscar-dunes/data/flags';
import { FLAGS } from '../src/shards/far-reach/quests/flags';

it('a loaded lit Signal save stays quiet', () => {
  const flags = new Flags('page-signal-loaded', false); flags.set(FLAG.lit);
  let summoned = false;
  const stages = bindPageQuestStages({ system: () => undefined }, { questHost: parseQuestHost(signal) }, { flags,
    bindings: new Map([['sunscar.signal-fire', [{ action: { spawn: 'sunscar.matriarch' }, run: () => { summoned = true; } }]]]) });
  stages.advance('sunscar.signal-fire');
  expect(summoned).toBe(false);
});

it('accepted Signal fire summons once and refuses unknown stage identities', () => {
  const flags = new Flags('page-signal-edge', false); let summoned = false;
  const stages = bindPageQuestStages({ system: () => undefined }, { questHost: parseQuestHost(signal) }, { flags,
    bindings: new Map([['sunscar.signal-fire', [{ action: { spawn: 'sunscar.matriarch' }, run: () => { summoned = true; } }]]]) });
  flags.set(FLAG.lit); stages.advance('sunscar.signal-fire'); expect(summoned).toBe(true);
  summoned = false; stages.advance('sunscar.signal-fire'); expect(summoned).toBe(false);
  expect(() => stages.advance('foreign-stage')).toThrow('Undeclared page quest stage');
});

it('Sky progress observes living roost bodies and the actual raised winch', () => {
  const flags = new Flags('page-sky', false); flags.set(FLAGS.notes);
  const updates: (() => void)[] = []; let alive = true, raised = false;
  bindPageQuestStages({ system: spec => { updates.push(() => { spec.run(1 / 60, 0); }); } }, { questHost: parseQuestHost(sky) }, {
    flags, actor: () => ({ alive }), observations: new Map([['winch-up', () => raised]]) });
  for (const update of updates) update();
  expect(flags.has(FLAGS.roost)).toBe(false); expect(flags.has(FLAGS.raised)).toBe(false);
  alive = false; raised = true; for (const update of updates) update();
  expect(flags.has(FLAGS.roost)).toBe(true); expect(flags.has(FLAGS.raised)).toBe(true);
});
