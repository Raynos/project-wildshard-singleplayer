// oxlint-disable-next-line import/no-nodejs-modules -- Read the actual shard, tape and committed native checkpoints.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Exact input/effect freshness, not a gameplay hash substitute.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep native snapshot artefacts compact.
import { gzipSync, gunzipSync } from 'node:zlib';
import * as v from 'valibot';
import source from '../../../src/shards/driftwood-isle/shard.config';
import { CAPTAIN_STEP } from '../../../src/shards/driftwood-isle/runtime/captain';
import { loadRapier, type Rapier } from '../../../src/engine/physics/rapier';
import { serializeSimSnapshot, snapshotSimHost } from '../../../src/engine/sim/snapshot';
import { SaveStore, type SaveStorage } from '../../../src/engine/saves/store';
import { Ledger, LedgerEmitter, type LedgerReceipt } from '../../../src/game/ledger';
import { createTrustedHeadlessResident, type TrustedHeadlessResident } from '../../../src/sdk/headlessRuntime';
import { HeadlessSimulation } from '../../../src/sdk/headless';
import { TickCommandSchema, TickEffectSchema, type HeadlessCommand, type HeadlessEffect } from '../../../src/sdk/tickProtocol';
import { canonicalSimDigest } from '../../fake/simState';
import { simMismatchError } from '../../fake/simMismatch';
import { playDriftwood } from './tape';

export const ENTRY = 'runtime/headless.ts';
const ROOT = new URL('../../../', import.meta.url), MODULE = new URL(`src/shards/driftwood-isle/${ENTRY}`, ROOT).href;
const WORKER = new URL('worker.ts', import.meta.url).href;
const DIR = new URL('checkpoints/', import.meta.url), MANIFEST = new URL('manifest.json', DIR);
const assets = new Map(source.files.map(file => [file.hash, new Uint8Array(readFileSync(new URL(`src/shards/driftwood-isle/assets/${file.hash}`, ROOT)))]));
const natural = v.pipe(v.number(), v.integer(), v.minValue(0));
const Frame = v.pipe(v.array(TickCommandSchema), v.maxLength(1024));
const Tape = v.pipe(v.array(Frame), v.maxLength(60_000));
const Effect = v.strictObject({ tick: natural, effect: TickEffectSchema });
const Checkpoint = v.strictObject({ name: v.string(), tick: natural, sha: v.string(), digest: v.string(), profile: v.array(v.tuple([v.string(), v.string()])) });
const Manifest = v.strictObject({ inputs: v.string(), tape: v.string(), ticks: natural, effects: v.array(Effect), checkpoints: v.array(Checkpoint), endDigest: v.string() });
type Recorded = v.InferOutput<typeof Manifest>;
const hash = (bytes: Uint8Array | string): string => createHash('sha256').update(bytes).digest('hex');
const digest = (session: TrustedHeadlessResident): string => canonicalSimDigest(snapshotSimHost(session.host));
const save = (session: TrustedHeadlessResident): string => serializeSimSnapshot(snapshotSimHost(session.host));
const identity = { instance: 'driftwood-witness', shard: source.identity.slug, revision: source.identity.revision };

