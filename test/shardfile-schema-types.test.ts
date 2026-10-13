import { expect, expectTypeOf, it } from 'vitest';
import * as v from 'valibot';
import type { ShardfileSchema, Shardfile } from '@wildshard/format/shardSchema';
import { ShardfileSchema as AuthorSchema } from '@wildshard/sdk/shardfile';
import { emptyShardfile } from '@wildshard/sdk/author';
import { ItemsSchema, type ShardItems } from '@wildshard/format/items';
import { ClientChannelProgramSchema, type ClientChannelsSchema, type ClientChannelProgram } from '@wildshard/format/clientChannels';
import { ITEMS } from '../src/shards/_template/data/items';
import type { WeaponProfile } from '@wildshard/format/weaponProfiles';

it('publishes bounded root input/output contracts without widening nested discriminants', () => {
  expectTypeOf<v.InferInput<typeof ShardfileSchema>>().toEqualTypeOf<unknown>();
  expectTypeOf<v.InferOutput<typeof AuthorSchema>>().toEqualTypeOf<Shardfile>();
  expectTypeOf<v.InferOutput<typeof ItemsSchema>>().toEqualTypeOf<ShardItems>();
  expectTypeOf<v.InferOutput<typeof ClientChannelsSchema>>().toEqualTypeOf<ClientChannelProgram[]>();
  const item = v.parse(ItemsSchema, ITEMS).rows[0];
  if (item?.kind !== 'weapon') throw new Error('Expected the admitted template weapon');
  expectTypeOf(item.id).toEqualTypeOf<`weapon.${string}`>();
  expectTypeOf(item.profile).toEqualTypeOf<WeaponProfile | undefined>();
  expect(JSON.stringify(v.parse(ItemsSchema, ITEMS))).toBe(JSON.stringify(ITEMS));
});

it('retains root defaults and strict refusals through the author schema boundary', () => {
  const empty = emptyShardfile({ slug: 'schema-types', name: 'Schema types', author: 'Fixture', seed: 1, revision: 1 });
  const { items: _items, clientChannels: _channels, ...input } = empty;
  const parsed = v.parse(AuthorSchema, input);
  expect(parsed.items).toEqual({ version: 1, rows: [], contexts: [], loadout: { primary: null, secondary: null, tools: [] } });
  expect(parsed.clientChannels).toBeUndefined();
  expect(v.safeParse(AuthorSchema, { ...input, unbound: true }).success).toBe(false);
});

it('preserves exact optional channel fields and backward-only expression refusal', () => {
  const row: ClientChannelProgram = { id: 'typed', reads: [], nodes: [{ op: 'constant', value: 3 }], channels: [{ property: 'x', value: 0 }] };
  expect(JSON.stringify(v.parse(ClientChannelProgramSchema, row))).toBe(JSON.stringify(row));
  expect(v.safeParse(ClientChannelProgramSchema, { ...row, nodes: [{ op: 'neg', a: 0 }] }).success).toBe(false);
});
