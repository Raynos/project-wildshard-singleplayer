// P1-E5.2 (E5-REPLICATION §3.3, §4): the server's end of the game protocol. One room steps one world on the fixed tick,
// builds a world frame every second tick (30 Hz, J40) and encodes each client's delta from it. It holds no socket and
// no save: a Transport carries its bytes, and accounts, rooms and persistence stay in the MMO plan.
import * as v from 'valibot';
import type { NetCommand } from '@wildshard/format/netCommand';
import { NetRoomActSchema, type NetChatReport, type NetChatSay, type NetTickAct } from './acts';
import { CHAT_RADIUS, RoomChat, type ChatLine, type ChatReports } from './chat';
import { BitWriter } from './bits';
import { cleanName } from './chatFilter';
import type { CombatEvent } from './combatWire';
import type { QuestProgress } from '../quest/progress';
import { decodeCommands } from './command';
import { CommandQueue } from './commandQueue';
import { encodeFrame, FRAME_RING, WorldFrameRing, type WorldFrame } from './frame';
import { NetHandles } from './handles';
import { GUEST, NetIdentitySchema, type NetIdentity } from './identity';
import { decodeAct, decodeHello, encodeEvents, encodeWelcome, messageId, MSG_ACT, MSG_CMDS, MSG_HELLO, type InitialBits, type NetDied, type NetEvent, type NetHit, type NetReward } from './messages';
import { NET_CLASSES, NET_SCHEMA_HASH } from './netSchemas';
import type { NetClass, NetRefs } from './schema';
import { LedgerBook, type LedgerFiling } from './ledgerBook';
import { framesBetween, rowDue } from './tiers';
import type { NetChannel, Transport } from './transport';

/** Sim steps per world frame: 60 Hz sim, 30 Hz frames (J40). */
export const TICKS_PER_FRAME = 2;
const SIM_HZ = 60, FRAME_HZ = 30;
/** Acts one client gets a tick, and the most it may have waiting. */
const ACTS_PER_TICK = 2, MAX_QUEUED_ACTS = 16;

/** The player a client owns. */
export interface NetPlayer { readonly id: string; readonly cls: NetClass<never>; sample: (out: Uint32Array, refs: NetRefs) => void }
/** Hands the room each entity, with a view its class's accessors read. A view is valid only during the call. */
export interface NetVisitor { entity: <S>(id: string, cls: NetClass<S>, view: S) => void }
/** The world a room replicates. */
export interface NetWorld {
  tick: () => number;
  /** The cell frame positions are local to (§3.5). */
  cell: () => number;
  /** Visit every replicated entity, the player included. */
  visit: (visitor: NetVisitor) => void;
  /** What the tick settled (P1-E3.2): each hit and death since the last call. A world with no fights leaves it out. */
  combat?: () => readonly CombatEvent[];
  /** A player's quests, when they moved past `since`. A world with no quests leaves it out. */
  quests?: (player: string, since: number) => { readonly version: number; readonly rows: readonly QuestProgress[]; readonly flags: readonly string[] } | null;
  /** What the tick granted (M8), each to its player. A world with no ledger leaves it out. */
  ledger?: () => readonly LedgerFiling[];
  /** The player a client owns unless it joins as another. */
  readonly player: NetPlayer;
}
/** One client's input for one tick. */
export interface NetTickInput { readonly client: number; readonly player: string; readonly command: NetCommand | null; readonly acts: readonly NetTickAct[] }
/** Bytes this room has put on the wire, for the bandwidth number (§7). */
export interface RoomStats { frames: number; frameBytes: number; eventBytes: number; refused: number; /** Rows a far tier left out (§3.3). */ tierSkips: number }
/** How a room is built. */
export interface NetRoomOptions {
  readonly world: NetWorld;
  /** Advance the world one fixed tick. */
  readonly step: (inputs: readonly NetTickInput[]) => void;
  /** This engine build's id; empty where builds are not stamped (tests, dev servers), which skips its check. */
  readonly build?: string;
  /** The players' receipts, where something outlives the room: a save, or rooms that share a player. */
  readonly book?: LedgerBook;
  /** Where reports of chat go. Absent, a report is checked and goes nowhere. */
  readonly reports?: ChatReports;
}

