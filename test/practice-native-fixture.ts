// oxlint-disable-next-line import/no-nodejs-modules -- Build one isolated admitted guest and load the retained real rig.
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Tiny fixtures stay under the repository scratch directory.
import { resolve } from 'node:path';
import { Bone, MeshStandardMaterial, Skeleton, SkinnedMesh, Vector3 } from 'three';
import { createConchReadablePreviewSource, createConchReadablePreviewOutput } from '../src/shards/driftwood-isle/generators/conchReadablePreview';
import { prepareProjectOutput, mergeProjectBlobs } from '../src/sdk/projectOutput';
import { emitNamedBlobs, nameBlob } from '../src/sdk/blobs';
import { writeOutputProduct } from '../src/sdk/outputProduct';
import { loadHeadlessProduct } from '../src/sdk/headlessProduct';
import { decisionLegacyLines } from '../scripts/decision-legacy-lines.mjs';
import { Scope } from '../src/engine/app/scope';
import { Events } from '../src/engine/events/events';
import { CombatPipeline } from '../src/engine/combat/pipeline';
import { createSimHost } from '../src/engine/sim';
import { loadRapier } from '../src/engine/physics/rapier';
import { speciesWithLook } from '../src/engine/entities/species/look';
import { NO_FUR } from '../src/engine/entities/species/rigs';
import { mergeAnimalGeometry } from '../src/engine/models/animalGeometry';
import { DEFAULT_CREATURE_RENDER, type AnimalModel, type AnimalRig } from '../src/engine/entities/AnimalFactory';
import { Animal } from '../src/engine/entities/AnimalView';
import { packedCreatureBodies } from '../src/game/plugin/geometry';
import { preparePracticeDecision } from '../src/game/practice/PracticeDecisions';
import { PracticeNativeActor, practiceNativeRecipe, practiceNativeSpawn } from '../src/game/practice/PracticeNativeActor';
import { PracticePlayer } from '../src/game/practice/PracticePlayer';
import { CONCH_NATIVE_JOINTS } from '../src/shards/driftwood-isle/generators/conchNativeClips';
import type { ClientChannelProgram } from '../src/format/clientChannels';
import type { ShardProduct } from '../src/game/shardfile/shardProduct';
import { SIM_LEVEL } from './fixtures/sim-level/level';

/** Test-only numeric authority witness, NOT an accepted Conch animation. Entry + kind makes every
 * synchronous applied contact distinguishable. Strike and measured displacement reads exercise the real ports. */
