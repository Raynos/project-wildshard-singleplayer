// oxlint-disable-next-line import/no-nodejs-modules -- Verify the unchanged live shader source against its pre-bake hash.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import * as v from 'valibot';
import { BufferAttribute, BufferGeometryLoader, MaterialLoader, MeshStandardMaterial, ShaderMaterial, type BufferGeometry } from 'three';
import { output } from '../src/shards/nine-dragon-stack/generators/output';
import baseline from './fixtures/nine-jian-buffers.json' with { type: 'json' };

async function hash(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes)));
  return Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
}
async function channels(geometry: BufferGeometry): Promise<unknown> {
  return { attributes: Object.fromEntries(await Promise.all(Object.entries(geometry.attributes).map(async ([key, attribute]) => {
    if (!(attribute instanceof BufferAttribute)) throw new Error('Jian channels stay ordinary buffers');
    return [key, {
    type: attribute.array.constructor.name, size: attribute.itemSize, normalized: attribute.normalized,
    hash: await hash(new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength)),
  }] as const; }))), index: geometry.index === null ? null : { type: geometry.index.array.constructor.name,
    hash: await hash(new Uint8Array(geometry.index.array.buffer, geometry.index.array.byteOffset, geometry.index.array.byteLength)) } };
}
function blob(name: string): unknown {
  const file = output.namedFiles.find(row => row.name === name), bytes = file === undefined ? undefined : output.assets.get(file.hash);
  if (bytes === undefined) throw new Error(`Missing admitted Jian blob ${name}`);
  return JSON.parse(new TextDecoder().decode(bytes), (_key, value: unknown) => value === '-0' ? -0 : value);
}

// Captured from vm/jian.ts and vm/swordSupport.ts before deleting either runtime module.
test('named Jian bakes preserve every original vertex and index byte', async () => {
  const halo = v.parse(v.strictObject({ geometry: v.unknown(), material: v.unknown() }), blob('weapons/jian-halo.json'));
  const support = v.parse(v.strictObject({ sword: v.unknown(), arms: v.unknown(), material: v.unknown(), tipY: v.number(), baseY: v.number() }), blob('weapons/jian-support.json'));
  const loader = new BufferGeometryLoader();
  expect(await channels(loader.parse(halo.geometry))).toEqual(baseline.halo);
  expect(await channels(loader.parse(support.sword))).toEqual(baseline.sword);
  expect(await channels(loader.parse(support.arms))).toEqual(baseline.arms);
  expect([support.tipY, support.baseY]).toEqual([baseline.tipY, baseline.baseY]);
  const material = new MaterialLoader().parse(halo.material);
  expect(material).toBeInstanceOf(ShaderMaterial);
  expect(material).toMatchObject({ transparent: true, depthWrite: false, blending: 5, blendSrc: 201, blendDst: 201, blendSrcAlpha: 200, blendDstAlpha: 201,
    uniforms: { uRes: { value: { x: 1, y: 1 } }, uPx: { value: 14 }, uTime: { value: 0 }, uGain: { value: 1 } } });
  const wood = new MaterialLoader().parse(support.material);
  expect(wood).toBeInstanceOf(MeshStandardMaterial);
  expect(wood).toMatchObject({ name: 'sword', flatShading: true, vertexColors: true, roughness: 0.82, metalness: 0, envMapIntensity: 0.6 });
});

test('halo shader bytes stay live and unchanged', async () => {
  const source = readFileSync(new URL('../src/shards/nine-dragon-stack/vm/fpArms.ts', import.meta.url), 'utf8');
  for (const [name, digest] of [['VS_HALO', baseline.vs], ['FS_HALO', baseline.fs]]) {
    const tick = String.fromCodePoint(96);
    const shader = new RegExp(`const ${String(name)} = /\\* glsl \\*/ ${tick}([\\s\\S]*?)${tick};`, 'u').exec(source)?.[1];
    if (shader === undefined) throw new Error(`Missing live halo shader ${String(name)}`);
    expect(await hash(new TextEncoder().encode(shader))).toBe(digest);
  }
});
