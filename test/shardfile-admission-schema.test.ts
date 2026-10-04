import { expect, it } from 'vitest';
import { emptyShardfile } from '@wildshard/sdk/author';
import { SHARDFILE_ADMISSION_LIMITS as limits, preflightShardfile } from '../src/sdk/admission';
import { parseShardfile } from '../src/game/shardfile/schema';
import { StateSchema } from '../src/game/shardfile/state';
import * as v from 'valibot';

const empty = () => emptyShardfile({ slug: 'admission', name: 'Admission', author: 'Test', revision: 1, seed: 435 });
const fields = (length: number, offset = 0) => Array.from({ length }, (_row, i) => ({ id: offset + i + 1, name: `field.${i}`,
  type: 'string' as const, privacy: 'public' as const, default: '' }));
it('accepts equality and refuses excessive portable state declarations in both full and lineage schemas', () => {
  const s = empty(); s.state.shared = fields(limits.stateFields); s.state.player = fields(limits.stateFields, limits.stateFields);
  expect(() => parseShardfile(s)).not.toThrow(); expect(() => v.parse(StateSchema, s.state)).not.toThrow();
  for (const scope of ['shared', 'player'] as const) {
    const state = { ...s.state, [scope]: [...s.state[scope], { id: 1000, name: 'extra', type: 'string', privacy: 'public', default: '' }] };
    expect(() => parseShardfile({ ...s, state })).toThrow('manifest admission limits');
    expect(() => v.parse(StateSchema, state)).toThrow();
  }
});
it('bounds identifiers and state text without changing the separate text allowance', () => {
  const s = empty();
  s.identity.slug = 'a'.repeat(limits.idCharacters);
  s.state.shared = [{ id: 1, name: 'b'.repeat(limits.idCharacters), type: 'string', privacy: 'public', default: 'x'.repeat(limits.textCharacters) }];
  expect(() => parseShardfile(s)).not.toThrow();
  expect(() => parseShardfile({ ...s, identity: { ...s.identity, slug: `${s.identity.slug}a` } })).toThrow();
  const field = s.state.shared[0]; if (field === undefined) throw new Error('Missing boundary field');
  expect(() => parseShardfile({ ...s, state: { ...s.state, shared: [{ ...field, name: `${field.name}b` }] } })).toThrow();
  expect(() => parseShardfile({ ...s, state: { ...s.state, shared: [{ ...field, default: 'x'.repeat(limits.textCharacters + 1) }] } })).toThrow('manifest admission limits');
});
it('refuses excessive input before inspecting file rows or invoking authored accessors', () => {
  let reads = 0;
  const row = { get hash() { reads++; return 'a'.repeat(64); } };
  expect(() => parseShardfile({ ...empty(), files: Array.from({ length: limits.files + 1 }, () => row) })).toThrow('manifest admission limits');
  expect(reads).toBe(0);
  const source = { ...empty(), get files() { reads++; return []; } };
  expect(() => parseShardfile(source)).toThrow('JSON data only'); expect(reads).toBe(0);
});
it('enforces declared distinct wire and free text bounds through the author and full-format entrypoints', () => {
  const s = empty(), hash = 'a'.repeat(64);
  s.files = [{ hash, kind: 'binary', compressed: limits.wireBytes, decoded: 0, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: false }];
  s.library = [hash];
  expect(() => preflightShardfile(s)).not.toThrow(); expect(() => parseShardfile(s)).not.toThrow();
  const file = s.files[0]; if (file === undefined) throw new Error('Missing wire fixture');
  const excessive = { ...s, files: [{ ...file, compressed: limits.wireBytes + 1 }] };
  expect(() => preflightShardfile(excessive)).toThrow('total wire');
  expect(() => parseShardfile(excessive)).toThrow('manifest admission limits');
});
