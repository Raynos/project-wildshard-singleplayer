// oxlint-disable-next-line import/no-nodejs-modules -- Reads the actual committed offline GLBs.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MeshStandardMaterial } from 'three';
import { modelGeometry } from '../src/sdk/modelGeometry';
import { staticGlb } from '../src/sdk/bake/glb';
import { captainHatGeometry } from '../src/shards/driftwood-isle/generators/captainHat';
import { boatGeometry } from '../src/shards/driftwood-isle/generators/boat';
import { sailclothCapeGeometry } from '../src/shards/driftwood-isle/generators/sailclothCape';
import { chimeGeometry } from '../src/shards/driftwood-isle/generators/seaGlassChime';
import { plaquesGeometry } from '../src/shards/driftwood-isle/generators/trophyPlaques';
import { PLAQUE_GAP } from '../src/shards/driftwood-isle/models/trophyPlaques';
import { SlotGeometry } from '../src/engine/models/slots';

import { counterGeometry } from '../src/shards/driftwood-isle/generators/tradeCounter';

const material = new MeshStandardMaterial({ vertexColors: true });
describe('lossless offline model geometry', () => {
  it('retains every fixed model attribute, including wind weights, and copies cannot mutate the template', async () => {
    const boat = boatGeometry();
    for (const [name, source] of [['captain-hat', captainHatGeometry()], ['sea-glass-chime', chimeGeometry().geometry], ['sailcloth-cape', sailclothCapeGeometry()], ['boat-hull', boat.hull], ['boat-sail', boat.sail], ['boat-gear', boat.gear], ['trophy-plaques', plaquesGeometry(PLAQUE_GAP).geometry], ['trophy-drop', plaquesGeometry(0).geometry], ['trade-counter', counterGeometry()]] as const) {
      const channels = source.hasAttribute('aSway') ? { _SWAY: 'aSway' } : {};
      const aliases = source.hasAttribute('aSway') ? { _sway: 'aSway' } : {};
      const bytes = new Uint8Array(readFileSync(`public/assets/driftwood-isle/baked/fixed-models/${name}.glb`));
      expect(bytes).toEqual(staticGlb([{ geometry: source, material, customAttributes: channels }], name));
      const asset = modelGeometry('fixed.glb', aliases);
      expect(() => asset.copy()).toThrow('not loaded');
      await asset.load(bytes);
      const copy = asset.copy();
      expect(copy.index).toBeNull();
      expect(Object.keys(copy.attributes).sort()).toEqual(Object.keys(source.attributes).sort());
      for (const channel of Object.keys(source.attributes)) {
        expect(copy.getAttribute(channel).itemSize).toBe(source.getAttribute(channel).itemSize);
        expect(copy.getAttribute(channel).array, channel).toEqual(source.getAttribute(channel).array);
      }
      copy.scale(2, 3, 4);
      expect(asset.copy().getAttribute('position').array).toEqual(source.getAttribute('position').array);
      copy.dispose(); source.dispose();
    }
  });
  it('shows exactly the original collectible vertices at every chime count', async () => {
    const source = chimeGeometry(), asset = modelGeometry('chime.glb', { _sway: 'aSway' });
    await asset.load(staticGlb([{ geometry: source.geometry, material, customAttributes: { _SWAY: 'aSway' } }]));
    const before = new SlotGeometry(source.geometry, source.ranges), after = new SlotGeometry(asset.copy(), source.ranges);
    for (const count of [15, 0, 1, 5, 10, 14, 15, 3]) {
      before.setRun(1, 16, count); after.setRun(1, 16, count);
      expect(after.geometry.drawRange).toEqual(before.geometry.drawRange);
      expect(after.geometry.getIndex()?.array).toEqual(before.geometry.getIndex()?.array);
    }
    after.geometry.dispose(); before.geometry.dispose();
  });
});
