import { expect, it } from 'vitest';
import { parseShardfile, shardfileRules } from '@wildshard/sdk/shardfile';
import { emptyShardfile } from '@wildshard/sdk/author';
import { emptyShardfileSource } from '@wildshard/game/shardfile/loader';
import { TEMPLATE_ROWS } from '../src/shards/_template/data/rows';
import { CREATURES } from '../src/shards/_template/data/creatures';
import { ENCOUNTERS, ENCOUNTER_UI } from '../src/shards/_template/data/encounters';
import { TEMPLATE_QUESTS } from '../src/shards/_template/data/quests';
import { TEMPLATE_LEDGER } from '../src/shards/_template/data/ledger';
import { TEMPLATE_AUDIO } from '../src/shards/_template/data/audio';

const empty = () => emptyShardfile({ slug: 'sections-test', name: 'Sections', author: 'Fixture', revision: 1, seed: 1 });
const fixture = () => {
  const source = empty(); source.serverBudget.entities = CREATURES.spawns.length;
  return parseShardfile({ ...source, rows: TEMPLATE_ROWS, creatures: CREATURES, encounters: ENCOUNTERS, ui: ENCOUNTER_UI, quests: TEMPLATE_QUESTS, audio: TEMPLATE_AUDIO, ledger: TEMPLATE_LEDGER });
};
it('keeps legacy empty fixtures compatible and default sections empty', () => {
  const source = empty();
  expect(source.terrain).toBeNull(); expect(source.water).toEqual([]); expect(source.creatures).toEqual({ brains: [], groups: [], spawns: [] });
  expect(source.quests).toEqual({ flags: [], quests: [], triggers: [], dialogue: [] });
  expect(source.audio).toEqual({ cues: [], routing: [], ambience: null, score: 'silent' });
  expect(() => emptyShardfileSource(source)).not.toThrow();
});
it('composes template declarations with matching species strikes actors and boss panels', () => {
  const source = fixture(), wire = JSON.stringify(source);
  expect(parseShardfile(JSON.parse(wire))).toEqual(source);
  expect(shardfileRules(source)).toEqual([]);
  expect(() => emptyShardfileSource(source)).toThrow('full shardfile loader');
});
it.each(['variant', 'strike', 'panel', 'capacity', 'controller'])('rejects a dangling or multiply controlled declaration: %s', (kind) => {
  const source = fixture(), spawn = source.creatures.spawns[0]; if (spawn === undefined) throw new Error('Missing spawn');
  if (kind === 'variant') spawn.variant = 'missing';
  if (kind === 'strike') spawn.strike = 'missing';
  if (kind === 'panel') source.ui = [];
  if (kind === 'capacity') source.serverBudget.entities = 0;
  if (kind === 'controller') spawn.brain = null;
  expect(() => parseShardfile(source)).toThrow();
});
it('refuses every unbound section in the minimal loader', () => {
  const source = empty();
  source.water = [{ kind: 'pool', id: 'pool', level: 0, shape: { kind: 'circle', x: 0, z: 0, radius: 1 } }];
  expect(() => emptyShardfileSource(source)).toThrow('full shardfile loader');
  source.water = []; source.audio = TEMPLATE_AUDIO;
  expect(() => emptyShardfileSource(source)).toThrow('full shardfile loader');
  source.audio = { cues: [], routing: [{ id: 'cue.fixture', when: [], actions: [] }], ambience: null, score: 'silent' };
  expect(() => emptyShardfileSource(source)).toThrow('full shardfile loader');
  source.audio = { cues: [], routing: [], ambience: null, score: 'silent' }; source.ledger = TEMPLATE_LEDGER;
  expect(() => emptyShardfileSource(source)).toThrow('full shardfile loader');
});
