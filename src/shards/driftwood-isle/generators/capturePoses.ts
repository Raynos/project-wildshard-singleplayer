import { driftwoodGroundSampler } from './groundSampling';
import manifest from '../manifest.json' with { type: 'json' };

/** Diagnostic eyes use the shipping native lattice and datum, compiled before manifest discovery. */
export function driftwoodCapturePoses(): Record<string, {
  probe: typeof manifest.captureProbes[number]; eye: readonly [number, number, number];
  yaw: number; pitch: number; mockup: string; frame: string;
}> {
  const heightAt = driftwoodGroundSampler();
  return Object.fromEntries(manifest.captureProbes.map(probe => [probe.name, {
    probe, eye: [probe.x, heightAt(probe.x, probe.z) + 1.68, probe.z] as const,
    yaw: -probe.yaw * 180 / Math.PI, pitch: probe.pitch * 180 / Math.PI, mockup: '', frame: probe.name,
  }]));
}
