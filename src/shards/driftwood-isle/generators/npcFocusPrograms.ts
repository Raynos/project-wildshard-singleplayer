// The kit figures' attention as client channel programs (G570): the turn to face the player and the head's focus, idle
// glance and gesture look, compiled from each NPC's profile (npcFocus.ts) for game/systems/npc/kitFigure, which fills
// owner `focus` natively each frame and keeps the pose in owner `figure` (Nalati's camp people move the same way).
import { ClientChannels } from '@wildshard/sdk/clientChannels';
import { parseClientChannels, type ClientChannelProgram } from '@wildshard/format/clientChannels';
import { CASTAWAY_FACING, CASTAWAY_HEAD_FOCUS, TRADER_FACING, TRADER_HEAD_FOCUS } from './npcFocus';

interface Facing { readonly range: number; readonly rate: number; readonly maxSpeed?: number; readonly wrapTarget?: boolean; readonly wrapOutput?: boolean }
interface Head {
  readonly range: number; readonly yawLimit: number; readonly pitchLimit?: number; readonly pitchScale: number; readonly eyeHeight: number;
  readonly minimumDistance: number; readonly response: 'linear' | 'exponential'; readonly rate: number; readonly clampAfterOffset: boolean;
  readonly idle: { readonly cadence: { readonly kind: 'sine' | 'cycle'; readonly base: number; readonly frequency: number; readonly span: number; readonly strict?: boolean };
    readonly yaw: readonly [number, number]; readonly yawWeight?: number;
    readonly pitch: number | { readonly frequency: number; readonly threshold: number; readonly above: number; readonly below: number } };
}
const FIGURE = ['turn', 'headYaw', 'headPitch', 'glanceT', 'glanceYaw', 'glancePitch'] as const;
const FOCUS = ['distance', 'toward', 'talking', 'turns', 'playerY', 'headY', 'override', 'overrideYaw', 'overridePitch', 'offsetYaw', 'offsetPitch'] as const;

