import { expect, test } from 'vitest';
import { NativeQuestCompositionSchema, NativeQuestServiceSpotsSchema, parseNativeQuestComposition, parseNativeQuestServiceSpots } from '../src/format/nativeQuestComposition';
import { namedJsonSchema } from '../src/sdk/formatJsonSchema';
import { encodeCanonicalJson } from '../src/sdk/immutable';
import { validateNamedJsonSchema } from '../src/game/shardfile/customSchema';
import { PINE_NATIVE_QUEST } from '../src/shards/pine-hollow/generators/nativeQuest';
import spots from '../src/shards/pine-hollow/data/spotsRows.json';

const placements = () => ({ rows: spots.rows, people: spots.people, board: spots.board, pickup: spots.rifle, cable: spots.zip, signals: spots.lanterns });
const bytes = (rows: unknown) => new TextEncoder().encode(encodeCanonicalJson(rows));

test('build admission keeps the frame wire and every existing cable endpoint', () => {
  const input = PINE_NATIVE_QUEST, at = placements();
  expect(bytes(parseNativeQuestComposition(input))).toEqual(bytes(input));
  expect(bytes(parseNativeQuestServiceSpots(at))).toEqual(bytes(at));
  expect(parseNativeQuestServiceSpots(at).cable).toEqual(spots.zip);
  expect(validateNamedJsonSchema(namedJsonSchema(NativeQuestCompositionSchema), bytes(input))).toEqual(input);
  expect(validateNamedJsonSchema(namedJsonSchema(NativeQuestServiceSpotsSchema), bytes(at))).toEqual(at);
});

test('native documents refuse malformed owner data before runtime construction', () => {
  const input = PINE_NATIVE_QUEST, at = placements(), policySchema = namedJsonSchema(NativeQuestCompositionSchema), spotsSchema = namedJsonSchema(NativeQuestServiceSpotsSchema);
  if (input.ammunition === undefined || input.bench === undefined) throw new Error('Missing original native services');
  for (const invalid of [{ ...input, ammunition: { launcher: 0.5 } }, { ...input, eye: Infinity }, { ...input, run: 'callback' },
    { ...input, bench: { ...input.bench, pose: { ...input.bench.pose, terrain: 'false' } } }]) {
    expect(() => parseNativeQuestComposition(invalid)).toThrow();
    expect(() => validateNamedJsonSchema(policySchema, bytes(invalid))).toThrow();
  }
  for (const invalid of [{ ...at, cable: { ...at.cable, landing: { x: 1, z: 2 } } },
    { ...at, pickup: { ...at.pickup, radius: 0 } }, { ...at, people: [{ kind: 'ranger', at: { x: 0, y: 0, z: 0 }, prompt: null }] }]) {
    expect(() => parseNativeQuestServiceSpots(invalid)).toThrow();
    expect(() => validateNamedJsonSchema(spotsSchema, bytes(invalid))).toThrow();
  }
});

test('build references refuse ambiguous saves, finish identities, phases and placement identities', () => {
  const input = PINE_NATIVE_QUEST, at = placements();
  if (input.board === undefined || input.chapter === undefined) throw new Error('Missing original contract board or chapter');
  const { reward: _reward, ...chapter } = input.chapter;
  for (const invalid of [{ ...input, saved: { ...input.saved, names: { ...input.saved.names, lead: 'counts' } } },
    { ...input, board: { ...input.board, ids: ['missing'] } },
    { ...input, board: { ...input.board, ids: [...input.board.ids, input.board.finish] } },
    { ...input, chapter: { ...chapter, observations: { reward: { read: 'reward-x' } } } },
    { ...input, phases: [...input.phases, 'lead'] }, { ...input, saved: { ...input.saved, restore: [] } }]) expect(() => parseNativeQuestComposition(invalid)).toThrow();
  expect(() => parseNativeQuestServiceSpots({ ...at, rows: [...at.rows, at.rows[0]] })).toThrow();
  expect(() => parseNativeQuestServiceSpots({ ...at, people: [...at.people, at.people[0]] })).toThrow();
});
