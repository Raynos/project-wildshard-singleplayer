// oxlint-disable-next-line import/no-nodejs-modules -- Node fixture reads the admitted lift module's bytes.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- the module's name is its hash
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ScriptHost } from '../../../src/engine/script/host';
import { ScriptWorld } from '../../../src/engine/script/effects';
import { Scope } from '../../../src/engine/app/scope';
import { Physics } from '../../../src/engine/physics/Physics';
import { loadRapier } from '../../../src/engine/physics/rapier';
import { CharacterMotor } from '../../../src/engine/physics/CharacterMotor';
import { MOVER_FIELD_RANGES, moverScriptEntities, parseMovers } from '../../../src/game/shardfile/movers';
import { MoverRuntime, moverQueries } from '../../../src/game/shardfile/moverRuntime';
import { MOVERS } from '../../../src/shards/nine-dragon-stack/data/movers';
import { DWELL, LIFTS, NORTH_DOOR, RIDE, liftBottom, liftTop } from '../../../src/shards/nine-dragon-stack/world/liftPlan';
import { entryDeckColliders } from '../../../src/shards/nine-dragon-stack/world/entries';
import { fragmentColliders } from '../../../src/shards/nine-dragon-stack/world/colliders';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

const ROWS = (id: string): string[] => [id, `${id}.gates`, `${id}.deck-door`, `${id}.street-door`, `${id}.road-gate`];

async function rig() {
  const physics = new Physics(await loadRapier(await (await fetch(wasmInline)).arrayBuffer()));
  const host = new ScriptHost({ world: new ScriptWorld({ fields: MOVER_FIELD_RANGES, archetypes: [], events: [], maxEntities: 32 }, moverScriptEntities(MOVERS)), query: moverQueries(MOVERS, () => []) });
  for (const hash of new Set(MOVERS.map((m) => m.module))) {
    const bytes = readFileSync(new URL(`../../../src/shards/nine-dragon-stack/assets/${hash}`, import.meta.url));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(hash); host.install(hash, Uint8Array.from(bytes));
  }
  const scope = new Scope('lift-proof'), runtime = new MoverRuntime(MOVERS, { physics, scope, host });
  // the deck, the street and the shaft's walls collide as they do in the world (static boxes)
  for (const c of [...entryDeckColliders(), ...fragmentColliders({ door: NORTH_DOOR }).floors, ...fragmentColliders({ door: NORTH_DOOR }).fronts]) {
    if (c.kind !== 'box') continue;
    const body = physics.world.createRigidBody(physics.R.RigidBodyDesc.fixed().setTranslation(c.x, c.y, c.z));
    physics.world.createCollider(physics.R.ColliderDesc.cuboid(c.hx, c.hy, c.hz), body);
  }
  return { physics, runtime, step(tick: number) { host.beginTick(tick); runtime.step(tick); physics.step(); }, dispose() { scope.dispose(); physics.dispose(); } };
}

