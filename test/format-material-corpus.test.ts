import { expect, it } from 'vitest';
import type { Shardfile } from '@wildshard/game/shardfile/schema';
import * as v from 'valibot';
import { MaterialsSchema, FamilyLooksSchema, materialGraphRules, graphFileRules } from '../src/game/shardfile/materials';
import { PostStackSchema, postStackCost, postStackRules } from '../src/game/shardfile/postStack';

const declarations = import.meta.glob<Shardfile>('../src/shards/*/shard.config.ts', { eager: true, import: 'default' });
it('preserves every shipped material and post declaration through persisted JSON admission', () => {
  expect(Object.keys(declarations)).toEqual(expect.arrayContaining([
    '../src/shards/_template/shard.config.ts', '../src/shards/pastel-plain/shard.config.ts', '../src/shards/ink-cel-valley/shard.config.ts',
  ]));
  for (const [path, source] of Object.entries(declarations)) {
    const persisted: unknown = JSON.parse(new TextDecoder().decode(new TextEncoder().encode(JSON.stringify(source))));
    const json: Shardfile = v.parse(v.custom<Shardfile>(value => value !== null && typeof value === 'object' && 'look' in value && 'state' in value), persisted);
    const admit = (row: Shardfile) => ({ materials: v.parse(MaterialsSchema, row.look.materials), familyLooks: v.parse(FamilyLooksSchema, row.look.familyLooks), post: v.parse(PostStackSchema, row.look.post ?? []) });
    expect(admit(json), path).toEqual(admit(source));
    const restored = { ...json, look: { ...json.look, ...admit(json) } };
    expect(materialGraphRules(restored), path).toEqual(materialGraphRules(source));
    expect(graphFileRules(restored, () => undefined), path).toEqual(graphFileRules(source, () => undefined));
    expect(postStackRules(restored), path).toEqual(postStackRules(source));
    expect(postStackCost(restored, () => undefined), path).toEqual(postStackCost(source, () => undefined));
  }
});
