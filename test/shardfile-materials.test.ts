import { expect, it } from 'vitest';
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '@wildshard/game/shardfile/schema';

const source = () => emptyShardfile({ slug: 'material-test', name: 'Materials', author: 'Local', seed: 1, revision: 1 });
it('fills platform material/look defaults while preserving authored parameters', () => {
  const input = { ...source(), look: { ...source().look, materials: { grass: { family: 'toon', colour: [0.2, 0.5, 0.1], roughness: 0.9 }, rock: { family: 'pbr', metalness: 0, ground: null } }, familyLooks: { toon: { cloudShade: { strength: 0, scale: 60, wind: [0, 0] } }, painterly: {}, emissive: {} } } };
  const parsed = parseShardfile(input), grass = parsed.look.materials['grass'];
  expect(grass?.family).toBe('toon'); if (grass?.family !== 'toon') throw new Error('expected toon material'); expect(grass.colour).toEqual([0.2, 0.5, 0.1]);
  expect(parsed.look.familyLooks.toon?.cloudShade.strength).toBe(0);
  expect(parseShardfile(source()).look.materials).toEqual({});
});
it.each([{ family: 'custom' }, { family: 'toon', roughness: 1.1 }, { family: 'pbr', normalScale: Infinity }, { family: 'toon', shader: 'void main() {}' }])('refuses unsupported or malformed material parameters %o', (material) => {
  const input = { ...source(), look: { ...source().look, materials: { test: material } } };
  expect(() => parseShardfile(input)).toThrow();
});
it('refuses unknown platform families and out-of-range family looks', () => {
  const shard = source(); shard.look.families.push('custom');
  expect(() => parseShardfile(shard)).toThrow();
  expect(() => parseShardfile({ ...source(), look: { ...source().look, familyLooks: { toon: { litGrade: -1 } } } })).toThrow();
});
it('requires material textures to be hash-addressed KTX2 files in the admitted library', () => {
  const base = source(), hash = 'a'.repeat(64);
  const input = { ...base, look: { ...base.look, materials: { rock: { family: 'pbr', maps: { colour: hash, normal: null, orm: null } } } } };
  expect(() => parseShardfile(input)).toThrow();
  input.files.push({ hash, kind: 'ktx2', compressed: 16, decoded: 16, gpu: 16, triangles: 0, draws: 0, dependencies: [], critical: false });
  input.library.push(hash); expect(() => parseShardfile(input)).not.toThrow();
  input.look.materials.rock.maps.colour = 'https://example.com/map.ktx2'; expect(() => parseShardfile(input)).toThrow();
});
