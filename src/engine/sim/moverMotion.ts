import * as v from 'valibot';
import { Euler, Quaternion } from 'three';
import { lowerMoverMotion, MoverMotionSchema, MoverTransitSchema, type MoverMotion, type MoverTransit } from '@wildshard/format/moverMotion';
import type { ScriptEntity, ScriptEffect } from '../script/effects';

/** Admitted stop/driver data; native execution never accepts a function or an executable URL. */
export type NativeMoverMotion = MoverMotion & { at: { x: number; y: number; z: number }; euler: { x: number; y: number; z: number } };
/** The existing caller supplies time, command and permission; the mechanic installs no clock. */
export interface MoverFrame { readonly tick: number; readonly dt: number; readonly action: number; readonly permission: number; readonly time?: number }
/** A surface track returns carry/presentation data, never a callback into authored code. */
export interface MoverCarry { readonly riding: boolean; readonly position: readonly [number, number, number]; readonly yaw?: number; readonly visible: boolean; readonly arrived?: 1 | -1 }
/** A detached next state; the existing world validates and commits it before publishing collision or views. */
export interface MoverAdvance { readonly entity: ScriptEntity; readonly effects: readonly ScriptEffect[]; readonly carry?: MoverCarry }
const tau = 2 * Math.PI;
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const clamp = (x: number): number => Math.min(1, Math.max(0, x));
/** Bounded phase approach used by reversible doors as well as platform tracks. */
function approach(value: number, target: number, dt: number, seconds: number): number { return clamp(value + Math.sign(target - value) * dt / seconds); }
function sine(value: number): number {
  const x = value - Math.floor(value / tau + 0.5) * tau, z = x * x;
  return x * (1 + z * (-1 / 6 + z * (1 / 120 + z * (-1 / 5040 + z * (1 / 362880 + z * (-1 / 39916800 + z / 6227020800))))));
}
/**
 * Native execution of admitted motion rows. Fixed drivers retain their six numeric fields and old continuation;
 * reversible surface tracks use the same position/angle/progress publication. Physics and the caller's clock stay owned.
 */
