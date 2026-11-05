// P1-E5.2 (J31, J49, E5-REPLICATION §6.3): the server half of the standalone target, written against two MessagePorts. The
// module worker is one line around this; the Node test runs the same code over a real MessageChannel.
import * as v from 'valibot';
import { installAppIdentity } from '@wildshard/engine/app/identity';
import { Scope } from '@wildshard/engine/app/scope';
import { diagnosticNow } from '@wildshard/engine/core/clock';
import { LedgerBook } from '@wildshard/engine/net/ledgerBook';
import type { ChatReports } from '@wildshard/engine/net/chat';
import { NetRoom } from '@wildshard/engine/net/room';
import { ServerClock } from '@wildshard/engine/net/serverClock';
import { SimNetWorld } from '@wildshard/engine/net/simWorld';
import { installSaveEnvironment } from '@wildshard/engine/saves/environment';
import { ForwardedStorage } from '@wildshard/engine/saves/forwardedStorage';
import { saves } from '@wildshard/engine/saves/runtime';
import { actRoutes } from '@wildshard/engine/sim/actRoutes';
import { serializeSimSnapshot, snapshotSimHostBytes } from '@wildshard/engine/sim/snapshot';
import { ServerMessageSchema, ShellMessageSchema, type ProbedRow, type ServerMessage, type ShellMessage } from '@wildshard/format/standaloneControl';
import { createQuestLedger } from '@wildshard/game/quest/ledger';
import { createTrustedHeadlessResident, type HeadlessRuntimeInput, type TrustedHeadlessResident } from '../headlessRuntime';
import { tickCommands } from '../tickProtocol';
import { CONTINUATION, ContinuationSlots, type SavedContinuation } from './continuation';
import { ledgerFilings } from './ledgerFilings';
import { netTickCommands } from './netInput';
import { WorkerLoopback } from './workerLoopback';

type Boot = Extract<ShellMessage, { kind: 'boot' }>;
/** How the composition reaches what a worker and a Node test get differently. */
export interface StandaloneServerOptions {
  readonly control: MessagePort; readonly game: MessagePort;
  /** Read and verify the shard's server inputs. */
  readonly load: (boot: Boot) => Promise<HeadlessRuntimeInput>;
  /** A save read back but would not restore, and boot moved to the one before it. */
  readonly onSaveRefused?: (error: unknown) => void;
  /** Where chat reports go (J110). Where that ends up is still to be decided. */
  readonly reports?: ChatReports;
}
/** The tick allowance one player's input may use. */
const COMMANDS_PER_TICK = 8;

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
  const book = new LedgerBook();
  let room: NetRoom | undefined, clock: ServerClock | undefined, resident: TrustedHeadlessResident | undefined, storage: ForwardedStorage | undefined;
  let slots: ContinuationSlots | undefined, slug = '', probing: number | null = null, tickMs = 0;
  const post = (message: ServerMessage): void => { control.postMessage(v.parse(ServerMessageSchema, message), []); };
  const fail = (error: unknown): void => { clock?.pause(); post({ kind: 'failed', reason: error instanceof Error ? error.message : String(error) }); };

  const boot = async (message: Boot): Promise<void> => {
    slug = message.slug;
    storage = new ForwardedStorage(message.saves, write => { post({ kind: 'write', ...write }); });
    const local = storage;
    installWorkerIdentity(message.savePrefix);
    installSaveEnvironment({ storage: saveScope => saveScope === 'session' ? null : local, persistent: () => true, persist: () => Promise.resolve(false) });
    slots = new ContinuationSlots(saves.define(CONTINUATION), slug, local, message.savePrefix);
    const input = await options.load(message);
    let saved: SavedContinuation | undefined;
    for (const candidate of slots.candidates()) {
      try { resident = await createTrustedHeadlessResident(input, candidate.saved.snapshot, { room: true }); saved = candidate.saved; slots.restored(candidate); break; }
      catch (error) { slots.setAside(candidate); options.onSaveRefused?.(error); }
    }
    resident ??= await createTrustedHeadlessResident(input, undefined, { room: true });
    const live = resident;
    live.host.respawn.served = true;
    const step: ConstructorParameters<typeof NetRoom>[0]['step'] = inputs => {
      const started = diagnosticNow(), own = inputs[0];
      live.step(tickCommands([{ source: 'net', commands: netTickCommands(own?.command ?? null, own?.acts ?? [], actRoutes(live.host)) }], COMMANDS_PER_TICK), undefined, new Map(inputs.map(row => [row.player, row.acts])));
      tickMs = diagnosticNow() - started;
      if (probing !== null && live.host.state.tick % 2 === 0) { post({ kind: 'probed', id: probing, tick: live.host.state.tick, tickMs, rows: probeRows(live) }); probing = null; }
    };
    if (saved?.ledger !== undefined) book.restore(saved.ledger);
    // M8: this is where a grant becomes the profile's, as it is on the page; only a fact the shard declares has a rule to pay.
    const facts = createQuestLedger(saves, input.shard, slug), declared = new Set(input.shard.ledger.map(row => row.fact));
    const world: SimNetWorld = new SimNetWorld(live.host, 0, () => ledgerFilings(live.host, world.player.id, live.effects, (name, entity) => declared.has(name) ? facts(name, entity) : null));
    room = new NetRoom({ world, step, build: message.build, book, ...(options.reports === undefined ? {} : { reports: options.reports }) });
    room.join(new WorkerLoopback(game));
    const tickRoom = room;
    clock = new ServerClock({ now: diagnosticNow, wait: (ms, run) => { const timer = scope.timeout(ms, run); return () => { scope.cancelTimer(timer); }; },
      step: () => { try { tickRoom.tick(); } catch (error) { fail(error); } } });
    post({ kind: 'booted', tick: live.host.state.tick, restored: saved !== undefined });
  };

  const save = async (id: number): Promise<void> => {
    if (resident === undefined || slots === undefined || storage === undefined) throw new Error('Save before boot');
    const tick = resident.host.state.tick;
    const wrote = slots.write({ tick, snapshot: serializeSimSnapshot(snapshotSimHostBytes(resident.host)), ledger: book.snapshot() });
    const durable = await storage.settled() && wrote; // J-ledger rule: a save counts only once the real storage has it (§6.3.3)
    slots.settled(durable);
    post({ kind: 'saved', id, tick, ok: durable });
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

