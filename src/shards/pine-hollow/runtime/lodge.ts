import * as v from 'valibot';
import { claim, contractFor, newBoard, recordKill, reroll, CONTRACT_ROWS, type Board, type KillInfo, type Reward } from '../quest/contracts';

const integer = v.pipe(v.number(), v.finite(), v.integer(), v.minValue(0), v.maxValue(Number.MAX_SAFE_INTEGER));
const BoardState = v.strictObject({ next: integer,
  slots: v.pipe(v.array(v.strictObject({ serial: integer, kind: v.picklist(['species', 'rarity', 'elite', 'thrall']), target: v.string(), have: integer })), v.length(3)),
  claimed: integer, streak: integer, best: integer });
const Saved = v.strictObject({ version: v.literal(1), open: v.boolean(), board: BoardState });
interface Point { readonly x: number; readonly y: number; readonly z: number }

/** Native board actions follow the page panel: open at its actual prompt, then claim/tear a selected slot while open.
 * Closing is explicit; the page panel has no walk-away closure. The entry point supplies captured prompt coordinates. */
export const PINE_LODGE = 'pine.lodge';
export const PINE_LODGE_ACT = { open: 0, close: 1, claim0: 10, claim1: 11, claim2: 12, tear0: 20, tear1: 21, tear2: 22 } as const;

/** The page reward order, with presentation omitted. Ownership of inventory, quiver, skins and facts stays with callers. */
export interface PineLodgePorts {
  readonly prompt: Point;
  readonly radius: number;
  readonly addItem: (id: 'lodge-ribbon' | 'amber-resin', count: number) => void;
  readonly addBolts: (count: number) => void;
  readonly ownSkin: (id: 'hollow-ash') => void;
  readonly streak: (count: number) => void;
}

function boardFrom(value: unknown): Board {
  const saved = v.parse(BoardState, value);
  const slots = saved.slots.map(slot => {
    const authored = contractFor(slot.serial, slot.kind, slot.target);
    if (authored === null || slot.have > authored.need) throw new RangeError('Invalid Pine lodge contract');
    return { ...authored, have: slot.have };
  });
  if (saved.next < 3 || slots.some(slot => slot.serial >= saved.next)
    || new Set(slots.map(slot => slot.serial)).size !== 3
    || saved.best > saved.claimed || saved.streak > saved.best || saved.claimed > saved.next - 3) {
    throw new RangeError('Invalid Pine lodge continuation');
  }
  return { next: saved.next, slots, claimed: saved.claimed, streak: saved.streak, best: saved.best };
}

/** Renderer-free keeper for the authored contract law. Restore is bounded, silent and atomic; words/rewards are rebuilt
 * from today's authored table, never accepted from a save. Every real death advances the same overlapping slots. */
export class PineLodge {
  private board: Board = newBoard();
  private opened = false;
  private readonly ports: PineLodgePorts;
  constructor(ports: PineLodgePorts) {
    this.ports = ports;
    if (CONTRACT_ROWS.some(row => row.reward.items.length > 2)) throw new RangeError('Pine lodge reward allowance changed');
    if (![ports.prompt.x, ports.prompt.y, ports.prompt.z, ports.radius].every(Number.isFinite) || ports.radius <= 0) {
      throw new RangeError('Invalid Pine lodge prompt');
    }
  }
  get active(): boolean { return this.opened; }
  killed(kill: KillInfo): void { recordKill(this.board, kill); }
  use(value: number, eye: Point): void {
    if (value === PINE_LODGE_ACT.close) { this.opened = false; return; }
    if (value === PINE_LODGE_ACT.open) {
      const dx = eye.x - this.ports.prompt.x, dy = eye.y - this.ports.prompt.y, dz = eye.z - this.ports.prompt.z;
      if (!this.opened && Math.sqrt(dx * dx + dy * dy + dz * dz) < this.ports.radius) this.opened = true;
      return;
    }
    if (!this.opened || !Number.isInteger(value)) return;
    const claiming = value >= PINE_LODGE_ACT.claim0 && value <= PINE_LODGE_ACT.claim2;
    const tearing = value >= PINE_LODGE_ACT.tear0 && value <= PINE_LODGE_ACT.tear2;
    if (!claiming && !tearing) return;
    if (this.board.next === Number.MAX_SAFE_INTEGER) throw new RangeError('Pine lodge draw capacity exhausted');
    if (tearing) { reroll(this.board, value - PINE_LODGE_ACT.tear0); return; }
    const reward = claim(this.board, value - PINE_LODGE_ACT.claim0);
    if (reward !== null) this.pay(reward);
  }
  private pay(reward: Reward): void {
    for (let i = 0; i < 2; i++) { const item = reward.items[i]; if (item === undefined) break; this.ports.addItem(item.id, item.n); }
    if (reward.bolts > 0) this.ports.addBolts(reward.bolts);
    if (reward.skin !== undefined) this.ports.ownSkin(reward.skin);
    this.ports.streak(this.board.streak);
  }
  snapshot(): { version: 1; open: boolean; board: v.InferOutput<typeof BoardState> } {
    const b = this.board;
    return { version: 1, open: this.opened, board: { next: b.next, slots: b.slots.map(c => ({ serial: c.serial, kind: c.kind, target: c.target, have: c.have })),
      claimed: b.claimed, streak: b.streak, best: b.best } };
  }
  prepareRestore(value: unknown): () => void {
    const saved = v.parse(Saved, value), board = boardFrom(saved.board);
    return () => { this.board = board; this.opened = saved.open; };
  }
  restore(value: unknown): void { this.prepareRestore(value)(); }
}