/** Every named result is scoped; the remaining page laws below keep whole-shard admission closed. */
export const OPEN = [
  'Living creature rig volumes are reproduced; rendered ragdoll bodies and their contacts remain outside this witness.',
  'Named target attacks/prompts are bounded input ports; camera crosshair, prompt occlusion/nearest selection, hitstop and clang are not modeled.',
  'The reward camera/player carry, zipline and every optional treasure/sea-glass path are not covered by this tape.',
  'Ecology is bounded at 256 lifetime recipes; ship clock/contact and the page cosmetic/audio/rig work are outside this witness.',
];
export const SCOPE = 'Real Sealed Ring player tape, Captain continuation and emitted ledger facts; not whole-shard compatibility';
export function driftwoodRapier(): Promise<Rapier> { return loadRapier(readFileSync(new URL('public/assets/physics/rapier.wasm', ROOT))); }
function boot(rapier: Rapier, snapshot?: string): Promise<TrustedHeadlessResident> {
  return createTrustedHeadlessResident({ shard: source, assets, rapier }, { module: MODULE }, snapshot);
}
function manifest(): Recorded { return v.parse(Manifest, JSON.parse(readFileSync(MANIFEST, 'utf8'))); }
function tape(m: Recorded): HeadlessCommand[][] {
  const bytes = readFileSync(new URL('commands.json.gz', DIR));
  if (hash(bytes) !== m.tape) throw new Error('Gameplay tape bytes are stale');
  const frames = v.parse(Tape, JSON.parse(gunzipSync(bytes).toString('utf8')));
  if (frames.length !== m.ticks) throw new Error('Gameplay tape length changed');
  return frames;
}
async function resume(rapier: Rapier, checkpoint: Recorded['checkpoints'][number]): Promise<TrustedHeadlessResident> {
  const bytes = readFileSync(new URL(`${checkpoint.name}.snap.gz`, DIR));
  if (hash(bytes) !== checkpoint.sha) throw new Error(`Checkpoint ${checkpoint.name} bytes changed`);
  const wire = gunzipSync(bytes).toString('utf8');
  if (canonicalSimDigest(wire) !== checkpoint.digest) throw new Error(`Checkpoint ${checkpoint.name} canonical state changed`);
  const session = await boot(rapier, wire);
  if (session.host.state.tick !== checkpoint.tick || digest(session) !== checkpoint.digest || session.effects.length > 0) {
    session.dispose(); throw new Error(`Checkpoint ${checkpoint.name} did not restore exactly`);
  }
  return session;
}
function play(session: TrustedHeadlessResident, frames: readonly HeadlessCommand[][], until: number): { tick: number; effect: HeadlessEffect }[] {
  const from = session.host.state.tick;
  if (until - from > 10_000 || until < from || until > frames.length) throw new Error('Invalid 10k slice');
  const effects: { tick: number; effect: HeadlessEffect }[] = [];
  for (let i = from; i < until; i++) {
    const commands = frames[i]; if (commands === undefined) throw new Error('Missing recorded player tick');
    session.step(commands); effects.push(...session.effects.map(effect => ({ tick: session.host.state.tick, effect })));
    if (session.host.player.health.attributes.health <= 0) throw new Error('Player died during recorded play');
  }
  return effects;
}
function expected(m: Recorded, from: number, until: number): Recorded['effects'] { return m.effects.filter(row => row.tick > from && row.tick <= until); }
function sameEffects(actual: Recorded['effects'], expectedEffects: Recorded['effects']): void {
  if (JSON.stringify(actual) !== JSON.stringify(expectedEffects)) throw new Error('Gameplay effects diverged from the recorded run');
}

class ProfileStorage implements SaveStorage {
  readonly data = new Map<string, string>(); refused = false;
  get length(): number { return this.data.size; }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null; }
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { if (this.refused) throw new Error('Refused durable write'); this.data.set(key, value); }
  removeItem(key: string): void { this.data.delete(key); }
}
function profile(local: ProfileStorage): Ledger { return new Ledger(new SaveStore({ local, session: null }), [{ id: identity.instance, shard: identity.shard }], [{ shard: identity.shard, revision: identity.revision, rules: source.ledger }], []); }
/** One cursor per declared provenance; these accept only effects emitted by a completed native tick. */
class FactIngress {
  private readonly emitters = new Map<string, LedgerEmitter>();
  private now = 0;
  private readonly dedupe: string[] = [];
  constructor(private readonly ledger: Ledger) {}
  ingest(tick: number, effects: readonly HeadlessEffect[]): LedgerReceipt[] {
    this.now = tick;
    return effects.flatMap(effect => {
      if (effect.kind !== 'fact') return [];
      const rule = source.ledger.find(mapping => mapping.fact === effect.name);
      if (rule === undefined) throw new Error('Gameplay emitted an undeclared fact');
      const key = JSON.stringify(rule.origin); let emitter = this.emitters.get(key);
      if (emitter === undefined) { emitter = new LedgerEmitter(this.ledger, identity, rule.origin, () => this.now, this.dedupe); this.emitters.set(key, emitter); }
      return [emitter.emit(effect.name, effect.actorId)];
    });
  }
}

