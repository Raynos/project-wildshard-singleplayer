// oxlint-disable-next-line import/no-nodejs-modules -- Reads the two authored guest fixtures for real Wasm compilation.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, test } from 'vitest';
import { Bone, Vector3 } from 'three';
import { DecisionHost, type DecisionScript } from '../src/engine/script/decision';
import { createScriptScenario, type ScriptScenario } from '../src/sdk/scriptScenario';
import { compileDecisionScripts } from '../src/sdk/buildDecisionScripts';
import { generateDecisionBindings } from '../src/sdk/decisionScriptBindings';
import { numericCreaturePose } from '../src/game/plugin/channelPrograms';
import type { AnimalRigContext } from '../src/engine/entities/animalRig';
import { StrikeRunner, type StrikeActor, type StrikeSpec } from '../src/engine/ai/strikes';
import { readSpeciesProgram } from '../src/format/speciesPrograms';
import { bakeSpecies } from '../src/sdk/bake/species';
import { buildBellback, buildTideRootColossus } from '../src/shards/driftwood-isle/generators/tidalGiantsBodies';
import { BELLBACK_CLIPS, TIDE_ROOT_COLOSSUS_CLIPS } from '../src/shards/driftwood-isle/generators/tidalGiantsClips';
import { TIDAL_GIANTS_SPECIES, TIDAL_GIANTS_STRIKES, TIDAL_GIANTS_FIELDS, TIDAL_GIANTS_MOVES, TIDAL_GIANTS_DECISIONS, TIDAL_GIANTS_BOUNTIES } from '../src/shards/driftwood-isle/generators/tidalGiantsCombat';

const registries = { actors: new Map([['driftwood.bellback', 1], ['driftwood.colossus', 2]]),
  moves: new Map(TIDAL_GIANTS_MOVES.map((r, i) => [r.id, i + 1])), strikes: new Map(TIDAL_GIANTS_STRIKES.map((r, i) => [r.id, i + 1])),
  fields: new Map(TIDAL_GIANTS_FIELDS.map(r => [r.name, r.id])) };
let compiled: Awaited<ReturnType<typeof compileDecisionScripts>>;
beforeAll(async () => {
  compiled = await compileDecisionScripts(TIDAL_GIANTS_DECISIONS, registries,
    new Map(TIDAL_GIANTS_DECISIONS.map(r => [r.source, readFileSync(`src/shards/driftwood-isle/${r.source}`, 'utf8')])), { asLineCeiling: 300 });
});
function scenario(index: number, hpShare = 1): ScriptScenario {
  const row = compiled.rows[index], actor = index + 1;
  if (row === undefined) throw new Error('Missing giant decision');
  const blob = compiled.blobs.find(b => b.file.path === row.module); if (blob === undefined) throw new Error('Missing Wasm');
  const generated = generateDecisionBindings(row, registries);
  const script: DecisionScript = { ...row, reads: ['nearestPlayer', 'distance', 'hpShare', 'strikeState', 'stunned', 'alive'], lists: [], ids: generated.map.ids };
  return createScriptScenario(DecisionHost, { bytes: blob.bytes, script, seed: 487,
    binding: { id: 1, script: row.id, self: actor, actors: [actor], instance: 0 },
    actors: [{ id: actor, at: [0, 0, 0], hpShare, fields: Object.fromEntries(TIDAL_GIANTS_FIELDS.map(f => [f.id, f.default])) }],
    players: [{ id: 99, at: [0, 0, 2] }] });
}
function observation(s: ScriptScenario, patch: { strikeState?: number; stunned?: boolean; hpShare?: number; alive?: boolean }): void {
  const actor = s.world.snapshot().actors?.[0]; if (actor === undefined) throw new Error('No body'); s.world.setActor({ ...actor, ...patch });
}
function start(s: ScriptScenario): void { s.send('start'); s.advance(1.2); expect(s.host.metrics()[0]?.refusals).toBe(0); }
function finish(s: ScriptScenario, strike: string): void { observation(s, { strikeState: 0 }); s.send('strike.done', 'self', strike, false); }

