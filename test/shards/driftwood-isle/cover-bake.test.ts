// oxlint-disable-next-line import/no-nodejs-modules -- Reads committed offline templates.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { MeshStandardMaterial, InstancedBufferAttribute } from 'three';
import { staticGlb } from '../../../src/sdk/bake/glb';
import { modelGeometry } from '../../../src/sdk/modelGeometry';
import { coverGeometry, coverLook } from '../../../src/shards/driftwood-isle/generators/groundCover';
import COVER_LOOK from '../../../src/shards/driftwood-isle/data/coverLook.json' with { type: 'json' };
import { loadCoverGeometry, copyCoverGeometry } from '../../../src/shards/driftwood-isle/boot/coverGeometry';
import { FIXED_MODEL_FILES } from '../../../src/shards/driftwood-isle/data/modelFiles';

it('keeps all near/far silhouettes, colours, normals and terrain coverage exact through the lossless intake', async () => {
  const source = coverGeometry(), material = new MeshStandardMaterial({ vertexColors: true });
  expect(source.look).toEqual(COVER_LOOK);
  for (const [name, original] of Object.entries(source.geometry)) {
    const bytes = new Uint8Array(readFileSync(`public/assets/driftwood-isle/baked/fixed-models/cover-${name}.glb`));
    expect(bytes).toEqual(staticGlb([{ geometry: original, material }], `cover-${name}`));
    const template = modelGeometry('cover.glb');
    await template.load(bytes);
    const decoded = template.copy();
    expect(decoded.index).toBeNull();
    expect(Object.keys(decoded.attributes).sort()).toEqual(Object.keys(original.attributes).sort());
    for (const [channel, attribute] of Object.entries(original.attributes)) {
      expect(decoded.getAttribute(channel).array, `${name}:${channel}`).toEqual(attribute.array);
    }
    expect(coverLook(decoded)).toEqual(coverLook(original));
    decoded.dispose(); original.dispose();
  }
  material.dispose();
});

it('gives double-buffered instance channels and geometry edits no access to the immutable templates', async () => {
  const entries: [string, Uint8Array][] = [];
  for (const url of Object.values(FIXED_MODEL_FILES)) if (url.includes('/cover-')) entries.push([url, new Uint8Array(readFileSync(`public${url}`))]);
  await loadCoverGeometry(new Map(entries));
  const first = copyCoverGeometry(), second = copyCoverGeometry();
  for (const name of Object.keys(first) as (keyof typeof first)[]) {
    const original = Array.from(second[name].getAttribute('position').array);
    first[name].scale(2, 3, 4);
    first[name].setAttribute('aGround', new InstancedBufferAttribute(new Float32Array(6), 3));
    expect(second[name].hasAttribute('aGround')).toBe(false);
    expect(Array.from(second[name].getAttribute('position').array)).toEqual(original);
    first[name].dispose(); second[name].dispose();
  }
});
