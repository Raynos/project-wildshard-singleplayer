import { CAPTURE_PROBES } from '../const';
import { GROUND } from '../../boot/ground';

interface CapturePose { probe: typeof CAPTURE_PROBES[number]; eye: readonly [number, number, number]; yaw: number; pitch: number; mockup: string; frame: string }
/** Keep the terrain-dependent diagnostic eyes at their existing height. */
export const poses = (): Promise<Record<string, CapturePose>> => Promise.resolve(Object.fromEntries(CAPTURE_PROBES.map((probe) => [probe.name, {
  probe, eye: [probe.x, GROUND.terrain.heightAt(probe.x, probe.z) + 1.68, probe.z] as const,
  yaw: -probe.yaw * 180 / Math.PI, pitch: probe.pitch * 180 / Math.PI, mockup: '', frame: probe.name,
}])));
