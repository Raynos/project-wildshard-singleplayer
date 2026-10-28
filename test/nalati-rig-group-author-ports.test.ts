import { expect, expectTypeOf, test } from 'vitest';
import type { AuthorGroupStepProfile } from '../src/sdk/decisionScripts';
import type { AuthorRiggedHullBook, AuthorRiggedHullUrls } from '../src/sdk/bake/skinned';
import type { GroupStepProfileV2 } from '../src/format/scriptGroupStepV2';
import type { ObservationColumnV2 } from '../src/format/scriptObservationColumnsV2';
import type { RiggedHullBook, RiggedHullUrls } from '../src/format/riggedHulls';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { NALATI_HULL_BOOK } from '../src/shards/nalati-grasslands/generators/riggedHulls';
import { nalatiRigFile, rigFileFrom } from '../src/shards/nalati-grasslands/generators/rigSources';
import * as pack from '../src/shards/nalati-grasslands/generators/packGroup';
import declared from '../src/shards/nalati-grasslands/data/bootAssets.json' with { type: 'json' };
import original from './fixtures/nalati-rig-group-author-original.json' with { type: 'json' };

test('pack and hull author ports retain complete native mutable types and original wires', () => {
  expectTypeOf<AuthorGroupStepProfile>().toEqualTypeOf<GroupStepProfileV2>();
  expectTypeOf<AuthorGroupStepProfile['columns'][number]>().toEqualTypeOf<ObservationColumnV2>();
  expectTypeOf<AuthorRiggedHullBook>().toEqualTypeOf<RiggedHullBook>();
  expectTypeOf<AuthorRiggedHullUrls>().toEqualTypeOf<RiggedHullUrls>();
  expect(NALATI_HULL_BOOK).toEqual(original.rigs);
  const bytes = new TextEncoder().encode(JSON.stringify(Object.fromEntries(Object.entries(pack).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0))));
  expect({ bytes: bytes.length, hash: hashImmutableBytes(bytes) }).toEqual(original.pack);
});

test('all eighteen rig reads retain their original tier URLs and require one declared source', () => {
  for (const tier of ['phone', 'desktop'] as const) for (const [hull, file] of Object.entries(original.rigs.tiers[tier].files)) {
    expect(nalatiRigFile(hull, tier)).toBe(file);
    expect(declared.world[tier]).toContain(file);
    expect(() => rigFileFrom([], hull, tier)).toThrow('needs one declared');
    expect(() => rigFileFrom([file, `/duplicate${file}`], hull, tier)).toThrow('needs one declared');
    expect(() => rigFileFrom([file], 'absent-hull', tier)).toThrow('needs one declared');
    expect(() => rigFileFrom([file], hull, tier === 'phone' ? 'desktop' : 'phone')).toThrow('needs one declared');
  }
});
