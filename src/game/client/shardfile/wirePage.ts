// J130: what a page with Settings ▸ Developer ▸ Worker client on reads in place of its own sim. Views install long before the
// server's first frame, so they take this seat at install and it fills when the wire does. The flip commit makes it the page.
import type { Vector3 } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import type { NetClient } from '@wildshard/engine/net/client';
import { QuestViewFeed } from '@wildshard/engine/quest/view/replica';
import type { QuestDef } from '@wildshard/engine/quest/core';
import type { QuestGateView, QuestView } from '@wildshard/engine/quest/viewPort';
import type { QuestProgress } from '@wildshard/engine/quest/progress';
import { workerClientOn } from '@wildshard/engine/ui/debugOptions';
import { Flags } from '@wildshard/engine/world/interact/flags';
import { netEncounterFeed, type EncounterRow } from '../boss/barFeed';
import { netLootFeed, type LootFeed } from '../loot/feed';
import { netCreatureCount } from '../population/netCounts';
import type { MoverView } from '../../server/plugin/mover';

type Live = (client: NetClient) => (() => void) | undefined;
const NO_ROWS: readonly EncounterRow[] = [];

/** A client's rows, through a seat that may not have one yet. */
const rowsOf = (seat: { readonly client: NetClient | null }): Pick<NetClient, 'latest' | 'stateField'> => ({ get latest() { return seat.client?.latest ?? null; }, stateField: (frame, name) => seat.client?.stateField(frame, name) });
/** One page's seat on the wire. */
export class WirePage {
  /** The server's client once this page has one. */
  client: NetClient | null = null;
  /** Ends the session's server: Settings stops it before it touches what it saves. */
  stop: () => void = () => undefined;
  /** Mover views by id: rows pose them, and no script runs them here. */
  readonly movers: Map<string, MoverView> = new Map<string, MoverView>();
  /** The head over a row's body, into `to`: what an elite's bar stands on. */
  readonly head: (body: number, to: Vector3) => boolean = (body, to) => this.heads(body, to);
  /** This player's own world (J106), for a gate and a key. */
  readonly gates: QuestGateView = { has: flag => this.heard.has(flag) };
  private readonly quests = new Map<string, QuestProgress>();
  private readonly heard = new Set<string>();
  private readonly feeds = new Map<string, QuestViewFeed>();
  private readonly waiting = new Set<Live>();
  private readonly books = new Set<Flags>();
  /** The rows a sky reads: none, until the wire is up. */
  readonly climateRows: Pick<NetClient, 'latest' | 'stateField'> = rowsOf(this);
  private encounterRows: (() => readonly EncounterRow[]) | null = null;
  private seeded = false;
  private heads: (body: number, to: Vector3) => boolean = () => false;
  private press: (id: string) => void = () => undefined;
  get on(): boolean { return workerClientOn(); }

  /** Run `use` once there is a client, now or later, until `scope` ends. What it returns runs when `scope` does. */
  whenLive(scope: Scope, use: Live): void {
    const { client } = this;
    if (client !== null) { const off = use(client); if (off !== undefined) scope.onDispose(off); return; }
    const run: Live = next => { const off = use(next); if (off !== undefined) scope.onDispose(off); return undefined; };
    this.waiting.add(run); scope.onDispose(() => { this.waiting.delete(run); });
  }
  /** Every flag book this page makes from now on follows the server's. */
  followBooks(): void { Flags.made = book => { this.books.add(book); book.follow(flag => { if (flag.startsWith('seen:')) this.send(flag); }); }; }
  /** The wire is up. `press` sends one `interact`. */
  bind(client: NetClient, press: (id: string) => void, stop: () => void, heads: (body: number, to: Vector3) => boolean): void {
    this.client = client; this.press = press; this.stop = stop; this.heads = heads; this.encounterRows = netEncounterFeed(client).rows;
    for (const use of this.waiting) use(client);
    this.waiting.clear();
  }
  unbind(): void { this.client = null; this.press = () => undefined; this.stop = () => undefined; this.encounterRows = null; this.heads = () => false; this.seeded = false; this.books.clear(); this.feeds.clear(); this.movers.clear(); }
  /** One press of a prompt the server knows by this id. */
  send(id: string): void { this.press(id); }
  /** A quest view for `def`, over this player's rows. */
  quest(def: QuestDef): QuestView {
    const feed = this.feeds.get(def.id) ?? new QuestViewFeed([def], { quests: this.quests, phased: this.heard });
    this.feeds.set(def.id, feed);
    return feed.quest(def.id);
  }
  /** The server's payouts: the page's own go, so a kill pays once. */
  lootFeed(scope: Scope): LootFeed {
    return { debug: {}, onPayout: pay => {
      let off: (() => void) | undefined;
      this.whenLive(scope, client => { off = netLootFeed(client).onPayout(pay); return off; });
      return () => { off?.(); };
    } };
  }
  /** The fights and lairs in this frame. */
  encounters(): readonly EncounterRow[] { return this.encounterRows?.() ?? NO_ROWS; }
  /** How many living creatures of `kind` are near this player, or null with no wire. */
  creatures(kind: string): number | null { return this.client === null ? null : netCreatureCount(this.client, kind); }
  /** What this frame's events changed: the server's flags and quest rows, then who they tell. `level` names the entered book, null any; `here` is false while a crossing is under way. */
  frame(level: string | null, here: boolean): void {
    const { client } = this;
    if (client === null || client.latest === null || !here) return;
    for (const [id, row] of client.quests) this.quests.set(id, row);
    this.heard.clear(); for (const flag of client.phased) this.heard.add(flag);
    const held = client.flags(), now = client.latest.tick;
    for (const flag of client.phased) (held as Set<string>).add(flag);
    for (const book of this.books) if (level === null || book.level.endsWith(level)) book.mirror(held, now);
    // What a save opened with is no news: the first frame only says where things stand.
    if (!this.seeded) { this.seeded = true; for (const feed of this.feeds.values()) feed.settle(); return; }
    for (const feed of this.feeds.values()) feed.sync();
  }
}
/** The seat. A page has one. */
export const wirePage: WirePage = new WirePage();
