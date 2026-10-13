import { expect, it } from 'vitest';
import { BufferAttribute, BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, type Object3D } from 'three';
import { creatureSpecimen, undrawnRig } from '../src/game/plugin/geometry';
import type { AnimalSpecies } from '../src/engine/entities/species/registry';
import { Rng } from '../src/engine/core/rng';
import { modelContext } from '../src/engine/models/model';
import { goatEntry, rayEntry, rocEntry } from '../src/shards/far-reach/models/creatures';
import { matriarchModel, rayModel, skittererModel, striderModel } from '../src/shards/sunscar-dunes/models/gear';

function body(parts: readonly BufferGeometry[]): AnimalSpecies {
  return { bones: [], furParts: [], hardParts: [...parts], eyeParts: [],
    dims: { bodyY: 1, bodyHalfLen: 1, bodyRadius: 1, headRadius: 1, legLen: 1, feet: [], halfWidth: 1 } };
}
function isSpecimenMesh(node: Object3D): node is Mesh<BufferGeometry, MeshStandardMaterial> {
  if (!(node instanceof Mesh)) return false;
  const geometry: unknown = node.geometry, material: unknown = node.material;
  return geometry instanceof BufferGeometry && material instanceof MeshStandardMaterial;
}
function dispose(root: Object3D): void {
  root.traverse(node => {
    if (isSpecimenMesh(node)) {
      node.geometry.dispose(); node.material.dispose();
    }
  });
}
function values(root: Object3D): unknown[] {
  const result: unknown[] = [];
  root.traverse(node => {
    if (isSpecimenMesh(node)) result.push({
      matrix: node.matrix.toArray(), scale: node.scale.toArray(), color: node.material.color.toArray(),
      roughness: node.material.roughness, metalness: node.material.metalness,
      flatShading: node.material.flatShading, vertexColors: node.material.vertexColors,
      attributes: Object.fromEntries(Object.entries(node.geometry.attributes).map(([name, attribute]) =>
        [name, { values: Array.from(attribute instanceof BufferAttribute ? attribute.array : attribute.data.array), itemSize: attribute.itemSize, normalized: attribute.normalized }])),
    });
  });
  return result;
}

it.each(['all', 'first'] as const)('%s specimens preserve original parts, material values and geometry bytes', parts => {
  const a = new BufferGeometry().setAttribute('position', new Float32BufferAttribute([1, 2, 3, 4, 5, 6, 7, 8, 9], 3));
  const b = new BufferGeometry().setAttribute('position', new Float32BufferAttribute([-1, 0, 1, -2, 0, 2, -3, 0, 3], 3));
  const original = [Array.from(a.getAttribute('position').array), Array.from(b.getAttribute('position').array)];
  const material = parts === 'all' ? { color: 0xffffff, flatShading: true, roughness: 0.95, metalness: 0, vertexColors: true }
    : { vertexColors: true, roughness: 0.8, flatShading: true };
  const actual = creatureSpecimen(body([a, b]), { parts, material, scale: parts === 'first' ? 3.6 : 1 });
  const expected = parts === 'all' ? new Group() : new Mesh(a, new MeshStandardMaterial(material));
  if (expected instanceof Group) for (const geometry of [a, b]) expected.add(new Mesh(geometry, new MeshStandardMaterial(material)));
  else expected.scale.setScalar(3.6);
  try {
    expect(actual.type).toBe(expected.type); expect(values(actual)).toEqual(values(expected));
    const meshes = isSpecimenMesh(actual) ? [actual] : actual.children.filter(isSpecimenMesh), geometries = meshes.map(mesh => mesh.geometry);
    expect(geometries[0]).toBe(a); if (parts === 'all') expect(geometries[1]).toBe(b);
    expect([Array.from(a.getAttribute('position').array), Array.from(b.getAttribute('position').array)]).toEqual(original);
  } finally { dispose(actual); dispose(expected); b.dispose(); }
});

it('retains the zero-area first-part fallback and refuses invalid scale before mutating the body', () => {
  const actual = creatureSpecimen(body([]), { parts: 'first', material: {} }), expected = new Mesh(undrawnRig(), new MeshStandardMaterial());
  try { expect(values(actual)).toEqual(values(expected)); } finally { dispose(actual); dispose(expected); }
  const geometry = new BufferGeometry(), input = body([geometry]);
  for (const scale of [0, -1, Number.NaN, Infinity]) expect(() => creatureSpecimen(input, { parts: 'all', material: {}, scale })).toThrow('finite and positive');
  expect(input.hardParts[0]).toBe(geometry); geometry.dispose();
});

it('both shipping model catalogues use their original specimen shape, material and scale without RNG', () => {
  const sky = [rocEntry, goatEntry, rayEntry], signal = [rayModel, skittererModel, striderModel, matriarchModel];
  for (const [catalogue, parts] of [[sky, 'all'], [signal, 'first']] as const) {
    for (const model of catalogue) {
      const rng = new Rng(77), before = rng.snapshot(), root = model.build(modelContext(null), model.defaults, rng);
      if (!(root instanceof Group) && !(root instanceof Mesh)) throw new Error('Shipping specimen requires its original object shape');
      try {
        expect(rng.snapshot()).toEqual(before);
        expect(root.type).toBe(parts === 'all' ? 'Group' : 'Mesh');
        expect(root.scale.toArray()).toEqual(model.id.endsWith('dune-matriarch') ? [3.6, 3.6, 3.6] : [1, 1, 1]);
        const meshes = isSpecimenMesh(root) ? [root] : root.children.filter(isSpecimenMesh);
        expect(meshes).toHaveLength(1);
        for (const mesh of meshes) {
          if (!(mesh.material instanceof MeshStandardMaterial)) throw new Error('Original standard material missing');
          expect(mesh.material.roughness).toBe(parts === 'all' ? 0.95 : 0.8);
          expect(mesh.material.flatShading).toBe(true); expect(mesh.material.vertexColors).toBe(true);
          expect(Array.from(mesh.geometry.getAttribute('position').array)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
        }
      } finally { dispose(root); }
    }
  }
});
