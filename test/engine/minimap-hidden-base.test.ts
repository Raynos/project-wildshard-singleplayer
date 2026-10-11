// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Minimap } from '../../src/engine/ui/Minimap';
import * as selection from '../../src/engine/level/selection';
import * as terrain from '../../src/engine/world/Heightfield';
import { legacyDouble } from '../fake/FakeGame';

const maps: Minimap[] = [];
beforeEach(() => {
  const noop = (): void => undefined;
  const gradient: CanvasGradient = { addColorStop: noop };
  const ctx = legacyDouble<CanvasRenderingContext2D>({
    createRadialGradient: () => gradient, save: noop, restore: noop,
    beginPath: noop, closePath: noop, arc: noop, clip: noop, rect: noop,
    fillRect: noop, drawImage: noop, translate: noop, rotate: noop,
    moveTo: noop, lineTo: noop, stroke: noop, fill: noop,
    setTransform: noop, putImageData: noop,
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
  vi.stubGlobal('ImageData', class implements ImageData {
    readonly colorSpace = 'srgb';
    readonly data: Uint8ClampedArray<ArrayBuffer>;
    constructor(readonly width: number, readonly height: number) {
      this.data = new Uint8ClampedArray(width * height * 4);
    }
  });
  const level = selection.activeLevel();
  vi.spyOn(selection, 'activeLevel').mockReturnValue({ ...level, minimap: {
    palette: { ground: (_x, _z, _height, _slope, _forest, out) => { out[0] = 60; out[1] = 90; out[2] = 120; } },
  } });
});
afterEach(() => {
  for (const map of maps.splice(0)) map.scope.dispose();
  document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});

it('keeps hidden dirty terrain pending and paints it once when the base becomes visible', () => {
  const heights = vi.spyOn(terrain, 'heightAt').mockReturnValue(0);
  const map = new Minimap(); maps.push(map);
  let alpha = 0;
  map.setExtras(() => ({ baseAlpha: alpha, rects: [], images: [], labels: [] }));
  map.update({ x: 0, z: 0 }, 0, []);
  map.setFeatures({ trees: [{ x: 5, z: 6, height: 7 }] });
  map.update({ x: 0, z: 0 }, 0, []);
  expect(heights).not.toHaveBeenCalled(); expect(map.layerGen).toBe(0);
  alpha = 0.25;
  map.update({ x: 0, z: 0 }, 0, []);
  expect(heights).toHaveBeenCalled(); expect(map.layerGen).toBe(1);
  const sampled = heights.mock.calls.length;
  map.update({ x: 0, z: 0 }, 0, []);
  expect(heights.mock.calls.length).toBe(sampled); expect(map.layerGen).toBe(1);
});

it('defers a hidden baked-map fetch until positive opacity requests its unchanged URL', () => {
  const level = selection.activeLevel(), url = '/minimap-hidden-base.webp';
  vi.mocked(selection.activeLevel).mockReturnValue({ ...level, minimap: { image: url } });
  const fetchMap = vi.fn<typeof fetch>(() => new Promise<Response>(() => { /* Keep the request pending. */ }));
  vi.stubGlobal('fetch', fetchMap);
  const map = new Minimap(); maps.push(map);
  let alpha = 0;
  map.setExtras(() => ({ baseAlpha: alpha, rects: [], images: [], labels: [] }));
  map.update({ x: 0, z: 0 }, 0, []);
  expect(fetchMap).not.toHaveBeenCalled();
  alpha = 1;
  map.update({ x: 0, z: 0 }, 0, []);
  map.update({ x: 0, z: 0 }, 0, []);
  expect(fetchMap).toHaveBeenCalledExactlyOnceWith(url);
});
