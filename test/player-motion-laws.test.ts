import { Vector3 } from 'three';
import { describe, expect, test } from 'vitest';
import { HOST_MOTION, PAGE_MOTION, stepPlayerMotion, type MotionLaw, type MotionWorld, type PlayerMotionState } from '../src/engine/player/motion';

// P1-E4.1: one step, two laws. Each row of MotionLaw is a difference the two callers really have, kept on purpose until
// E5.3 converges it. These pin what a row does, so one cannot disappear without someone choosing that.

const DT = 1 / 60;
function player(): PlayerMotionState {
  return { position: new Vector3(), yaw: 0, moveScale: 1, impulse: new Vector3(), fall: { vy: 0, grounded: true }, walk: { x: 0, z: 0 },
    shove: { t: 0, vx: 0, vz: 0 }, dash: { t: 0, vx: 0, vz: 0 }, dodge: { cd: 0, t: 0 }, jump: null,
    board: { on: false, hoverAir: false, hoverBob: 0, onGround: false }, boardVelocity: new Vector3(),
    swim: { on: false, stood: false, diving: false, climbTo: null, climbCooldown: 0, strokeTime: 0 }, swimVelocity: new Vector3(),
    footing: { water: null, depth: 0, wading: false, onPlatform: false, sliding: false } };
}
/** Flat ground at y = 0 with a slope normal the test sets, and a capsule that records its moves. */
function world(law: MotionLaw, s: PlayerMotionState, velocity?: { x: number; z: number }): MotionWorld & { moves: number } {
  const result = { grounded: true, groundNormalY: 1, downhillX: 0, downhillZ: 0, horizontalFreedom: 1, groundCollider: null };
  const w: MotionWorld & { moves: number } = { moves: 0, law, hasWater: false, water: () => null, heightAt: () => 0, platforms: [], floor: () => undefined, bob: () => 0,
    motor: { result, carry: () => false, move: (feet, want) => {
      w.moves++; feet.x += want.x; feet.z += want.z; feet.y = Math.max(0, feet.y + want.y); result.grounded = feet.y === 0; return result;
    } },
    foot: { speed: () => 4, crouching: false, velocity, active: false, coyoteMs: 100 },
    boardTop: () => 14, boardCapped: () => false, jumped: () => undefined, dodged: () => undefined, landed: () => undefined, boardLanded: () => undefined,
    swimChanged: () => undefined, stroked: () => undefined, scratch: null };
  if (law.oneVelocity) Object.assign(s, { boardVelocity: s.swimVelocity, walk: s.swimVelocity });
  return w;
}
const still = { moveX: 0, moveZ: 0, yaw: 0 };

describe('the page law and the host law', () => {
  test('a dash leaves momentum on the page; on the host it only overrode the step', () => {
    const page = player(), host = player(), hostVelocity = { x: 0, z: 0 };
    const pageWorld = world(PAGE_MOTION, page), hostWorld = world(HOST_MOTION, host, hostVelocity);
    for (const s of [page, host]) Object.assign(s.dash, { t: DT * 2, vx: 12, vz: 0 });
    stepPlayerMotion(page, still, pageWorld, DT); stepPlayerMotion(host, still, hostWorld, DT);
    expect(page.walk.x).toBe(12);
    expect(hostVelocity.x).toBe(0);
    expect(host.position.x).toBeCloseTo(page.position.x, 9);
  });
  test('only the page slides down ground too steep to stand on', () => {
    for (const [law, sliding] of [[PAGE_MOTION, true], [HOST_MOTION, false]] as const) {
      const s = player(), w = world(law, s);
      Object.assign(w.motor.result, { groundNormalY: .5, downhillX: 1 });
      stepPlayerMotion(s, still, w, DT);
      expect(s.footing.sliding).toBe(sliding);
    }
  });
  test('a resting host player takes no step at all; a resting page player still falls into the ground', () => {
    const host = player(), page = player(), hostWorld = world(HOST_MOTION, host), pageWorld = world(PAGE_MOTION, page);
    expect(stepPlayerMotion(host, undefined, hostWorld, DT).mode).toBe('rest');
    expect(hostWorld.moves).toBe(0);
    expect(stepPlayerMotion(page, still, pageWorld, DT).mode).toBe('foot');
    expect(pageWorld.moves).toBe(1);
  });
  test('a host walker with no velocity takes no gravity while it holds the ground', () => {
    const s = player(), w = world(HOST_MOTION, s);
    stepPlayerMotion(s, { ...still, moveX: 1 }, w, DT);
    expect(s.fall.vy).toBe(0); expect(s.position.x).toBeCloseTo(4 * DT, 9);
  });
  test('stepping on the board drops the host walk; the page has one velocity and keeps it', () => {
    const page = player(), host = player();
    const pageWorld = world(PAGE_MOTION, page), hostWorld = world(HOST_MOTION, host);
    page.walk.x = 3; host.walk.x = 3;
    Object.assign(page.board, { on: true }); Object.assign(host.board, { on: true });
    stepPlayerMotion(page, still, pageWorld, DT); stepPlayerMotion(host, still, hostWorld, DT);
    expect(host.walk.x).toBe(0);
    expect(page.walk.x).toBeGreaterThan(2); // it coasts down from 3, and is not dropped
  });
});
