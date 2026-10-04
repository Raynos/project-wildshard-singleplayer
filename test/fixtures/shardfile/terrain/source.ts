import type { TerrainBakeSource } from '../../../../src/sdk/bake/terrain';

/** A rolling fixture field with flat entry roads and one hand-raised mound; no trusted runtime survives baking. */
export const TERRAIN_FIXTURE: TerrainBakeSource = {
  heightAt: (x, z) => Math.sin(x * 0.05) * Math.cos(z * 0.03) * 3 * Math.max(0, Math.min(1, (250 - Math.max(Math.abs(x), Math.abs(z))) / 30)),
  colourAt: (_x, _z, height) => [0.38 + Math.max(0, height) / 100, 0.4, 0.42],
  overrides: [{ x: 0, z: 0, radius: 12, height: 4, mode: 'raise' }],
};
