import * as v from 'valibot';
import type { StrikeData } from '../../../src/engine/ai/strikeRows';
import { emptyShardfile } from '../../../src/sdk/author';
import { bakeSpecies } from '../../../src/sdk/bake/species';
import { emitNamedBlobs, nameBlob } from '../../../src/sdk/blobs';
import type { DecisionBuildOptions } from '../../../src/sdk/buildDecisionScripts';
import { encodeCanonicalJson, hashImmutableBytes } from '../../../src/sdk/immutable';
import { validateOutputProduct, writeOutputProduct, outputScriptAdmissionRows } from '../../../src/sdk/outputProduct';
import { admitProduct } from '../../../src/sdk/productOutput';
import { emitPlatformSections } from '../../../src/sdk/platformSections';
import { mergeProjectBlobs, prepareProjectOutput, type ProjectOutput } from '../../../src/sdk/projectOutput';
import { parseShardfile, type Shardfile } from '../../../src/sdk/shardfile';
import type { BrainedSpecies } from '../../../src/sdk/speciesBrains';
import type { PlatformDataSectionName } from '../../../src/format/platformDataSections';
import { readSpeciesProgram } from '../../../src/format/speciesPrograms';
import practiceLooks from '../../../src/shards/driftwood-isle/data/practiceLooks.json' with { type: 'json' };
import pickupCatalogue from '@wildshard/game/data/pickupCatalogue' with { type: 'json' };
import authoredGraphs from '../../../src/shards/driftwood-isle/data/lookGraphs.json' with { type: 'json' };
import heldArms from '../../../src/shards/driftwood-isle/data/heldArms.json' with { type: 'json' };
import neutralGrayLighting from '../../../src/shards/driftwood-isle/data/practiceNeutralGrayLighting.json' with { type: 'json' };
import { CRAB_BRAIN_PROFILE } from '../../../src/shards/driftwood-isle/generators/brains';
import { prototypeDefinition, type PrototypeId } from './catalogue';
import { prototypePose } from './pose';

const materials = ['driftwood-creature', 'driftwood-creature-glowing', 'driftwood-fp-arms', 'driftwood-fp-wood', 'driftwood-fp-iron', 'driftwood-fp-swim'] as const;
const lighting = neutralGrayLighting['neutral-gray-v2'];
const metadataSchema = v.looseObject({ file: v.string(), bodies: v.array(v.looseObject({ kind: v.string(), variant: v.string(),
  bones: v.array(v.looseObject({ name: v.string() })), dims: v.looseObject({ bodyY: v.number(), rigidCorpse: v.optional(v.unknown()) }) })) });

/** Transform only the explicit prototype policy: retain all geometry, weights, normals and bind joints.
 * Unsupported custom corpse requests are omitted because the prototype dies by despawning. */
export function prototypeMetadata(id: PrototypeId, bytes: Uint8Array): v.InferOutput<typeof metadataSchema> {
  const definition = prototypeDefinition(id);
  if (hashImmutableBytes(bytes) !== definition.metadataSha256) throw new Error(`Wrong retained ${id} source metadata`);
  const source = v.parse(metadataSchema, JSON.parse(new TextDecoder().decode(bytes)));
  const body = source.bodies[0];
  if (source.bodies.length !== 1 || body === undefined || body.kind !== definition.kind || body.variant !== definition.variant
    || source.file !== definition.bodyFile) throw new Error('Prototype source identity differs');
  const dims = { ...body.dims };
  delete dims.rigidCorpse;
  if (definition.hoverHeight > 0) dims.bodyY = definition.hoverHeight;
  return { ...source, bodies: [{ ...body, dims }] };
}

export function prototypeCombat(id: PrototypeId): { species: BrainedSpecies; strikes: StrikeData[] } {
  const row = prototypeDefinition(id);
  const strike = `strike.prototype.${row.id}`;
  const duration = 1.2;
  const strikes: StrikeData[] = [{ id: strike, shape: { kind: 'arc' as const, radius: row.reach, halfAngle: .9 },
    range: row.reach, damage: row.damage, windup: .65, active: .15, recover: .4, cooldown: 1.5,
    units: 'world' as const, tags: ['cover.checked'], weight: { kind: 'constant' as const, value: 1 } }];
  const species: BrainedSpecies = { id: `creature.${row.kind}`, kind: row.kind, label: row.label,
    aggressive: true, lockable: true, walkSpeed: row.speed, chargeDamage: row.damage, corpseFade: 0, tick: 'ai',
    variants: [{ id: row.variant, label: row.label, rarity: 'common', weight: 1, scale: [row.scale, row.scale], hp: row.hp }],
    brain: { archetype: 'stalker', data: { ...CRAB_BRAIN_PROFILE, id: `brain.prototype.${id}`, awareRadius: 30,
      disengageRadius: 40, holdRadius: row.reach * .85, attackRadius: row.reach * .9,
      attackDuration: duration, attackCooldown: 1.5, subordinateVariant: 'none', leaderVariant: row.variant } },
    body: { kind: 'animal', motion: 'ground', attack: 'keeper', stunned: 'none', contact: { kind: 'environment', halfArc: .9 },
      actions: { stateKey: 'st', states: ['idle', 'sidestep', 'attack', 'flee'], actions: [{ state: 2, phase: .65 / duration,
        strike, damage: 'charge', once: { key: 'hit', value: 1, test: 'falsy' } }] } } };
  return { species, strikes };
}

