// PHYSICS.md, the rope bridge: its deck is a chain of plank segments on joints. At rest it holds the catenary it was
// built on; under a walker's weight it sags where the feet are and springs back after; its planks never roll; the
// walker rides it end to end without falling through.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { loadRapier } from '../src/physics/rapier';
import { Physics } from '../src/physics/Physics';
import { CharacterMotor } from '../src/physics/CharacterMotor';
import { RopeChain } from '../src/physics/ropeChain';
import type { DeckSegment } from '../src/world/RopeBridge';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

const rapier = async () => loadRapier(await (await fetch(wasmInline)).arrayBuffer());

/** The bridge's deck along +x from (0, 5, 0) to (L, 5, 0), sagging `sag` in the middle — as RopeBridge.build cuts it. */
function deck(L = 22.6, sag = 0.9, hy = 0.05): DeckSegment[] {
  const n = Math.round(L / 0.9), top = (t: number) => 5 - sag * 4 * t * (1 - t), q = new THREE.Quaternion(), up = new THREE.Vector3();
  const out: DeckSegment[] = [];
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n, y0 = top(t0), y1 = top(t1), run = L / n;
    q.setFromEuler(new THREE.Euler(-Math.atan2(y1 - y0, run), Math.PI / 2, 0, 'YXZ'));
    up.set(0, 1, 0).applyQuaternion(q);
    out.push({ x: (t0 + t1) / 2 * L - up.x * hy, y: (y0 + y1) / 2 - up.y * hy, z: -up.z * hy, rot: { x: q.x, y: q.y, z: q.z, w: q.w }, hz: Math.hypot(run, y1 - y0) / 2 });
  }
  return out;
}

/** the top-centre height of each segment's middle */
function tops(chain: RopeChain): number[] {
  return chain.bodies.map((b) => {
    const t = b.translation(), r = b.rotation();
    return new THREE.Vector3(0, 0.05, 0).applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w)).y + t.y;
  });
}

/** the worst roll of any segment about the span (degrees): its local x axis's rise out of level */
function maxRoll(chain: RopeChain): number {
  return Math.max(...chain.bodies.map((b) => {
    const r = b.rotation();
    return Math.abs(Math.asin(new THREE.Vector3(1, 0, 0).applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w)).y)) * 180 / Math.PI;
  }));
}

describe('rope bridge deck (RopeChain)', () => {
  it('hangs on its catenary at rest, carries a walker across with a real sag, and springs back', async () => {
    const R = await rapier();
    const ph = new Physics(R);
    const segs = deck();
    const chain = new RopeChain(ph, { segments: segs, hx: 0.85, hy: 0.05, mass: 14 });
    const rest = tops(chain);
    for (let i = 0; i < 180; i++) { ph.step(); chain.capture(); }
    const settled = tops(chain);
    // no one on it: the joints hold the shape it was built in (a few cm of give)
    expect(Math.max(...settled.map((y, i) => Math.abs(y - (rest[i] ?? 0))))).toBeLessThan(0.1);

    // walk across at 4.3 m/s with 80 kg of weight on the feet
    const motor = new CharacterMotor(ph, { radius: 0.38, height: 1.8, step: 0.35, maxClimbDeg: 40, snap: 0.3, group: 'PLAYER', blockedBy: ['WORLD'], weight: 80 });
    const feet = { x: 0.6, y: 5.3, z: 0 };
    let vy = 0, deepest = 0, lowestFeet = Infinity, ridden = 0;
    const mid = Math.floor(segs.length / 2);
    for (let i = 0; i < 60 * 8 && feet.x < 22; i++) {
      const riding = motor.carry(feet);
      vy -= 22 / 60;
      const r = motor.move(feet, { x: 4.3 / 60, y: riding && vy <= 0 ? 0 : vy / 60, z: 0 });
      if (r.grounded && vy < 0) vy = 0;
      if (riding) ridden++;
      ph.step(); chain.capture();
      const now = tops(chain);
      if (Math.abs(feet.x - 11.3) < 1) deepest = Math.max(deepest, (settled[mid] ?? 0) - (now[mid] ?? 0));
      lowestFeet = Math.min(lowestFeet, feet.y - (5 - 0.9 * 4 * (feet.x / 22.6) * (1 - feet.x / 22.6)));
      expect(Number.isFinite(feet.y)).toBe(true);
    }
    expect(feet.x).toBeGreaterThan(21.5); // made it across
    expect(ridden).toBeGreaterThan(200); // on the planks, riding them, most of the way
    expect(deepest).toBeGreaterThan(0.05); // the deck gives under the weight…
    expect(deepest).toBeLessThan(0.7); // …without folding
    expect(lowestFeet).toBeGreaterThan(-0.8); // never through the deck
    expect(maxRoll(chain)).toBeLessThan(3); // planks stay level across

    // off it (the walker gone): it swings back to its catenary
    motor.dispose();
    for (let i = 0; i < 60 * 6; i++) { ph.step(); chain.capture(); }
    const back = tops(chain);
    expect(Math.max(...back.map((y, i) => Math.abs(y - (settled[i] ?? 0))))).toBeLessThan(0.06);
  });
});