describe('SF51-p: Nine Dragon lantern lifts', () => {
  it('declares five rows a lift, one admitted module, inside the mover limits', () => {
    expect(parseMovers(MOVERS)).toEqual(MOVERS);
    expect(MOVERS).toHaveLength(LIFTS.length * 5);
    expect(new Set(MOVERS.map((m) => m.module)).size).toBe(1);
  });

  it('carries a rider from the deck to the street in about 16 s on one action, gated while it moves, and goes back down', async () => {
    const r = await rig(), lift = LIFTS[0]; if (lift === undefined) throw new Error('no lift');
    const motor = new CharacterMotor(r.physics, { radius: 0.38, height: 1.8, step: 0.35, maxClimbDeg: 40, snap: 0.3, group: 'PLAYER', blockedBy: ['WORLD'], weight: 80 });
    const b = liftBottom(lift), t = liftTop(lift), feet = { x: b.x, y: b.y + 0.05, z: b.z };
    let vy = 0, tick = 0, carried = 0, maxDrift = 0, arrived = -1;
    const advance = (): void => {
      tick++; r.step(tick);
      const carry = motor.carry(feet); vy -= 22 / 60;
      const moved = motor.move(feet, { x: 0, y: carry && vy <= 0 ? 0 : vy / 60, z: 0 }); if (moved.grounded && vy < 0) vy = 0;
      if (carry) carried++;
      maxDrift = Math.max(maxDrift, Math.hypot(feet.x - b.x, feet.z - b.z));
    };
    try {
      for (let i = 0; i < 30; i++) advance();
      expect(r.runtime.pose(`${lift.id}.deck-door`).enabled).toBe(false); expect(r.runtime.pose(`${lift.id}.street-door`).enabled).toBe(true);
      for (const row of ROWS(lift.id)) r.runtime.command(row, 1);
      const start = tick;
      for (let i = 0; i < 20 * 60; i++) {
        advance();
        const cage = r.runtime.pose(lift.id).position;
        if (i === 5 * 60) { expect(r.runtime.pose(`${lift.id}.gates`).enabled).toBe(true); expect(r.runtime.pose(`${lift.id}.deck-door`).enabled).toBe(true); expect(feet.y - cage.y).toBeLessThan(0.2); }
        if (arrived < 0 && cage.y >= t.y) arrived = tick - start;
      }
      expect(arrived / 60).toBeGreaterThan(RIDE - 0.5); expect(arrived / 60).toBeLessThan(RIDE + 0.5);
      expect(r.runtime.pose(lift.id).position.y).toBe(t.y);
      expect(feet.y).toBeGreaterThan(t.y - 0.05); expect(feet.y).toBeLessThan(t.y + 0.3);
      expect(maxDrift).toBeLessThan(0.2); expect(carried).toBeGreaterThan(RIDE * 60);
      expect(r.runtime.pose(`${lift.id}.gates`).enabled).toBe(false); expect(r.runtime.pose(`${lift.id}.street-door`).enabled).toBe(false); expect(r.runtime.pose(`${lift.id}.deck-door`).enabled).toBe(true);
      // (stepping out onto the street is the browser walk's to prove: a bare CharacterMotor here stalls on the resting
      // cage's floor now and then, the E285 stall the player's controller retries)
      // call it back down from the street (action 2 is the deck's call: ignored at the top only when resting at the bottom)
      for (const row of ROWS(lift.id)) r.runtime.command(row, 1);
      for (let i = 0; i < (RIDE + 1) * 60; i++) { tick++; r.step(tick); }
      expect(r.runtime.pose(lift.id).position.y).toBe(b.y); expect(r.runtime.pose(`${lift.id}.street-door`).enabled).toBe(true);
      expect(r.runtime.pose(`${lift.id}.road-gate`).enabled).toBe(false);
    } finally { motor.dispose(); r.dispose(); }
  });

  it('SF8c: comes back down on its own after the dwell at the top, the road gate shut the whole time it is away', async () => {
    const r = await rig(), lift = LIFTS[0]; if (lift === undefined) throw new Error('no lift');
    let tick = 0;
    const gate = (): boolean => r.runtime.pose(`${lift.id}.road-gate`).enabled, y = (): number => r.runtime.pose(lift.id).position.y;
    try {
      for (let i = 0; i < 10; i++) { tick++; r.step(tick); }
      expect(gate()).toBe(false); expect(y()).toBe(liftBottom(lift).y);
      // a call from the street (action 3) sends it up; a deck call (2) at the bottom is ignored
      for (const row of ROWS(lift.id)) r.runtime.command(row, 2);
      for (let i = 0; i < 30; i++) { tick++; r.step(tick); }
      expect(y()).toBe(liftBottom(lift).y); expect(gate()).toBe(false);
      for (const row of ROWS(lift.id)) r.runtime.command(row, 3);
      let top = -1, back = -1, shutAway = true;
      for (let i = 0; i < (2 * RIDE + DWELL + 2) * 60; i++) {
        tick++; r.step(tick);
        if (y() !== liftBottom(lift).y && !gate()) shutAway = false;
        if (top < 0 && y() === liftTop(lift).y) top = i;
        if (top >= 0 && back < 0 && y() === liftBottom(lift).y) back = i;
      }
      expect(shutAway).toBe(true);
      expect(top).toBeGreaterThan(0); expect(back).toBeGreaterThan(top);
      // it rests at the top for the dwell, then rides down: the whole return a dwell plus a ride (± a second)
      expect((back - top) / 60).toBeGreaterThan(DWELL + RIDE - 1); expect((back - top) / 60).toBeLessThan(DWELL + RIDE + 1);
      expect(gate()).toBe(false);
    } finally { r.dispose(); }
  });
});