/** Separate practice source, without world placement or persistent economy authority. */
export function createPrototypeSource(id: PrototypeId): Shardfile {
  const row = prototypeDefinition(id);
  const base = emptyShardfile({ slug: 'driftwood-isle', name: row.label, author: 'Wildshard', revision: 1, seed: 0x5ea1 });
  return parseShardfile({ ...base, look: { ...base.look,
    familyLooks: { ...base.look.familyLooks, toon: lighting.toon },
    materials: Object.fromEntries(materials.map(name => [name, { family: 'graph', graph: authoredGraphs.looks[name] }])) },
    runtime: { entry: 'runtime/hybrid.ts', binds: ['spawns', 'loot'], spawns: { homes: [], bosses: [], actors: [
      { id: `prototype.${row.id}`, kind: row.kind, look: row.variant, at: [0, 0], yaw: 0 } ] } },
    rows: { ...base.rows, loot: [{ id: 'driftwood.practice.loot', gear: 'purse.coins', finds: null, marks: null,
      charted: false, chime: 'cue.loot.chime', economy: { tables: [{ id: 'loot.driftwood.coins', domain: 'coins',
        table: { mode: 'each', rows: [{ item: 'coin', weight: 1, count: 5, match: { kind: row.kind } }] } }],
        effects: [], goods: [], grants: { player: [], worn: [], weapons: [] }, finds: { counters: [], sections: [] }, marks: [] } }] } });
}

export function createPrototypeOutput(id: PrototypeId, metadataBytes: Uint8Array): ProjectOutput {
  const row = prototypeDefinition(id), metadata = prototypeMetadata(id, metadataBytes);
  const body = metadata.bodies[0];
  if (body === undefined) throw new Error('Missing prototype body');
  const poseFile = `poses/prototype-${id}.json`;
  const looks = [{ id: `driftwood.look.${row.kind}`, species: `creature.${row.kind}`, kind: row.kind, pose: poseFile,
    rootFlinch: 'authored-pose', rigContract: { skeleton: `${row.kind}.prototype.v1`, clips: [], sockets: ['body', 'head'] } }];
  const files: readonly (readonly [string, unknown])[] = [
    ['practice/looks.json', { ...practiceLooks, looks, arenaLighting: { profile: 'neutral-gray-v2', ...lighting.hemisphere } }],
    ['practice/bodies.json', metadata],
    ['practice/pickups.json', { ...pickupCatalogue, looks: [], geometries: pickupCatalogue.geometries.filter(part => part.key === pickupCatalogue.coin) }],
    [poseFile, prototypePose(id, body.bones.map(bone => bone.name), body.dims.bodyY)],
    ['practice/prototype.json', { status: 'WIP prototype', qualityComplete: false, originalNativeAdmission: false,
      description: row.description, sourceMetadataSha256: row.metadataSha256, payloadSha256: row.payloadSha256, death: 'despawn' }],
  ];
  const named = emitNamedBlobs(files.map(([name, value]) => nameBlob(name, 'json', new TextEncoder().encode(encodeCanonicalJson(value)))));
  const { species, strikes } = prototypeCombat(id);
  const { arms, wood, iron, swim } = heldArms.look.materials;
  return { namedFiles: named.files, assets: named.assets,
    platform: emitPlatformSections(new Map<PlatformDataSectionName, unknown>([
      ['actors/species-programs', { page: [], native: [], program: readSpeciesProgram({ species: [Object.assign(bakeSpecies(species, species.id), { brain: species.brain, body: species.body })], strikes }) }],
      ['actors/moves', []], ['actors/strikes', strikes], ['sim/scripts', []],
      ['held/arms', { ...heldArms, look: { ...heldArms.look, materials: { arms, wood, iron, swim } }, weapons: heldArms.weapons.filter(item => item.blade === 'wood'), cards: [], claims: [] }],
    ])) };
}

/** Normal SDK preparation/admission plus disk validation; no manufactured native admission receipt. */
export async function buildPrototypeProduct(id: PrototypeId, project: string, destination: string, options: DecisionBuildOptions, metadataBytes: Uint8Array): Promise<ReturnType<typeof validateOutputProduct>> {
  const source = createPrototypeSource(id);
  const prepared = await prepareProjectOutput(project, createPrototypeOutput(id, metadataBytes), { source, options });
  const merged = mergeProjectBlobs(source, prepared.assets, prepared.blobs, prepared.options.namedFiles);
  admitProduct(merged.shard, merged.assets, 'refuse', outputScriptAdmissionRows(prepared.options.platform));
  writeOutputProduct(merged.shard, merged.assets, destination, { ...prepared.options, namedFiles: merged.namedFiles });
  return validateOutputProduct(destination);
}
