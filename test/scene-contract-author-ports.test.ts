import { expect, expectTypeOf, test } from 'vitest';
import * as v from 'valibot';
import { worldSceneMotion, type AuthorPrivateScene, type AuthorWorldSceneRecipe, type AuthorWorldScenePlacement,
  type AuthorWorldConstruction, type AuthorWorldEntry, type AuthorWorldEntryStep, type AuthorRopeDeckSite,
  type AuthorWorldUpdates, type AuthorSceneMotion } from '../src/sdk/worldScenes';
import type { AuthorQuestWorld } from '../src/sdk/quests';
import type { PrivateScene, WorldSceneRecipe } from '../src/format/clientChannels';
import type { WorldScenePlacementRow } from '../src/format/worldScenePlacement';
import type { WorldConstructionRows } from '../src/format/worldAssembly';
import type { WorldEntryRows, WorldEntryStep } from '../src/format/worldEntry';
import type { RopeDeckSiteRows } from '../src/format/ropeDeckSite';
import type { WorldUpdatesRows } from '../src/format/worldUpdates';
import type { QuestWorldRows } from '../src/format/questWorld';
import { parseSceneMotion, type SceneMotion } from '../src/format/sceneMotion';
import { SIGNAL_SCENE_MOTION } from '../src/shards/sunscar-dunes/generators/clientMotion';

function outcome(run: () => unknown): unknown {
  try { return { rows: run() }; }
  catch (error) {
    if (error instanceof v.ValiError) return { issues: error.issues };
    if (error instanceof Error) return { name: error.name, message: error.message };
    throw error;
  }
}

test('scene author ports retain every complete native hierarchy, placement, entry and ownership type', () => {
  expectTypeOf<AuthorPrivateScene>().toEqualTypeOf<PrivateScene>();
  expectTypeOf<AuthorWorldSceneRecipe>().toEqualTypeOf<WorldSceneRecipe>();
  expectTypeOf<AuthorWorldScenePlacement>().toEqualTypeOf<WorldScenePlacementRow>();
  expectTypeOf<AuthorWorldConstruction>().toEqualTypeOf<WorldConstructionRows>();
  expectTypeOf<AuthorWorldEntry>().toEqualTypeOf<WorldEntryRows>();
  expectTypeOf<AuthorWorldEntryStep>().toEqualTypeOf<WorldEntryStep>();
  expectTypeOf<AuthorRopeDeckSite>().toEqualTypeOf<RopeDeckSiteRows>();
  expectTypeOf<AuthorWorldUpdates>().toEqualTypeOf<WorldUpdatesRows>();
  expectTypeOf<AuthorSceneMotion>().toEqualTypeOf<SceneMotion>();
  expectTypeOf<AuthorQuestWorld>().toEqualTypeOf<QuestWorldRows>();
});

test('native scene motion retains complete rows, detached ownership and plain-data refusals', () => {
  const input = structuredClone(SIGNAL_SCENE_MOTION), rows = worldSceneMotion(input);
  expect(rows).toEqual(parseSceneMotion(input)); expect(rows).not.toBe(input);
  for (const bad of [null, {}, { ...input, owner: 'invalid' }, { ...input, groups: () => [] }]) {
    expect(outcome(() => worldSceneMotion(bad))).toEqual(outcome(() => parseSceneMotion(bad)));
    expect(() => worldSceneMotion(bad)).toThrow();
  }
});
