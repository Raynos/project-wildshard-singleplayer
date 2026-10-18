import frames from '../data/peopleFrames.json' with { type: 'json' };
import motions from '../data/peopleMotion.json' with { type: 'json' };
import { ClientChannels } from '@wildshard/sdk/clientChannels';
import { parseClientChannels, type ClientChannelProgram } from '@wildshard/format/clientChannels';

type Expr = number | string | readonly [string, ...Expr[]];
const add = (a: Expr, b: Expr): Expr => ['add', a, b], sub = (a: Expr, b: Expr): Expr => ['sub', a, b];
const mul = (a: Expr, b: Expr): Expr => ['mul', a, b], gt = (a: Expr, b: Expr): Expr => ['gt', a, b];
const choose = (test: Expr, yes: Expr, no: Expr): Expr => ['select', test, yes, no];
const sin = (a: Expr): Expr => ['sin', a], wrap = (a: Expr): Expr => ['atan2', sin(a), ['cos', a]];
const clamp = (a: Expr, lo: number, hi: number): Expr => ['max', lo, ['min', hi, a]];
const damp = (field: string, goal: Expr, rate: number): Expr => add(`person.${field}`, mul(sub(goal, `person.${field}`), `decay${rate}`));
interface Wave { offset: number; amplitude: number; frequency: number; clock: string; cosine?: boolean }
interface Profile { idleHead?: { distance: number; yaw: number; pitch: number }; idleArm?: { distance: number; x: Wave; z?: Wave } }

/** Compile the exact camp focus/gesture law; the caller retains terrain queries,
 * orbit contact, matrices and its existing frame phase. No new host is needed. */
export function peopleMotion(id: string, frame: { neck: readonly number[] }, profile: Profile): ClientChannelProgram[] {
  const phase = 'person.phase', talk = 'talk', distance = 'distance', time: Expr = ['time'];
  const wave = (w: Wave): Expr => add(w.offset, mul([w.cosine === true ? 'cos' : 'sin', mul(w.clock === 'phase' ? phase : time, w.frequency)], w.amplitude));
  const face = choose(talk, 'toYou', choose(gt(7, distance), 'toYou', 'person.idleYaw'));
  const yaw = add('person.yaw', mul(wrap(sub(face, 'person.yaw')), 'decayFace'));
  const glanceClock = sub('person.glanceT', ['delta']), due = gt(0, glanceClock);
  const glanceT = choose(due, add(2.5, ['mod', mul(phase, 7.3), 3]), glanceClock);
  const glance = choose(due, mul(sin(mul(phase, 3.1)), 0.9), 'person.glance');
  const focus = choose(talk, 1, gt(12, distance));
  let hy = choose(focus, clamp(wrap(sub('toYou', yaw)), -1.2, 1.2), mul(glance, 0.6));
  let hp = choose(focus, mul(['neg', ['atan2', sub(add('playerY', 1.6), add('person.feet.y', frame.neck[1] ?? 0)), ['max', 0.5, distance]]], 0.6), 0);
  hp = add(hp, choose(talk, mul(sin(mul(time, 5.2)), 0.06), 0));
  if (profile.idleHead !== undefined) {
    const idle = choose(talk, 0, gt(distance, profile.idleHead.distance));
    hy = choose(idle, profile.idleHead.yaw, hy); hp = choose(idle, profile.idleHead.pitch, hp);
  }
  let ax = choose(talk, sub(-0.55, mul(['max', 0, sin(mul(time, 2.3))], 0.45)), mul(sin(mul(phase, 1.1)), 0.04));
  let az = choose(talk, add(-0.25, mul(sin(mul(time, 1.7)), 0.15)), -0.05);
  if (profile.idleArm !== undefined) {
    const idle = choose(talk, 0, gt(distance, profile.idleArm.distance));
    ax = choose(idle, wave(profile.idleArm.x), ax);
    if (profile.idleArm.z !== undefined) az = choose(idle, wave(profile.idleArm.z), az);
  }
  const outputs: readonly [string, Expr][] = [['yaw', yaw], ['glanceT', glanceT], ['glance', glance],
    ['headYaw', damp('headYaw', hy, 4)], ['headPitch', damp('headPitch', hp, 4)], ['armX', damp('armX', ax, 6)], ['armZ', damp('armZ', az, 6)]];
  const programs: ClientChannelProgram[] = [];
  for (let start = 0; start < outputs.length; start += 5) {
  const b = new ClientChannels(`nalati.people.${id}.focus.${String(start)}`), memo = new Map<string, number>();
  const properties = ['yaw', 'value', 'turn', 'pitch', 'roll', 'x', 'z'] as const;
    const lower = (value: Expr): number => {
      const key = JSON.stringify(value), old = memo.get(key); if (old !== undefined) return old;
      let node: number;
      if (typeof value === 'number') node = b.constant(value);
      else if (typeof value === 'string') node = b.read(value);
      else {
        const [op, ...args] = value, at = (i: number): number => { const arg = args[i]; if (arg === undefined) throw new Error('Missing figure expression'); return lower(arg); };
        if (op === 'time' || op === 'delta') node = b.clock(op);
        else if (op === 'select') node = b.select(at(0), at(1), at(2));
        else if (op === 'sin' || op === 'cos' || op === 'neg') node = b.unary(op, at(0));
        else if (op === 'add' || op === 'sub' || op === 'mul' || op === 'atan2' || op === 'min' || op === 'max' || op === 'mod' || op === 'gt') node = b.binary(op, at(0), at(1));
        else throw new Error('Unknown figure expression');
      }
      memo.set(key, node); return node;
    };
  const bindings = outputs.slice(start, start + 5).map(([field, expr], i) => {
    const property = properties[i]; if (property === undefined) throw new Error('Missing figure channel');
    b.output(property, lower(expr)); return { property, target: 'person', path: [field] };
  });
  const row = b.build(), parsed = parseClientChannels([{ ...row, numeric: { group: id, outputs: bindings,
    inputs: row.reads.filter(read => read.startsWith('person.')).map(input => ({ input, owner: 'person', path: input.split('.').slice(1) })) } }])[0];
  if (parsed === undefined) throw new Error('Missing figure motion program'); programs.push(parsed);
  }
  return programs;
}

export const peoplePrograms = Object.fromEntries(Object.entries(frames).map(([id, frame]) =>
  [id, peopleMotion(id, frame, motions[id as keyof typeof motions])]));
