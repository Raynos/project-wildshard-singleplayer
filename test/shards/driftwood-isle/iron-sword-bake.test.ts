// oxlint-disable-next-line import/no-nodejs-modules -- Admit the committed offline pickup geometry.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { BufferGeometry, Mesh, MeshStandardMaterial, type Material, type Object3D } from 'three';
import type { SkyRig } from '../../../src/engine/world/skyRig';
import { staticGlb } from '../../../src/sdk/bake/glb';
import { ironSwordGeometry } from '../../../src/shards/driftwood-isle/generators/ironSword';
import { loadFixedGeometry } from '../../../src/shards/driftwood-isle/boot/fixedGeometry';
import { FIXED_MODEL_FILES } from '../../../src/shards/driftwood-isle/data/modelFiles';
import { buildIronSwordDisplay } from '../../../src/shards/driftwood-isle/weapons/IronSword';

function partMesh(object: Object3D | undefined): Mesh<BufferGeometry, MeshStandardMaterial> {
  if (!(object instanceof Mesh) || !(object.geometry instanceof BufferGeometry) || !(object.material instanceof MeshStandardMaterial)) throw new Error('Native iron sword mesh missing');
  return object as Mesh<BufferGeometry, MeshStandardMaterial>;
}

beforeAll(async () => {
  await loadFixedGeometry(new Map(Object.values(FIXED_MODEL_FILES).map(url => [url, new Uint8Array(readFileSync(`public${url}`))])));
});

it('ships the original blade and fittings exactly, retaining the real pickup materials, shadows and centring', () => {
  const configured: Material[] = [];
  const sky = { setupMaterial(material: Material): void { configured.push(material); } } as SkyRig;
  const source = ironSwordGeometry(), display = buildIronSwordDisplay(sky);
  expect(display.children).toHaveLength(2);
  const material = new MeshStandardMaterial({ vertexColors: true });
  for (const [index, part] of (['blade', 'fittings'] as const).entries()) {
    const mesh = partMesh(display.children[index]);
    const original = source[part];
    const bytes = new Uint8Array(readFileSync(`public/assets/driftwood-isle/baked/fixed-models/iron-sword-${part}.glb`));
    expect(bytes).toEqual(staticGlb([{ geometry: original, material }], `iron-sword-${part}`));
    expect(Object.keys(mesh.geometry.attributes).sort()).toEqual(Object.keys(original.attributes).sort());
    for (const [channel, attribute] of Object.entries(original.attributes)) expect(mesh.geometry.getAttribute(channel).array, channel).toEqual(attribute.array);
    expect(mesh.geometry.index).toBeNull();
    expect([mesh.castShadow, mesh.receiveShadow, mesh.position.toArray()]).toEqual([true, true, [0, -0.36, 0]]);
    expect(configured[index]).toBe(mesh.material);
    expect([mesh.material.name, mesh.material.flatShading, mesh.material.vertexColors, mesh.material.roughness, mesh.material.metalness, mesh.material.envMapIntensity]).toEqual(part === 'blade' ? ['iron-sword-steel', true, true, 0.5, 0.65, 0.85] : ['iron-sword-fittings', true, true, 0.62, 0.45, 0.7]);
    original.dispose(); mesh.geometry.dispose(); mesh.material.dispose();
  }
  material.dispose();
});

it('keeps pickup disposal and geometry edits independent between displays', () => {
  const sky = { setupMaterial(_material: Material): void { /* No renderer needed for admission. */ } } as SkyRig;
  const first = buildIronSwordDisplay(sky), second = buildIronSwordDisplay(sky), third = buildIronSwordDisplay(sky);
  for (let i = 0; i < 2; i++) {
    const a = partMesh(first.children[i]), b = partMesh(second.children[i]), c = partMesh(third.children[i]);
    a.geometry.scale(2, 3, 4); a.geometry.dispose();
    expect(b.geometry.getAttribute('position').array).toEqual(c.geometry.getAttribute('position').array);
    expect(b.geometry).not.toBe(c.geometry);
    b.geometry.dispose(); c.geometry.dispose();
    for (const mesh of [a, b, c]) mesh.material.dispose();
  }
});