/** Fresh continuous spawn-to-reward play; snapshots observe gameplay and never inject a grant, position or actor state. */
export async function recordGameplay(rapier: Rapier, inputs: string): Promise<object> {
  const session = await boot(rapier), local = new ProfileStorage(), ledger = profile(local), ingress = new FactIngress(ledger), frames: HeadlessCommand[][] = [], effects: Recorded['effects'] = [], checkpoints: Recorded['checkpoints'] = [];
  session.host.events.on('player.died', () => { throw new Error('Witness player died'); }, session.host.scope);
  mkdirSync(DIR, { recursive: true });
  let fork: TrustedHeadlessResident | undefined;
  const forkEffects: Recorded['effects'] = [];
  const mark = async (name: string): Promise<void> => {
    if (name !== 'spawn' && name !== 'captain' && !name.startsWith('tick-')) return;
    const bytes = gzipSync(save(session), { level: 9 }); writeFileSync(new URL(`${name}.snap.gz`, DIR), bytes);
    checkpoints.push({ name, tick: session.host.state.tick, sha: hash(bytes), digest: digest(session), profile: [...local.data] });
    if (name === 'captain') fork = await boot(rapier, gunzipSync(bytes).toString('utf8'));
  };
  try {
    await mark('spawn');
    await playDriftwood(session.host, commands => {
      if (frames.length >= 60_000) throw new Error('Gameplay recording exceeded its bound');
      frames.push(v.parse(Frame, commands)); session.step(commands);
      if (fork !== undefined) { const replay = fork; replay.step(commands); forkEffects.push(...replay.effects.map(effect => ({ tick: replay.host.state.tick, effect }))); }
      effects.push(...session.effects.map(effect => ({ tick: session.host.state.tick, effect })));
      ingress.ingest(session.host.state.tick, session.effects);
      if (!ledger.flush()) throw new Error('Recording profile grant was not durable');
      if (frames.length % 10_000 === 0) { const name = `tick-${String(frames.length)}`, bytes = gzipSync(save(session), { level: 9 }); writeFileSync(new URL(`${name}.snap.gz`, DIR), bytes); checkpoints.push({ name, tick: session.host.state.tick, sha: hash(bytes), digest: digest(session), profile: [...local.data] }); }
    }, mark);
    if (fork === undefined || digest(fork) !== digest(session)) throw new Error('Continuous gameplay / mid-fight restore diverged');
    const cp = checkpoints.find(row => row.name === 'captain');
    if (cp === undefined) throw new Error('No Captain checkpoint');
    sameEffects(forkEffects, effects.filter(row => row.tick > cp.tick));
    const bytes = gzipSync(JSON.stringify(frames), { level: 9 }); writeFileSync(new URL('commands.json.gz', DIR), bytes);
    const recorded = v.parse(Manifest, { inputs, tape: hash(bytes), ticks: frames.length, effects, checkpoints, endDigest: digest(session) });
    writeFileSync(MANIFEST, `${JSON.stringify(recorded, null, 2)}\n`);
    return { status: 'written', ticks: frames.length, checkpoints: checkpoints.map(({ name, tick }) => ({ name, tick })), effects, hash: recorded.endDigest };
  } finally { fork?.dispose(); session.dispose(); }
}
export function checkpointsFresh(inputs: string): { status: string; inputs: string; recorded: string; ticks: number } {
  const m = manifest(); tape(m);
  for (const cp of m.checkpoints) if (hash(readFileSync(new URL(`${cp.name}.snap.gz`, DIR))) !== cp.sha) throw new Error(`Stale ${cp.name} checkpoint`);
  return { status: m.inputs === inputs ? 'fresh' : 'stale', inputs, recorded: m.inputs, ticks: m.ticks };
}
/** Fresh real runtime for exactly 10k ticks, including native navigation, then all 92 flared entry lanes. */
export async function headlessProof(rapier: Rapier): Promise<object> {
  const m = manifest(), frames = tape(m), session = await boot(rapier);
  try {
    const effects = play(session, frames, 10_000); sameEffects(effects, expected(m, 0, 10_000));
    const entries = session.proveEntries();
    if (entries.lanes !== 92 || !session.host.flags.has('shard:lookout')) throw new Error('Missing real lookout / four-entry proof');
    return { status: 'passed', ticksExecuted: 10_000, hash: digest(session), entries, facts: effects, nativeActors: session.host.entities.size, alive: true };
  } finally { session.dispose(); }
}
/** Each later gameplay window is bounded to 10k, resuming a committed native continuation once. */
export async function walkSlice(rapier: Rapier, name: string): Promise<object> {
  const m = manifest(), frames = tape(m), cp = m.checkpoints.find(row => row.name === name);
  if (cp === undefined) throw new Error('Unknown gameplay checkpoint');
  const until = Math.min(m.ticks, cp.tick + 10_000), session = await resume(rapier, cp);
  try {
    const effects = play(session, frames, until); sameEffects(effects, expected(m, cp.tick, until));
    if (until === m.ticks && !session.host.flags.has('quest:driftwood-done')) throw new Error('Reward not completed');
    return { status: 'passed', resumedTick: cp.tick, ticksExecuted: until - cp.tick, complete: session.host.flags.has('quest:driftwood-done'), hash: digest(session) };
  } finally { session.dispose(); }
}
/** Resume the real committed living Captain, capture it again, then compare its fight/reward and worker suffix.
 * The separate walk windows cover the prefix; replay spends its budget on the same mid-fight checkpoint only. */