/** One figure's facing and head law as a numeric group `npc.<name>`. */
export function kitFocusProgram(name: string, facing: Facing, head: Head): ClientChannelProgram {
  const b = new ClientChannels(`driftwood.npc.${name}.focus`), constants = new Map<number, number>();
  const c = (value: number): number => { let node = constants.get(value); if (node === undefined) { node = b.constant(value); constants.set(value, node); } return node; };
  const figure = (key: (typeof FIGURE)[number]): number => b.read(`figure.${key}`), focus = (key: (typeof FOCUS)[number]): number => b.read(`focus.${key}`);
  const fig = { turn: figure('turn'), headYaw: figure('headYaw'), headPitch: figure('headPitch'), glanceT: figure('glanceT'), glanceYaw: figure('glanceYaw'), glancePitch: figure('glancePitch') };
  const at = { distance: focus('distance'), toward: focus('toward'), talking: focus('talking'), turns: focus('turns'), playerY: focus('playerY'), headY: focus('headY'),
    override: focus('override'), overrideYaw: focus('overrideYaw'), overridePitch: focus('overridePitch'), offsetYaw: focus('offsetYaw'), offsetPitch: focus('offsetPitch') };
  const add = (x: number, y: number): number => b.binary('add', x, y), sub = (x: number, y: number): number => b.binary('sub', x, y);
  const mul = (x: number, y: number): number => b.binary('mul', x, y), gt = (x: number, y: number): number => b.binary('gt', x, y);
  const clamp = (x: number, lo: number, hi: number): number => b.binary('max', c(lo), b.binary('min', c(hi), x));
  const wrap = (x: number): number => b.binary('atan2', b.unary('sin', x), b.unary('cos', x));
  const dt = b.clock('delta'), time = b.clock('time'), sin = (x: number): number => b.unary('sin', x);
  const response = (rate: number, kind: 'linear' | 'exponential'): number => kind === 'linear' ? b.binary('min', c(1), mul(dt, c(rate)))
    : sub(c(1), b.binary('pow', c(Math.E), mul(c(-rate), dt)));
  // the body turn (was plugin/animation stepNpcFacing): toward the player while near or talking, unless the gesture holds it
  const faces = mul(b.binary('max', gt(c(facing.range), at.distance), at.talking), at.turns);
  const target = b.select(faces, at.toward, c(0)), wanted = facing.wrapTarget === true ? wrap(target) : target;
  let step = mul(wrap(sub(wanted, fig.turn)), response(facing.rate, 'exponential'));
  if (facing.maxSpeed !== undefined) { const most = mul(c(facing.maxSpeed), dt); step = b.binary('max', b.unary('neg', most), b.binary('min', most, step)); }
  const turned = add(fig.turn, step), turn = facing.wrapOutput === true ? wrap(turned) : turned;
  // the head (was stepNpcHeadFocus): a gesture's look, else the player within range, else the idle glance
  const near = gt(c(head.range), at.distance);
  let pitch = b.unary('neg', b.binary('atan2', sub(add(at.playerY, c(head.eyeHeight)), at.headY), b.binary('max', c(head.minimumDistance), at.distance)));
  if (head.pitchLimit !== undefined) pitch = clamp(pitch, -head.pitchLimit, head.pitchLimit);
  const nearYaw = add(clamp(wrap(sub(at.toward, turn)), -head.yawLimit, head.yawLimit), at.offsetYaw);
  const nearPitch = add(mul(pitch, c(head.pitchScale)), at.offsetPitch);
  const idle = head.idle, cadence = idle.cadence, clock = sub(fig.glanceT, dt);
  const due = cadence.strict === true ? gt(c(0), clock) : sub(c(1), gt(clock, c(0)));
  const wait = cadence.kind === 'sine' ? mul(add(sin(mul(time, c(cadence.frequency))), c(1)), c(cadence.span)) : b.binary('mod', mul(time, c(cadence.frequency)), c(cadence.span));
  const glanceT = b.select(due, add(c(cadence.base), wait), clock), glanceYaw = b.select(due, mul(sin(mul(time, c(idle.yaw[0]))), c(idle.yaw[1])), fig.glanceYaw);
  const glancePitch = b.select(due, typeof idle.pitch === 'number' ? c(idle.pitch)
    : b.select(gt(sin(mul(time, c(idle.pitch.frequency))), c(idle.pitch.threshold)), c(idle.pitch.above), c(idle.pitch.below)), fig.glancePitch);
  const idleNow = mul(sub(c(1), at.override), sub(c(1), near));
  let yaw = b.select(at.override, at.overrideYaw, b.select(near, nearYaw, mul(glanceYaw, c(idle.yawWeight ?? 1))));
  const goalPitch = b.select(at.override, at.overridePitch, b.select(near, nearPitch, glancePitch));
  if (head.clampAfterOffset) yaw = clamp(yaw, -head.yawLimit, head.yawLimit);
  const r = response(head.rate, head.response);
  const outputs: readonly [string, number][] = [['turn', turn], ['headYaw', add(fig.headYaw, mul(sub(yaw, fig.headYaw), r))],
    ['headPitch', add(fig.headPitch, mul(sub(goalPitch, fig.headPitch), r))], ['glanceT', b.select(idleNow, glanceT, fig.glanceT)],
    ['glanceYaw', b.select(idleNow, glanceYaw, fig.glanceYaw)], ['glancePitch', b.select(idleNow, glancePitch, fig.glancePitch)]];
  const properties = ['yaw', 'pitch', 'roll', 'value', 'turn', 'x'] as const;
  const bindings = outputs.map(([field, node], i) => { const property = properties[i]; if (property === undefined) throw new Error('Missing focus channel');
    b.output(property, node); return { property, target: 'figure', path: [field] }; });
  const row = b.build(), program = parseClientChannels([{ ...row, numeric: { group: `npc.${name}`, outputs: bindings,
    inputs: row.reads.map(input => ({ input, owner: input.split('.')[0] ?? '', path: input.split('.').slice(1) })), restoreOnly: [] } }])[0];
  if (program === undefined) throw new Error(`Missing ${name} focus program`);
  return program;
}

/** The castaway's and the trader's attention programs (product clientChannels). */
export const NPC_FOCUS_PROGRAMS = [kitFocusProgram('castaway', CASTAWAY_FACING, CASTAWAY_HEAD_FOCUS), kitFocusProgram('trader', TRADER_FACING, TRADER_HEAD_FOCUS)];
