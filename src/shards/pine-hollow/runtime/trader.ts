import * as v from 'valibot';
import { tradeState, type Room } from '../quest/trades';
import type { AmmoKind } from '../loadout/ammo';


const text = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
const amount = v.pipe(v.number(), v.safeInteger(), v.minValue(1));
const item = v.picklist(['venison', 'deer-hide', 'boar-hide', 'boar-tusk', 'bear-pelt', 'amber-resin', 'lodge-ribbon']);
const tradeRow = v.strictObject({ id: text, label: text, short: text, blurb: text,
  give: v.pipe(v.array(v.strictObject({ item, n: amount })), v.minLength(1), v.maxLength(3)),
  get: v.union([v.strictObject({ bolts: amount }), v.strictObject({ ammo: v.picklist(['pitch', 'broadhead', 'cartridge', 'arrow']), n: amount }),
    v.strictObject({ skin: v.picklist(['scarback-furnace', 'hollow-ash']) })]), once: v.exactOptional(v.boolean()) });
const catalogue = v.strictObject({ goods: v.pipe(v.array(v.strictObject({ id: text, name: text, does: text,
  icon: v.picklist(['bolt', 'rifle', 'longbow', 'crossbow']), price: v.literal(0), tile: text, trade: tradeRow,
  cost: v.pipe(v.array(v.strictObject({ item, n: amount, text })), v.minLength(1), v.maxLength(3)) })), v.minLength(1), v.maxLength(64)), lines: v.record(text, text) });
export type TradeCatalogue = v.InferOutput<typeof catalogue>;
export type TradeGood = TradeCatalogue['goods'][number];
export type Trade = v.InferOutput<typeof tradeRow>;
export type TradeItem = v.InferOutput<typeof item>;
/** Preflight every offer and display link before the native modal or page panel can use a row. */
export function parseTradeCatalogue(input: unknown): TradeCatalogue {
  const rows = v.parse(catalogue, input);
  if (new Set(rows.goods.map(g => g.id)).size !== rows.goods.length || (Object.keys(rows.lines).length !== item.options.length || item.options.some(id => rows.lines[id] === undefined))
    || rows.goods.some(g => g.id !== g.trade.id || g.cost.length !== g.trade.give.length
      || g.cost.some((c, i) => { const paid = g.trade.give[i]; return paid === undefined || c.item !== paid.item || c.n !== paid.n; }))) throw new Error('Invalid Pine trade catalogue');
  return rows;
}

const Saved = v.strictObject({ version: v.literal(1), open: v.boolean() });

/** The command names an authored trade by table index; opening belongs to Mott's completed reading, not a bypass. */
export const PINE_TRADE = 'pine.trade';
export const PINE_TRADE_CLOSE = -1;
export type PineTradeSkin = 'hollow-ash' | 'scarback-furnace';

/** Existing pack/kit owners perform the same synchronous grants as the page. The shop has no separate inventory. */
export interface PineTraderPorts {
  readonly catalogue: TradeCatalogue;
  readonly pack: { count: (id: TradeItem) => number; take: (id: TradeItem, n: number) => boolean };
  readonly owns: (skin: string) => boolean;
  readonly room: Room;
  /** The page's plain-bolt swap tops up the currently loaded crossbow stack, after checking iron-stack room. */
  readonly addBolts: (n: number) => void;
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
    if (ports.catalogue.goods.some(good => good.trade.give.length > 3)) throw new RangeError('Pine trade payment allowance changed');
  }
  get active(): boolean { return this.opened; }
  open(): void { this.opened = true; }
  use(value: number): boolean {
    if (value === PINE_TRADE_CLOSE) { this.opened = false; return false; }
    if (!this.opened || !Number.isInteger(value)) return false;
    const trade = this.ports.catalogue.goods[value]?.trade;
    if (trade === undefined || !tradeState(trade, this.ports.pack, this.ports.owns, this.ports.room).ok) return false;
    for (let i = 0; i < 3; i++) { const give = trade.give[i]; if (give === undefined) break; this.ports.pack.take(give.item, give.n); }
    const got = trade.get;
    if ('bolts' in got) this.ports.addBolts(got.bolts);
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
