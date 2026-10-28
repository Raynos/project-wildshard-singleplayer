import { expect, expectTypeOf, test } from 'vitest';
import type { modelSceneSourceFile, bakedSceneSourceFile } from '../src/sdk/worldScenes';
import type { readManifestSource } from '../src/sdk/projectManifest';
import type { RigLibraryRows, ModelSpecimenRow } from '../src/game/plugin/geometry';
import type { BakedColliderInput, WorldPieceRow } from '../src/game/shardfile/bakedKinds';
import type { ChunkHorizon } from '../src/game/shard/manifest';
import type { skyRigLibrary } from '../src/shards/far-reach/generators/rigLibrary';
import type { BakedPiece } from '../src/shards/far-reach/generators/fileInventory';
import { nalatiDayChannels } from '../src/shards/nalati-grasslands/generators/dayChannels';
import { NALATI_HORIZON_V2 } from '../src/shards/nalati-grasslands/generators/horizon';
import { hashImmutableBytes } from '../src/sdk/immutable';
import original from './fixtures/nalati-sky-author-original.json' with { type: 'json' };

test('source emitter ports retain complete native rigs, specimens, contacts and generic world rows', () => {
  type Models = Parameters<typeof modelSceneSourceFile>[1];
  type Placements = NonNullable<Parameters<typeof bakedSceneSourceFile>[1]['placements']>;
  type World = Placements['rows'][number];
  type Restricted = Omit<World, 'baked'> & { readonly baked?: BakedPiece };
  expectTypeOf<NonNullable<Models['rows']['rigs']>>().toEqualTypeOf<RigLibraryRows>();
  expectTypeOf<ReturnType<typeof skyRigLibrary>>().toEqualTypeOf<RigLibraryRows>();
  expectTypeOf<NonNullable<Models['specimens']>[number]>().toEqualTypeOf<ModelSpecimenRow>();
  expectTypeOf<NonNullable<Placements['colliders']>[number]['colliders'][number]>().toEqualTypeOf<BakedColliderInput>();
  expectTypeOf<World>().toEqualTypeOf<WorldPieceRow>();
  expectTypeOf<Restricted extends WorldPieceRow<BakedPiece> ? true : false>().toEqualTypeOf<true>();
  expectTypeOf<WorldPieceRow<BakedPiece> extends Restricted ? true : false>().toEqualTypeOf<true>();
});

test('horizon ports retain all mutable native ring and band fields', () => {
  expectTypeOf<NonNullable<Awaited<ReturnType<typeof readManifestSource>>['authored']['horizon']>>().toEqualTypeOf<ChunkHorizon>();
  expectTypeOf<typeof NALATI_HORIZON_V2>().toEqualTypeOf<ChunkHorizon>();
});

test('every original Nalati day-channel and horizon declaration byte remains unchanged', () => {
  const bytes = new TextEncoder().encode(JSON.stringify({ day: nalatiDayChannels(), horizon: NALATI_HORIZON_V2 }));
  expect({ bytes: bytes.byteLength, hash: hashImmutableBytes(bytes) }).toEqual(original);
});
