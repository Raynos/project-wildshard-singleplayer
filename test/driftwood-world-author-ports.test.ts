import { expect, expectTypeOf, test } from 'vitest';
import * as v from 'valibot';
import { roadSocketMetrics } from '../src/sdk/entries';
import { collectionDisplayRows } from '../src/sdk/rows';
import { chapterWakeRows } from '../src/sdk/quests';
import { speciesProgramRows } from '../src/sdk/species';
import { toonSceneLook } from '../src/sdk/worldScenes';
import { CHUNK_HALF, ENTRY_WIDTH, ENTRY_ASPHALT } from '../src/format/contentBounds';
import { parseCollectionDisplays } from '../src/format/collectionDisplay';
import { parseChapterWake } from '../src/format/chapterDirector';
import { readSpeciesProgram } from '../src/format/speciesPrograms';
import { parseToonLook } from '../src/format/toonLook';
import { collectionRows } from '../src/shards/driftwood-isle/generators/collections';
import { WAKE_ENCOUNTER } from '../src/shards/driftwood-isle/generators/wakeEncounter';
import { DRIFTWOOD_ENEMY_PROGRAM } from '../src/shards/driftwood-isle/generators/speciesPrograms';
import { TOON_LOOK } from '../src/shards/driftwood-isle/generators/toonPresentation';

function result(run: () => unknown): unknown {
  try { return { rows: run() }; }
  catch (error) {
    if (error instanceof v.ValiError) return { issues: error.issues };
    throw error;
  }
}

test('author socket dimensions retain native values and detached caller ownership', () => {
  const metrics = roadSocketMetrics();
  expect(metrics).toEqual({ half: CHUNK_HALF, width: ENTRY_WIDTH, asphalt: ENTRY_ASPHALT });
  metrics.half = 0;
  expect(roadSocketMetrics().half).toBe(CHUNK_HALF);
});

test('complete author world contracts preserve exact native types and serialized rows', () => {
  expectTypeOf<ReturnType<typeof collectionDisplayRows>>().toEqualTypeOf<ReturnType<typeof parseCollectionDisplays>>();
  expectTypeOf<ReturnType<typeof chapterWakeRows>>().toEqualTypeOf<ReturnType<typeof parseChapterWake>>();
  expectTypeOf<ReturnType<typeof speciesProgramRows>>().toEqualTypeOf<ReturnType<typeof readSpeciesProgram>>();
  expectTypeOf<ReturnType<typeof toonSceneLook>>().toEqualTypeOf<ReturnType<typeof parseToonLook>>();
  const pairs = [
    [collectionDisplayRows, parseCollectionDisplays, collectionRows()],
    [chapterWakeRows, parseChapterWake, WAKE_ENCOUNTER],
    [speciesProgramRows, readSpeciesProgram, DRIFTWOOD_ENEMY_PROGRAM],
    [toonSceneLook, parseToonLook, TOON_LOOK],
  ] as const;
  for (const [author, native, rows] of pairs) {
    expect(JSON.stringify(author(rows))).toBe(JSON.stringify(native(rows)));
    expect(author(rows)).not.toBe(rows);
    for (const malformed of [null, {}, { ...rows, extra: true }, { ...rows, unexpected: () => 0 }]) {
      expect(result(() => author(malformed))).toEqual(result(() => native(malformed)));
      if (malformed === null || Object.keys(malformed).length === 0) expect(() => author(malformed)).toThrow();
    }
  }
});
