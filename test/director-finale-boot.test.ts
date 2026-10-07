// @vitest-environment happy-dom
// oxlint-disable-next-line import/no-nodejs-modules -- The installer fetch double returns the actual committed author bytes.
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { setDev } from '../src/engine/core/devMode';
import { Scope } from '../src/engine/app/scope';
import { withOwner } from '../src/engine/app/ownership';
import type { SystemSpec } from '../src/engine/app/systems';
import { Flags } from '../src/engine/world/interact/flags';
import { installFinale, type FinaleAdventure, type FinaleWorld } from '../src/shards/driftwood-isle/quest/Finale';
import type { AdvAnimal } from '../src/shards/driftwood-isle/quest/adventure';
import declaration from '../src/shards/driftwood-isle/data/director.json';

const scopes: Scope[] = [];
afterEach(() => { setDev(false); scopes.splice(0).forEach((scope) => { scope.dispose(); }); vi.unstubAllGlobals(); document.body.replaceChildren(); });
function fixture() {
  const scope = new Scope('finale.boot'); scopes.push(scope);
  const flags = new Flags('driftwood-isle', false), events: { tick: number; key: string }[] = [], frames: ((dt: number, time: number) => void)[] = [], systems: SystemSpec[] = [];
  const player = { position: new Vector3(20, 0, 0), velocity: new Vector3(), yaw: 0, pitch: 0, carried: false };
  let tick = 0;
  const record = (key: string): void => { events.push({ tick, key }); };
  const world: FinaleWorld<AdvAnimal> = { scope, player, sky: { planetDir: new Vector3(0, 0, 1), dayNight: { phase: 0.4 } },
    game: { onUpdate: (run) => { frames.push(run); } },
    animals: { spawn: (kind, x, z, yaw) => ({ kind, position: new Vector3(x, 0, z), mem: { yaw }, hp: 10, maxHp: 10, alive: true, herd: 0 }) },
    hud: { toast: (text) => { if (text.startsWith('Captain Brine sinks')) record('captain.dead'); } },
    music: { combat: () => { record('captain.wake'); }, sting: () => { if (player.carried) record('reward.start'); } },
  };
  const adventure: FinaleAdventure = { flags, spine: null, complete: null, place: (point) => ({ x: point.x, y: point.dy ?? 0, z: point.z, yaw: 0 }), floorAt: () => 0,
    setAnchor: () => { /* Marker presentation is unchanged and outside the director event tape. */ } };
  flags.onChange((key, on) => { if (on && key === 'seen:reward') record('reward.finish'); });
  return { scope, flags, events, player, world, adventure, systems,
    fixed: () => { for (const system of systems) system.run(1 / 60, tick / 60); },
    frame: () => { for (const frame of frames) frame(1 / 60, tick / 60); },
    tick: (value: number) => { tick = value; },
  };
}
describe('SF24 shipping Driftwood director boot', () => {
  it('keeps Legacy as the default, with no author fetch or fixed director system', async () => {
    const h = fixture(), fetch = vi.fn(() => Promise.reject(new Error('Legacy must never load script'))); vi.stubGlobal('fetch', fetch);
    const installed = await withOwner(h.scope, () => installFinale(h.adventure, h.world, { scope: h.scope, system: (value) => { h.systems.push(value); }, debugRow: (row) => { expect(row.initial).toBe('off'); } }));
    expect(fetch).not.toHaveBeenCalled(); expect(h.systems).toEqual([]);
    h.tick(10); h.flags.set('used:altar'); h.frame();
    expect(h.events).toEqual([{ tick: 10, key: 'captain.wake' }]); expect(installed.captain()?.mem['awake']).toBe(1);
  });
  it('runs the saved Script choice through the real recipe with exactly the legacy event ticks and poses', async () => {
    setDev(true);
    const bytes = Uint8Array.from(readFileSync(`src/shards/driftwood-isle/assets/${declaration.module}`));
    vi.stubGlobal('fetch', () => Promise.resolve(new Response(bytes)));
    const legacy = fixture(), directed = fixture();
    const a = withOwner(legacy.scope, () => installFinale(legacy.adventure, legacy.world));
    const b = await withOwner(directed.scope, () => installFinale(directed.adventure, directed.world, { scope: directed.scope,
      system: (value) => { directed.systems.push(value); }, debugRow: (row) => { row.change('on'); } }));
    expect(directed.systems.map((system) => system.phase)).toEqual(['fixed.post']);
    for (let tick = 1; tick <= 10000; tick++) {
      for (const h of [legacy, directed]) { h.tick(tick); if (tick === 10) h.flags.set('used:altar'); if (tick === 200) h.flags.set('dead:captain'); }
      legacy.player.position.copy(tick >= 220 ? a.rewardAt : new Vector3(20, 0, 0));
      directed.player.position.copy(tick >= 220 ? b.rewardAt : new Vector3(20, 0, 0));
      directed.fixed(); legacy.frame(); directed.frame();
      expect(directed.events).toEqual(legacy.events);
      expect(directed.player.position.toArray()).toEqual(legacy.player.position.toArray());
      expect([directed.player.yaw, directed.player.pitch, directed.player.carried]).toEqual([legacy.player.yaw, legacy.player.pitch, legacy.player.carried]);
      expect(directed.world.sky.dayNight?.phase).toBe(legacy.world.sky.dayNight?.phase);
    }
    expect(directed.flags.all).toEqual(legacy.flags.all);
    expect(directed.events).toEqual([{ tick: 10, key: 'captain.wake' }, { tick: 200, key: 'captain.dead' }, { tick: 220, key: 'reward.start' }, { tick: 640, key: 'reward.finish' }]);
  }, 60000);
});