test('giant metadata admits real distinct decision bodies and six bounded strikes', () => {
  const program = readSpeciesProgram({ species: TIDAL_GIANTS_SPECIES.map(row => Object.assign(bakeSpecies(row, row.id), { brain: row.brain, body: row.body })), strikes: TIDAL_GIANTS_STRIKES });
  expect(program.species.map(s => s.variants[0]?.hp)).toEqual([180, 480]);
  expect(program.strikes).toHaveLength(6); expect(TIDAL_GIANTS_BOUNTIES).toEqual({ bellback: 12, tideRootColossus: 35 });
  expect(program.species[1]?.brain).toMatchObject({ data: { guard: { field: 'tg-exposed', multiplier: 1.5 } } });
});
test('Bellback rings then announces the outer echo; a poise break or real stun clears the sequence', () => {
  const s = scenario(0); start(s); expect(s.state()).toMatchObject({ step: 1 });
  finish(s, 'pulse'); expect(s.commands()).toContainEqual(['strike', 'self', 'echo', 99]); expect(s.state()).toMatchObject({ step: 2 });
  const poise = scenario(0); start(poise); poise.send('hit', 'self', 99, 18, .9);
  expect(poise.state()).toMatchObject({ step: 4, sequence: 0 }); expect(poise.commands().filter(c => c[0] === 'strike')).toEqual([]);
  const stun = scenario(0); start(stun); observation(stun, { stunned: true, strikeState: 0 }); finish(stun, 'pulse');
  expect(stun.state()).toMatchObject({ step: 4, sequence: 0 }); expect(stun.commands().filter(c => c[0] === 'strike')).toEqual([]);
});
test('Colossus alternates sweep/slam, adds a separately told second sweep below55%, and exposes on slam recovery', () => {
  const s = scenario(1); start(s); expect(s.state()).toMatchObject({ step: 1 });
  finish(s, 'left'); s.advance(.9); expect(s.commands()).toContainEqual(['strike', 'self', 'slam', 99]);
  observation(s, { strikeState: 3 }); s.advance(.2);
  expect(s.world.snapshot().actors?.[0]?.fields?.[114]).toBe(1);
  finish(s, 'slam'); expect(s.world.snapshot().actors?.[0]?.fields?.[114]).toBe(0);
  const phase2 = scenario(1, .5); start(phase2); finish(phase2, 'left');
  expect(phase2.commands()).toContainEqual(['strike', 'self', 'right', 99]);
  const phase3 = scenario(1, .2); start(phase3); finish(phase3, 'left'); finish(phase3, 'right');
  expect(phase3.commands()).toContainEqual(['strike', 'self', 'slam', 99]);
  expect(phase3.host.metrics()[0]?.refusals).toBe(0);
});
test('death clears pending echoes and heart exposure without rewards or adds in guest commands', () => {
  for (const index of [0, 1]) {
    const s = scenario(index); start(s); observation(s, { alive: false }); s.send('death', 'self', 99);
    expect(s.state()).toMatchObject({ step: 6 }); expect(s.commands()).toContainEqual(['field', 'self', 'awake', 0]);
    expect(s.commands().filter(c => ['strike', 'spawn', 'reward', 'grant'].includes(String(c[0])))).toEqual([]);
    s.advance(3); expect(s.state()).toMatchObject({ step: 6 });
    expect(s.commands().filter(c => c[0] === 'strike')).toEqual([]);
  }
});
function strikeSpec(id: string): StrikeSpec {
  const row = readSpeciesProgram({ species: [], strikes: TIDAL_GIANTS_STRIKES }).strikes.find(s => s.id === id);
  if (row === undefined) throw new Error('No strike'); return { ...row, weight: () => 1 };
}
function makeActor(): StrikeActor & { alive: boolean } { return { position: { x: 0, y: 0, z: 0 }, alive: true, yaw: 0, scale: 1,
  startAttack: () => undefined, cancelAttack: () => undefined, setMotion: () => undefined }; }
