import * as v from 'valibot';

// P1-E5.2 (J59 Q7, E5-REPLICATION §6.3): the control port. `boot`, `pause` and save forwarding exist only in the
// standalone target, so they travel apart from the game Transport and the game protocol stays identical to the MMO's.

const text = v.pipe(v.string(), v.minLength(1), v.maxLength(2048));
const natural = v.pipe(v.number(), v.finite(), v.integer(), v.minValue(0), v.maxValue(Number.MAX_SAFE_INTEGER));
const id = natural;

/** What the page sends the server worker. */
export type ShellMessage =
  | { readonly kind: 'boot'; readonly slug: string; readonly base: string; readonly build: string; readonly savePrefix: string; readonly saves: Readonly<Record<string, string>> }
  | { readonly kind: 'ready' } | { readonly kind: 'pause' } | { readonly kind: 'resume' }
  | { readonly kind: 'save'; readonly id: number } | { readonly kind: 'probe'; readonly id: number }
  | { readonly kind: 'written'; readonly seq: number; readonly ok: boolean };
/** The server's exact state of one creature at a frame tick. */
export interface ProbedRow { readonly id: string; readonly x: number; readonly y: number; readonly z: number; readonly yaw: number; readonly hp: number }
/** What the server worker sends the page. */
export type ServerMessage =
  | { readonly kind: 'booted'; readonly tick: number; readonly restored: boolean }
  | { readonly kind: 'write'; readonly seq: number; readonly key: string; readonly value: string | null }
  | { readonly kind: 'saved'; readonly id: number; readonly tick: number; readonly ok: boolean }
  | { readonly kind: 'probed'; readonly id: number; readonly tick: number; readonly tickMs: number; readonly rows: readonly ProbedRow[] }
  | { readonly kind: 'failed'; readonly reason: string };

/** The page's messages, checked on arrival in the worker. */
export const ShellMessageSchema: v.GenericSchema<ShellMessage> = v.variant('kind', [
  v.strictObject({ kind: v.literal('boot'), slug: text, base: text, build: v.string(), savePrefix: text, saves: v.record(v.string(), v.string()) }),
  v.strictObject({ kind: v.literal('ready') }), v.strictObject({ kind: v.literal('pause') }), v.strictObject({ kind: v.literal('resume') }),
  v.strictObject({ kind: v.literal('save'), id }), v.strictObject({ kind: v.literal('probe'), id }),
  v.strictObject({ kind: v.literal('written'), seq: natural, ok: v.boolean() }),
]);
const finite = v.pipe(v.number(), v.finite());
/** The worker's messages, checked on arrival in the page. */
export const ServerMessageSchema: v.GenericSchema<ServerMessage> = v.variant('kind', [
  v.strictObject({ kind: v.literal('booted'), tick: natural, restored: v.boolean() }),
  v.strictObject({ kind: v.literal('write'), seq: natural, key: text, value: v.nullable(v.string()) }),
  v.strictObject({ kind: v.literal('saved'), id, tick: natural, ok: v.boolean() }),
  v.strictObject({ kind: v.literal('probed'), id, tick: natural, tickMs: finite, rows: v.array(v.strictObject({ id: text, x: finite, y: finite, z: finite, yaw: finite, hp: finite })) }),
  v.strictObject({ kind: v.literal('failed'), reason: v.string() }),
]);
