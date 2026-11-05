// P1-E5.2 (J31, J49, E5-REPLICATION §6.3): the server half of the standalone target, written against two MessagePorts. The
// module worker is one line around this; the Node test runs the same code over a real MessageChannel.
import * as v from 'valibot';
import { installAppIdentity } from '@wildshard/engine/app/identity';
import { Scope } from '@wildshard/engine/app/scope';
import { diagnosticNow } from '@wildshard/engine/core/clock';
import { NetRoom } from '@wildshard/engine/net/room';
import { ServerClock } from '@wildshard/engine/net/serverClock';
import { SimNetWorld } from '@wildshard/engine/net/simWorld';
import { installSaveEnvironment } from '@wildshard/engine/saves/environment';
import { ForwardedStorage } from '@wildshard/engine/saves/forwardedStorage';
import { saves } from '@wildshard/engine/saves/runtime';
import type { SaveKeyDef } from '@wildshard/engine/saves/store';
import { actRoutes } from '@wildshard/engine/sim/actRoutes';
import { serializeSimSnapshot, snapshotSimHostBytes } from '@wildshard/engine/sim/snapshot';
import { ServerMessageSchema, ShellMessageSchema, type ProbedRow, type ServerMessage, type ShellMessage } from '@wildshard/format/standaloneControl';
import { createTrustedHeadlessResident, type HeadlessRuntimeInput, type TrustedHeadlessResident } from '../headlessRuntime';
import { MAX_TICK_SNAPSHOT_CHARS, tickCommands } from '../tickProtocol';
import { netTickCommands } from './netInput';
import { WorkerLoopback } from './workerLoopback';

type Boot = Extract<ShellMessage, { kind: 'boot' }>;
/** How the composition reaches what a worker and a Node test get differently. */
export interface StandaloneServerOptions {
  readonly control: MessagePort; readonly game: MessagePort;
  /** Read and verify the shard's server inputs. */
  readonly load: (boot: Boot) => Promise<HeadlessRuntimeInput>;
}
interface SavedContinuation { readonly tick: number; readonly snapshot: string }
/** The tick allowance one player's input may use. */
const COMMANDS_PER_TICK = 8;
const CONTINUATION: SaveKeyDef<SavedContinuation | null> = { key: 'continuation', scope: 'shard', version: 1, initial: () => null,
  schema: v.nullable(v.strictObject({ tick: v.pipe(v.number(), v.integer(), v.minValue(0)), snapshot: v.pipe(v.string(), v.maxLength(MAX_TICK_SNAPSHOT_CHARS)) })) };
/** A continuation gets its own document: it is megabytes, and every other save write would rewrite it. */
const continuationDocument = (slug: string): string => `standalone-${slug}`;

/** A worker has no page, so no app identity: all it needs of one is the save prefix, which the page passes at boot. */
function installWorkerIdentity(savePrefix: string): void {
  installAppIdentity({ name: '', wordmark: '', tagline: '', savePrefix, saveFormat: '', fileSlug: '', exposeProbe: () => undefined, harness: () => undefined });
}

function probeRows(resident: TrustedHeadlessResident): ProbedRow[] {
  return [...resident.host.entities].map(([id, sim]) => ({ id, x: sim.position.x, y: sim.position.y, z: sim.position.z, yaw: sim.yaw, hp: sim.hp }));
}

/** Run the server half until `dispose`. Anything that ends it reports `failed` on the control port. */
export function runStandaloneServer(options: StandaloneServerOptions): { dispose: () => void } {
  const { control, game } = options, scope = new Scope('standalone.server');
  let room: NetRoom | undefined, clock: ServerClock | undefined, resident: TrustedHeadlessResident | undefined, storage: ForwardedStorage | undefined;
  let slot: ReturnType<typeof saves.define<SavedContinuation | null>> | undefined, slug = '', probing: number | null = null, tickMs = 0;
  const post = (message: ServerMessage): void => { control.postMessage(v.parse(ServerMessageSchema, message), []); };
  const fail = (error: unknown): void => { clock?.pause(); post({ kind: 'failed', reason: error instanceof Error ? error.message : String(error) }); };

  const boot = async (message: Boot): Promise<void> => {
    slug = message.slug;
    storage = new ForwardedStorage(message.saves, write => { post({ kind: 'write', ...write }); });
    const local = storage;
    installWorkerIdentity(message.savePrefix);
    installSaveEnvironment({ storage: saveScope => saveScope === 'session' ? null : local, persistent: () => true, persist: () => Promise.resolve(false) });
    slot = saves.define(CONTINUATION);
    const input = await options.load(message), saved = slot.peek(continuationDocument(slug));
    resident = await createTrustedHeadlessResident(input, saved?.snapshot);
    const live = resident;
    const step: ConstructorParameters<typeof NetRoom>[0]['step'] = inputs => {
      const started = diagnosticNow(), own = inputs[0];
      live.step(tickCommands([{ source: 'net', commands: netTickCommands(own?.command ?? null, own?.acts ?? [], actRoutes(live.host)) }], COMMANDS_PER_TICK), undefined, new Map(inputs.map(row => [row.player, row.acts])));
      tickMs = diagnosticNow() - started;
      if (probing !== null && live.host.state.tick % 2 === 0) { post({ kind: 'probed', id: probing, tick: live.host.state.tick, tickMs, rows: probeRows(live) }); probing = null; }
    };
    room = new NetRoom({ world: new SimNetWorld(live.host), step, build: message.build });
    room.join(new WorkerLoopback(game));
    const tickRoom = room;
    clock = new ServerClock({ now: diagnosticNow, wait: (ms, run) => { const timer = scope.timeout(ms, run); return () => { scope.cancelTimer(timer); }; },
      step: () => { try { tickRoom.tick(); } catch (error) { fail(error); } } });
    post({ kind: 'booted', tick: live.host.state.tick, restored: saved !== null && saved !== undefined });
  };

  const save = async (id: number): Promise<void> => {
    if (resident === undefined || slot === undefined || storage === undefined) throw new Error('Save before boot');
    const tick = resident.host.state.tick;
    const wrote = slot.write({ tick, snapshot: serializeSimSnapshot(snapshotSimHostBytes(resident.host)) }, continuationDocument(slug));
    const durable = await storage.settled(); // J-ledger rule: a save counts only once the real storage has it (§6.3.3)
    post({ kind: 'saved', id, tick, ok: wrote && durable });
  };

  const handle = (raw: unknown): void => {
    const message = v.parse(ShellMessageSchema, raw);
    if (message.kind === 'boot') void boot(message).catch(fail);
    else if (message.kind === 'ready') { room?.open(); clock?.start(); }
    else if (message.kind === 'pause') clock?.pause();
    else if (message.kind === 'resume') clock?.start();
    else if (message.kind === 'save') void save(message.id).catch(fail);
    else if (message.kind === 'probe') probing = message.id;
    else storage?.acked(message.seq, message.ok);
  };
  control.onmessage = (event: MessageEvent<unknown>): void => { try { handle(event.data); } catch (error) { fail(error); } };
  return { dispose: () => { clock?.pause(); scope.dispose(); room?.dispose(); resident?.dispose(); control.close(); } };
}

