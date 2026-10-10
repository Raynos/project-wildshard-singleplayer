import * as v from 'valibot';
import { TRADES, tradeState, type Room, type TradeItem } from '../quest/trades';
import type { AmmoKind } from '../loadout/ammo';

const Saved = v.strictObject({ version: v.literal(1), open: v.boolean() });

/** The command names an authored trade by table index; opening belongs to Mott's completed reading, not a bypass. */
export const PINE_TRADE = 'pine.trade';
export const PINE_TRADE_CLOSE = -1;
export type PineTradeSkin = 'hollow-ash' | 'scarback-furnace';

/** Existing pack/kit owners perform the same synchronous grants as the page. The shop has no separate inventory. */
export interface PineTraderPorts {
  readonly pack: { count: (id: TradeItem) => number; take: (id: TradeItem, n: number) => boolean };
  readonly owns: (skin: string) => boolean;
  readonly room: Room;
  readonly addAmmo: (kind: AmmoKind, n: number) => void;
  readonly ownSkin: (skin: PineTradeSkin) => void;
}

/** Renderer-free Mott modal. It uses the page's actual affordability/ownership/cap check and payment order.
 * Explicit close mirrors the panel; walking away does not close a shop that the page leaves open. */
export class PineTrader {
  private opened = false;
  private readonly ports: PineTraderPorts;
  constructor(ports: PineTraderPorts) {
    this.ports = ports;
    if (TRADES.some(trade => trade.give.length > 3)) throw new RangeError('Pine trade payment allowance changed');
  }
  get active(): boolean { return this.opened; }
  open(): void { this.opened = true; }
  use(value: number): boolean {
    if (value === PINE_TRADE_CLOSE) { this.opened = false; return false; }
    if (!this.opened || !Number.isInteger(value)) return false;
    const trade = TRADES[value];
    if (trade === undefined || !tradeState(trade, this.ports.pack, this.ports.owns, this.ports.room).ok) return false;
    for (let i = 0; i < 3; i++) { const give = trade.give[i]; if (give === undefined) break; this.ports.pack.take(give.item, give.n); }
    const got = trade.get;
    if ('bolts' in got) this.ports.addAmmo('iron', got.bolts);
    else if ('ammo' in got) this.ports.addAmmo(got.ammo, got.n);
    else this.ports.ownSkin(got.skin);
    return true;
  }
  snapshot(): { version: 1; open: boolean } { return { version: 1, open: this.opened }; }
  /** Validation precedes mutation; a silent restore never takes payment or replays a grant. */
  prepareRestore(value: unknown): () => void {
    const saved = v.parse(Saved, value);
    return () => { this.opened = saved.open; };
  }
  restore(value: unknown): void { this.prepareRestore(value)(); }
}
