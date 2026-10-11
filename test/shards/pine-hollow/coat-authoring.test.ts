import { expect, it } from 'vitest';
import * as THREE from 'three';
import { COAT_PALETTES, coatVariant } from '../../../src/shards/pine-hollow/generators/coatRecipes';
import { paintCoatPixels } from '../../../src/shards/pine-hollow/generators/coatPixels';
import { pressFlap as authoredFlap } from '../../../src/shards/pine-hollow/generators/coatFlap';
import { pressFlap as shippingFlap } from '../../../src/shards/pine-hollow/runtime/looks/riggedHulls';
import { DEER_PALETTE, DEER } from '@wildshard/game/systems/species/deer';
import { ELK_PALETTE, ELK } from '@wildshard/game/systems/species/elk';
import { BEAR_PALETTE, BEAR_LOOK } from '@wildshard/game/systems/species/view/bear';
import { BOAR_PALETTE, BOAR_LOOK } from '@wildshard/game/systems/species/view/boar';
import { PINE_HULLS } from '../../../src/shards/pine-hollow/data/creatureHulls';
import { THRALL_TRAITS, ELK_THRALL_TINT } from '../../../src/shards/pine-hollow/species/thrall';

it('retains every palette and every pixel-affecting variant independently of the renderer registry', () => {
  expect(COAT_PALETTES).toEqual({ deer: DEER_PALETTE, elk: ELK_PALETTE, bear: BEAR_PALETTE, boar: BOAR_PALETTE });
  const marks = (traits: Readonly<Record<string, string | number | boolean>> | undefined) => Object.fromEntries(['piebald', 'blaze', 'scar', 'thrall', 'grizzle'].map(key => [key, traits?.[key] ?? 0]));
  for (const [kind, variants] of [['deer', DEER.variants], ['elk', ELK.variants]] as const) for (const row of variants) {
    const authored = coatVariant(kind, row.id); expect(authored.tint).toEqual(row.tint); expect(marks(authored.traits)).toEqual(marks(row.traits));
  }
  for (const [kind, look] of [['boar', BOAR_LOOK], ['bear', BEAR_LOOK]] as const) for (const [id, row] of Object.entries(look.variants ?? {})) {
    const authored = coatVariant(kind, id); expect(authored.tint).toEqual(row.tint); expect(marks(authored.traits)).toEqual(marks(row.traits));
  }
  expect(coatVariant('elk', 'thrall').tint).toEqual(ELK_THRALL_TINT);
  expect(coatVariant('elk', 'thrall').traits?.['thrall']).toBe(THRALL_TRAITS.thrall);
  expect(() => coatVariant('unknown', 'base')).toThrow('Missing authored coat');
});
it('retains the shipping flap positions and normals without importing a runtime into the producer', () => {
  for (const trim of Object.values(PINE_HULLS.flaps ?? {})) {
    const position = new Float32Array([-0.4, 0.7, -1, 0.4, 0.7, -1, 0, 0.3, -0.1]), normal = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), index = new Uint16Array([0, 1, 2]);
    const p = position.slice(), n = normal.slice();
    expect(authoredFlap(position, normal, index, trim)).toEqual(shippingFlap(p, n, index, trim)); expect(position).toEqual(p); expect(normal).toEqual(n);
  }
});
it('refuses malformed rasters before painting or allocating surface channels', () => {
  const map = new THREE.Texture(), geometry = new THREE.BufferGeometry();
  expect(() => paintCoatPixels({ palette: {}, source: ['deer', 'hind'], keys: ['a', 'b', 'c'] }, { geometry, map }, { id: 'hind' }, [], new Uint8ClampedArray(3), 1, 1, undefined)).toThrow('Invalid bounded');
  geometry.dispose(); map.dispose();
});
