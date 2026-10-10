// E315 M8 / E323: check-models' hand-registration finder. A registry `.add({ … })` with an `object` is found by a balanced
// scan of the literal — nested colliders, arrays and calls before the key, and the shorthand `{ id, object }`, used to
// slip past rule 6 (and the DONE counts) because the regex stopped at the first `}`.
import { describe, expect, it } from 'vitest';
import { addsWithKey, addsWithObject, checkModels, DONE, ON_CONTRACT } from '../scripts/check-models.mjs';

describe('check-models: a registry add with an object (E323)', () => {
  it('finds the object key at the literal\'s top level, however deeply the rest nests', () => {
    expect(addsWithObject("registry.add({ id: 'a', object: mesh });")).toBe(1);
    expect(addsWithObject("registry.add({ id: 'a', colliders: [{ kind: 'box', hx: 1 }], object: mesh });")).toBe(1);
    expect(addsWithObject("registry.add({ id: 'a', colliders: boxes.map((b) => ({ ...b, y: f(b) })), floor: (x, z) => { return h(x, z); }, object: g });")).toBe(1);
    expect(addsWithObject("registry.add({ id, object, colliders });")).toBe(1);
    expect(addsWithObject("registry.add({\n  id,\n  object\n});")).toBe(1);
    expect(addsWithObject("reg.add({ id: '}', name: 'a { b', object: m }); reg.add({ id: 'c', object: n });")).toBe(2);
  });

  it('ignores an add without one: a nested object key, a colliders-only piece, another key named like it', () => {
    expect(addsWithObject("registry.add({ id: 'a', colliders: [{ kind: 'box' }] });")).toBe(0);
    expect(addsWithObject("registry.add({ id: 'a', model: { object: () => g } });")).toBe(0);
    expect(addsWithObject("registry.add({ id: 'a', anObject: g, objects: [g] });")).toBe(0);
    expect(addsWithObject('set.add(x); group.add(mesh);')).toBe(0);
  });

  it('rule 6 fails a file on the contract that registers a nested-literal piece by hand', () => {
    const file = ON_CONTRACT[0];
    if (file === undefined) throw new Error('ON_CONTRACT is empty');
    const bad = checkModels({ [file]: "registry.add({ id: 'x', colliders: [{ kind: 'box', hx: 1, hy: 1, hz: 1 }], object: mesh });" }).violations;
    expect(bad.some((v) => v.startsWith(`${file}: on the model contract`))).toBe(true);
    expect(checkModels({ [file]: "registry.add({ id: 'x', colliders: [{ kind: 'box', hx: 1, hy: 1, hz: 1 }] });" }).violations).toEqual([]);
  });

  it('permits only the declared People model support files, retaining the contract for other helpers', () => {
    for (const name of ['figureRig', 'figureMotion']) {
      expect(checkModels({ [`src/shards/nalati-grasslands/models/npc/${name}.ts`]: 'export function support() {}' }).violations).toEqual([]);
    }
    for (const file of ['src/shards/nalati-grasslands/models/npc/newHelper.ts', 'src/shards/another/models/npc/figureRig.ts']) {
      expect(checkModels({ [file]: 'export function support() {}' }).violations).toContain(`${file}: a file in a models folder that defines no model`);
    }
  });

  it('the whole tree holds with the stricter finder', () => {
    expect(checkModels().violations).toEqual([]);
  });
});

describe('check-models after M6: every area is held (E315)', () => {
  it('a registry add with a model entry is place / listModel\'s alone: counted as a top-level key, anywhere else it fails', () => {
    expect(addsWithKey("registry.add({ id: 'x', name: 'X', model: entry });", 'model')).toBe(1);
    expect(addsWithKey("registry.add({ id, model });", 'model')).toBe(1);
    expect(addsWithKey("const plate = { label: 'Deer', model: { build: () => g } };", 'model')).toBe(0); // (a Journal plate is no registration)
    const bad = checkModels({ 'src/shards/driftwood-isle/world/Palms.ts': "registry.add({ id: 'palm', name: 'Palm', category: 'nature', file: 'x', model: entry });" }).violations;
    expect(bad.some((v) => v.includes('registry add with model'))).toBe(true);
  });

  it('the shared code is held too: a new file drawing by hand fails until it is declared world with its reason', () => {
    const shared = Object.keys(DONE).find((a) => a.startsWith('shared'));
    expect(shared).toBeDefined();
    const bad = checkModels({ 'src/world/NewScatter.ts': 'const m = new THREE.InstancedMesh(g, mat, 40);' }).violations;
    expect(bad.some((v) => v.startsWith('src/world/NewScatter.ts: shared'))).toBe(true);
    for (const [area, files] of Object.entries(DONE)) for (const [file, d] of Object.entries(files)) expect(d.why.length, `${area} ${file}`).toBeGreaterThan(10);
  });

  it('the old registrations fail everywhere (the dev labs and their exemption went in E357 F7)', () => {
    const bad = checkModels({ 'src/engine/world/Grass.ts': "registerModel({ id: 'x' }); addBuilt('x', mesh);" }).violations;
    expect(bad.some((v) => v.includes('registerModel'))).toBe(true);
    expect(bad.some((v) => v.includes('addBuilt'))).toBe(true);
  });
});

it('retains model identity and contract checks on exact frozen copies', () => {
  const legacyCove = 'src/shards/driftwood-isle-legacy/world/Cove.ts';
  const twoMerges = 'mergeGeometries(a); mergeGeometries(b);';
  expect(checkModels({ [legacyCove]: twoMerges }).violations).toEqual([]);
  expect(checkModels({ [legacyCove]: `${twoMerges} mergeGeometries(c);` }).violations.some(v => v.includes('3 × mergeGeometries'))).toBe(true);
  expect(checkModels({ 'src/shards/driftwood-isle/world/Cove.ts': twoMerges }).violations.some(v => v.includes('2 × mergeGeometries'))).toBe(true);
  const model = 'src/shards/driftwood-isle-legacy/models/boat.ts';
  expect(checkModels({ [model]: "defineModel({ id: 'driftwood-isle/boat' });" }).violations).toEqual([]);
  expect(checkModels({ [model]: "defineModel({ id: 'another/boat' });" }).violations.some(v => v.includes('must start'))).toBe(true);
  expect(checkModels({ 'src/shards/driftwood-isle-unregistered-legacy/models/boat.ts': "defineModel({ id: 'driftwood-isle/boat' });" }).violations.some(v => v.includes('must start'))).toBe(true);
  expect(checkModels({ 'src/shards/nalati-grasslands-legacy/world/Crags.ts': 'registerSolid({});' }).violations.some(v => v.includes('never registers'))).toBe(true);
});
