import type {HeadlessTapePlan,HeadlessTapeReport} from './headlessTape';
import { HeadlessObservationReportSchema, OBSERVATION_TICKS, type HeadlessTickSample } from './headlessObservation';
import { HeadlessJourneyReportSchema, type HeadlessJourneyPlan, type HeadlessJourneyReport } from './headlessJourney';
// oxlint-disable-next-line import/no-nodejs-modules -- The isolated simulation communicates through the Node worker boundary.
import { parentPort, workerData } from 'node:worker_threads';
// oxlint-disable-next-line import/no-nodejs-modules -- Parent and worker use the same monotonic clock for a preemptible wall deadline.
import { hrtime } from 'node:process';
import * as v from 'valibot';
import { WorkerRequestSchema, TickCommitSchema, TickObservationSchema, HeadlessTapeReportSchema, HeadlessTapePartReportSchema, type AuthorProofPlan, type AuthorProofReport, type HeadlessCommand, type HeadlessTickCommit, type HeadlessTickObservation } from './tickProtocol';
import {TapePartBudget} from './headlessTapeParts';

export interface TickWorkerAdapter {
  /** Checks all snapshot/tick fields without publishing an intermediate save. */
  observe?: () => HeadlessTickObservation;
  verbTape?:(plan:HeadlessTapePlan)=>HeadlessTapeReport;
  journey?: (plan:HeadlessJourneyPlan)=>HeadlessJourneyReport;
  step: (commands: readonly HeadlessCommand[]) => void;
  commit: () => HeadlessTickCommit;
  finish: () => { ticks: number; lanes: number; steps: number; liftRides?: number; liftCalls?: number; portalTransfers?: number };
  /** Optional fixed platform proof; trusted shard adapters without it refuse. */
  authorProof?: (plan: AuthorProofPlan) => Promise<AuthorProofReport>;
  dispose: () => void;
}
export const WorkerEnvelopeSchema: v.ObjectSchema<{ readonly clock: v.InstanceSchema<SharedArrayBufferConstructor, undefined>; readonly tickMicros: v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.IntegerAction<number, undefined>, v.MinValueAction<number, 1, undefined>, v.MaxValueAction<number, 16666, undefined>]>; readonly commandsPerTick: v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.IntegerAction<number, undefined>, v.MinValueAction<number, 0, undefined>, v.MaxValueAction<number, 1024, undefined>]>; readonly enforceTickDeadline: v.OptionalSchema<v.BooleanSchema<undefined>, true>; readonly payload: v.UnknownSchema; }, undefined> = v.object({ clock: v.instance(SharedArrayBuffer), tickMicros: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(16_666)), commandsPerTick: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(1024)), enforceTickDeadline: v.optional(v.boolean(), true), payload: v.unknown() });
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
  let parts:TapePartBudget|undefined;
  let partsFinished=false;
  const handle = async (raw: unknown): Promise<void> => {
    try {
      const request = v.parse(WorkerRequestSchema, raw);
      if(partsFinished)throw new Error('Headless tape parts already finished');
      if(parts!==undefined&&request.kind!=='verbTapePart'&&request.kind!=='finish')throw new Error('Tape parts own this worker until finish');
      if(request.kind==='verbTapePart'){
        if(envelope.enforceTickDeadline)throw new Error('Verb tape requires trusted offline timing');
        for(const segment of request.plan.segments)for(const commands of segment.frames??[segment.commands])
          if(commands.length+(segment.route===undefined?0:1)>envelope.commandsPerTick)throw new Error('Aggregate commandsPerTick exceeded');
        if(adapter.verbTape===undefined)throw new Error('Missing native verb tape capability');
        const guard=parts??=new TapePartBudget(v.parse(TickCommitSchema,adapter.commit()).tick);
        guard.admit(request.plan);
        const result=v.parse(HeadlessTapePartReportSchema,{report:adapter.verbTape(request.plan),commit:adapter.commit()});
        guard.accept(result);port.postMessage({verbTapePart:result});return;
      }
      if (request.kind === 'observe') {
        if (envelope.enforceTickDeadline) throw new Error('Observation requires trusted offline timing');
        if (adapter.observe === undefined) throw new Error('Missing offline observation capability');
        const samples: HeadlessTickSample[] = [];
        let commit: HeadlessTickCommit | undefined;
        for (let index = 0; index < OBSERVATION_TICKS; index++) {
          const started = hrtime.bigint(); Atomics.store(clock, 1, started); Atomics.store(clock, 0, 1n);
          adapter.step([]);
          const elapsed = hrtime.bigint() - started; Atomics.store(clock, 2, elapsed); Atomics.store(clock, 0, 2n);
          if (index === OBSERVATION_TICKS - 1) commit = v.parse(TickCommitSchema, adapter.commit());
          const metadata = commit === undefined ? adapter.observe() : Object.fromEntries(Object.entries(commit).filter(([key]) => key !== 'snapshot'));
          const checked = v.parse(TickObservationSchema, metadata);
          samples.push({ tick: checked.tick, tickMicros: Number(elapsed) / 1000, scriptMicros: checked.scriptMicros ?? 0, fuelUsed: checked.fuelUsed ?? 0 });
        }
        if (commit === undefined) throw new Error('Missing final observation checkpoint');
        port.postMessage({ observation: v.parse(HeadlessObservationReportSchema, { samples, commit }) }); return;
      }
      if(request.kind==='verbTape'){
        if(envelope.enforceTickDeadline)throw new Error('Verb tape requires trusted offline timing');
        for(const segment of request.plan.segments)for(const commands of segment.frames??[segment.commands])
          if(commands.length+(segment.route===undefined?0:1)>envelope.commandsPerTick)throw new Error('Aggregate commandsPerTick exceeded');
        if(adapter.verbTape===undefined)throw new Error('Missing native verb tape capability');
        port.postMessage({verbTape:v.parse(HeadlessTapeReportSchema,adapter.verbTape(request.plan))});return;
      }
      if(request.kind==='journey'||request.kind==='walk'){
        if(envelope.enforceTickDeadline)throw new Error('Journey requires trusted offline timing');
        if(envelope.commandsPerTick<1)throw new Error('Journey needs one player command per tick');
        if(adapter.journey===undefined)throw new Error('Missing native journey capability');
        const report=v.parse(HeadlessJourneyReportSchema,adapter.journey(request.plan));
        if(request.kind==='walk')port.postMessage({walk:{report,commit:v.parse(TickCommitSchema,adapter.commit())}});
        else port.postMessage({journey:report});return;
      }
      if (request.kind === 'authorProof') {
        if (adapter.authorProof === undefined) throw new Error('Author proof requires the data-only native owner');
        port.postMessage({ authorProof: await adapter.authorProof(request.plan) }); return;
      }
      if (request.kind === 'finish') { partsFinished=parts!==undefined;port.postMessage({ proof: adapter.finish() }); return; }
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
  };
  port.on('message', (raw: unknown) => { void handle(raw); });
}