/** What a client held at a frame. `due` are the rows this frame may send; `rows` is the world frame each held row came from. */
interface ClientView { tick: number; readonly visible: Set<number>; readonly due: Set<number>; readonly rows: Map<number, number> }
/** A settled event in handles, kept until the next frame. */
type RoomCombat = NetDied | (NetHit & { readonly landedBy: string | null }) | (NetReward & { readonly owner: string });
interface RoomClient {
  readonly id: number; readonly transport: Transport; readonly queue: CommandQueue; readonly player: NetPlayer;
  /** Who it said it is at `hello` (J111). A hand-off keeps it. */
  identity: NetIdentity;
  /** The last receipt it has had. */
  ledgerSeen: number;
  /** waiting: said hello before the room opened. live: welcomed. */
  state: 'new' | 'waiting' | 'live';
  ack: number; readonly acts: NetTickAct[]; readonly known: Set<number>;
  /** The quest rows this client holds, and the book version they came from. */
  questVersion: number; readonly quests: Map<string, string>; readonly phased: Set<string>;
  /** What this client could see at each recent frame: a baseline is the frame and this set. */
  readonly views: ClientView[]; nextView: number;
  readonly owner: Uint32Array; dispose: () => void;
}

const initialBits: InitialBits = cls => { const entry = NET_CLASSES[cls]; return entry === undefined ? undefined : { bits: entry.initial.map(column => column.bits), text: entry.text.length }; };

function rowPosition(frame: WorldFrame, at: number, cls: NetClass<never>): { x: number; y: number; z: number } | null {
  if (cls.position === null) return null;
  const read = (index: number): number => { const column = cls.row[index], value = column?.value(frame.data[at + index] ?? 0); return typeof value === 'number' ? value : 0; };
  return { x: read(cls.position[0]), y: read(cls.position[1]), z: read(cls.position[2]) };
}

/** The server's end of the wire. */
export class NetRoom {
  readonly stats: RoomStats = { frames: 0, frameBytes: 0, eventBytes: 0, refused: 0, tierSkips: 0 };
  private readonly clients: RoomClient[] = [];
  private readonly handles = new NetHandles();
  private readonly ring = new WorldFrameRing();
  private readonly writer = new BitWriter(4096);
  private readonly world: NetWorld;
  private readonly step: NetRoomOptions['step'];
  private readonly build: string;
  private readonly inputs: NetTickInput[] = [];
  private readonly combat: RoomCombat[] = [];
  private readonly book: LedgerBook;
  private readonly chat: RoomChat;
  private opened = false;
  private serial = 0;
  private clientIds = 0;
  constructor(options: NetRoomOptions) { this.world = options.world; this.step = options.step; this.build = options.build ?? ''; this.book = options.book ?? new LedgerBook(); this.chat = new RoomChat(options.reports); }
  /** Who a client said it is, its Name cleaned. */
  identityOf(client: number): NetIdentity | null { return this.clients.find(entry => entry.id === client)?.identity ?? null; }
  /** The last command `seq` applied for a client, or 0. */
  lastSeq(client: number): number { return this.clients.find(entry => entry.id === client)?.queue.lastSeq ?? 0; }
  /** Commands refused and duplicated across every client. */
  get admission(): { refused: number; duplicates: number } {
    return this.clients.reduce((sum, client) => ({ refused: sum.refused + client.queue.refused, duplicates: sum.duplicates + client.queue.duplicates }), { refused: 0, duplicates: 0 });
  }
  /** Connect a client that owns `player`. It waits for its `hello`, and past that for `open`. Returns its id. */
  join(transport: Transport, player: NetPlayer = this.world.player, queue: CommandQueue = new CommandQueue()): number {
    const id = ++this.clientIds, owner = new Uint32Array(player.cls.owner.length);
    const client: RoomClient = { id, transport, player, queue, identity: GUEST, ledgerSeen: 0, state: 'new', ack: -1, acts: [], known: new Set(), questVersion: -1, quests: new Map(), phased: new Set(), owner,
      views: Array.from({ length: FRAME_RING }, () => ({ tick: -1, visible: new Set<number>(), due: new Set<number>(), rows: new Map<number, number>() })), nextView: 0, dispose: () => undefined };
    const off = transport.onMessage((channel, bytes) => { this.receive(client, channel, bytes); });
    const closed = transport.onClose(() => { this.remove(client); });
    client.dispose = () => { off(); closed(); };
    this.clients.push(client);
    return id;
  }
  /**
   * A player crossed (P1-E3.9): their client leaves this world for the room of the one they stand in, on the same link and
   * with the same command stream. It hears `travel`, then the new room's `welcome`, then a full frame at that room's next.
   */
  handOff(id: number, to: NetRoom, player: NetPlayer): number {
    const client = this.clients.find(entry => entry.id === id);
    if (client === undefined || client.state !== 'live' || !to.opened) throw new Error('Invalid net hand-off');
    const tick = this.world.tick(), travel: NetEvent = { kind: 'travel', tick, from: this.world.cell(), to: to.world.cell() };
    client.transport.send('reliable', encodeEvents(this.writer, tick, [travel], initialBits));
    this.remove(client);
    return to.adopt(client.transport, player, client.queue, client.identity);
  }
  private adopt(transport: Transport, player: NetPlayer, queue: CommandQueue, identity: NetIdentity): number {
    const id = this.join(transport, player, queue), client = this.clients.find(entry => entry.id === id);
    if (client !== undefined) { client.identity = identity; this.welcome(client); } // it said hello to the room it came from
    return id;
  }
  /** The client finished loading (§6.3.1): welcome everyone waiting and send each its full frame. */
  open(): void {
    this.opened = true;
    const waiting = this.clients.filter(client => client.state === 'waiting');
    for (const client of waiting) this.welcome(client);
    if (waiting.length > 0) this.snapshot(this.world.tick());
  }
  /** One fixed tick: one command per client, the world's step, and on every second tick a frame. */
  tick(): void {
    this.inputs.length = 0;
    for (const client of this.clients) {
      if (client.state !== 'live') continue;
      this.inputs.push({ client: client.id, player: client.player.id, command: client.queue.next(), acts: client.acts.splice(0, ACTS_PER_TICK) });
    }
    this.step(this.inputs);
    this.settled();
    for (const filing of this.world.ledger?.() ?? []) this.book.file(filing);
    const tick = this.world.tick();
    if (tick % TICKS_PER_FRAME === 0) this.snapshot(tick);
  }
  /** Turn the tick's settled combat into handles now: a body retired by the next frame still gets its death. */
  private settled(): void {
    for (const row of this.world.combat?.() ?? []) {
      const { refs } = this.handles;
      if (row.kind === 'reward') { const { player, ...reward } = row; this.combat.push({ ...reward, body: refs(row.body), owner: player }); continue; }
      if (row.kind === 'hit') { const target = refs(row.target); if (target !== 0) { const { by, seq, ...hit } = row; this.combat.push({ ...hit, target, confirmFor: seq, landedBy: by }); } }
      else { const id = refs(row.id); if (id !== 0) this.combat.push({ ...row, id, by: row.by === null ? 0 : refs(row.by) }); }
    }
  }
  /** Drop every client. */
  dispose(): void { for (const client of this.clients.slice()) this.remove(client); }

