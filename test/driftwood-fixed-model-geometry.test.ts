// oxlint-disable-next-line import/no-nodejs-modules -- Reads the actual committed offline GLBs.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MeshStandardMaterial } from 'three';
import { modelGeometry } from '../src/sdk/modelGeometry';
import { staticGlb } from '../src/sdk/bake/glb';
import { captainHatGeometry } from '../src/shards/driftwood-isle/generators/captainHat';
import { chimeGeometry } from '../src/shards/driftwood-isle/generators/seaGlassChime';
import { SlotGeometry } from '../src/engine/models/slots';

const material = new MeshStandardMaterial({ vertexColors: true });
describe('lossless offline model geometry', () => {
  it('retains every hat/chime attribute, including wind weights, and copies cannot mutate the template', async () => {
    for (const [name, source] of [['captain-hat', captainHatGeometry()], ['sea-glass-chime', chimeGeometry().geometry]] as const) {
      const bytes = new Uint8Array(readFileSync(`public/assets/driftwood-isle/baked/fixed-models/${name}.glb`));
      expect(bytes).toEqual(staticGlb([{ geometry: source, material, customAttributes: { _SWAY: 'aSway' } }], name));
      const asset = modelGeometry('fixed.glb', { _sway: 'aSway' });
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
