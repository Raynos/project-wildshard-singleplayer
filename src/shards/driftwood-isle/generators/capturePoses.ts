import { parseBakedTerrain } from '@wildshard/format/bakedTerrainBytes';
import { bakedSamplers } from '@wildshard/format/bakedTerrainSampling';
import manifest from '../manifest.json' with { type: 'json' };
import { WORLD_DROP } from '../data/landscapeRows';
import { driftwoodGroundBytes } from './groundRows';

/** Diagnostic eyes use the shipping native lattice and datum, compiled before manifest discovery. */
export function driftwoodCapturePoses(): Record<string, {
  probe: typeof manifest.captureProbes[number]; eye: readonly [number, number, number];
  yaw: number; pitch: number; mockup: string; frame: string;
}> {
  const grid = parseBakedTerrain(driftwoodGroundBytes());
  if (grid === null) throw new Error('Capture poses require the authored terrain lattice');
  const { heightAt } = bakedSamplers(grid);
  return Object.fromEntries(manifest.captureProbes.map(probe => [probe.name, {
    probe, eye: [probe.x, (heightAt(probe.x, probe.z) - WORLD_DROP) + 1.68, probe.z] as const,
    yaw: -probe.yaw * 180 / Math.PI, pitch: probe.pitch * 180 / Math.PI, mockup: '', frame: probe.name,
  }]));
}
