// E315 M8 / E323: check-models' hand-registration finder. A registry `.add({ … })` with an `object` is found by a balanced
// scan of the literal — nested colliders, arrays and calls before the key, and the shorthand `{ id, object }`, used to
// slip past rule 6 (and the DONE counts) because the regex stopped at the first `}`.
import { describe, expect, it } from 'vitest';
import { addsWithObject, checkModels, ON_CONTRACT } from '../scripts/check-models.mjs';

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

  it('the whole tree holds with the stricter finder', () => {
    expect(checkModels().violations).toEqual([]);
  });
});
