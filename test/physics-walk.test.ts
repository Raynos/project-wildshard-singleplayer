import { describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Executes the browser-serialized harness against a flat physics fixture.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- A VM supplies the browser globals without starting a browser.
import { runInNewContext } from 'node:vm';
import { InputService } from '../src/engine/input/InputService';

describe('physics baseline autopilot', () => {
  it('walks a flat leg through InputService without teleporting and releases its observer', async () => {
    let now = 0, spawns = 0, removed = false;
    const input = new InputService(() => now);
    const position = { x: 0, y: 0, z: 0 };
    const player = {
      position, velocity: { y: 0, set: () => undefined }, keys: new Set<string>(),
      yaw: 0, pitch: 0, onGround: true, onPlatform: false, swimming: false, sliding: false,
      spawn: (x: number, z: number, yaw: number) => { spawns++; Object.assign(position, { x, z }); player.yaw = yaw; },
    };
    const watchFrames = (tick: (dt: number) => void) => {
      queueMicrotask(() => {
        for (let frame = 0; frame < 300; frame++) {
          if (removed) break;
          now += 1000 / 60;
          const move = input.axis2('move');
          position.x -= Math.sin(player.yaw) * move.y * 4 / 60;
          position.z -= Math.cos(player.yaw) * move.y * 4 / 60;
          tick(1 / 60);
          input.endFrame();
        }
      });
      return () => { removed = true; };
    };
    const source = readFileSync(new URL('../scripts/physics-walk.mjs', import.meta.url), 'utf8').replace('export async function', 'async function');
    const result: unknown = await runInNewContext(`${source}\nwalkPhysicsLeg(leg)`, {
      window: { __wildshard: { world: {
        player, game: { app: { input }, watchFrames }, animals: {},
        physics: { R: { Ray: Object, QueryFilterFlags: { EXCLUDE_SENSORS: 0 } }, world: { castRay: () => null } },
      } } },
      performance: { now: () => now }, setTimeout: (run: () => void) => { run(); },
      leg: { name: 'flat', start: { x: 0, y: 0, z: 0, yaw: 0 }, waypoints: [{ x: 0, z: -4 }] },
    });
    expect(result).toMatchObject({ stuck: [], out: 0 });
    expect(position.z).toBeLessThan(-3.2);
    expect(spawns).toBe(1); // A stuck waypoint teleport must never count as walking progress.
    expect(removed).toBe(true);
    expect(input.held('move.forward')).toBe(false);
  });
});
