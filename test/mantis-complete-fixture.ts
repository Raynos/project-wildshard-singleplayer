// oxlint-disable-next-line import/no-nodejs-modules -- Reads the retained exact product and native geometry, without rebuilding.
import { readFileSync } from 'node:fs';
import { Bone, Vector3 } from 'three';
import * as v from 'valibot';
import { loadHeadlessProduct } from '../src/sdk/headlessProduct';
import { outputDescriptor } from '../src/game/shardfile/outputDescriptor';
import { borrowedDecisionAuthority } from '../src/game/shardfile/borrowedDecisions';
import { parseDecisionScripts } from '../src/format/decisionScripts';
import { loadRapier } from '../src/engine/physics/rapier';
import { createSimHost } from '../src/engine/sim';
import type { AnimalSim } from '../src/engine/entities/AnimalSim';
import type { BorrowedSpeciesControl } from '../src/game/plugin/brain';
import type { Shardfile } from '../src/format/shardSchema';
import type { AnimalRigContext } from '../src/engine/entities/animalRig';
import { SIM_LEVEL } from './fixtures/sim-level/level';

const root = 'tmp/mantis-precontact-native-capture1/product';
export const native = v.parse(v.object({ bones: v.array(v.object({ name: v.string(), parent: v.nullable(v.string()),
  pos: v.tuple([v.number(), v.number(), v.number()]) })), parts: v.array(v.object({ name: v.string(), positions: v.array(v.number()),
    skinIndices: v.array(v.number()), skinWeights: v.array(v.number()) })) }),
JSON.parse(readFileSync('art/driftwood-isle/lowpoly-mantis/runtime-admission/v7-rigid1/mantis-v7-native.json', 'utf8')));
export function poseContext(animal?: AnimalRigContext['animal']): AnimalRigContext & { bones: Record<string, Bone> } {
  const bones: Record<string, Bone> = {};
  for (const def of native.bones) {
    const b = new Bone(); b.name = def.name; b.position.fromArray(def.pos);
    if (def.parent !== null) {
      const parent = bones[def.parent], rest = native.bones.find(row => row.name === def.parent);
      if (parent === undefined || rest === undefined) throw new Error('Missing native parent');
      b.position.sub(new Vector3(...rest.pos)); parent.add(b);
    }
    bones[def.name] = b;
  }
  const owner = animal ?? { mem: {}, position: new Vector3(), yOffset: 0 };
  return { bones, dims: { bodyY: native.bones[0]?.pos[1] ?? 0, bodyHalfLen: 0, bodyRadius: 0, headRadius: 0,
    legLen: 1.4, feet: [], halfWidth: 0 }, dt: 1/60, t: 0, seed: .7, scale: 1, speed: 0, strafe: 0, phase: 0,
    state: 'idle', alive: true, deathT: -1, flinch: 0, brace: 0, attack: -1, lookTarget: new Vector3(), lookWeight: 0,
    position: owner.position, yaw: 0, mem: owner.mem, animal: owner };
}
export function locals(context: AnimalRigContext): Record<string, number[]> {
  return Object.fromEntries(Object.entries(context.bones).map(([name,b]) => [name,[...b.position,b.rotation.x,b.rotation.y,b.rotation.z,...b.scale]]));
}
export async function fixture(group = false): Promise<{
  host: ReturnType<typeof createSimHost>; actor: AnimalSim; control: BorrowedSpeciesControl;
  scope: ReturnType<typeof createSimHost>['scope']; damage: number[]; context: ReturnType<typeof poseContext>;
  source: Shardfile; sections: Map<string, unknown>; assets: Map<string, Uint8Array>;
}> {
  const product = await loadHeadlessProduct(root), descriptor = outputDescriptor(product.shardfile);
  if (descriptor?.index.build.sourceHash !== '123eab925eca95a5275637259803235c85c670cb85c184e186334a3c24f8c9f7') throw new Error('Wrong preserved product');
  const source = structuredClone(product.shardfile), sections = new Map(descriptor.sections);
  const scripts = parseDecisionScripts(sections.get('sim/scripts')), script = scripts[0];
  if (script === undefined) throw new Error('Missing exact guest');
  if (group) { script.binding = { spawnGroup: 'motion.test' }; script.state = script.state.map(row => ({ ...row, scope: 'actor' as const })); }
  sections.set('sim/scripts', scripts);
  const assets = new Map(descriptor.index.files.map(file => [file.hash, Uint8Array.from(readFileSync(`${root}/${file.path}`))]));
  const original = SIM_LEVEL.entities[0]; if (original === undefined) throw new Error('Missing fixture');
  const id = 'driftwood.splinter-mantis';
  const host = createSimHost({ ...SIM_LEVEL, quests: [], entities: [{ id, seed: original.seed, scale: original.scale, yaw: original.yaw, at: { x: 0, y: 0, z: 3.1 },
    spec: { ...original.spec, kind: 'splinter-mantis', hp: 55 } }] },
  { rapier: await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm'))) });
  const actor = host.entities.get(id); if (actor === undefined) throw new Error('Missing actual actor');
  const scope = host.scope.child('motion-proof'), authority = borrowedDecisionAuthority(source, assets, sections, {
    scope, events: host.events, flags: host.flags, physics: host.physics, player: host.player,
    groundHeightAt: (x,z) => host.groundHeightAt(x,z), live: body => host.entities.get(body.entityId) === body,
    fixed: (name,run,owner) => { owner.onDispose(host.onStep(name,run)); },
  });
  const control = authority.bind(actor, { script: script.id, ...(group ? { group: 'motion.test' } : { actor: id }), strikeEffects: [] },
    { kind: 'animal', motion: 'ground', attack: 'keeper', stunned: 'none', contact: { kind: 'environment', halfArc: Math.PI / 2 } });
  const damage: number[] = [];
  control.observe({ calm: false, reach: () => true, claim: () => true, hurt: amount => { damage.push(amount); } });
  control.fighting = true;
  host.step(); // The group binds its existing lazy admitted owner on the first fixed step.
  return { host, actor, control, scope, damage, context: poseContext(actor), source, sections, assets };
}
