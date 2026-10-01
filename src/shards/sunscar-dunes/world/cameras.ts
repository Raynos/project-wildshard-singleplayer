/**
 * Capture poses (manifest `dev.poses`): yaw in degrees, 0 = north (-z), +90 = east; pitch + = up; `eye` = feet + 1.68.
 * C is Jake's pick (art/sunscar-dunes/round-2-dunes/C-dusk-signal-fire.jpg): from the spawn's dune top, the tower on
 * the far crest against the glow.
 */
import { SPAWN, TOWER } from '../layout';

interface Pose { eye: readonly [number, number, number]; feet: readonly [number, number, number]; yaw: number; pitch: number; mockup: string; frame: string }
const MOCKUP = 'art/sunscar-dunes/round-2-dunes/C-dusk-signal-fire.jpg';

export function duskPoses(heightAt: (x: number, z: number) => number): Readonly<Record<string, Pose>> {
  const pose = (x: number, z: number, yaw: number, pitch: number, frame: string, lift = 0): Pose => {
    const y = heightAt(x, z) + lift;
    return { eye: [x, y + 1.68, z], feet: [x, y, z], yaw, pitch, mockup: MOCKUP, frame };
  };
  const toTower = Math.atan2(TOWER.x - SPAWN.x, -(TOWER.z - SPAWN.z)) * 180 / Math.PI;
  return {
    C: pose(SPAWN.x, SPAWN.z, toTower, 3, 'the signal tower on the far crest, centred, against the orange glow; dunes falling away in front'),
    hollow: pose(-30, 10, 300, 2, 'a dune hollow in blue shade, the lit crest beyond'),
    deck: pose(TOWER.x, TOWER.z + 1, 180, -6, 'from the tower deck back over the dune sea', 4.5),
  };
}
