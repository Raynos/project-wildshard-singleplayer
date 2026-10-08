import { BufferGeometry, Float32BufferAttribute, MeshStandardMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import * as v from 'valibot';
import { PropsSchema, validatePropsReferences } from '../src/game/shardfile/props';
import { WorldBakeRows, type WorldGroundEntry } from '../src/sdk/bake/worldRows';
import { staticGlb } from '../src/sdk/bake/glb';
import { parseGlb } from '../src/sdk/assets';
import { contentHash } from '../src/sdk/project';

function ground(x = 0, z = 0): WorldGroundEntry {
  const px = -250 + x * 62.5, pz = -250 + z * 62.5;
  const geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute([px, 0, pz, px + 62.5, 0, pz, px, 0, pz + 62.5], 3))
    .setAttribute('normal', new Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3))
    .setAttribute('surf', new Float32BufferAttribute([9, 0, 0, 0, 9, 0, 0, 0, 9, 0, 0, 0], 4)).setIndex([0, 2, 1]);
  const material = new MeshStandardMaterial(); material.name = 'native.ground';
  try { return { tile: { lod: 0, x, z, bounds: { min: [px, 0, pz], max: [px + 62.5, 0, pz + 62.5] } }, bytes: staticGlb([{ geometry, material, customAttributes: { _SURF: 'surf' } }]) }; }
  finally { geometry.dispose(); material.dispose(); }
}

describe('shared authored world row packing', () => {
  it('uses identical hashing and byte-derived costs for native ground and static prop entries', () => {
    const entry = ground(), a = new WorldBakeRows(), b = new WorldBakeRows();
    const ref = a.ground(entry); b.tile({ ...entry.tile, bytes: entry.bytes });
    const first = a.finish('nalati.ground'), second = b.finish('nalati.ground');
    expect(first).toEqual(second);
    expect(ref.file).toBe(contentHash(entry.bytes));
    expect(first.assets.get(ref.file)).toEqual(entry.bytes);
    expect(first.files[0]).toEqual({ hash: ref.file, kind: 'glb', compressed: entry.bytes.length, ...parseGlb(entry.bytes), dependencies: [], critical: false });
    expect(first.props.family).toBe('nalati.ground'); expect(v.parse(PropsSchema, first.props)).toEqual(first.props);
    expect(() => validatePropsReferences(first.props, { ...first, library: [], far: null })).not.toThrow();
    expect(first.tiles[0]).toMatchObject({ ...entry.tile, files: [ref.file], compressed: entry.bytes.length, ...parseGlb(entry.bytes) });
  });

  it('charges a diamond dependency once, deduplicates immutable bytes and returns owned deterministic snapshots', () => {
    const pack = new WorldBakeRows(), shared = pack.asset(new TextEncoder().encode('{"shared":1}'), 'json');
    const left = pack.asset(new TextEncoder().encode('{"left":1}'), 'json', [shared.hash]);
    const right = pack.asset(new TextEncoder().encode('{"right":1}'), 'json', [shared.hash]);
    expect(pack.asset(new TextEncoder().encode('{"shared":1}'), 'json')).toEqual(shared);
    const entry = ground(), file = pack.ground(entry, [right.hash, left.hash]);
    const snapshot = pack.finish('pine.ground'), tile = snapshot.tiles[0];
    expect(snapshot.files).toHaveLength(4);
    expect(tile?.compressed).toBe(snapshot.files.reduce((sum, row) => sum + row.compressed, 0));
    expect(tile?.decoded).toBe(snapshot.files.reduce((sum, row) => sum + row.decoded, 0));
    const bytes = snapshot.assets.get(file.file); if (bytes === undefined) throw new Error('Missing packed bytes');
    bytes.fill(0); snapshot.files.length = 0; snapshot.tiles.length = 0;
    const repeat = pack.finish('pine.ground'); expect(repeat.assets.get(file.file)).toEqual(entry.bytes); expect(repeat.files).toHaveLength(4);
    expect(repeat.files.map(row => row.hash)).toEqual(repeat.files.map(row => row.hash).sort());
  });

  it('refuses conflicting metadata, missing dependencies, overlapping tile ownership and invalid bounds', () => {
    const pack = new WorldBakeRows(), entry = ground(); pack.ground(entry);
    expect(() => pack.ground(entry)).toThrow('combine ground and props');
    expect(() => pack.asset(entry.bytes, 'binary')).toThrow('Conflicting');
    expect(() => pack.asset(new Uint8Array([1]), 'binary', ['f'.repeat(64)])).toThrow('previously packed');
    const invalid = ground(1); invalid.tile.bounds.min[0] = -250;
    expect(() => pack.ground(invalid)).toThrow('bounds');
    expect(() => pack.finish('unadmitted material name')).toThrow('catalogue ID');
  });
});
