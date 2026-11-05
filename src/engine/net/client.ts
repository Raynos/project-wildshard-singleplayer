// P1-E5.2 (E5-REPLICATION §4): the client's end of the game protocol. It says hello, decodes frames and events, acks, and
// sends commands in bundles with redundant copies. Prediction and interpolation build on this in E5.3; the view halves
// read its rows in E4.3. It knows nothing of how bytes travel, and imports nothing from the server.
import type { NetAct, NetCommand } from '@wildshard/format/netCommand';
import { BitWriter } from './bits';
import { encodeCommands, seqAfter } from './command';
import { decodeFrame, FRAME_RING, NO_BASELINE, type DecodedFrame, type FrameTable } from './frame';
import { decodeEvents, decodeWelcome, encodeAct, encodeHello, messageId, MSG_EVENTS, MSG_FRAME, MSG_WELCOME, type InitialBits, type NetCombatEvent, type NetWelcome } from './messages';
import { NET_CLASSES, NET_SCHEMA_HASH, PLAYER_CLASS } from './netSchemas';
import type { NetClass, NetValue } from './schema';
import type { Transport } from './transport';

/** Older commands repeated in each bundle, against loss (§4.2). */
export const REDUNDANT_COMMANDS = 4;

/** What the client knows of an entity from its spawn. */
export interface NetEntityInfo { readonly handle: number; readonly id: string; readonly cls: NetClass<never>; readonly initial: Readonly<Record<string, NetValue>> }
/** A row with its quantised values turned back into field values. */
export type NetFields = Readonly<Record<string, NetValue>>;

const initialBits: InitialBits = cls => { const entry = NET_CLASSES[cls]; return entry === undefined ? undefined : { bits: entry.initial.map(column => column.bits), text: entry.text.length }; };

function decodeColumns(columns: NetClass<never>['row'], values: ArrayLike<number>): Record<string, NetValue> {
  const out: Record<string, NetValue> = {};
  columns.forEach((column, index) => { out[column.name] = column.value(values[index] ?? 0); });
  return out;
}

/** The client's end of the wire. */
export class NetClient {
  /** The server's welcome, once it arrives. */
  welcome: NetWelcome | null = null;
  /** The newest frame decoded. */
  latest: DecodedFrame | null = null;
  /** Why the connection ended, or null while it is open. `reload` means a stale build was refused (J54). */
  closed: string | null = null;
  /** Frames refused as malformed or not applicable yet. */
  dropped = 0;
  readonly entities: Map<number, NetEntityInfo> = new Map<number, NetEntityInfo>();
  private readonly transport: Transport;
  private readonly writer = new BitWriter(1024);
  private readonly frames = new Map<number, DecodedFrame>();
  private readonly listeners = new Set<(frame: DecodedFrame) => void>();
  private readonly fights = new Set<(event: NetCombatEvent) => void>();
  private readonly table: FrameTable;
  private readonly ids = new Map<string, number>();
  private unacked: NetCommand[] = [];
  private fresh = 0;
  private seq = 0;
  private readonly off: (() => void)[];
  constructor(transport: Transport) {
    this.transport = transport;
    this.table = { ownerClass: PLAYER_CLASS, classOf: handle => this.entities.get(handle)?.cls, baseline: tick => this.frames.get(tick) ?? null };
    this.off = [transport.onMessage((_channel, bytes) => { this.receive(new Uint8Array(bytes)); }), transport.onClose(reason => { this.closed = reason; })];
  }
  /** Begin the handshake. `build` is this client's engine build id. */
  hello(build = ''): void { this.transport.send('reliable', encodeHello(this.writer, { schemaHash: NET_SCHEMA_HASH, build })); }
  /** Call for every frame decoded; returns the unsubscribe. */
  onFrame(listener: (frame: DecodedFrame) => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  /** Call for every settled hit and death (P1-E3.2); returns the unsubscribe. */
  onCombat(listener: (event: NetCombatEvent) => void): () => void { this.fights.add(listener); return () => { this.fights.delete(listener); }; }
  /** A held frame by tick. */
  frame(tick: number): DecodedFrame | null { return this.frames.get(tick) ?? null; }
  /** One entity's row in a frame, as field values. */
  fields(frame: DecodedFrame, handle: number): NetFields | null {
    const row = frame.rows.get(handle), cls = this.entities.get(handle)?.cls;
    return row === undefined || cls === undefined ? null : decodeColumns(cls.row, row);
  }
  /** The owner block of a frame, as field values. */
  owner(frame: DecodedFrame): NetFields { return decodeColumns(PLAYER_CLASS.owner, frame.owner); }
  /** Queue one sim step's input; the next `flush` sends it. Returns the `seq` it was given. */
  command(input: Omit<NetCommand, 'seq'>): number {
    this.seq = (this.seq + 1) & 0xffff;
    this.unacked.push({ ...input, seq: this.seq }); this.fresh++;
    return this.seq;
  }
  /** Send this client frame's bundle: its new commands and up to REDUNDANT_COMMANDS older unacked ones, plus the ack. */
  flush(): void {
    const acked = this.latest?.lastSeq;
    if (acked !== undefined) this.unacked = this.unacked.filter(command => seqAfter(command.seq, acked));
    const commands = this.unacked.slice(-(Math.min(this.fresh, 3) + REDUNDANT_COMMANDS));
    this.fresh = 0;
    const ackFrame = this.latest?.tick ?? NO_BASELINE;
    this.transport.send('unreliable', encodeCommands(this.writer, { ackFrame, commands }, id => this.ids.get(id) ?? 0));
  }
  /** Send a non-movement action on the reliable channel. */
  act(act: NetAct): void { this.transport.send('reliable', encodeAct(this.writer, act)); }
  /** Stop listening; the transport stays with its owner. */
  dispose(): void { for (const off of this.off) off(); this.listeners.clear(); this.fights.clear(); }

  private receive(bytes: Uint8Array): void {
    switch (messageId(bytes)) {
      case MSG_WELCOME: this.welcome = decodeWelcome(bytes); break;
      case MSG_EVENTS: this.events(bytes); break;
      case MSG_FRAME: this.decoded(decodeFrame(bytes, this.table)); break;
      default: this.dropped++;
    }
  }
  private events(bytes: Uint8Array): void {
    const decoded = decodeEvents(bytes, initialBits);
    if (decoded === null) { this.dropped++; return; }
    for (const event of decoded.events) {
      if (event.kind === 'hit' || event.kind === 'died') { for (const listener of this.fights) listener(event); continue; }
      if (event.kind === 'despawn') {
        const id = this.entities.get(event.handle)?.id;
        if (id !== undefined) this.ids.delete(id);
        this.entities.delete(event.handle);
        continue;
      }
      const cls = NET_CLASSES[event.cls];
      if (cls === undefined) continue;
      const initial = decodeColumns(cls.initial, event.initial);
      cls.text.forEach((field, index) => { initial[field.name] = event.text[index] ?? ''; });
      this.entities.set(event.handle, { handle: event.handle, id: event.id, cls, initial });
      this.ids.set(event.id, event.handle);
    }
  }
  private decoded(frame: DecodedFrame | null): void {
    if (frame === null) { this.dropped++; return; }
    this.frames.set(frame.tick, frame);
    if (this.frames.size > FRAME_RING) for (const tick of this.frames.keys()) { this.frames.delete(tick); if (this.frames.size <= FRAME_RING) break; }
    if (this.latest === null || frame.tick > this.latest.tick) this.latest = frame;
    for (const listener of this.listeners) listener(frame);
  }
}
