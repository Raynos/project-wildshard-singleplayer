// oxlint-disable-next-line import/no-nodejs-modules -- The isolated simulation communicates through the Node worker boundary.
import { parentPort, workerData } from 'node:worker_threads';
// oxlint-disable-next-line import/no-nodejs-modules -- Parent and worker use the same monotonic clock for a preemptible wall deadline.
import { hrtime } from 'node:process';
import * as v from 'valibot';
import { WorkerRequestSchema, TickCommitSchema, type HeadlessCommand, type HeadlessTickCommit } from './tickProtocol';

export interface TickWorkerAdapter {
  step: (commands: readonly HeadlessCommand[]) => void;
  commit: () => HeadlessTickCommit;
  finish: () => { ticks: number; lanes: number; steps: number; liftRides?: number; liftCalls?: number; portalTransfers?: number };
  dispose: () => void;
}
export const WorkerEnvelopeSchema = v.object({ clock: v.instance(SharedArrayBuffer), tickMicros: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(16_666)), commandsPerTick: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(1024)), enforceTickDeadline: v.optional(v.boolean(), true), payload: v.unknown() });
/** Internal trusted worker adapter. Author modules are admitted WASM, never a configurable JS module URL. */
export async function runTickWorker(create: (payload: unknown) => Promise<TickWorkerAdapter>): Promise<void> {
  const port = parentPort; if (port === null) throw new Error('Tick worker requires a parent');
  const envelope = v.parse(WorkerEnvelopeSchema, workerData), clock = new BigInt64Array(envelope.clock);
  const sendError = (error: unknown): void => { Atomics.store(clock, 0, 3n); port.postMessage({ error: error instanceof Error ? error.message : String(error) }); port.close(); };
  let adapter: TickWorkerAdapter;
  try { adapter = await create(envelope.payload); port.postMessage({ commit: v.parse(TickCommitSchema, adapter.commit()) }); }
  catch (error) { sendError(error); return; }
  port.on('close', () => { adapter.dispose(); });
  let cold = true;
  port.on('message', (raw: unknown) => {
    try {
      const request = v.parse(WorkerRequestSchema, raw);
      if (request.kind === 'finish') { port.postMessage({ proof: adapter.finish() }); return; }
      if (request.commands.length > envelope.commandsPerTick) throw new Error('Aggregate commandsPerTick exceeded');
      // One first-touch/JIT tick has the platform's bounded 16.666 ms ceiling, never an unarmed watchdog.
      const tickMicros = cold ? 16_666 : envelope.tickMicros; cold = false;
      const started = hrtime.bigint(); Atomics.store(clock, 1, started); Atomics.store(clock, 0, 1n);
      adapter.step(request.commands);
      const elapsed = hrtime.bigint() - started; Atomics.store(clock, 2, elapsed);
      if (envelope.enforceTickDeadline && elapsed > BigInt(tickMicros) * 1000n) throw new Error('Headless tick deadline exceeded');
      // Checkpoint construction cannot publish a partial tick and has the parent's independent request deadline.
      Atomics.store(clock, 0, 2n); port.postMessage({ commit: v.parse(TickCommitSchema, adapter.commit()) });
    } catch (error) { sendError(error); }
  });
}
