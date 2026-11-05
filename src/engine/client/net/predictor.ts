// P1-E5.3-C4 (E5-REPLICATION §5.2): client-side prediction of one's own character. Every fixed step runs the shared motion
// step at once and saves the state after it; every frame compares the server's state at `lastSeq` with what was saved, and
// only a difference over tolerance puts the server's state back and replays the commands the server has not reached.
// The world is never rolled back, only this character (J59 Q10).
import type { Vector3 } from 'three';
import type { NetCommand } from '@wildshard/format/netCommand';
import { seqAfter } from '../../shared/net/command';
import type { NetColumn } from '../../shared/net/schema';
import { CAPTURED, captureMotion, MOTION_WORDS, restoreMotion } from '../../shared/player/motionState';
import type { PlayerMotionState } from '../../shared/player/motion';
import type { CharacterMotor } from '../../shared/physics/CharacterMotor';

/** Saved moves: about a second. A full ring means the server has stopped answering, and the player holds still. */
export const PREDICTION_RING = 64;
/** E5-REPLICATION §9: position within this, and equal flags, is a match. */
export const PREDICTION_TOLERANCE = 0.02;
/** A correction this far is a teleport: it snaps rather than glides. */
export const PREDICTION_SNAP = 3;
/** Seconds the camera takes to lose about two thirds of a correction. */
const SMOOTH_TIME = 0.1;

/** What a predictor drives. */
export interface PredictedBody {
  readonly motionState: PlayerMotionState;
  readonly motor: CharacterMotor;
  /** Added to the camera's feet. */
  readonly renderOffset: Vector3;
  /** One step of a quantised command. `replay`: the second run of a step, which fires no sound, event or view moment. False
   *  when something else owned the motion that step (a ride, a traversal), so a replay skips it. */
  step: (command: NetCommand, replay: boolean) => boolean;
}

/** Owner block columns to the state they carry. A field not listed here keeps its saved value on a correction. */
const OWNER_WRITES: Readonly<Record<string, (s: PlayerMotionState, value: number) => void>> = {
  px: (s, value) => { s.position.x = value; }, py: (s, value) => { s.position.y = value; }, pz: (s, value) => { s.position.z = value; },
  vx: (s, value) => { s.velocity.x = value; }, vy: (s, value) => { s.velocity.y = value; }, vz: (s, value) => { s.velocity.z = value; },
  dashT: (s, value) => { s.dash.t = value; }, dodgeT: (s, value) => { s.dodge.t = value; }, dodgeCd: (s, value) => { s.dodge.cd = value; }, shoveT: (s, value) => { s.shove.t = value; },
};
const OWNER_FLAGS: Readonly<Record<string, (s: PlayerMotionState, value: boolean) => void>> = {
  grounded: (s, value) => { s.fall.grounded = value; }, board: (s, value) => { s.board.on = value; }, swim: (s, value) => { s.swim.on = value; },
};

/** The owner block's columns as the predictor reads them, resolved once. */
interface OwnerTable { readonly x: number; readonly y: number; readonly z: number; readonly grounded: number; readonly board: number; readonly swim: number }
function ownerTable(columns: readonly NetColumn<never>[]): OwnerTable {
  const at = (name: string): number => {
    const index = columns.findIndex(column => column.name === name);
    if (index === -1) throw new Error(`Owner block has no ${name}`);
    return index;
  };
  return { x: at('px'), y: at('py'), z: at('pz'), grounded: at('grounded'), board: at('board'), swim: at('swim') };
}

/** One player's prediction. */
export class Predictor {
  /** Corrections taken, and steps replayed for them: what a proof page reports. */
  corrections = 0; replays = 0;
  private readonly body: PredictedBody;
  private readonly columns: readonly NetColumn<never>[];
  private readonly table: OwnerTable;
  private readonly seqs = new Uint16Array(PREDICTION_RING);
  private readonly owned = new Uint8Array(PREDICTION_RING);
  private readonly commands: (NetCommand | null)[] = Array.from({ length: PREDICTION_RING }, () => null);
  private readonly states = new Float64Array(PREDICTION_RING * MOTION_WORDS);
  private head = 0;
  private count = 0;
  private acked: number | null = null;
  constructor(body: PredictedBody, columns: readonly NetColumn<never>[]) {
    this.body = body; this.columns = columns; this.table = ownerTable(columns);
  }
  /** The ring is full: run no step and send no command until a frame frees it. */
  get full(): boolean { return this.count === PREDICTION_RING; }
  /** Moves the server has not acknowledged. */
  get pending(): number { return this.count; }

