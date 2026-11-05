import * as v from 'valibot';

// P1-E5.2 (E5-REPLICATION §4.2): the admission grammar of decoded input. Bytes from a client are decoded first, then
// every command and act passes through these schemas before the room queues it (MMO-REQUIREMENTS R3). The aim carries
// world coordinates, as AimCommand does; the bounds keep a hostile value out of the fixed tick.

const finite = v.pipe(v.number(), v.finite());
const u16 = v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(0xffff));
const axis = v.pipe(finite, v.minValue(-1), v.maxValue(1));
const point = v.strictObject({ x: finite, y: finite, z: finite });
const id = v.pipe(v.string(), v.regex(/^[a-zA-Z0-9._:-]{1,128}$/u));

/** Raw local axes, as LocalSteer holds them. */
export interface NetSteer { readonly keyX: number; readonly keyY: number; readonly stickX: number; readonly stickY: number }
/** World-space aim, as AimCommand holds it. */
export interface NetAim { readonly origin: { readonly x: number; readonly y: number; readonly z: number }; readonly direction: { readonly x: number; readonly y: number; readonly z: number } }
/** One client sim step of input (§4.2). */
export interface NetCommand {
  /** Wrapping, one per client sim step. */
  readonly seq: number;
  /** The low 16 bits of the server tick the client was rendering others at, for the rewind in E5.3. */
  readonly viewTick: number;
  readonly steer: NetSteer;
  readonly yaw: number; readonly pitch: number;
  /** NET_BUTTONS bits: the presses jump, dodge, hover; the holds sprint, crouch, dive, surface, heavy. */
  readonly buttons: number;
  /** A swing or shot start (J41); `targetId` keeps today's lock-on. */
  readonly attack?: { readonly targetId?: string; readonly aim: NetAim };
  /** What the heavy hold is aimed at while the crosshair is on something. */
  readonly heavyTarget?: string;
  readonly launcher?: { readonly slot: number; readonly ads: number; readonly fire?: true };
}
/** A non-movement action that must not be lost (§4.2), carrying the `seq` it belongs to. */
export type NetAct = { readonly kind: 'interact'; readonly seq: number; readonly id: string } | { readonly kind: 'reload'; readonly seq: number; readonly slot: number };

/** A decoded command fit for the fixed tick. */
export const NetCommandSchema: v.GenericSchema<NetCommand> = v.strictObject({
  seq: u16, viewTick: u16,
  steer: v.strictObject({ keyX: axis, keyY: axis, stickX: axis, stickY: axis }),
  yaw: finite, pitch: v.pipe(finite, v.minValue(-Math.PI / 2 - 1e-3), v.maxValue(Math.PI / 2 + 1e-3)),
  buttons: v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(0xff)),
  attack: v.exactOptional(v.strictObject({ targetId: v.exactOptional(id), aim: v.strictObject({ origin: point, direction: point }) })),
  heavyTarget: v.exactOptional(id),
  launcher: v.exactOptional(v.strictObject({ slot: v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(31)),
    ads: v.pipe(finite, v.minValue(0), v.maxValue(1)), fire: v.exactOptional(v.literal(true)) })),
});
/** A decoded act fit for the fixed tick. */
export const NetActSchema: v.GenericSchema<NetAct> = v.variant('kind', [
  v.strictObject({ kind: v.literal('interact'), seq: u16, id }),
  v.strictObject({ kind: v.literal('reload'), seq: u16, slot: v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(31)) }),
]);
