import * as v from 'valibot';
import type { ContractCatalogue, ContractReward } from '@wildshard/format/contracts';
import { claim, contractFor, newBoard, recordKill, reroll, type Board, type KillInfo } from './contracts';

const integer = v.pipe(v.number(), v.finite(), v.safeInteger(), v.minValue(0));
const BoardState = v.strictObject({ next: integer,
  slots: v.pipe(v.array(v.strictObject({ serial: integer, kind: v.string(), target: v.string(), have: integer })), v.maxLength(8)),
  claimed: integer, streak: integer, best: integer });
const Saved = v.strictObject({ version: v.literal(1), open: v.boolean(), board: BoardState });
interface Point { readonly x: number; readonly y: number; readonly z: number }

/** Native board actions follow the page panel: open at its actual prompt, then claim/tear a selected slot while open.
 * Closing is explicit; the page panel has no walk-away closure. The entry point supplies captured prompt coordinates. */
export const CONTRACT_ACTION = { open: 0, close: 1, claim0: 10, tear0: 20 } as const;
/** Data-only modal board. A successful claim returns rewards for the existing inventory owner. */
export interface ContractBoardRows {
  readonly contracts: ContractCatalogue; readonly prompt: Point; readonly radius: number;
}
export interface ContractClaim { readonly reward: ContractReward; readonly streak: number }

function boardFrom(contracts: ContractCatalogue, value: unknown): Board {
  const saved = v.parse(BoardState, value);
  const slots = saved.slots.map(slot => {
    const authored = contractFor(contracts, slot.serial, slot.kind, slot.target);
    if (authored === null || slot.have > authored.need) throw new RangeError('Invalid contract board contract');
    return { ...authored, have: slot.have };
  });
  if (saved.slots.length !== contracts.slots || saved.next < contracts.slots || slots.some(slot => slot.serial >= saved.next)
    || new Set(slots.map(slot => slot.serial)).size !== contracts.slots
    || saved.best > saved.claimed || saved.streak > saved.best || saved.claimed > saved.next - contracts.slots) {
    throw new RangeError('Invalid contract board continuation');
  }
  return { next: saved.next, slots, claimed: saved.claimed, streak: saved.streak, best: saved.best };
}

/** Renderer-free keeper for the authored contract law. Restore is bounded, silent and atomic; words/rewards are rebuilt
 * from today's authored table, never accepted from a save. Every real death advances the same overlapping slots. */
export class ContractBoard {
  private board: Board;
  private opened = false;
  private readonly ports: ContractBoardRows;
  constructor(ports: ContractBoardRows) {
    this.ports = ports; this.board = newBoard(ports.contracts);
    if (![ports.prompt.x, ports.prompt.y, ports.prompt.z, ports.radius].every(Number.isFinite) || ports.radius <= 0) {
      throw new RangeError('Invalid contract board prompt');
    }
  }
  get active(): boolean { return this.opened; }
  killed(kill: KillInfo): void { recordKill(this.ports.contracts, this.board, kill); }
  use(value: number, eye: Point): ContractClaim | null {
    if (value === CONTRACT_ACTION.close) { this.opened = false; return null; }
    if (value === CONTRACT_ACTION.open) {
      const dx = eye.x - this.ports.prompt.x, dy = eye.y - this.ports.prompt.y, dz = eye.z - this.ports.prompt.z;
      if (!this.opened && Math.sqrt(dx * dx + dy * dy + dz * dz) < this.ports.radius) this.opened = true;
      return null;
    }
    if (!this.opened || !Number.isInteger(value)) return null;
    const claiming = value >= CONTRACT_ACTION.claim0 && value <= CONTRACT_ACTION.claim0 + this.ports.contracts.slots - 1;
    const tearing = value >= CONTRACT_ACTION.tear0 && value <= CONTRACT_ACTION.tear0 + this.ports.contracts.slots - 1;
    if (!claiming && !tearing) return null;
    if (this.board.next === Number.MAX_SAFE_INTEGER) throw new RangeError('contract board draw capacity exhausted');
    if (tearing) { reroll(this.ports.contracts, this.board, value - CONTRACT_ACTION.tear0); return null; }
    const reward = claim(this.ports.contracts, this.board, value - CONTRACT_ACTION.claim0);
    return reward === null ? null : { reward, streak: this.board.streak };
  }
  snapshot(): { version: 1; open: boolean; board: v.InferOutput<typeof BoardState> } {
    const b = this.board;
    return { version: 1, open: this.opened, board: { next: b.next, slots: b.slots.map(c => ({ serial: c.serial, kind: c.kind, target: c.target, have: c.have })),
      claimed: b.claimed, streak: b.streak, best: b.best } };
  }
  prepareRestore(value: unknown): () => void {
    const saved = v.parse(Saved, value), board = boardFrom(this.ports.contracts, saved.board);
    return () => { this.board = board; this.opened = saved.open; };
  }
  restore(value: unknown): void { this.prepareRestore(value)(); }
}
