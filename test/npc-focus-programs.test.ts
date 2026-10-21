import { expect, test } from 'vitest';
import { installChannelPrograms } from '../src/game/plugin/channelPrograms';
import { NPC_FOCUS_PROGRAMS } from '../src/shards/driftwood-isle/generators/npcFocusPrograms';
import { CASTAWAY_FACING, CASTAWAY_HEAD_FOCUS, TRADER_FACING, TRADER_HEAD_FOCUS } from '../src/shards/driftwood-isle/generators/npcFocus';

// The oracle: the native laws the programs replace (game/plugin/animation stepNpcFacing and stepNpcHeadFocus before G570),
// composed as KitFigure composed them.
interface Facing { range: number; rate: number; maxSpeed?: number; wrapTarget?: boolean; wrapOutput?: boolean }
type Head = typeof CASTAWAY_HEAD_FOCUS | typeof TRADER_HEAD_FOCUS;
interface Focus { distance: number; toward: number; talking: number; turns: number; playerY: number; headY: number; override: number; overrideYaw: number; overridePitch: number; offsetYaw: number; offsetPitch: number }
interface Figure { turn: number; headYaw: number; headPitch: number; glanceT: number; glanceYaw: number; glancePitch: number }
const FIELDS = ['turn', 'headYaw', 'headPitch', 'glanceT', 'glanceYaw', 'glancePitch'] as const;
const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
function facing(current: number, target: number, p: Facing, dt: number): number {
  const wanted = p.wrapTarget === true ? wrap(target) : target;
  let step = wrap(wanted - current) * (1 - Math.exp(-p.rate * dt));
  if (p.maxSpeed !== undefined) step = Math.max(-p.maxSpeed * dt, Math.min(p.maxSpeed * dt, step));
  return p.wrapOutput === true ? wrap(current + step) : current + step;
}
function head(s: Figure, p: Head, f: Focus, relativeYaw: number, dt: number, time: number): void {
  let yaw: number, pitch: number;
  if (f.override !== 0) { yaw = f.overrideYaw; pitch = f.overridePitch; }
  else if (f.distance < p.range) {
    yaw = Math.max(-p.yawLimit, Math.min(p.yawLimit, wrap(relativeYaw)));
    pitch = Math.max(-p.pitchLimit, Math.min(p.pitchLimit, -Math.atan2(f.playerY + p.eyeHeight - f.headY, Math.max(p.minimumDistance, f.distance)))) * p.pitchScale;
    yaw += f.offsetYaw; pitch += f.offsetPitch;
  } else {
    s.glanceT -= dt;
    const c = p.idle.cadence;
    if (s.glanceT <= 0) {
      s.glanceT = c.base + (Math.sin(time * c.frequency) + 1) * c.span;
      s.glanceYaw = Math.sin(time * p.idle.yaw[0]) * p.idle.yaw[1];
      const ip = p.idle.pitch;
      s.glancePitch = typeof ip === 'number' ? ip : Math.sin(time * ip.frequency) > ip.threshold ? ip.above : ip.below;
    }
    yaw = s.glanceYaw; pitch = s.glancePitch;
  }
  if (p.clampAfterOffset) yaw = Math.max(-p.yawLimit, Math.min(p.yawLimit, yaw));
  const r = Math.min(1, dt * p.rate);
  s.headYaw += (yaw - s.headYaw) * r; s.headPitch += (pitch - s.headPitch) * r;
}

test.each([['castaway', CASTAWAY_FACING, CASTAWAY_HEAD_FOCUS], ['trader', TRADER_FACING, TRADER_HEAD_FOCUS]] as const)(
  'the %s focus program follows the native facing and head laws over a long trace', (name, faceRow, headRow) => {
    const program: Figure = { turn: 0, headYaw: 0, headPitch: 0, glanceT: 0, glanceYaw: 0, glancePitch: 0 }, native: Figure = { ...program };
    const focus: Focus = { distance: 0, toward: 0, talking: 0, turns: 1, playerY: 0, headY: 0, override: 0, overrideYaw: 0, overridePitch: 0, offsetYaw: 0, offsetPitch: 0 };
    const motion = installChannelPrograms(NPC_FOCUS_PROGRAMS, `npc.${name}`, new Map<string, unknown>([['figure', program], ['focus', focus]]));
    let seed = 0x5eed, time = 0, idle = 0, near = 0, looked = 0;
    const rand = (): number => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
    for (let i = 0; i < 4000; i++) {
      const dt = rand() < 0.02 ? 0 : rand() * 0.1; time += dt;
      // the player wanders between near and far; a gesture now and then holds the turn, looks or offers
      Object.assign(focus, { distance: Math.abs(8 + Math.sin(i * 0.011) * 9 + (rand() - 0.5) * 2), toward: (rand() - 0.5) * 14, talking: Number(rand() < 0.1),
        turns: Number(rand() > 0.15), playerY: rand() * 3, headY: 1.5 + rand(), override: Number(rand() < 0.1), overrideYaw: (rand() - 0.5) * 2,
        overridePitch: (rand() - 0.5), offsetYaw: rand() < 0.2 ? (rand() - 0.5) * 0.6 : 0, offsetPitch: rand() < 0.2 ? (rand() - 0.5) * 0.4 : 0 });
      motion.evaluate({ time, delta: dt, values: {} });
      const faces = (focus.distance < faceRow.range || focus.talking !== 0) && focus.turns !== 0;
      native.turn = facing(native.turn, faces ? focus.toward : 0, faceRow, dt);
      head(native, headRow, focus, focus.toward - native.turn, dt, time);
      if (focus.override !== 0) looked++; else if (focus.distance < headRow.range) near++; else idle++;
      for (const key of FIELDS) expect(program[key]).toBeCloseTo(native[key], 9);
    }
    expect(Math.min(idle, near, looked)).toBeGreaterThan(200);
  });
