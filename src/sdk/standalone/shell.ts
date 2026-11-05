// P1-E5.2 (J31, E5-REPLICATION §6.3): the page half of the standalone target. It composes the client with the server worker
// and owns what only a page can do: start the worker, keep the real storage, and pause on a hidden tab. Nothing imports it
// yet; E5.4 switches the shipped client onto it. This file must never reach a `server`-tagged module (J2).
import * as v from 'valibot';
import { Scope } from '@wildshard/engine/app/scope';
import { NetClient } from '@wildshard/engine/net/client';
import { deviceIdentity, type NetIdentity } from '@wildshard/engine/net/identity';
import type { SaveStorage } from '@wildshard/engine/saves/store';
import { ServerMessageSchema, ShellMessageSchema, type ProbedRow, type ServerMessage, type ShellMessage } from '@wildshard/format/standaloneControl';
import { WorkerLoopback } from './workerLoopback';

/** What the server should run and where the page keeps saves. */
export interface StandaloneConfig {
  readonly slug: string;
  /** The shard's built output directory. */
  readonly base: string;
  /** This engine build's id; empty where builds are not stamped. */
  readonly build: string;
  /** Saves live under this prefix in `storage`, the page's durable storage. */
  readonly savePrefix: string; readonly storage: SaveStorage;
  /** Who this player is (J111); absent, this device's own id. */
  readonly identity?: NetIdentity;
}
/** A running standalone session. */
export interface StandaloneShell {
  readonly client: NetClient;
  readonly transport: WorkerLoopback;
  /** Resolves once the server has built its world, restored from a save or fresh. */
  readonly booted: Promise<{ readonly tick: number; readonly restored: boolean }>;
  /** The client finished loading: release the welcome and start the server's clock (§6.3.1). */
  ready: () => void;
  pause: () => void; resume: () => void;
  /** Ask the server to save, resolving once the save is durable in `storage`. */
  save: () => Promise<{ readonly tick: number; readonly ok: boolean }>;
  /** The server's exact creature state at its next frame tick. */
  probe: () => Promise<{ readonly tick: number; readonly tickMs: number; readonly rows: readonly ProbedRow[] }>;
  dispose: () => void;
}

/** Every save document under `prefix`, to pre-fill the worker's storage (§6.3.3). */
function saveDocuments(storage: SaveStorage, prefix: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index), value = key === null ? null : storage.getItem(key);
    if (key?.startsWith(prefix) === true && value !== null) out[key] = value;
  }
  return out;
}
function applyWrite(storage: SaveStorage, key: string, value: string | null): boolean {
  try { if (value === null) storage.removeItem(key); else storage.setItem(key, value); return true; } catch { return false; }
}

/** Run the page half over the two ports. `startStandalone` is this over a real worker; a Node test passes a MessageChannel. */
export function connectStandalone(config: StandaloneConfig, control: MessagePort, game: MessagePort, end: () => void): StandaloneShell {
  const transport = new WorkerLoopback(game), client = new NetClient(transport);
  const post = (message: ShellMessage): void => { control.postMessage(v.parse(ShellMessageSchema, message), []); };
  const waits = new Map<number, (message: ServerMessage) => void>();
  let requests = 0, booted: (value: { tick: number; restored: boolean }) => void = () => undefined, failed: (reason: Error) => void = () => undefined;
  const bootPromise = new Promise<{ tick: number; restored: boolean }>((resolve, reject) => { booted = resolve; failed = reject; });
  const request = <T>(send: (id: number) => ShellMessage, read: (message: ServerMessage) => T | null): Promise<T> => new Promise(resolve => {
    const id = ++requests;
    waits.set(id, message => { const out = read(message); if (out !== null) { waits.delete(id); resolve(out); } });
    post(send(id));
  });
  control.onmessage = (event: MessageEvent<unknown>): void => {
    const message = v.parse(ServerMessageSchema, event.data);
    if (message.kind === 'booted') { booted({ tick: message.tick, restored: message.restored }); client.hello(config.build, config.identity ?? deviceIdentity(config.storage, config.savePrefix)); }
    else if (message.kind === 'write') post({ kind: 'written', seq: message.seq, ok: applyWrite(config.storage, message.key, message.value) });
    else if (message.kind === 'failed') { failed(new Error(message.reason)); client.closed ??= message.reason; }
    else waits.get(message.id)?.(message);
  };
  // §6.3.2: a backgrounded tab throttles both sides, so the server stops with it, as today's paused state does.
  const visibility = (): void => { post({ kind: document.visibilityState === 'hidden' ? 'pause' : 'resume' }); };
  const scope = new Scope('standalone.shell');
  if (typeof document !== 'undefined') scope.listen(document, 'visibilitychange', visibility);
  post({ kind: 'boot', slug: config.slug, base: config.base, build: config.build, savePrefix: config.savePrefix, saves: saveDocuments(config.storage, config.savePrefix) });
  return { client, transport, booted: bootPromise,
    ready: () => { post({ kind: 'ready' }); }, pause: () => { post({ kind: 'pause' }); }, resume: () => { post({ kind: 'resume' }); },
    save: () => request(id => ({ kind: 'save', id }), message => message.kind === 'saved' ? { tick: message.tick, ok: message.ok } : null),
    probe: () => request(id => ({ kind: 'probe', id }), message => message.kind === 'probed' ? { tick: message.tick, tickMs: message.tickMs, rows: message.rows } : null),
    dispose: () => { scope.dispose(); client.dispose(); transport.close('disposed'); control.close(); end(); } };
}

/** Start the standalone target: the server always in a module worker, with no main-thread fallback (J49). */
export function startStandalone(config: StandaloneConfig): StandaloneShell {
  const worker = new Worker(new URL('serverWorker.ts', import.meta.url), { type: 'module' });
  const control = new MessageChannel(), game = new MessageChannel();
  worker.postMessage(null, [control.port2, game.port2]);
  return connectStandalone(config, control.port1, game.port1, () => { worker.terminate(); });
}
