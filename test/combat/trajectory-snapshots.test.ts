import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { projectileFlightStep, type ProjectileKind } from '../../src/engine/combat/view/projectile';
import { boltFlightStep } from '../../src/shards/pine-hollow/runtime/weapons/crossbow/Crossbow';
import { javelinFlightStep } from '../../src/shards/nalati-grasslands/runtime/weapons/Spear';
import { arrowKind as bowArrow } from '../../src/shards/nalati-grasslands/weapons/recurve';
import { arrowKind as longbowArrow } from '../../src/shards/pine-hollow/weapons/longbowView';
import { boltFlight, BOLT_KINDS } from '../../src/shards/pine-hollow/loadout/ammo';
import { FakeGame } from '../fake/FakeGame';
import { fakeWorld } from '../fake/world';

type Step = (pos: THREE.Vector3, vel: THREE.Vector3, h: number) => void;
const pitches = [-10, 0, 10, 25, 45];
const draws = [0.25, 0.6, 1];
const origin = new THREE.Vector3(0, 1.6, 0);
function velocity(speed: number, pitch: number): THREE.Vector3 {
  const p = THREE.MathUtils.degToRad(pitch);
  return new THREE.Vector3(0, Math.sin(p) * speed, -Math.cos(p) * speed);
}
function trace(step: Step, speed: number, pitch: number, substeps: number): number[][] {
  const game = new FakeGame(), pos = origin.clone(), vel = velocity(speed, pitch), positions: number[][] = [];
  game.onFixed('step', (dt) => {
    for (let i = 0; i < substeps; i++) step(pos, vel, dt / substeps);
    positions.push(pos.toArray().map((n) => Number(n.toFixed(4))));
  });
  for (let frame = 0; frame < 180; frame++) game.advance(1 / 60);
  expect(game.dead).toBe(false); expect(positions).toHaveLength(180);
  return positions;
}

// Frozen pre-C1 bodies: these are independent oracles for the mechanical extraction, not new production helpers.
function oldArrow(kind: Pick<ProjectileKind, 'gravity' | 'drag' | 'windCoupling'>, wind: THREE.Vector3 | null): Step {
  return (pos, vel, h) => {
    vel.y -= kind.gravity * h;
    if (wind !== null && kind.windCoupling > 0) {
      const w = wind.clone(); w.y = 0;
      const sp = vel.length();
      if (sp > 1e-3) {
        const side = w.sub(vel);
        side.addScaledVector(vel, -side.dot(vel) / (sp * sp));
        vel.addScaledVector(side, kind.windCoupling * h);
      }
    }
    vel.multiplyScalar(1 - kind.drag * h * vel.length() * 0.1);
    pos.addScaledVector(vel, h);
  };
}

describe('C1 mechanical flight extraction', () => {
  it.each([null, new THREE.Vector3(6, 5, -2)])('preserves the original arrow body bit-for-bit with wind %s', (wind) => {
    const kind = { gravity: 5, drag: 0.015, windCoupling: 0.25 };
    const pos = origin.clone(), vel = new THREE.Vector3(17, 4, -52), oldPos = pos.clone(), oldVel = vel.clone();
    for (let frame = 0; frame < 720; frame++) {
      oldArrow(kind, wind)(oldPos, oldVel, 1 / 240);
      projectileFlightStep(pos, vel, 1 / 240, kind, wind);
      expect(pos.toArray()).toEqual(oldPos.toArray()); expect(vel.toArray()).toEqual(oldVel.toArray());
    }
  });
  it('preserves all six bolt bodies and the javelin body bit-for-bit', () => {
    for (const kind of BOLT_KINDS) for (const rain of [0, 1]) {
      const mod = boltFlight(kind, rain), pos = origin.clone(), oldPos = origin.clone(), vel = velocity(62, 25), oldVel = vel.clone();
      for (let n = 0; n < 720; n++) {
        oldVel.y -= 9.8 * mod.gravity * (1 / 240);
        oldVel.multiplyScalar(1 - 0.012 * mod.drag * (1 / 240) * oldVel.length() * 0.1);
        oldPos.addScaledVector(oldVel, 1 / 240);
        boltFlightStep(pos, vel, 1 / 240, mod);
        expect(pos.toArray()).toEqual(oldPos.toArray()); expect(vel.toArray()).toEqual(oldVel.toArray());
      }
    }
    const pos = origin.clone(), oldPos = origin.clone(), vel = velocity(28, 45), oldVel = vel.clone();
    for (let n = 0; n < 360; n++) {
      oldVel.y -= 9.8 * (1 / 120); oldPos.addScaledVector(oldVel, 1 / 120);
      javelinFlightStep(pos, vel, 1 / 120);
      expect(pos.toArray()).toEqual(oldPos.toArray()); expect(vel.toArray()).toEqual(oldVel.toArray());
    }
  });
});

describe('3 s trajectories: no wind or world, position at every 1/60 s', () => {
  const { sky } = fakeWorld();
  for (const [name, kind, base, gain] of [
    ['bow', bowArrow(sky), 30, 28], ['longbow', longbowArrow(sky), 32, 30],
  ] as const) {
    for (const draw of draws) for (const pitch of pitches) {
      it(`${name} draw ${draw}, pitch ${pitch}`, () => {
        expect(trace((p, v, h) => { projectileFlightStep(p, v, h, kind); }, base + gain * draw, pitch, 4)).toMatchSnapshot();
      });
    }
    kind.geometry.dispose(); kind.material.dispose();
  }
  for (const kind of BOLT_KINDS) for (const rain of [0, 1]) for (const pitch of pitches) {
    it(`${kind} bolt rain ${rain}, pitch ${pitch}`, () => {
      expect(trace((p, v, h) => { boltFlightStep(p, v, h, boltFlight(kind, rain)); }, 62, pitch, 4)).toMatchSnapshot();
    });
  }
  for (const pitch of pitches) {
    it(`javelin pitch ${pitch}`, () => { expect(trace(javelinFlightStep, 28, pitch, 2)).toMatchSnapshot(); });
    it(`ghost-rider arrow pitch ${pitch}`, () => {
      expect(trace((p, v, h) => { projectileFlightStep(p, v, h, { gravity: 5, drag: 0.004, windCoupling: 0 }); }, 34, pitch, 4)).toMatchSnapshot();
    });
    for (const draw of draws) it(`sun-arrow prediction draw ${draw}, pitch ${pitch}`, () => {
      // Projectiles.predict uses 1/90 s, sampling the same integrator, rather than four substeps per frame.
      const kind = { gravity: 5, drag: 0.015, windCoupling: 0.25 }, pos = origin.clone(), vel = velocity(30 + 28 * draw, pitch);
      const positions: number[][] = [];
      for (let n = 0; n < 270; n++) {
        projectileFlightStep(pos, vel, 1 / 90, kind);
        positions.push(pos.toArray().map((v) => Number(v.toFixed(4))));
      }
      expect(positions).toMatchSnapshot();
    });
  }
});
