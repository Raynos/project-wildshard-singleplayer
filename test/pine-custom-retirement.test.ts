import { expect, test } from 'vitest';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import { pineRetiredCustomPayloads } from './fixtures/pine-retired-custom';
import { PINE_PREPARED_OUTPUT as output, PINE_KING_KIT } from './fixtures/pine-program';
import { CABIN_LIFE } from '../src/shards/pine-hollow/generators/cabinLook';
import { CABIN_LIGHT } from '../src/shards/pine-hollow/generators/cabinAssembly';
import { HEARTH_LOOKS } from '../src/shards/pine-hollow/generators/hearthLook';
import { THRALL_CLIPS } from '../src/shards/pine-hollow/generators/thrallClips';
import thrall from '../src/shards/pine-hollow/data/thrallLook.json' with {type:'json'};
import { PINE_OUTPUT } from '../src/shards/pine-hollow/generators/outputInputs';

// Full historical emitted bodies, independently retained before this retirement.
// Actual normal BEFORE/AFTER proof must also reconstruct the fresh source-bound bodies.
const historical = new Map([
  ['custom/cabinAppearance', {bytes:594,hash:'cf0189417d33e57a7eff221ba764ccdadde201ae35fc7e13f331527f31539411'}],
  ['custom/kingKit', {bytes:311,hash:'0c0fcdfbca213457b989db0478948a53120fc1b7bf2d5637f467f6082e058d2a'}],
  ['custom/paintedTextures', {bytes:718,hash:'f953a41ebcd48de0f4d1916f2dec71525dc08b10bfd80a737df72c96a8419403'}],
  ['custom/thrallLook', {bytes:8900,hash:'c20705c654db075ca9cae3ffee71bbfdd5289d10f86917568316c96d236c0657'}],
  ['custom/trophyMounts', {bytes:970,hash:'3aa9ffd0817696708cc1377cb36482e4e13bea587cb586bea388e9b256dad31c'}],
]);

test('five retired Pine copies reconstruct complete canonical bodies from native carriers', () => {
  const rows = pineRetiredCustomPayloads(output);
  expect([...rows.keys()].sort()).toEqual([...historical.keys()].sort());
  for (const [name, value] of rows) {
    const expected = historical.get(name);
    if (expected === undefined) throw new Error('Missing historical section authority');
    const bytes = new TextEncoder().encode(encodeCanonicalJson(value));
    expect(bytes.byteLength,name).toBe(expected.bytes);
    expect(hashImmutableBytes(bytes),name).toBe(expected.hash);
    expect(output.custom.sections.some(section => section.name === name),name).toBe(false);
  }
  expect(rows.get('custom/cabinAppearance')).toEqual({CABIN_LIFE,CABIN_LIGHT,HEARTH_LOOKS});
  expect(rows.get('custom/kingKit')).toEqual(PINE_KING_KIT.rows);
  expect(rows.get('custom/thrallLook')).toEqual({pose:THRALL_CLIPS,...thrall});
  expect(rows.get('custom/trophyMounts')).toEqual(PINE_OUTPUT.custom['custom/trophyMounts']);
});

test('the complete quest runtime leaves no Pine document in the custom path', () => {
  expect(output.custom.sections).toEqual([]);
  expect(output.namedFiles.some(row => row.name === 'quests/runtime.json')).toBe(true);
  expect(output.namedFiles.some(row => row.name === 'quests/native-story.json')).toBe(false);
});
