// E357 S4.3b (08 §6.3 B): Driftwood's toon look is its LookStrategy. The ground palette at 20 points and the patched
// shader chunks are frozen from the engine code they moved out of (Terrain.ts lowPolyGroundColor; stylize.ts
// installStylize after installAtmosphere — hashes checked equal to the old install on 2026-10-01), so a program key
// cannot drift unseen.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { installAtmosphere } from '../../../src/engine/world/Atmosphere';
import { fnv1a32 } from '../../../src/engine/core/rng';
import { lowPolyGroundColor } from '../../../src/shards/driftwood-isle/look/groundColor';
import { installRampFog, installToonLighting, resumeRampFog, suspendRampFog, toonUniforms } from '../../../src/shards/driftwood-isle/look/toon';
import { shardRender } from '../../../src/shards/driftwood-isle/look/render';

/** [h, slope, x, z, lip, r, g, b] */
const GROUND: readonly (readonly number[])[] = [
  [-2.0, 0.000, -200.0, 150.0, 0.5, 0.00768, 0.35994, 0.46733],
  [-0.4, 0.137, -178.7, 132.1, 0, 0.50093, 0.37774, 0.19841],
  [1.2, 0.274, -157.4, 114.2, 0, 1.05448, 0.73167, 0.27654],
  [2.8, 0.411, -136.1, 96.3, 0.5, 0.23267, 0.23637, 0.24377],
  [4.4, 0.548, -114.8, 78.4, 0, 0.19920, 0.21297, 0.23465],
  [6.0, 0.685, -93.5, 60.5, 0, 0.13816, 0.14896, 0.16607],
  [7.6, 0.822, -72.2, 42.6, 0.5, 0.10607, 0.21740, 0.08750],
  [9.2, 0.059, -50.9, 24.7, 0, 0.15561, 0.42274, 0.06248],
  [10.8, 0.196, -29.6, 6.8, 0, 0.15591, 0.41738, 0.05946],
  [12.4, 0.333, -8.3, -11.1, 0.5, 0.17112, 0.35182, 0.10794],
  [14.0, 0.470, 13.0, -29.0, 0, 0.24222, 0.25847, 0.28402],
  [15.6, 0.607, 34.3, -46.9, 0, 0.15188, 0.16285, 0.18017],
  [17.2, 0.744, 55.6, -64.8, 0.5, 0.17694, 0.31786, 0.11083],
  [18.8, 0.881, 76.9, -82.7, 0, 0.13377, 0.14511, 0.16313],
  [20.4, 0.118, 98.2, -100.6, 0, 0.25578, 0.52639, 0.07529],
  [22.0, 0.255, 119.5, -118.5, 0.5, 0.24228, 0.48934, 0.06884],
  [23.6, 0.392, 140.8, -136.4, 0, 0.24893, 0.26561, 0.29182],
  [25.2, 0.529, 162.1, -154.3, 0, 0.17987, 0.19217, 0.21153],
  [26.8, 0.666, 183.4, -172.2, 0.5, 0.20913, 0.34380, 0.13345],
  [28.4, 0.803, 204.7, -190.1, 0, 0.11430, 0.12399, 0.13939],
];

const hash = (s: string): string => fnv1a32(s).toString(16);

describe("Driftwood's toon look", () => {
  it('paints the ground as Terrain.ts did', () => {
    const c = new THREE.Color();
    for (const [h = 0, slope = 0, x = 0, z = 0, lip = 0, r, g, b] of GROUND) {
      lowPolyGroundColor(c, h, slope, x, z, lip);
      expect([c.r, c.g, c.b].map((v) => Number(v.toFixed(5)))).toEqual([r, g, b]);
    }
  });

  it('patches the chunks byte for byte as installStylize did (the ramp fog after the engine fog, then the toon light)', () => {
    installAtmosphere({});
    installRampFog();
    installToonLighting();
    expect([hash(THREE.ShaderChunk.fog_pars_fragment), hash(THREE.ShaderChunk.fog_fragment), hash(THREE.ShaderChunk.lights_physical_pars_fragment)])
      .toEqual(['b50c99ee', 'f4d94416', 'b317e256']);
  });

  it('declares every part the engine used to branch on', () => {
    const look = shardRender();
    expect(look.mode).toBe('extend');
    expect(look.fog?.order).toBe(200);
    expect(look.shadows).toEqual({ rig: 'phoneSplits', filter: 'tent', fade: true, normalBias: 0.14, radius: 0.6, texelBias: 'phone', depth16: 'phone' });
    expect(look.lighting).toBeDefined();
    expect(look.backdrop).toBeDefined();
    expect(look.terrainPainter).toBeDefined();
  });

  it('switches the ramp haze off and back for an overhead shot', () => {
    const start = toonUniforms.uFogStart.value, end = toonUniforms.uFogEnd.value;
    suspendRampFog();
    expect([toonUniforms.uFogStart.value, toonUniforms.uFogEnd.value]).toEqual([1e6, 2e6]);
    resumeRampFog();
    expect([toonUniforms.uFogStart.value, toonUniforms.uFogEnd.value]).toEqual([start, end]);
  });
});
