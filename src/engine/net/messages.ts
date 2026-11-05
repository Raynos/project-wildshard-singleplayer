// P1-E5.2 (E5-REPLICATION §4.2–4.3): the small messages around `frame` and `cmds`. Every message starts with its id byte.
import type { NetAct } from '@wildshard/format/netCommand';
import { BitReader, NetDecodeError, type BitWriter } from './bits';

export const MSG_HELLO = 1;
export const MSG_CMDS = 2;
export const MSG_ACT = 3;
export const MSG_WELCOME = 4;
export const MSG_FRAME = 5;
export const MSG_EVENTS = 6;
/** The id byte of any message, or 0 for an empty one. */
export function messageId(bytes: Uint8Array): number { return bytes[0] ?? 0; }

/** Run a decoder at the trust boundary: malformed bytes give null, never an exception. */
function guarded<T>(bytes: Uint8Array, id: number, read: (reader: BitReader) => T): T | null {
  try {
    const reader = new BitReader(bytes);
    if (reader.read(8) !== id) return null;
    const out = read(reader);
    reader.end();
    return out;
  } catch (error) { if (error instanceof NetDecodeError) return null; throw error; }
}

/** `hello`: what the client was built from. A mismatch of either field is refused (J54). */
export interface NetHello { readonly schemaHash: number; readonly build: string }
export function encodeHello(writer: BitWriter, hello: NetHello): ArrayBuffer {
  writer.write(MSG_HELLO, 8); writer.write(hello.schemaHash, 32); writer.writeText(hello.build);
  return writer.finish();
}
export function decodeHello(bytes: Uint8Array): NetHello | null {
  return guarded(bytes, MSG_HELLO, reader => ({ schemaHash: reader.read(32), build: reader.readText() }));
}

/** `welcome`: your player's handle, the server's tick and rates (sim 60, frame 30, J40). */
export interface NetWelcome { readonly handle: number; readonly tick: number; readonly cell: number; readonly schemaHash: number; readonly simHz: number; readonly frameHz: number }
export function encodeWelcome(writer: BitWriter, welcome: NetWelcome): ArrayBuffer {
  writer.write(MSG_WELCOME, 8); writer.write(welcome.handle, 16); writer.write(welcome.tick, 32); writer.write(welcome.cell, 16);
  writer.write(welcome.schemaHash, 32); writer.write(welcome.simHz, 8); writer.write(welcome.frameHz, 8);
  return writer.finish();
}
export function decodeWelcome(bytes: Uint8Array): NetWelcome | null {
  return guarded(bytes, MSG_WELCOME, reader => ({ handle: reader.read(16), tick: reader.read(32), cell: reader.read(16), schemaHash: reader.read(32), simHz: reader.read(8), frameHz: reader.read(8) }));
}

/** An entity entering a client's relevance: its identity and initial fields, once (§3.4). */
export interface NetSpawn { readonly kind: 'spawn'; readonly handle: number; readonly cls: number; readonly id: string; readonly initial: readonly number[]; readonly text: readonly string[] }
/** The server retired an entity, so its handle's slot may be reused under a new generation. */
export interface NetDespawn { readonly kind: 'despawn'; readonly handle: number }
/** One reliable event. E3 and E4 add `died`, `hit`, `ledger` and the rest as their views need them. */
export type NetEvent = NetSpawn | NetDespawn;
/** The spawn's column widths, which only the receiver's class table knows. */
export type InitialBits = (cls: number) => { readonly bits: readonly number[]; readonly text: number } | undefined;

const EVENT_SPAWN = 1, EVENT_DESPAWN = 2;
/** Encode an `events` message; `bits` gives the spawn fields' declared widths. */
export function encodeEvents(writer: BitWriter, tick: number, events: readonly NetEvent[], bits: InitialBits): ArrayBuffer {
  writer.write(MSG_EVENTS, 8); writer.write(tick, 32); writer.write(events.length, 16);
  for (const event of events) {
    if (event.kind === 'despawn') { writer.write(EVENT_DESPAWN, 8); writer.write(event.handle, 16); continue; }
    writer.write(EVENT_SPAWN, 8); writer.write(event.handle, 16); writer.write(event.cls, 8); writer.writeText(event.id);
    bits(event.cls)?.bits.forEach((width, index) => { writer.write(event.initial[index] ?? 0, width); });
    for (const text of event.text) writer.writeText(text);
  }
  return writer.finish();
}
/** Decode an `events` message. An unknown class or event kind refuses the whole message. */
export function decodeEvents(bytes: Uint8Array, bits: InitialBits): { readonly tick: number; readonly events: readonly NetEvent[] } | null {
  return guarded(bytes, MSG_EVENTS, reader => {
    const tick = reader.read(32), count = reader.read(16), events: NetEvent[] = [];
    for (let index = 0; index < count; index++) {
      const kind = reader.read(8);
      if (kind === EVENT_DESPAWN) { events.push({ kind: 'despawn', handle: reader.read(16) }); continue; }
      if (kind !== EVENT_SPAWN) throw new NetDecodeError('Unknown event');
      const handle = reader.read(16), cls = reader.read(8), id = reader.readText(), widths = bits(cls);
      if (widths === undefined) throw new NetDecodeError('Unknown class');
      const initial = widths.bits.map(width => reader.read(width)), text = Array.from({ length: widths.text }, () => reader.readText());
      events.push({ kind: 'spawn', handle, cls, id, initial, text });
    }
    return { tick, events };
  });
}

const ACT_INTERACT = 1, ACT_RELOAD = 2;
/** Encode an `act` message. */
export function encodeAct(writer: BitWriter, act: NetAct): ArrayBuffer {
  writer.write(MSG_ACT, 8); writer.write(act.seq, 16);
  if (act.kind === 'interact') { writer.write(ACT_INTERACT, 8); writer.writeText(act.id); }
  else { writer.write(ACT_RELOAD, 8); writer.write(act.slot, 8); }
  return writer.finish();
}
/** Decode an `act` message. */
export function decodeAct(bytes: Uint8Array): NetAct | null {
  return guarded(bytes, MSG_ACT, (reader): NetAct => {
    const seq = reader.read(16), kind = reader.read(8);
    if (kind === ACT_INTERACT) return { kind: 'interact', seq, id: reader.readText() };
    if (kind === ACT_RELOAD) return { kind: 'reload', seq, slot: reader.read(8) };
    throw new NetDecodeError('Unknown act');
  });
}