  private remove(client: RoomClient): void {
    client.dispose();
    const at = this.clients.indexOf(client);
    if (at !== -1) this.clients.splice(at, 1);
  }
  private receive(client: RoomClient, _channel: NetChannel, bytes: ArrayBuffer): void {
    const view = new Uint8Array(bytes);
    switch (messageId(view)) {
      case MSG_HELLO: this.hello(client, view); break;
      case MSG_CMDS: this.commands(client, view); break;
      case MSG_ACT: this.act(client, view); break;
      default: this.stats.refused++;
    }
  }
  private hello(client: RoomClient, view: Uint8Array): void {
    const hello = decodeHello(view);
    if (client.state !== 'new') { this.stats.refused++; return; }
    // A hello this build cannot read is a stale tab as surely as a wrong hash: it must reload, not wait for ever (§4.4).
    if (hello === null) { this.stats.refused++; client.transport.close('reload'); return; }
    // J54: exact match only. Refused with `reload`, so a stale tab picks up the new build (§4.4).
    if (hello.schemaHash !== NET_SCHEMA_HASH || (this.build !== '' && hello.build !== this.build)) { client.transport.close('reload'); return; }
    const said = v.safeParse(NetIdentitySchema, { player: hello.player, name: hello.name });
    if (!said.success) { this.stats.refused++; client.transport.close('refused'); return; }
    client.identity = { player: said.output.player, name: cleanName(said.output.name) };
    client.ledgerSeen = hello.ledger;
    client.state = 'waiting';
    if (this.opened) this.welcome(client);
  }
  private commands(client: RoomClient, view: Uint8Array): void {
    const bundle = decodeCommands(view, this.handles.idOf);
    if (bundle === null || client.state !== 'live') { this.stats.refused++; return; }
    if (bundle.ackFrame > client.ack && bundle.ackFrame <= this.world.tick()) client.ack = bundle.ackFrame;
    client.queue.admit(bundle.commands);
  }
  private act(client: RoomClient, view: Uint8Array): void {
    const decoded = decodeAct(view), parsed = v.safeParse(NetRoomActSchema, decoded);
    if (!parsed.success || client.state !== 'live') { this.stats.refused++; return; }
    const act = parsed.output;
    if (act.kind === 'chat' || act.kind === 'report') { if (!this.chatAct(client, act)) this.stats.refused++; return; }
    // Untrusted input stays bounded (R3): a flood of acts waits its turn or is refused, and can never exceed a tick's allowance.
    if (client.acts.length >= MAX_QUEUED_ACTS) { this.stats.refused++; return; }
    client.acts.push(act);
  }
  private chatAct(client: RoomClient, act: NetChatSay | NetChatReport): boolean {
    if (act.kind === 'report') return this.chat.report(client.identity.player, act.line);
    return this.chat.say({ ...client.identity, body: client.player.id }, act.channel, act.text, this.world.tick());
  }
  /** Whether `client` hears a line: anyone in the room, or within earshot of who said it. */
  private hears(frame: WorldFrame, own: number, line: ChatLine, from: number): boolean {
    if (line.channel === 'room' || from === own) return true;
    const place = (handle: number): { x: number; y: number; z: number } | null => {
      const cls = this.handles.row(handle)?.cls, at = frame.offset(handle);
      return cls === undefined || at === undefined ? null : rowPosition(frame, at, cls);
    };
    const here = place(own), there = place(from);
    return here !== null && there !== null && (here.x - there.x) ** 2 + (here.y - there.y) ** 2 + (here.z - there.z) ** 2 <= CHAT_RADIUS ** 2;
  }
  private welcome(client: RoomClient): void {
    client.state = 'live';
    // Handles are handed out by frames, and the welcome comes first: without this a first client's own handle reads 0.
    const { handles } = this, serial = ++this.serial;
    this.world.visit({ entity: (id, cls, view) => { handles.touch(id, cls, view, serial); } });
    const handle = handles.refs(client.player.id);
    client.transport.send('reliable', encodeWelcome(this.writer, { handle, tick: this.world.tick(), cell: this.world.cell(), schemaHash: NET_SCHEMA_HASH, simHz: SIM_HZ, frameHz: FRAME_HZ }));
  }
  private snapshot(tick: number): void {
    const frame = this.ring.claim(tick), serial = ++this.serial, { handles } = this;
    this.world.visit({ entity: (id, cls, view) => {
      const row = handles.touch(id, cls, view, serial), at = frame.claim(row.handle, cls.row.length);
      cls.row.forEach((column, index) => { frame.data[at + index] = column.sample(view, handles.refs); });
    } });
    const retired = handles.sweep(serial), combat = this.combat.splice(0), lines = this.chat.drain();
    for (const client of this.clients) if (client.state === 'live') this.send(client, frame, retired, combat, lines);
  }
  /** Every entity in range of this client, itself excluded: its own state is the owner block. */
  private view(client: RoomClient, frame: WorldFrame, own: number): ClientView {
    const view = client.views[client.nextView];
    if (view === undefined) throw new Error('Empty client view ring');
    client.nextView = (client.nextView + 1) % FRAME_RING;
    view.tick = frame.tick; view.visible.clear(); view.due.clear();
    const ownClass = this.handles.row(own)?.cls, ownAt = frame.offset(own);
    const origin = ownClass === undefined || ownAt === undefined ? null : rowPosition(frame, ownAt, ownClass);
    for (const handle of frame.handles()) {
      const cls = this.handles.row(handle)?.cls, at = frame.offset(handle);
      if (handle === own || cls === undefined || at === undefined) continue;
      const position = origin === null ? null : rowPosition(frame, at, cls);
      const away = position === null || origin === null ? 0 : (position.x - origin.x) ** 2 + (position.y - origin.y) ** 2 + (position.z - origin.z) ** 2;
      if (cls.radius !== null && away > cls.radius ** 2) continue;
      view.visible.add(handle);
      if (rowDue(Math.floor(frame.tick / TICKS_PER_FRAME), handle, framesBetween(away))) view.due.add(handle);
    }
    return view;
  }
  /**
   * Which world frame each row this client ends up holding came from. A row left out stays what its baseline had, so the
   * next delta must start there and not at the baseline's own tick. A row whose source is about to leave the ring is sent whole.
   */
  private heldRows(view: ClientView, frame: WorldFrame, seen: ClientView | null): void {
    view.rows.clear();
    for (const handle of view.visible) {
      const from = view.due.has(handle) ? undefined : seen?.rows.get(handle);
      const kept = from !== undefined && frame.tick - from < (FRAME_RING - 2) * TICKS_PER_FRAME;
      view.rows.set(handle, kept ? from : frame.tick);
      if (kept) this.stats.tierSkips++;
    }
  }
  private send(client: RoomClient, frame: WorldFrame, retired: readonly number[], combat: readonly RoomCombat[], lines: readonly ChatLine[]): void {
    const { handles, writer, world } = this, own = handles.refs(client.player.id), view = this.view(client, frame, own), events: NetEvent[] = [];
    for (const handle of view.visible) {
      if (client.known.has(handle)) continue;
      const row = handles.row(handle);
      if (row === undefined) continue;
      client.known.add(handle);
      events.push({ kind: 'spawn', handle, cls: row.cls.id, id: row.id, initial: row.initial, text: row.text });
    }
    // Spawns, then what happened, then who left: a body's last hit and its death arrive before its despawn.
    for (const row of combat) {
      if (row.kind === 'reward') { if (row.owner === client.player.id) { const { owner: _owner, ...reward } = row; events.push(reward); } continue; }
      if (row.kind === 'died') { if (row.id === own || client.known.has(row.id)) events.push(row); continue; }
      const { landedBy, ...hit } = row, owned = landedBy === client.player.id;
      if (row.target !== own && !owned && !client.known.has(row.target)) continue;
      events.push({ ...hit, confirmFor: owned ? hit.confirmFor : 0 });
    }
    const quests = world.quests?.(client.player.id, client.questVersion) ?? null;
    if (quests !== null) {
      client.questVersion = quests.version;
      for (const row of quests.rows) {
        const seen = `${String(row.started)}|${String(row.n)}|${row.step ?? ''}`;
        if (client.quests.get(row.quest) === seen) continue;
        client.quests.set(row.quest, seen); events.push({ kind: 'quest', tick: frame.tick, ...row });
      }
      for (const flag of client.phased) if (!quests.flags.includes(flag)) { client.phased.delete(flag); events.push({ kind: 'phase', tick: frame.tick, flag, on: false }); }
      for (const flag of quests.flags) if (!client.phased.has(flag)) { client.phased.add(flag); events.push({ kind: 'phase', tick: frame.tick, flag, on: true }); }
    }
    for (const line of lines) {
      const from = handles.refs(line.body);
      if (!this.hears(frame, own, line, from)) continue;
      events.push({ kind: 'chat', tick: line.tick, line: line.line, channel: line.channel, from: client.known.has(from) || from === own ? from : 0, name: line.name, text: line.text });
    }
    for (const receipt of this.book.since(client.player.id, client.ledgerSeen)) { events.push({ ...receipt, tick: frame.tick }); client.ledgerSeen = receipt.serial; }
    for (const handle of retired) if (client.known.delete(handle)) events.push({ kind: 'despawn', handle });
    if (events.length > 0) {
      const bytes = encodeEvents(writer, frame.tick, events, initialBits);
      this.stats.eventBytes += bytes.byteLength;
      client.transport.send('reliable', bytes);
    }
    const acked = client.ack < 0 ? null : this.ring.at(client.ack), seen = client.views.find(entry => entry.tick === client.ack);
    const base = acked === frame || seen === undefined ? null : acked;
    this.heldRows(view, frame, base === null ? null : seen ?? null);
    client.player.sample(client.owner, handles.refs);
    const bytes = encodeFrame(writer, { frame, cell: world.cell(), lastSeq: client.queue.lastSeq, ownerClass: client.player.cls, owner: client.owner,
      visible: view.visible, baseline: base === null || seen === undefined ? null : { frame: base, visible: seen.visible, rowFrom: handle => this.ring.at(seen.rows.get(handle) ?? -1) },
      due: handle => view.rows.get(handle) === frame.tick, classOf: handle => handles.row(handle)?.cls });
    this.stats.frames++; this.stats.frameBytes += bytes.byteLength;
    client.transport.send('unreliable', bytes);
  }
}
