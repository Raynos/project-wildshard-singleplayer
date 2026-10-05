// oxlint-disable-next-line import/no-nodejs-modules -- A separate isolate makes blocked WASM and native host queries preemptible.
import { Worker } from 'node:worker_threads';
// oxlint-disable-next-line import/no-nodejs-modules -- Same monotonic wall clock as the worker, independent of its event loop.
import { hrtime } from 'node:process';
import * as v from 'valibot';
import { Scope } from '@wildshard/engine/app/scope';
import { tickCommands, TickCommitSchema, type HeadlessCommandSource, type HeadlessTickCommit } from './tickProtocol';

const proofSchema = v.strictObject({ ticks: v.pipe(v.number(), v.integer(), v.minValue(0)), lanes: v.pipe(v.number(), v.integer(), v.minValue(0)), steps: v.pipe(v.number(), v.integer(), v.minValue(0)) });
const replySchema = v.variant('kind', [v.strictObject({ kind: v.literal('commit'), value: TickCommitSchema }), v.strictObject({ kind: v.literal('proof'), value: proofSchema })]);
type Reply = v.InferOutput<typeof replySchema>;
/** A deadline failure quarantines the worker while retaining the last fully committed continuation. */
export class HeadlessDeadlineError extends Error {
  readonly checkpoint: HeadlessTickCommit | undefined;
  readonly elapsedMicros: number;
  constructor(checkpoint: HeadlessTickCommit | undefined, elapsedMicros: number) { super(`Headless tick deadline exceeded at ${elapsedMicros.toFixed(0)} us; worker quarantined`); this.name = 'HeadlessDeadlineError'; this.checkpoint = checkpoint === undefined ? undefined : structuredClone(checkpoint); this.elapsedMicros = elapsedMicros; }
}
/** Internal parent-side runner; its module URL is selected only by trusted platform code. */
export class TickWorkerHost {
  private readonly worker: Worker;
  private readonly clock = new BigInt64Array(new SharedArrayBuffer(24));
  private last: HeadlessTickCommit | undefined;
  private pending: { resolve: (value: Reply) => void; reject: (error: Error) => void } | undefined;
  private requestStarted = 0n;
  private closed = false;
  private cold = true;
  private tickBudgetMicros: number;
  private readonly scope = new Scope('headless watchdog');
  private readonly ready: Promise<Reply>;
  constructor(url: URL, payload: unknown, private readonly budget: { tickMicros: number; commandsPerTick: number }, execArgv: string[] = [], private readonly deadline: 'runtime' | 'advisory' = 'runtime') {
    if (!Number.isInteger(budget.tickMicros) || budget.tickMicros < 1 || budget.tickMicros > 16_666 || !Number.isInteger(budget.commandsPerTick) || budget.commandsPerTick < 0 || budget.commandsPerTick > 1024) throw new Error('Invalid headless budget');
    this.tickBudgetMicros = budget.tickMicros;
    this.ready = this.wait();
    this.worker = new Worker(url, { workerData: { payload, ...budget, clock: this.clock.buffer, enforceTickDeadline: deadline === 'runtime' }, execArgv });
    this.worker.on('message', (raw: unknown) => {
      try {
        const message = v.parse(v.union([v.strictObject({ commit: TickCommitSchema }), v.strictObject({ proof: proofSchema }), v.strictObject({ error: v.string() })]), raw);
        if ('error' in message) { this.fail(message.error.includes('tick deadline') ? new HeadlessDeadlineError(this.last, Number(Atomics.load(this.clock, 2)) / 1000) : new Error(message.error)); return; }
        const reply: Reply = 'commit' in message ? { kind: 'commit', value: message.commit } : { kind: 'proof', value: message.proof };
        if (reply.kind === 'commit') this.last = structuredClone(reply.value);
        const pending = this.pending; this.pending = undefined; pending?.resolve(reply);
      } catch (error) { this.fail(error instanceof Error ? error : new Error(String(error))); }
    });
    this.worker.on('error', (error: unknown) => { this.fail(error instanceof Error ? error : new Error(String(error))); });
    this.worker.on('exit', code => { if (!this.closed) this.fail(new Error(`Headless worker exited: ${code}`)); });
    this.scope.interval(1, () => {
      const now = hrtime.bigint();
      if (this.deadline === 'runtime' && Atomics.load(this.clock, 0) === 1n && now - Atomics.load(this.clock, 1) > BigInt(this.tickBudgetMicros) * 1000n) this.fail(new HeadlessDeadlineError(this.last, Number(now - Atomics.load(this.clock, 1)) / 1000));
      else if (this.pending !== undefined && now - this.requestStarted > 30_000_000_000n) this.fail(new Error('Headless worker request deadline exceeded; quarantined'));
    });
  }
  private wait(): Promise<Reply> {
    this.requestStarted = hrtime.bigint();
    return new Promise((resolve, reject) => { this.pending = { resolve, reject }; });
  }
  private fail(error: Error): void {
    if (this.closed) return;
    this.closed = true; this.scope.dispose();
    const pending = this.pending; this.pending = undefined; pending?.reject(error); void this.worker.terminate();
  }
  async initialized(): Promise<void> { const reply = await this.ready; if (reply.kind !== 'commit') throw new Error('Missing initial worker checkpoint'); }
  get quarantined(): boolean { return this.closed; }
  get checkpoint(): HeadlessTickCommit | undefined { return this.last === undefined ? undefined : structuredClone(this.last); }
  get lastTickMicros(): number { return Number(Atomics.load(this.clock, 2)) / 1000; }
  async step(sources: readonly HeadlessCommandSource[] = []): Promise<HeadlessTickCommit> {
    const commands = tickCommands(sources, this.budget.commandsPerTick);
    if (this.finished) throw new Error('Headless validation finished; resume a fresh worker from the committed checkpoint');
    await this.initialized(); if (this.closed || this.pending !== undefined) throw new Error('Headless worker unavailable or busy');
    this.tickBudgetMicros = this.cold ? 16_666 : this.budget.tickMicros; this.cold = false;
    Atomics.store(this.clock, 0, 0n); const result = this.wait();
    // oxlint-disable-next-line unicorn/require-post-message-target-origin -- Node Worker messages have no browser target origin.
    this.worker.postMessage({ kind: 'step', commands });
    const reply = await result; if (reply.kind !== 'commit') throw new Error('Missing worker tick checkpoint'); return reply.value;
  }
  async finish(): Promise<v.InferOutput<typeof proofSchema>> {
    if (this.finished) throw new Error('Headless validation already finished');
    await this.initialized(); if (this.closed || this.pending !== undefined) throw new Error('Headless worker unavailable or busy');
    this.finished = true;
    const result = this.wait();
    // oxlint-disable-next-line unicorn/require-post-message-target-origin -- Node Worker messages have no browser target origin.
    this.worker.postMessage({ kind: 'finish' });
    const reply = await result; if (reply.kind !== 'proof') throw new Error('Missing headless validation proof'); return reply.value;
  }
  async dispose(): Promise<void> { this.closed = true; this.scope.dispose(); this.pending?.reject(new Error('Headless worker disposed')); this.pending = undefined; await this.worker.terminate(); }
  private finished = false;
}