export class MoverMechanic {
  private readonly fixed: NativeMoverMotion | undefined;
  private readonly transit: MoverTransit | undefined;
  private readonly parameters: readonly number[];
  /** Former fixed-driver identity; no bytes are needed to execute the admitted row. */
  readonly module: string | undefined;
  constructor(input: NativeMoverMotion | MoverTransit) {
    if ('kind' in input) { this.transit = v.parse(MoverTransitSchema, input); this.parameters = []; }
    else {
      const motion = v.parse(MoverMotionSchema, { driver: input.driver, trigger: input.trigger, ...(input.track === undefined ? {} : { track: input.track }) });
      if (Object.values(input.at).some(value => !Number.isFinite(value) || Math.abs(value) > 250)
        || Object.values(input.euler).some(value => !Number.isFinite(value) || Math.abs(value) > Math.PI)) throw new Error('Invalid mover rest pose');
      this.fixed = { ...motion, at: { ...input.at }, euler: { ...input.euler } };
      const lowered = lowerMoverMotion(motion, input); this.parameters = lowered.input; this.module = lowered.module;
    }
  }
  /** Door progress and angle share the track phase law; no object or authored update closure enters the mechanic. */
  static approach(value: number, target: number, dt: number, seconds: number): number {
    if (![value, target, dt, seconds].every(Number.isFinite) || value < 0 || value > 1 || target < 0 || target > 1 || dt < 0 || dt > 1 || seconds <= 0 || seconds > 3600) throw new Error('Invalid track phase');
    return approach(value, target, dt, seconds);
  }
  /** Reversible hinged track output, including the original quadratic ease-in/out. */
  static hinge(value: number, target: number, dt: number, seconds: number, angle: number): { progress: number; angle: number } {
    const progress = MoverMechanic.approach(value, target, dt, seconds);
    if (!Number.isFinite(angle) || Math.abs(angle) > Math.PI) throw new Error('Invalid hinge angle');
    const eased = progress < 0.5 ? 2 * progress * progress : 1 - (-2 * progress + 2) ** 2 / 2;
    return { progress, angle: -eased * angle };
  }
  /** Numeric publication matches the original field/position order; carry data is optional and renderer-free. */
  step(before: ScriptEntity, frame: MoverFrame): MoverAdvance {
    if (!Number.isFinite(frame.dt) || frame.dt < 0 || frame.dt > 1 || !Number.isSafeInteger(frame.tick) || frame.tick < 0
      || !Number.isFinite(frame.permission) || !Number.isInteger(frame.action) || frame.action < 0 || frame.action > 3
      || frame.time !== undefined && !Number.isFinite(frame.time)) throw new Error('Invalid mover frame');
    const fields = { ...before.fields }, entity: ScriptEntity = { ...before, fields, position: [...before.position] };
    const effects: ScriptEffect[] = [];
    const field = (id: number, value: number): void => { fields[id] = value; effects.push({ op: 1, a: id, b: value, c: 0, d: 0 }); };
    const position = (x: number, y: number, z: number): void => { entity.position = [x, y, z]; effects.push({ op: 4, a: x, b: y, c: z, d: 0 }); };
    const transit = this.transit;
    if (transit !== undefined) {
      let phase = fields[5] ?? 0, active = fields[6] ?? 0;
      if (active !== 1 && active !== 0.5 && (frame.action === 1 || frame.action === 2)) { phase = 0; active = frame.action === 1 ? 1 : 0.5; }
      if (active !== 1 && active !== 0.5) return { entity, effects };
      const forward = active === 1, from = forward ? transit.from : transit.to, to = forward ? transit.to : transit.from;
      phase = Math.min(1, phase + frame.dt / transit.seconds);
      const e = phase * phase * (3 - 2 * phase), x = lerp(from[0], to[0], e), z = lerp(from[2], to[2], e);
      const water = Math.min(1, Math.min(phase, 1 - phase) * transit.bankRamp), bank = lerp(from[1], to[1], e), time = frame.time ?? frame.tick / 60;
      const y = bank + (transit.water - bank) * water + Math.sin(time * transit.bob[0]) * transit.bob[1] * water;
      const heading = Math.atan2(to[0] - from[0], to[2] - from[2]);
      position(x, y, z); field(1, Math.sin(time * transit.pitch[0]) * transit.pitch[1] * water); field(2, heading);
      field(3, Math.sin(time * transit.roll[0] + transit.roll[2]) * transit.roll[1] * water); field(5, phase);
      const riding = phase < 1; field(6, riding ? active : forward ? 0 : 0.25);
      if (!riding && forward) entity.position = [...transit.to];
      return { entity, effects, carry: { riding, position: riding ? [x, y + transit.seat, z] : transit.landings[forward ? 1 : 0],
        visible: riding || forward, ...(riding ? {} : { yaw: heading + transit.yaw, arrived: forward ? 1 : -1 }) } };
    }
    const motion = this.fixed;
    if (motion === undefined) throw new Error('Missing admitted motion');
    const p = (i: number): number => { const value = this.parameters[i]; if (value === undefined) throw new Error('Missing mover parameter'); return value; };
    const { driver, track, trigger } = motion;
    if (driver.kind === 'static') { field(4, 1); return { entity, effects }; }
    if (driver.kind === 'winch' && driver.mode === 'hinge') {
      let angle = fields[1] ?? 0, raised = fields[5] ?? 0, raising = fields[6] ?? 0;
      if (frame.action === 3) { angle = 0; raised = 1; raising = 0; }
      else if (raised === 0 && ((frame.action === 1 && frame.permission === 3) || frame.action === 2)) raising = 1;
      if (raising === 1 && raised === 0) { angle = Math.min(0, angle + frame.dt * driver.speed); if (angle >= 0) { raised = 1; raising = 0; } }
      field(1, angle); field(4, raised); field(5, raised); field(6, raising); return { entity, effects };
    }
    if (driver.kind === 'winch') {
      let phase = fields[5] ?? 0, active = fields[6] ?? 0;
      if (active === 0) { if (frame.action === 1 || frame.action === 3) active = 1; }
      else if (active === 1) { if (frame.action === 1 || frame.action === 2) active = 0.5; }
      else if (active === 0.5) { if (frame.action === 1 || frame.action === 3) active = 1; }
      else if (active >= 0.2 && active <= 0.4) {
        if (frame.action === 1 || frame.action === 2) active = 0.5;
        else { active += 0.2 * frame.dt / driver.dwell; if (active >= 0.4 - 1e-9) active = 0.5; }
      }
      if (active === 1) { phase += frame.dt / p(6); if (phase >= 0.996) { phase = 1; active = 0.2; } }
      else if (active === 0.5) { phase -= frame.dt / p(6); if (phase <= 0.004) { phase = 0; active = 0; } }
      const top = 1 / 0.9, e = phase < 0.1 ? top * phase * phase / 0.2 : phase > 0.9 ? 1 - top * (1 - phase) * (1 - phase) / 0.2 : top * (phase - 0.05);
      position(lerp(p(0), p(3), e), lerp(p(1), p(4), e), lerp(p(2), p(5), e));
      field(4, driver.gate ? Number(phase > 0 || active !== 0) : 1); field(5, phase); field(6, active); return { entity, effects };
    }
    if (driver.kind === 'waves') {
      const time = frame.tick / 60, x = motion.at.x, z = motion.at.z;
      const displace = (px: number, pz: number): readonly [number, number, number] => {
        let dx = 0, dy = 0, dz = 0;
        for (const [wx, wz, amplitude, length, speed, q] of driver.waves) {
          const k = tau / length, phase = k * (wx * px + wz * pz - speed * time), qa = q / (k * 4), c = sine(phase + Math.PI / 2);
          dx += wx * qa * c; dz += wz * qa * c; dy += amplitude * sine(phase);
        }
        return [dx * driver.damping, dy * driver.damping, dz * driver.damping];
      };
      const height = (px: number, pz: number): number => {
        let d = displace(px, pz), ax = px - d[0], az = pz - d[2]; d = displace(ax, az); ax = px - d[0]; az = pz - d[2]; return displace(ax, az)[1];
      };
      const heading = motion.euler.y, fx = -sine(heading), fz = -sine(heading + Math.PI / 2), sx = -fz, sz = fx;
      const tilt = (value: number): number => { const z2 = value * value; return value * (1 + z2 * (-1 / 3 + z2 * (1 / 5 + z2 * (-1 / 7 + z2 / 9)))); };
      position(x, motion.at.y + height(x, z), z); field(1, tilt((height(x + fx * 2, z + fz * 2) - height(x - fx * 2, z - fz * 2)) / 4));
      field(2, heading); field(3, tilt((height(x + sx * 2, z + sz * 2) - height(x - sx * 2, z - sz * 2)) / 4)); field(4, 1); return { entity, effects };
    }
    let phase = fields[5] ?? 0, active = fields[6] ?? 0;
    if (trigger.kind === 'always') active = 1;
    else if (trigger.kind === 'interact') { if (frame.permission !== 0) { if (frame.action === 1) active = 1 - active; else if (frame.action === 2) active = 0; else if (frame.action === 3) { phase = 0; active = 1; } } }
    else if (trigger.kind === 'stand') active = frame.permission !== 0 ? trigger.delay === 0 ? 1 : Math.min(1, active + frame.dt / trigger.delay) : 0;
    else active = Number(frame.permission !== 0);
    if (active === 1) { const cycle = driver.kind === 'pendulum' ? driver.period : (track?.duration ?? 1) / (track?.speed ?? 1) * (track?.loop === 'pingpong' ? 2 : 1); phase += frame.dt / cycle; phase = driver.kind === 'pendulum' || track?.loop !== 'once' ? phase - Math.floor(phase) : Math.min(1, phase); }
    let pitch = motion.euler.x, yaw = motion.euler.y, roll = motion.euler.z;
    if (driver.kind === 'pendulum') { const angle = driver.amplitude * Math.sin(phase * tau); if (driver.axis === 'x') pitch += angle; else if (driver.axis === 'y') yaw += angle; else roll += angle; }
    else {
      if (track === undefined) throw new Error('Missing track');
      const sample = track.loop === 'pingpong' ? phase < 0.5 ? phase * 2 : (1 - phase) * 2 : phase, time = sample * track.duration;
      let i = 0; while (i < track.times.length - 2 && time > (track.times[i + 1] ?? 0)) i++;
      const a = track.times[i], b = track.times[i + 1]; if (a === undefined || b === undefined) throw new Error('Missing track interval');
      const t = clamp((time - a) / (b - a)), start = track.position?.[i] ?? [motion.at.x, motion.at.y, motion.at.z], end = track.position?.[i + 1] ?? start;
      position(lerp(start[0], end[0], t), lerp(start[1], end[1], t), lerp(start[2], end[2], t));
      const rest = new Quaternion().setFromEuler(new Euler(motion.euler.x, motion.euler.y, motion.euler.z)), from = track.quaternion?.[i], to = track.quaternion?.[i + 1];
      const rotation = from === undefined ? rest : new Quaternion(...from); if (to !== undefined) rotation.slerp(new Quaternion(...to), t);
      const angles = new Euler().setFromQuaternion(rotation, 'YXZ'); pitch = angles.x; yaw = angles.y; roll = angles.z;
    }
    if (driver.kind === 'pendulum') position(motion.at.x, motion.at.y, motion.at.z);
    field(1, pitch); field(2, yaw); field(3, roll); field(5, phase); field(6, active); return { entity, effects };
  }
}
