import { afterEach, expect, test, vi } from 'vitest';
import { driveGridSeam, gridSeamRoute } from '../scripts/physics-grid.mjs';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

test('leaves home before waiting for owned peer admission', async () => {
  vi.useFakeTimers();
  const route = gridSeamRoute({ home: 'home', cells: [{ instance: 'home', slug: 'home', cell: [0, 0] },
    { instance: 'peer', slug: '_template', cell: [1, 0] }] }, 15);
  let x = 0, held = false, current: string | null = 'home', roadWaits = 0, roadFrames = 0;
  const transitions: { from: string | null; to: string | null }[] = [];
  const residents = ['home'];
  const player = { position: { x: 0, z: 0 }, velocity: { set: () => undefined }, yaw: 0, hover: false,
    hoverSpeedLimit: () => 30, setHover: (value: boolean) => { player.hover = value; },
    spawn: (at: number) => { x = at; }, motor: { collider: { isEnabled: () => true } } };
  const input = { clear: () => { held = false; }, setHeld: (_key: string, value: boolean) => { held = value; } };
  const state = () => ({ current, worldFeet: { x, y: 0.55, z: 0 }, residents, crossings: transitions.length,
    transitions, gameplayReady: true, issues: {} });
  vi.stubGlobal('window', { __wildshard: { shard: { grid: { state: () => ({ live: { live: state() } }) } },
    world: { player, game: { app: { input }, watchFrames: (frame: (dt: number) => void) => {
      const timer = setInterval(() => {
        if (held) x -= Math.sin(player.yaw) * 15 * 0.05;
        const next = x <= 250 ? 'home' : x >= 305 ? 'peer' : null;
        if (next !== current) { transitions.push({ from: current, to: next }); current = next; }
        if (current === null && !residents.includes('peer')) {
          roadFrames++; if (!held) roadWaits++;
          if (roadFrames > 100) residents.push('peer');
        }
        frame(0.05);
      }, 50);
      return () => { clearInterval(timer); };
    } } } } });
  const result = driveGridSeam(route);
  await vi.advanceTimersByTimeAsync(40_000);
  expect(await result).toMatchObject({ complete: true, crossingDelta: 4, stuck: [], timedOut: false });
  expect(roadWaits).toBeGreaterThan(0);
  expect(transitions).toEqual([{ from: 'home', to: null }, { from: null, to: 'peer' },
    { from: 'peer', to: null }, { from: null, to: 'home' }]);
});
