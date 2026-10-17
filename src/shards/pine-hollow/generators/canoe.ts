// oxlint-disable-next-line import/no-nodejs-modules -- Sample declared retained terrain at build time only.
import { readFileSync } from 'node:fs';
import { readNativeTerrain } from '@wildshard/sdk/bake/terrain';
import { parseMovers, type MoverData } from '@wildshard/format/movers';
import { lowerMoverMotion } from '@wildshard/format/moverMotion';
import { ISLET, POND } from '../data/layout';
import timbers from '../data/timberWorld.generated.json' with { type: 'json' };

/** Resolve the old terrain/deck sampling offline; runtime receives one ordinary winch path. */
export function canoeMover(heightAt: (x: number, z: number) => number): MoverData[number] {
  const site = timbers.landmarks.canoe[0]; if (site === undefined) throw new Error('Missing authored canoe site');
  const from: [number, number, number] = [site.x - 1.2, Math.max(heightAt(site.x - 1.2, site.z), POND.level), site.z];
  const to: [number, number, number] = [ISLET.x + ISLET.r - 1.6, Math.max(heightAt(ISLET.x + ISLET.r - 1.6, ISLET.z + 0.4), POND.level), ISLET.z + 0.4];
  const floor = (x: number, z: number): number => {
    let y = heightAt(x, z);
    for (const rect of Object.values(timbers.landmarks.timberFloors).flat()) {
      const c = Math.cos(rect.rot), s = Math.sin(rect.rot), dx = x - rect.x, dz = z - rect.z;
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      if (Math.abs(lx) <= rect.hw && Math.abs(lz) <= rect.hd) y = Math.max(y, rect.y
        + ('slope' in rect && typeof rect.slope === 'number' ? rect.slope * lz : 0)
        + ('tilt' in rect && typeof rect.tilt === 'number' ? rect.tilt * lx : 0));
    }
    return y;
  };
  const landings: [[number, number, number], [number, number, number]] = [[site.x + 2.6, floor(site.x + 2.6, site.z + 1.4), site.z + 1.4],
    [ISLET.x + ISLET.r - 3.8, floor(ISLET.x + ISLET.r - 3.8, ISLET.z + 0.6), ISLET.z + 0.6]];
  const at = { x: from[0], y: from[1], z: from[2] }, euler = { x: 0, y: 0, z: 0 };
  const driver = { kind: 'winch', mode: 'ride', dwell: 1, gate: false, return: 'command', ease: 'smoothstep', snap: 0 } as const;
  const track = { clip: 'canoe', duration: 9, loop: 'once', speed: 1, times: [0, 9], position: [from, to] } as const;
  const trigger = { kind: 'interact', permission: 0 } as const, lowered = lowerMoverMotion({ driver, track, trigger }, { at, euler });
  const rows = parseMovers([{ id: 'pine.canoe', entity: 2001, execution: 'native', kind: 'channel', at, euler, enabled: false, boxes: [],
    driver, track, trigger, ...lowered, carry: { seat: -0.45, landings, yaw: Math.PI,
      surface: { level: POND.level + 0.02, bankRamp: 8, bob: [1.9, 0.03], pitch: [1.3, 0.02], roll: [2.1, 0.035, 1] },
      prompts: [{ at: [from[0], from[1] + 0.8, from[2]], radius: 2.6, label: 'Paddle to the islet' },
        { at: [landings[1][0], landings[1][1] + 0.9, landings[1][2]], radius: 2.4, label: 'Paddle back to the shore' }],
      arrival: { flag: 'secret:islet', hint: 'The islet. Nobody has stood here in a long time' } } }]);
  const row = rows[0]; if (row === undefined) throw new Error('Missing admitted canoe path'); return row;
}
/** Build-only section input; no runtime imports this generated inventory. */
export function canoeMovers(): MoverData {
  const ground = readNativeTerrain(readFileSync(new URL('../../../../public/assets/baked/pine-hollow/terrain.bin', import.meta.url)));
  return [canoeMover(ground.heightAt)];
}
