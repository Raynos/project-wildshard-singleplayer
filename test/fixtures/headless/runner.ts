import { TickWorkerHost, HeadlessDeadlineError } from '../../../src/sdk/tickWorkerHost';
import { HeadlessSimulation, validateSimulation } from '../../../src/sdk/headless';
import { emptyShardfile } from '../../../src/sdk/author';
// oxlint-disable-next-line import/no-nodejs-modules -- Read the real template's committed, already admitted asset fixture.
import { readFileSync } from 'node:fs';
import template from '../../../src/shards/_template/shard.config';

function check(value: boolean, message: string): void { if (!value) throw new Error(message); }
/** Native Node fixture: imports only bundled installed-style JavaScript, with no Vitest loader or workspace aliases. */
export async function run(mode: string, bytes: number[]): Promise<object> {
  if (mode === 'measure') {
    const source = structuredClone(template); source.serverBudget.tickMicros = 16_666;
    const sim = await HeadlessSimulation.create(source, new Map(source.files.map(file => [file.hash, new Uint8Array(readFileSync(`src/shards/_template/assets/${file.hash}`))])));
    try {
      const times: number[] = [];
      for (let i = 0; i < 120; i++) { await sim.step(); times.push(sim.lastTickMicros); }
      const cold = times.shift(), warm = times.sort((a, b) => a - b);
      return { cold, warmP99: warm[Math.floor(warm.length * 0.99)], warmMax: warm.at(-1), ticks: sim.checkpoint?.tick };
    } finally { await sim.dispose(); }
  }
  if (mode === 'template') {
    const sim = await HeadlessSimulation.create(template, new Map(template.files.map(file => [file.hash, new Uint8Array(readFileSync(`src/shards/_template/assets/${file.hash}`))])));
    let committed = sim.checkpoint;
    try {
      for (let i = 0; i < 60; i++) committed = await sim.step();
      return await sim.finish();
    } catch (error) {
      if (error instanceof HeadlessDeadlineError) {
        check(sim.quarantined && error.checkpoint?.snapshot === committed?.snapshot && JSON.stringify(sim.checkpoint) === JSON.stringify(committed), 'Template exposed unfinished tick state or effects');
        return { deadline: true, tick: error.checkpoint?.tick, elapsedMicros: error.elapsedMicros, budget: template.serverBudget.tickMicros, snapshot: error.checkpoint?.snapshot.length, retainedExact: true };
      }
      throw error;
    } finally { await sim.dispose(); }
  }
  if (mode === 'normal') {
    const source = emptyShardfile({ slug: 'watchdog-test', name: 'Test', author: 'Test', revision: 1, seed: 435 }); source.serverBudget.tickMicros = 1;
    const sim = await HeadlessSimulation.create(source, new Map(), undefined, { deadline: 'advisory' });
    try {
      const first = await sim.step([{ source: 'input', commands: [{ kind: 'player', moveX: 1, moveZ: 0, yaw: 0 }] }]);
      const next = await sim.step(); const fresh = await HeadlessSimulation.create(source, new Map(), first.snapshot, { deadline: 'advisory' });
      try { const replay = await fresh.step(); check(replay.snapshot === next.snapshot, 'Exact native worker continuation diverged'); } finally { await fresh.dispose(); }
      const proof = await validateSimulation(source, new Map()); check(proof.ticks === 60 && proof.lanes > 0 && proof.steps > 0 && proof.timing.samples === 60 && Number.isFinite(proof.timing.medianMicros), 'Missing deterministic capsule validation and advisory timing');
      const committed = sim.checkpoint; await sim.finish(); let finished = false;
      try { await sim.step(); } catch (error) { finished = error instanceof Error && error.message.includes('validation finished'); }
      check(finished && sim.checkpoint?.snapshot === committed?.snapshot, 'Validation resumed after temporary capsule allocation or changed the committed checkpoint');
      return { tick: next.tick, ...proof, exact: true };
    } finally { await sim.dispose(); }
  }
  const entry = 'slowWorker.js', url = new URL(entry, import.meta.url), budget = { tickMicros: 16_666, commandsPerTick: 2 };
  const runner = new TickWorkerHost(url, { bytes }, budget);
  try {
    await runner.initialized();
    const initial = runner.checkpoint; check(initial !== undefined, 'No initial snapshot');
    const command = { kind: 'script', actorId: 'actor.player', value: 0 } as const;
    if (mode === 'overflow') {
      let refused = false;
      try { await runner.step([{ source: 'input', commands: [command, command] }, { source: 'replay', commands: [command] }]); } catch (error) { refused = error instanceof Error && error.message.includes('Aggregate'); }
      check(refused && runner.checkpoint?.snapshot === initial?.snapshot && !runner.quarantined, 'Split sources evaded the aggregate cap or mutated state');
      const commit = await runner.step([{ source: 'input', commands: [command] }, { source: 'replay', commands: [command] }]);
      const snapshot = commit.snapshot; commit.snapshot = 'tampered'; check(runner.checkpoint?.snapshot === snapshot, 'Caller changed authoritative checkpoint');
      return { accepted: 2, refused: 3, tick: commit.tick };
    }
    if (mode === 'cold') {
      let refused = false;
      try { await runner.step([{ source: 'input', commands: [{ ...command, value: 1 }] }]); } catch (error) { refused = error instanceof HeadlessDeadlineError; }
      check(refused && runner.quarantined && runner.checkpoint?.tick === 0 && runner.checkpoint.effects.length === 0, 'Cold-start allowance disabled preemption or exposed unfinished effects');
      return { retained: 0, effects: 0, quarantined: true };
    }
    const committed = await runner.step(); const started = performance.now(); let error: unknown;
    try { await runner.step([{ source: 'input', commands: [{ ...command, value: 1 }] }]); } catch (caught) { error = caught; }
    check(error instanceof HeadlessDeadlineError && runner.quarantined, 'Blocked host query was not preempted');
    check(runner.checkpoint?.snapshot === committed.snapshot && runner.checkpoint.effects.length === 1, 'Unfinished tick exposed state or effects');
    const fresh = new TickWorkerHost(url, { bytes, snapshot: committed.snapshot }, budget);
    try { await fresh.initialized(); const resumed = await fresh.step(); check(resumed.tick === committed.tick + 1 && resumed.effects.length === 1, 'Last committed checkpoint did not resume'); }
    finally { await fresh.dispose(); }
    return { retained: committed.tick, effects: runner.checkpoint?.effects.length, elapsed: performance.now() - started, quarantined: runner.quarantined };
  } finally { await runner.dispose(); }
}
