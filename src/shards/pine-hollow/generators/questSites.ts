/** Quest placements are fixed build facts, shared by the page's scene and pickup owners. */
import hollow from '../data/hollowLog.json' with { type: 'json' };
import layout from '../data/layout.generated.json' with { type: 'json' };
import { cabinAmbienceRows } from './ambience';

interface QuestSites {
  readonly hollow: { x: number; z: number; yaw: number; floorY: number; mid: [number, number, number]; mouths: [number, number, number][];
    floor: { x: number; z: number; hw: number; hd: number; y: number; rot: number } };
  readonly rifle: { x: number; y: number; z: number };
}
export function questSites(heightAt: (x: number, z: number) => number): QuestSites {
  const { x, z, yaw, len, r } = hollow, ax = Math.cos(yaw), az = -Math.sin(yaw);
  const floorY = Math.max(heightAt(x, z), heightAt(x - ax * len / 2, z - az * len / 2), heightAt(x + ax * len / 2, z + az * len / 2)) + 0.25;
  const mouths = [-1, 1].map((side): [number, number, number] => {
    const mx = x + side * ax * (len / 2 + 1.2), mz = z + side * az * (len / 2 + 1.2);
    return [mx, heightAt(mx, mz), mz];
  });
  const cabin = layout.CABIN_SITES[0];
  if (cabin === undefined) throw new Error('Quest rifle needs its ranger cabin');
  const c = Math.cos(cabin.rot), s = Math.sin(cabin.rot);
  const rx = cabin.x + 1.5 * c - 1.6 * s, rz = cabin.z - 1.5 * s - 1.6 * c;
  const floor = cabinAmbienceRows().floors.find(row => {
    const cosine = Math.cos(row.rot), sine = Math.sin(row.rot), dx = rx - row.x, dz = rz - row.z;
    return Math.abs(dx * cosine - dz * sine) <= row.hw && Math.abs(dx * sine + dz * cosine) <= row.hd;
  });
  return { hollow: { x, z, yaw, floorY, mid: [x, floorY, z], mouths,
    floor: { x, z, hw: len / 2, hd: r * 0.8, y: floorY, rot: yaw } },
    rifle: { x: rx, y: floor?.y ?? heightAt(rx, rz), z: rz } };
}
