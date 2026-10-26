import { expect, test } from 'vitest';
import { HalfFloatType, LinearFilter, RedFormat, type DataTexture } from 'three';
import { zlibSync } from 'fflate';
import { realGc } from '@wildshard/engine/test/realGc';
import { GrassPresentationProfile } from '@wildshard/game/looks/grassPresentation';
import view from '../src/shards/nalati-grasslands/data/grassView.json' with { type: 'json' };

const heights = [0x3c00, 0xbc00, 0x3555, 0x8000];
function fixture() {
  const files = new Map<string, Uint8Array>();
  const height = zlibSync(new Uint8Array(new Uint16Array(heights).buffer));
  files.set('orchard/height.bin', height);
  const packed = zlibSync(new Uint8Array(16)), backing = new ArrayBuffer(1024 * 1024);
  const rasterBytes = new Uint8Array(backing, 0, packed.length); rasterBytes.set(packed);
  files.set('orchard/raster.bin', rasterBytes);
  files.set('orchard/scene.bin', zlibSync(new TextEncoder().encode(JSON.stringify({ version: 1, buffers: [], attributes: [], geometries: [], draws: [] }))));
  const raster = { file: 'orchard/raster.bin' }, scene = { file: 'orchard/scene.bin' };
  const tier = { rings: [{ T: 2, G: 2 }], flowers: { T: 3, G: 2 }, cards: { T: 1, s: .4 }, near: [1, 2], per: 2,
    scenes: { blades: scene, flowers: scene, cards: scene } };
  const profile = new GrassPresentationProfile({ height: { file: 'orchard/height.bin' }, mask: raster, field: raster, ground: raster,
    phone: tier, desktop: tier, view: { ...view, looks: ['orchard-blades', 'orchard-petals', 'orchard-clover'],
      half: 1, heightSize: 2, heightOrigin: -1, lattice: 2 } }, files);
  return { profile, files: new WeakRef(files), field: new WeakRef(backing), height: new WeakRef(height.buffer) };
}
function words(texture: DataTexture): number[] {
  const image: unknown = texture.image;
  if (typeof image !== 'object' || image === null) throw new Error('Missing height image');
  const data: unknown = Reflect.get(image, 'data');
  if (!(data instanceof Uint16Array)) throw new Error('Missing native height words');
  return Array.from(data);
}
const name = 'a live height texture releases its retired grass profile and other inputs';
test(name, async () => {
  await realGc('test/grass-profile-lifetime.test.ts', name, async collect => {
    function prepare() {
      const made = fixture(), texture = made.profile.heightTexture();
      expect(made.profile.heightTexture()).toBe(texture);
      return { texture, profile: new WeakRef(made.profile), files: made.files, field: made.field, height: made.height };
    }
    const live = prepare();
    try {
      await collect(live.profile); await collect(live.files); await collect(live.field); await collect(live.height);
      expect(words(live.texture)).toEqual(heights);
      expect(live.texture).toMatchObject({ format: RedFormat, type: HalfFloatType, magFilter: LinearFilter, minFilter: LinearFilter,
        image: { width: 2, height: 2 }, version: 1 });
    } finally { live.texture.dispose(); }
  });
});

test('an active grass profile shares and reloads only its disposed height texture', () => {
  const { profile } = fixture(), first = profile.heightTexture();
  expect(words(first)).toEqual(heights); expect(profile.heightTexture()).toBe(first);
  first.dispose(); const next = profile.heightTexture();
  expect(next).not.toBe(first); expect(words(next)).toEqual(heights);
  first.dispose(); expect(profile.heightTexture()).toBe(next);
  next.dispose();
});