test('pulse and echo have different safe bands; cover, once-only impact and death cancellation use the real runner', () => {
  for (const [id, inside, outside] of [['pulse', 1, 3.5], ['echo', 3.5, 1]] as const) {
    const spec = strikeSpec(`strike.bellback.${id}`), runner = new StrikeRunner(), a = makeActor(); let hits = 0;
    const target = { x: 0, y: 0, z: inside }, context = { actor: a, target, canReach: () => true, hit: () => { hits++; } };
    expect(runner.contains(spec, context)).toBe(true); expect(runner.contains(spec, { actor: a, target: { x: 0, y: 0, z: outside } })).toBe(false);
    expect(runner.contact(spec, { ...context, canReach: () => false })).toBe(false);
    runner.start(spec, a, target); for (let i = 0; i < 180; i++) runner.update(1 / 60, context); expect(hits).toBe(1);
    runner.start(spec, a, target); a.alive = false; runner.update(1 / 60, context); expect(runner.busy).toBe(false); expect(hits).toBe(1);
  }
});
test('aimed slam is committed and narrow; opposite root sweep has the opposite safe side', () => {
  const runner = new StrikeRunner(), a = makeActor(), slam = strikeSpec('strike.colossus.slam'); runner.start(slam, a, { x: 0, y: 0, z: 4 });
  expect(runner.contains(slam, { actor: a, target: { x: 0, y: 0, z: 4 } })).toBe(true);
  expect(runner.contains(slam, { actor: a, target: { x: 2, y: 0, z: 4 } })).toBe(false);
  const side = { actor: a, target: { x: 3, y: 0, z: 1 } };
  expect(runner.contains(strikeSpec('strike.colossus.left'), side)).toBe(true);
  expect(runner.contains(strikeSpec('strike.colossus.right'), side)).toBe(false);
});
function rig(body: ReturnType<typeof buildBellback>): AnimalRigContext {
  const mem = {}, position = new Vector3();
  return { bones: Object.fromEntries(body.bones.map(b => [b.name, new Bone()])), dims: body.dims,
    dt: 1 / 60, t: 1, seed: .7, scale: 1, speed: .8, strafe: 0, phase: .3, state: 'attack', alive: true,
    deathT: -1, flinch: .2, brace: .3, attack: -1, lookTarget: new Vector3(0, 0, 2), lookWeight: 1,
    position, yaw: 0, mem, animal: { mem, position, yOffset: 0 } };
}
test('both bodies have finite bounded skinning, independent rigs, changing tells and complete death poses', () => {
  for (const [build, clips] of [[buildBellback, BELLBACK_CLIPS], [buildTideRootColossus, TIDE_ROOT_COLOSSUS_CLIPS]] as const) {
    const body = build(), pose = numericCreaturePose(clips), c = rig(body), names = new Set(body.bones.map(b => b.name));
    expect(names.size).toBe(body.bones.length);
    for (const b of body.bones) expect(b.parent === null || names.has(b.parent)).toBe(true);
    for (const g of [...body.hardParts, ...body.eyeParts]) {
      g.computeBoundingBox(); expect(g.boundingBox?.max.y).toBeLessThan(4);
      const skin = g.getAttribute('skinIndex'), weights = g.getAttribute('skinWeight');
      for (let i = 0; i < skin.count; i++) { expect(skin.getX(i)).toBeLessThan(body.bones.length); expect(weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i)).toBeCloseTo(1); }
      for (const value of g.getAttribute('position').array) expect(Number.isFinite(value)).toBe(true);
    }
    for (let step = 0; step < 7; step++) for (const clock of [0, .4, .9, 1.2, 1.6]) for (const death of [-1, .5, 1]) {
      Object.assign(c.mem, { 'tg-state': step, 'tg-clock': clock, 'tg-exposed': step === 3 ? 1 : 0 }); c.deathT = death; pose(c);
      for (const b of Object.values(c.bones)) for (const v of [b.rotation.x, b.rotation.y, b.rotation.z, b.position.y, b.scale.x, b.scale.y, b.scale.z]) expect(Number.isFinite(v)).toBe(true);
    }
    for (const g of [...body.hardParts, ...body.eyeParts]) g.dispose();
  }
});

// The actual skeleton matrix must put the striking root tips inside the admitted narrow lane.
test('Colossus active slam roots converge on the lane and reach its endpoint', () => {
  const body = buildTideRootColossus(), c = rig(body), pose = numericCreaturePose(TIDE_ROOT_COLOSSUS_CLIPS);
  const bones = Object.fromEntries(body.bones.map(def => [def.name, new Bone()]));
  for (const def of body.bones) {
    const bone = bones[def.name]; if (bone === undefined) throw new Error('Missing joint');
    bone.position.set(...def.pos);
    if (def.parent !== null) {
      const parent = bones[def.parent], parentDef = body.bones.find(p => p.name === def.parent);
      if (parent === undefined || parentDef === undefined) throw new Error('Missing parent');
      bone.position.sub(new Vector3(...parentDef.pos)); parent.add(bone);
    }
  }
  c.bones = bones; c.flinch = 0; c.brace = 0; c.speed = 0; c.deathT = -1;
  Object.assign(c.mem, { 'tg-state': 3, 'tg-clock': 1.2, 'tg-exposed': 0 }); pose(c);
  bones['body']?.updateMatrixWorld(true);
  const runner = new StrikeRunner(), a = makeActor(), slam = strikeSpec('strike.colossus.slam'); runner.start(slam, a, { x: 0, y: 0, z: 6 });
  for (const i of [0, 3]) {
    const angle = Math.PI / 4 + i * Math.PI / 2;
    const tip = bones[`tip${i}`]; if (tip === undefined) throw new Error('Missing slam root');
    const end = new Vector3(Math.sin(angle) * .55, -.06, Math.cos(angle) * .55).applyMatrix4(tip.matrixWorld);
    expect(Math.abs(end.x)).toBeLessThan(.8); expect(end.z).toBeGreaterThan(6); expect(end.z).toBeLessThan(6.25);
    expect(runner.contains(slam, { actor: a, target: end })).toBe(true);
  }
  for (const g of [...body.hardParts, ...body.eyeParts]) g.dispose();
});
