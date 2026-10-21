import { expect, test } from 'vitest';
import { NativeStoryPolicySchema, NativeStorySpotsSchema, parseNativeStoryPolicy, parseNativeStorySpots } from '../src/format/nativeStoryRows';
import { namedJsonSchema } from '../src/sdk/formatJsonSchema';
import { encodeCanonicalJson } from '../src/sdk/immutable';
import { validateNamedJsonSchema } from '../src/game/shardfile/customSchema';
import story from '../src/shards/pine-hollow/data/nativeStory.json';
import spots from '../src/shards/pine-hollow/data/spotsRows.json';

function policy() {
  const { actions: _actions, cancel: _cancel, actor: _actor, trade: _trade, ammo: _ammo, touch: _touch, latch: _latch, ...rows } = story;
  return { ...rows, transitions: { ids: ['dam-sluice'], rowLimit: 1, flagLimit: 16, touch: 'direct', pickup: 'walk-in' },
    clock: { version: 1, quest: 'chapter', caption: { kicker: 'Chapter', title: 'Start', subtitle: '' },
      observations: {}, actions: {}, source: 'optional', initialDt: 0, changes: [], requests: [] } };
}
const placements = () => ({ rows: spots.rows, people: spots.people, board: spots.board, pickup: spots.rifle, cable: spots.zip, signals: spots.lanterns });
const bytes = (rows: unknown) => new TextEncoder().encode(encodeCanonicalJson(rows));

test('build admission keeps policy wire names and every cable endpoint without changing document bytes', () => {
  const input = policy(), at = placements();
  expect(bytes(parseNativeStoryPolicy(input))).toEqual(bytes(input));
  expect(bytes(parseNativeStorySpots(at))).toEqual(bytes(at));
  expect(parseNativeStorySpots(at).cable).toEqual(spots.zip);
  expect(validateNamedJsonSchema(namedJsonSchema(NativeStoryPolicySchema), bytes(input))).toEqual(input);
  expect(validateNamedJsonSchema(namedJsonSchema(NativeStorySpotsSchema), bytes(at))).toEqual(at);
});

test('native documents refuse invalid owner data before runtime construction', () => {
  const input = policy(), at = placements(), policySchema = namedJsonSchema(NativeStoryPolicySchema), spotsSchema = namedJsonSchema(NativeStorySpotsSchema);
  for (const invalid of [{ ...input, launcher: 0.5 }, { ...input, eye: Infinity }, { ...input, run: 'callback' },
    { ...input, bench: { ...input.bench, terrain: 'false' } }]) {
    expect(() => parseNativeStoryPolicy(invalid)).toThrow();
    expect(() => validateNamedJsonSchema(policySchema, bytes(invalid))).toThrow();
  }
  for (const invalid of [{ ...at, cable: { ...at.cable, landing: { x: 1, z: 2 } } },
    { ...at, pickup: { ...at.pickup, radius: 0 } }, { ...at, people: [{ kind: 'ranger', at: { x: 0, y: 0, z: 0 }, prompt: null }] }]) {
    expect(() => parseNativeStorySpots(invalid)).toThrow();
    expect(() => validateNamedJsonSchema(spotsSchema, bytes(invalid))).toThrow();
  }
});

test('build references refuse ambiguous saves, finishes, chapter poses and placement identities', () => {
  const input = policy(), at = placements();
  for (const invalid of [{ ...input, savedNames: { ...input.savedNames, lead: 'counts' } },
    { ...input, finish: { ...input.finish, ids: ['missing'] } },
    { ...input, finish: { ...input.finish, ids: [...input.finish.ids, input.finish.id] } },
    { ...input, clock: { ...input.clock, observations: { reward: { read: 'reward-x' } } } }]) expect(() => parseNativeStoryPolicy(invalid)).toThrow();
  expect(() => parseNativeStorySpots({ ...at, rows: [...at.rows, at.rows[0]] })).toThrow();
  expect(() => parseNativeStorySpots({ ...at, people: [...at.people, at.people[0]] })).toThrow();
});