export async function replayProof(rapier: Rapier): Promise<object> {
  const m = manifest(), frames = tape(m), cp = m.checkpoints.find(row => row.name === 'captain');
  if (cp === undefined) throw new Error('No real Captain checkpoint');
  const original = await resume(rapier, cp); let restored: TrustedHeadlessResident | undefined, worker: HeadlessSimulation | undefined;
  try {
    const captain = [...original.host.entities.values()].find(actor => actor.kind === 'captain');
    const encounter = original.host.adapters.get(CAPTAIN_STEP)?.snapshot();
    if (captain === undefined || !captain.alive || captain.hp >= 200 || typeof encounter !== 'string') throw new Error('Checkpoint is not the living mid-fight Captain');
    const hp = captain.hp, checkpoint = save(original); restored = await boot(rapier, checkpoint);
    if (digest(original) !== digest(restored)) throw new Error('Mid-fight restore not exact');
    worker = await HeadlessSimulation.create(source, assets, checkpoint, { deadline: 'advisory', trustedRuntime: { module: WORKER } });
    const until = Math.min(m.ticks, cp.tick + 1000), a: Recorded['effects'] = [], b: Recorded['effects'] = [];
    if (until - cp.tick > 10_000) throw new Error('Captain replay exceeded its 10k window');
    for (let i = cp.tick; i < until; i++) {
      const commands = frames[i]; if (commands === undefined) throw new Error('Missing Captain command');
      original.step(commands); restored.step(commands);
      a.push(...original.effects.map(effect => ({ tick: original.host.state.tick, effect })));
      b.push(...restored.effects.map(effect => ({ tick: original.host.state.tick, effect })));
      if (i < cp.tick + 60) {
        const commit = await worker.step([{ source: 'witness.tape', commands }]);
        if (JSON.stringify(commit.effects) !== JSON.stringify(restored.effects)) throw new Error('SDK worker effects diverged');
        if (i === cp.tick + 59) {
          const workerHash = canonicalSimDigest(commit.snapshot), expectedSnapshot = snapshotSimHost(restored.host), expectedHash = canonicalSimDigest(expectedSnapshot);
          if (workerHash !== expectedHash) throw simMismatchError('SDK worker continuation diverged', expectedSnapshot, commit.snapshot, { expected: expectedHash, actual: workerHash });
        }
      }
    }
    const endHash = digest(original), replayHash = digest(restored); sameEffects(a, b); sameEffects(a, expected(m, cp.tick, until));
    if (endHash !== replayHash || !original.host.flags.has('dead:captain') || !original.host.flags.has('quest:driftwood-done')) throw new Error('Captain continuation/reward diverged');
    return { status: 'passed', resumedFrom: cp.name, prefixTicks: 0, checkpointCaptured: true, checkpointTick: cp.tick, hp, encounter: JSON.parse(encounter) as unknown, suffixTicksExecuted: until - cp.tick, hash: endHash, replayHash, effects: a, workerTicks: 60, workerExact: true, victory: true };
  } finally { await worker?.dispose(); restored?.dispose(); original.dispose(); }
}

/** Real tick emissions for one bounded window, with its profile captured from the same continuous gameplay run. */
export async function ledgerProof(rapier: Rapier, name: string): Promise<object> {
  const m = manifest(), frames = tape(m), cp = m.checkpoints.find(row => row.name === name);
  if (cp === undefined) throw new Error('No gameplay ledger window');
  const session = await resume(rapier, cp), local = new ProfileStorage();
  for (const [key, value] of cp.profile) local.data.set(key, value);
  const ledger = profile(local), ingress = new FactIngress(ledger), receipts: LedgerReceipt[] = [];
  const until = Math.min(m.ticks, cp.tick + 10_000);
  try {
    const effects = play(session, frames, until); sameEffects(effects, expected(m, cp.tick, until));
    for (const row of effects) {
      if (row.effect.kind !== 'fact') continue;
      local.refused = receipts.length === 0;
      const emitted = ingress.ingest(row.tick, [row.effect]); receipts.push(...emitted);
      if (receipts.length === 1) {
        if (emitted[0]?.status !== 'pending' || ledger.flush()) throw new Error('Refused gameplay grant was credited durably');
        local.refused = false; if (!ledger.flush()) throw new Error('Gameplay grant retry failed');
      }
    }
    const state = ledger.state(), rows = Object.values(state.facts), reopened = profile(local);
    if (rows.length === 0 || receipts.length === 0 || JSON.stringify(reopened.state()) !== JSON.stringify(state) || rows.some(row => reopened.record(row).status !== 'duplicate')) throw new Error('Gameplay grants were not durable/deduplicated');
    if (until === m.ticks) for (const id of ['castaway', 'shards', 'sailor', 'quest']) {
      if (!Object.values(state.achievements).some(row => row.id === id && row.earned)) throw new Error(`Gameplay did not earn ${id}`);
    }
    return { status: 'passed', resumedTick: cp.tick, ticksExecuted: until - cp.tick, rules: source.ledger.length, facts: rows.map(row => ({ name: row.name, tick: row.tick, entity: row.entity, origin: row.origin })), achievements: Object.values(state.achievements), gameplayEmissionProven: true, refusedWriteRetried: true, durableReload: true, duplicateStable: true };
  } finally { session.dispose(); }
}
