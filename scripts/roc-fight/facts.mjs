#!/usr/bin/env node
// G393 baseline (sp-o130): the canonical Storm Roc fight's facts from Sky Reach's whole-shard witness tape
// (test/proof/far-reach/witness.ts, G354's 26,469-tick journey), read from a source tree without touching it. It boots the
// tree's own headless plan and runs its own `SkyTape` from the spawn tick by tick, exactly as the witness's `play` does
// (same boot, same lent commands, same AFTER = 120 ticks past the Roc's fall), and only observes: the tick the crown leg
// starts, every encounter change (state / phase / attempts), the Roc's HP every 600 ticks and at each change, the
// player's hits taken, the Roc's stoops (its body below the crown's deck + 3 m), the flock's live count, and the
// endpoint. Deterministic: plain Node, portable math, no wall clock.
//   node --import <tree>/scripts/sim-node-loader.mjs scripts/roc-fight/facts.mjs [--tree=<checkout>] [--output=<facts.json>]
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const arg = (/** @type {string} */ name) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const tree = pathToFileURL(`${resolve(arg('tree') ?? process.cwd())}/`);
const output = arg('output');
const at = (/** @type {string} */ path) => new URL(path, tree).href;

const { installPortableMath } = await import(at('test/fake/portableMath.ts')); installPortableMath();
const { installAppIdentity } = await import(at('src/engine/app/identity.ts'));
const { WILDSHARD_IDENTITY } = await import(at('src/game/identity.ts'));
installAppIdentity(WILDSHARD_IDENTITY);
const witness = await import(at('test/proof/far-reach/witness.ts'));
const { createSimHost } = await import(at('src/engine/sim.ts'));
const { canonicalSimDigest } = await import(at('test/fake/simState.ts'));
const { snapshotSimHost } = await import(at('src/engine/sim/snapshot.ts'));
const { ROC_ID, ROC_STEP } = await import(at('src/shards/far-reach/data/rocFight.ts'));
const { CROWN } = await import(at('src/shards/far-reach/data/layout.ts'));
const { FLAGS } = await import(at('src/shards/far-reach/quest/flags.ts'));

const LIMIT = 60_000, AFTER = 120, HP_EVERY = 600;
const rapier = await witness.skyRapier(), plan = await witness.skyPlan(rapier);
/** @type {{ tape: readonly unknown[]; tick: unknown[]; effects: unknown[] }} */
const session = { tape: [], tick: [], effects: [] };
const host = createSimHost(plan.level, { ...plan.ports, rapier });
plan.install(host, { restoring: false, commands: () => session.tape, emit: (/** @type {unknown} */ effect) => { session.tick.push(effect); } });
const tape = new witness.SkyTape();

/** The encounter row's continuation (state / phase / attempts), or null when the tree keeps it elsewhere. */
function encounter() {
  const saved = host.adapters.get(ROC_STEP)?.snapshot();
  if (typeof saved !== 'string') return null;
  const boss = /** @type {{ boss?: { state?: string; phase?: number; attempts?: number } }} */ (JSON.parse(saved)).boss;
  return boss === undefined ? null : { state: String(boss.state), phase: Number(boss.phase), attempts: Number(boss.attempts) };
}
const round = (/** @type {number} */ n) => Math.round(n * 100) / 100;
const roc = () => host.entities.get(ROC_ID);
const flockAlive = () => [...host.entities.values()].filter(actor => actor.entityId !== ROC_ID && actor.alive).length;

/** @type {{ tick: number; state: string; phase: number; attempts: number; rocHp: number | null; playerHp: number }[]} */
const changes = [];
/** @type {{ tick: number; rocHp: number | null; phase: number | null; flockAlive: number; playerHp: number; roc: number[] | null; player: number[] }[]} */
const samples = [];
/** @type {{ tick: number; damage: number; playerHp: number }[]} */
const hits = [];
/** @type {number[]} */
const stoops = [];
/** loop-carried observation state */
const seen = { last: '', hp: host.player.health.attributes.health, grounded: false, minHp: host.player.health.attributes.health };
let crownTick = null, victoryTick = null;
for (let i = 0; i < LIMIT; i++) {
  const commands = tape.next(host);
  session.tape = commands; session.tick = [];
  let player;
  for (const command of commands) if (command.kind === 'player') player = command;
  try {
    host.step(player === undefined ? undefined : { moveX: player.moveX, moveZ: player.moveZ, yaw: player.yaw,
      ...(player.attack === undefined ? {} : { attack: player.attack }), ...(player.hover === undefined ? {} : { hover: player.hover }) });
  } finally { session.tape = []; }
  session.effects.push(...session.tick);
  const tick = host.state.tick, hp = host.player.health.attributes.health, body = roc();
  if (crownTick === null && tape.walked) crownTick = tick;
  if (hp < seen.hp) hits.push({ tick, damage: round(seen.hp - hp), playerHp: round(hp) });
  seen.hp = hp; seen.minHp = Math.min(seen.minHp, hp);
  if (crownTick !== null) {
    const e = encounter(), key = e === null ? '' : `${e.state}/${String(e.phase)}/${String(e.attempts)}`;
    if (e !== null && key !== seen.last) { changes.push({ tick, ...e, rocHp: body === undefined ? null : round(body.hp), playerHp: round(hp) }); seen.last = key; }
    const low = body !== undefined && body.alive && body.position.y < CROWN.y + 3;
    if (low && !seen.grounded) stoops.push(tick);
    seen.grounded = low;
    if ((tick - crownTick) % HP_EVERY === 0) samples.push({ tick, rocHp: body === undefined ? null : round(body.hp), phase: e?.phase ?? null, flockAlive: flockAlive(), playerHp: round(hp),
      roc: body === undefined ? null : [body.position.x, body.position.y, body.position.z].map(round), player: [host.player.position.x, host.player.position.y, host.player.position.z].map(round) });
  }
  if (victoryTick === null && host.flags.has(FLAGS.roc)) victoryTick = tick;
  if (victoryTick !== null && tick >= victoryTick + AFTER) break;
}
if (crownTick === null || victoryTick === null) throw new Error(`No Roc fight to its fall within ${String(LIMIT)} ticks`);
const fightStart = crownTick, fightHits = hits.filter(hit => hit.tick >= fightStart);
const facts = {
  source: 'test/proof/far-reach/witness.ts SkyTape from the spawn (headless, portable math)',
  endpointTick: host.state.tick, victoryTick, crownTick, fightTicks: victoryTick - crownTick, hash: canonicalSimDigest(snapshotSimHost(host)),
  attempts: changes.at(-1)?.attempts ?? null, changes, fightHitsTaken: fightHits.length, fightDamageTaken: round(fightHits.reduce((n, h) => n + h.damage, 0)),
  journeyHitsTaken: hits.length - fightHits.length, minPlayerHp: round(seen.minHp),
  stoops: stoops.length, stoopTicks: stoops, rocHpEvery: HP_EVERY, samples, hits,
  effects: Object.fromEntries([...session.effects.reduce((/** @type {Map<string, number>} */ m, /** @type {{ kind: string; name?: string }} */ e) => m.set(e.kind === 'fact' ? `fact:${String(e.name)}` : e.kind, (m.get(e.kind === 'fact' ? `fact:${String(e.name)}` : e.kind) ?? 0) + 1), new Map())].sort((x, y) => (x[0] < y[0] ? -1 : 1))),
};
host.dispose();
const text = `${JSON.stringify(facts, null, 1)}\n`;
if (output === undefined) process.stdout.write(text); else writeFileSync(output, text);
