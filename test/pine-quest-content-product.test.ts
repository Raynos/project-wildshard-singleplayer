import { expect, test } from 'vitest';
import { readProjectAssets } from '../src/sdk/project';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import { PINE_QUESTS } from '../src/shards/pine-hollow/data/quests';
import { parsePineQuestRows } from '../src/shards/pine-hollow/quest/rows';

// Frozen canonical hashes of the original play-read authored declarations.
const originals = {
  quests: 'e59398ee103e7f9ec7ee5ed2626e426b1c18bbfd136361c593200a9e02a5f19c',
  content: '92c95fddf6be5ad38fdbd3661d1099cbe39f99fce379c7fd7119215823d3e0ea',
  ranger: '45e97c6c019fc49d440839a424761c60f21319deb6e59fbccc9dfdd8a23c79b5',
  miller: '388993120452db2e132dce701a42e73f1e506dcb5dff28efa44e60bfa02c098a',
  trader: 'b5c91381cf3d73e86b104a689c5c3a52e37abc6fa1d4aa5ac5f43117bd68a62f',
};
const hash = (value: unknown): string => hashImmutableBytes(new TextEncoder().encode(encodeCanonicalJson(value)));

test('the retained producer preserves the entire quest and NPC declarations in the admitted product', async () => {
  const loaded = await readProjectAssets('src/shards/pine-hollow');
  expect(hash(loaded.shard.quests)).toBe(originals.quests);
  expect(hash(PINE_QUESTS)).toBe(originals.quests);
  const named = loaded.output.namedFiles?.find(file => file.name === 'quests/native.json');
  const bytes = named === undefined ? undefined : loaded.assets.get(named.hash);
  if (bytes === undefined) throw new Error('The product must publish its fixed quest rows');
  const rows = parsePineQuestRows(JSON.parse(new TextDecoder().decode(bytes)));
  expect(hash(rows.content)).toBe(originals.content);
  expect(rows.table.rows).toHaveLength(44);
  expect(rows.table.rows.filter(row => row.id.startsWith('resin-'))).toHaveLength(30);
  expect(rows.table.rows.filter(row => row.id.startsWith('token-'))).toHaveLength(8);
  expect(Object.keys(rows.readings.speakers)).toEqual(['ranger', 'miller', 'trader']);
  expect(rows.readings.continuation).toEqual({ bare: 'ranger', wrapped: ['miller', 'trader'] });
  expect(rows.beats['hamlet']?.flags).toEqual([]);
  expect(rows.beats['done']?.flags).toEqual(['talked:ranger', 'lever:dam-log-a', 'lever:dam-log-b', 'open:dam-sluice', 'taken:pond-glass', 'lit:pond', 'taken:ridge-flint', 'lit:ridge', 'used:ph-zip', 'lit:den', 'followed:stag', 'dead:king', 'seen:dawn', 'quest:warden-done']);
  expect(() => parsePineQuestRows({ ...rows, table: { ...rows.table, rows: [{ ...rows.table.rows[0], at: { poi: 'world', x: Number.NaN, y: 0, z: 0, yaw: 0 } }] } })).toThrow();
  const { ranger: RANGER, miller: MILLER, trader: TRADER } = rows.readings.speakers;
  for (const [id, npc] of Object.entries({ ranger: RANGER, miller: MILLER, trader: TRADER })) {
    const declared = loaded.shard.questNpcs?.find(row => row.npc.id === id);
    if (declared === undefined) throw new Error(`Missing admitted NPC: ${id}`);
    expect(hash(declared.npc)).toBe(hash(npc));
  }
  expect([hash(RANGER), hash(MILLER), hash(TRADER)]).toEqual([originals.ranger, originals.miller, originals.trader]);
  expect(loaded.shard.questNpcs?.map(row => row.npc.id)).toEqual(['ranger', 'miller', 'trader']);
  expect(PINE_QUESTS.quests[0]?.steps.map(row => row.id)).toEqual(['pond', 'ridge', 'zip', 'den', 'stag', 'king', 'dawn']);
}, 30_000);
