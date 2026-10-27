import { expect, test } from 'vitest';
import { filePolicy } from '@wildshard/engine/boot/filePolicy';
import { CLOUD_FIELD_URL } from '@wildshard/engine/boot/bakedApi';
import { bootFilePolicy, sharedBootTextures, type BootInventory } from './bootInventory';

test('explicit boot inventory keeps original phone fallbacks and GPU precedence', () => {
  const inventory: BootInventory = { '/fixture/model.phone.glb': true, '/fixture/paint.phone.webp': 24 };
  const table = {
    phone: { '/fixture/paint.phone.webp': '/fixture/phone-01234567.ktx2' },
    desktop: { '/fixture/paint.webp': '/fixture/desktop-01234567.ktx2' },
  };
  for (const tier of ['phone', 'desktop'] as const) for (const mode of ['img', 'ktx2'] as const) {
    const original = filePolicy(tier, mode, table, inventory), author = bootFilePolicy(tier, mode, table, inventory);
    for (const path of ['/fixture/model.glb', '/fixture/paint.webp', '/fixture/absent.png', '/fixture/rows.bin']) {
      expect(author.phone(path)).toBe(original.phone(path));
      expect(author.gpu(path)).toBe(original.gpu(path));
    }
  }
});

test('boot authoring refuses an omitted inventory instead of borrowing the page', () => {
  expect(() => { Reflect.apply(bootFilePolicy, undefined, ['phone', 'img', { phone: {}, desktop: {} }, undefined]); })
    .toThrow('Boot authoring requires an explicit inventory');
  expect(sharedBootTextures({})).toEqual([]);
  expect(sharedBootTextures({ [CLOUD_FIELD_URL]: true })).toEqual([CLOUD_FIELD_URL]);
});