  /** Run and save one step. False, with nothing changed, when the ring is full. */
  step(command: NetCommand): boolean {
    if (this.full) return false;
    const { body } = this, slot = (this.head + this.count) % PREDICTION_RING;
    this.owned[slot] = body.step(command, false) ? 1 : 0;
    this.seqs[slot] = command.seq; this.commands[slot] = command;
    captureMotion(body.motionState, body.motor, this.states, slot * MOTION_WORDS);
    this.count++;
    return true;
  }

  /** A frame: `lastSeq` is the newest command the server has stepped, `owner` its state after it. True when it corrected. */
  reconcile(lastSeq: number, owner: ArrayLike<number>): boolean {
    if (this.acked !== null && !seqAfter(lastSeq, this.acked)) return false;
    const { body, seqs, states, count, head } = this, offset = count === 0 ? -1 : (lastSeq - (seqs[head] ?? 0)) & 0xffff;
    this.acked = lastSeq;
    if (offset < 0 || offset >= count) return false; // older than the ring, or nothing saved
    const slot = (head + offset) % PREDICTION_RING, at = slot * MOTION_WORDS;
    this.head = (slot + 1) % PREDICTION_RING; this.count = count - offset - 1;
    if (this.matches(at, owner)) return false;
    const s = body.motionState, feet = s.position, x = feet.x + body.renderOffset.x, y = feet.y + body.renderOffset.y, z = feet.z + body.renderOffset.z, { yaw } = s;
    restoreMotion(s, body.motor, states, at);
    this.write(s, owner);
    for (let left = 0, run = this.head; left < this.count; left++, run = (run + 1) % PREDICTION_RING) {
      const command = this.commands[run];
      if (command !== null && command !== undefined && this.owned[run] === 1) { body.step(command, true); this.replays++; }
      captureMotion(s, body.motor, states, run * MOTION_WORDS);
    }
    s.yaw = yaw; // the view is this client's own: the server sends it back later than the thumb has moved
    this.corrections++;
    const offsetX = x - feet.x, offsetY = y - feet.y, offsetZ = z - feet.z, far = offsetX * offsetX + offsetY * offsetY + offsetZ * offsetZ > PREDICTION_SNAP * PREDICTION_SNAP;
    body.renderOffset.set(far ? 0 : offsetX, far ? 0 : offsetY, far ? 0 : offsetZ);
    return true;
  }

  /** Each render frame: the camera glides back onto the predicted feet. */
  update(dt: number): void {
    const { renderOffset } = this.body;
    if (renderOffset.x === 0 && renderOffset.y === 0 && renderOffset.z === 0) return;
    renderOffset.multiplyScalar(Math.exp(-dt / SMOOTH_TIME));
    if (renderOffset.lengthSq() < 1e-8) renderOffset.set(0, 0, 0);
  }

  private matches(at: number, owner: ArrayLike<number>): boolean {
    const { states, table } = this;
    const x = this.value(table.x, owner) - (states[at + CAPTURED.x] ?? 0), y = this.value(table.y, owner) - (states[at + CAPTURED.y] ?? 0), z = this.value(table.z, owner) - (states[at + CAPTURED.z] ?? 0);
    if (x * x + y * y + z * z > PREDICTION_TOLERANCE * PREDICTION_TOLERANCE) return false;
    return this.flag(table.grounded, owner) === states[at + CAPTURED.grounded] && this.flag(table.board, owner) === states[at + CAPTURED.board] && this.flag(table.swim, owner) === states[at + CAPTURED.swim];
  }
  private flag(index: number, owner: ArrayLike<number>): number { return this.columns[index]?.value(owner[index] ?? 0) === true ? 1 : 0; }
  private value(index: number, owner: ArrayLike<number>): number {
    const value = this.columns[index]?.value(owner[index] ?? 0);
    return typeof value === 'number' ? value : 0;
  }
  private write(s: PlayerMotionState, owner: ArrayLike<number>): void {
    const { columns } = this;
    for (const [index, column] of columns.entries()) {
      const value = column.value(owner[index] ?? 0);
      if (typeof value === 'number') OWNER_WRITES[column.name]?.(s, value);
      else if (typeof value === 'boolean') OWNER_FLAGS[column.name]?.(s, value);
    }
  }
}