export function transitionRows(): { practiceTransition: { owner: 'isolated-practice'; joints: string[] };
  strikeIds: string[]; group: string; programs: ClientChannelProgram[] } {
  return { practiceTransition: { owner: 'isolated-practice', joints: [...CONCH_NATIVE_JOINTS] },
    strikeIds: ['strike.conch-duelist.thrust', 'strike.conch-duelist.counter'], group: 'practice.proof',
    programs: [{ id: 'practice.proof.head', reads: ['kind', 'entry', 'time', 'strike', 'distance'],
      nodes: [{ op: 'read', index: 0 }, { op: 'read', index: 1 }, { op: 'read', index: 2 },
        { op: 'add', a: 0, b: 1 }, { op: 'select', test: 0, yes: 3, no: 2 },
        { op: 'read', index: 3 }, { op: 'read', index: 4 }],
      channels: [{ property: 'x', value: 4 }, { property: 'pitch', value: 5 }, { property: 'roll', value: 6 }],
      numeric: { group: 'practice.proof', inputs: [
        { input: 'kind', owner: 'transition', path: ['kind'] }, { input: 'entry', owner: 'entry.head', path: ['position', 'x'] },
        { input: 'time', owner: 'frame', path: ['t'] }, { input: 'strike', owner: 'strike', path: ['phase'] },
        { input: 'distance', owner: 'motion', path: ['distance'] }], outputs: [
        { property: 'x', target: 'joint.head', path: ['position', 'x'] },
        { property: 'pitch', target: 'joint.head', path: ['rotation', 'x'] },
        { property: 'roll', target: 'joint.head', path: ['rotation', 'z'] }], restoreOnly: [] } }] };
}
const directory = 'art/driftwood-isle/approved-conch/runtime-admission/arena-candidate1';
const metadata: unknown = JSON.parse(readFileSync(`${directory}/metadata.json`, 'utf8'));
let root = '';
export async function prepareFixture(): Promise<ShardProduct> {
  mkdirSync('tmp', { recursive: true }); root = mkdtempSync(resolve('tmp/practice-native-proof-'));
  const source = createConchReadablePreviewSource('neutral-gray-v2'), output = createConchReadablePreviewOutput(metadata);
  const refusal = transitionRows();
  refusal.programs.push({ id: 'practice.proof.refusal', reads: ['kind'],
    nodes: [{ op: 'read', index: 0 }, { op: 'constant', value: 1e12 }, { op: 'mul', a: 0, b: 1 }],
    channels: [{ property: 'x', value: 2 }],
    numeric: { group: refusal.group, inputs: [{ input: 'kind', owner: 'transition', path: ['kind'] }],
      outputs: [{ property: 'x', target: 'joint.head', path: ['rotation', 'y'] }], restoreOnly: [] } });
  const extra = emitNamedBlobs([
    nameBlob('poses/native-proof.json', 'json', new TextEncoder().encode(JSON.stringify(transitionRows()))),
    nameBlob('poses/native-refusal.json', 'json', new TextEncoder().encode(JSON.stringify(refusal))),
  ]);
  const lines = decisionLegacyLines(resolve('.'), 'driftwood-isle');
  if (lines === undefined) throw new Error('Missing sealed decision budget');
  const prepared = await prepareProjectOutput(resolve('src/shards/driftwood-isle'), {
    ...output, namedFiles: [...output.namedFiles ?? [], ...extra.files], assets: new Map([...output.assets ?? [], ...extra.assets]),
  }, { source, options: { decisionLegacyLines: lines } });
  const merged = mergeProjectBlobs(source, prepared.assets, prepared.blobs, prepared.options.namedFiles);
  writeOutputProduct(merged.shard, merged.assets, root, { ...prepared.options, namedFiles: merged.namedFiles });
  return loadHeadlessProduct(root);
}
export function removeFixture(): void { if (root !== '') { rmSync(root, { recursive: true, force: true }); root = ''; } }
export async function fixture(product: ShardProduct): Promise<{ owner: Scope; outside: ReturnType<typeof createSimHost>;
  events: Events; combat: CombatPipeline; native: PracticeNativeActor; view: Animal; rig: AnimalRig; model: AnimalModel;
  player: PracticePlayer; tick: () => void }> {
  const owner = new Scope('native-proof'), outside = createSimHost({ ...SIM_LEVEL, entities: [], quests: [] },
    { scope: owner, rapier: await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm'))) });
  const events = new Events(), combat = new CombatPipeline(events, owner), species = product.section('actors/species-programs').program?.species[0];
  if (species?.brain?.archetype !== 'decision') throw new Error('Missing real admitted Conch');
  const decision = await preparePracticeDecision(product, species.brain.data.script, owner);
  const bodies = packedCreatureBodies(metadata, undefined, () => Promise.resolve(Uint8Array.from(readFileSync(`${directory}/payload.bin`))));
  await bodies.preload(); const parts = bodies.copy('conch-duelist', 'conch-duelist');
  const definition = speciesWithLook(species, { id: 'proof.look', species: species.id, kind: species.kind,
    rigContract: { skeleton: 'conch-duelist.character-native15', clips: [], sockets: ['body', 'head'] },
    fur: NO_FUR, rig: 'custom', rootFlinch: 'authored-pose', build: () => parts,
    animate: () => { throw new Error('The bound view must never evaluate a second pose'); } });
  const variant = definition.variants[0]; if (variant === undefined) throw new Error('Missing variant');
  const material = new MeshStandardMaterial(), geometry = mergeAnimalGeometry(parts.furParts, parts.hardParts, parts.eyeParts);
  const model: AnimalModel = { kind: species.kind, variant: variant.id, species: definition, variantDef: variant,
    style: 'toon', render: { ...DEFAULT_CREATURE_RENDER, furRim: false, oneMaterial: true },
    geometry, bones: parts.bones, dims: parts.dims, fur: material, hard: material, eye: material, shells: [] };
  const mesh = new SkinnedMesh(geometry, material), bones: Record<string, Bone> = {}, ordered: Bone[] = [];
  for (const row of parts.bones) {
    const bone = new Bone(); bone.name = row.name; bone.position.fromArray(row.pos); bones[row.name] = bone; ordered.push(bone);
    if (row.parent === null) mesh.add(bone);
    else { const parent = bones[row.parent], rest = parts.bones.find(value => value.name === row.parent);
      if (parent === undefined || rest === undefined) throw new Error('Missing real bind parent');
      bone.position.sub(new Vector3(...rest.pos)); parent.add(bone); }
  }
  mesh.updateMatrixWorld(true); mesh.bind(new Skeleton(ordered));
  const rig: AnimalRig = { mesh, bones, materials: [material] };
  const playerPort = { position: outside.player.position, yaw: outside.player.yaw, dodging: false,
    shove: () => undefined, impulse: () => undefined };
  const link: { native?: PracticeNativeActor } = {};
  const player = new PracticePlayer({ owner, events, combat, player: playerPort, now: () => (link.native?.host.clock.now ?? 0) * 1000 });
  const spawn = practiceNativeSpawn(model, 17, 1, { x: 0, y: 0, z: 3.1 }, Math.PI);
  const native: PracticeNativeActor = new PracticeNativeActor({ scope: owner, ports: { physics: outside.physics,
    player: { ...outside.player, health: player.health }, events, combat }, spawn, species,
    recipe: practiceNativeRecipe(model, rig), pose: JSON.parse(new TextDecoder().decode(await product.file('poses/native-proof.json'))), decision,
    observation: { get calm(): boolean { return player.defeated; }, reach: () => true, claim: () => true,
      hurt: amount => { player.hurt(native.actor, amount); } } });
  link.native = native;
  const instance = native;
  const view = new Animal(rig, model, spawn.seed, spawn.scale, spawn.id, { heightAt: () => 0, random: () => .5 }).bindSimulation(instance.actor);
  view.bindPublishedPose(instance.pose);
  owner.onDispose(() => { view.retireBody(); mesh.skeleton.dispose(); geometry.dispose(); material.dispose(); });
  return { owner, outside, events, combat, native: instance, view, rig, model, player,
    tick: () => { outside.physics.step(); instance.fixed(); player.update(1 / 60); } };
}
