import { expect, expectTypeOf, test } from 'vitest';
import type { AuthorGraph, AuthorGraphNode, AuthorGraphRef, AuthorGraphParam, AuthorPostGraphLook } from '../src/sdk/bake/materialGraph';
import type { GraphIr, GraphNode, GraphRef, GraphParam } from '../src/format/materialGraph';
import type { PostGraphLookRow } from '../src/format/postGraphLook';
import type { WorldSceneModels } from '../src/format/worldSceneModels';
import type { worldSceneModels } from '../src/sdk/worldScenes';
import type { AuthorSpawnTables } from '../src/sdk/spawns';
import type { SpawnTables } from '../src/format/spawnTables';
import type { AuthorExchangeRows } from '../src/sdk/rows';
import type { ExchangeRows } from '../src/format/exchange';
import { graphSceneAuthorObservation } from './fixtures/graph-scene-author-observation';
import original from './fixtures/graph-scene-author-original.json' with { type: 'json' };

test('all graph, scene-model, spawn and exchange ports retain exact complete native types', () => {
  expectTypeOf<AuthorGraph>().toEqualTypeOf<GraphIr>();
  expectTypeOf<AuthorGraphNode>().toEqualTypeOf<GraphNode>();
  expectTypeOf<AuthorGraphRef>().toEqualTypeOf<GraphRef>();
  expectTypeOf<AuthorGraphParam>().toEqualTypeOf<GraphParam>();
  expectTypeOf<AuthorPostGraphLook>().toEqualTypeOf<PostGraphLookRow>();
  expectTypeOf<ReturnType<typeof worldSceneModels>>().toEqualTypeOf<WorldSceneModels>();
  expectTypeOf<AuthorSpawnTables>().toEqualTypeOf<SpawnTables>();
  expectTypeOf<AuthorExchangeRows>().toEqualTypeOf<ExchangeRows>();
});

test('every original graph, model-choice, spawn and exchange declaration byte remains unchanged', () => {
  expect(graphSceneAuthorObservation()).toEqual(original);
});
