import recurve from '../public/assets/nalati/baked/recurve-pool.json' with { type: 'json' };
import { expect, test } from 'vitest';
import { BufferGeometry } from 'three';
import { bindHeldBow } from '../src/game/plugin/heldLauncher';
import { HeldBowDefinitionSchema } from '../src/format/weaponProfiles';
import { PINE_HELD_BOW } from '../src/shards/pine-hollow/generators/longbow';
import { recurveBase } from '../src/shards/nalati-grasslands/generators/recurvePool';
import * as v from 'valibot';

test('both bows bind borrowed parts and retain their distinct loose and riding policies', () => {
  const pine = v.parse(HeldBowDefinitionSchema, PINE_HELD_BOW);
  const nalati = v.parse(v.object(HeldBowDefinitionSchema.entries), recurve);
  expect(nalati.base).toEqual(v.parse(HeldBowDefinitionSchema, { ...nalati, base: recurveBase() }).base);
  for (const definition of [pine, nalati]) {
    const geometry = new Map(Object.values(definition.bow.parts).map(id => [id, new BufferGeometry()]));
    const bow = bindHeldBow(definition, { geometry: id => geometry.get(id) ?? null });
    for (const [id, part] of geometry) expect(bow.model.geometry?.get(id)).toBe(part);
    expect(bow.profile.arrowLength).toBe(v.parse(v.object({ length: v.number() }), JSON.parse(definition.bow.bake.arrow)).length);
    expect(bow.profile.draw).toEqual(definition.base.draw);
    expect(bow.profile.projectile).toEqual(definition.base.projectile);
    expect(bow.profile.loose).toEqual(definition.base.loose);
    expect(bow.profile.quiver).toBe(definition.base.quiver);
    expect(() => bindHeldBow(definition, { geometry: () => null })).toThrow('bow part');
  }
  expect(pine.base.quiver).toBe(20);
  expect(pine.base.parent).toBe('weapon.bow');
  expect(pine.base.mounted).toBeUndefined();
  const riding = bindHeldBow(nalati, { geometry: () => new BufferGeometry() }).profile.mounted;
  expect(riding?.gaits).toEqual([{ below: 0.3, spread: 0.3 }, { below: 3.2, spread: 0.8 },
    { below: 6.5, spread: 3 }, { below: 10.5, spread: 1.5 }, { below: Infinity, spread: 1.8 }]);
});

test('binding refuses malformed feel and parent identities before borrowing parts', () => {
  let reads = 0;
  const library = { geometry: () => { reads++; return new BufferGeometry(); } };
  expect(() => bindHeldBow({ ...PINE_HELD_BOW, base: { ...PINE_HELD_BOW.base, quiver: -1 } }, library)).toThrow();
  expect(reads).toBe(0);
  expect(() => bindHeldBow({ ...PINE_HELD_BOW, base: { ...PINE_HELD_BOW.base, parent: 'invalid' } }, library)).toThrow();
  expect(reads).toBe(0);
  expect(() => bindHeldBow({ ...PINE_HELD_BOW, base: { ...PINE_HELD_BOW.base, draw: { ...PINE_HELD_BOW.base.draw, holdSteady: 9 } } }, library)).toThrow('fatigue');
  expect(reads).toBe(0);
});
