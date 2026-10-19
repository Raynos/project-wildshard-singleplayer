// oxlint-disable-next-line import/no-nodejs-modules -- Exact authored rig fixture, no renderer or browser.
import { readFileSync } from 'node:fs';
import { Bone, Vector3 } from 'three';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import type { AnimalRigContext } from '../src/engine/entities/animalRig';
import { numericCreaturePose } from '../src/game/plugin/channelPrograms';
import { colossusNativeClips, COLOSSUS_NATIVE_JOINTS } from '../src/shards/driftwood-isle/generators/colossusNativeClips';
import { TIDAL_GIANTS_DECISIONS, TIDAL_GIANTS_STRIKES } from '../src/shards/driftwood-isle/generators/tidalGiantsCombat';
import { createColossusNativePreviewOutput, createColossusNativePreviewSource, COLOSSUS_NATIVE_PREVIEW_DECISION_MEMORY } from '../src/shards/driftwood-isle/generators/colossusNativePreview';

const native = v.parse(v.object({ bones: v.array(v.strictObject({ name: v.string(), parent: v.nullable(v.string()),
  pos: v.tuple([v.number(), v.number(), v.number()]) })) }), JSON.parse(readFileSync('art/driftwood-isle/lowpoly-colossus/runtime-admission/v4-skin1/colossus-v4-native.json', 'utf8')));
function rig(): { context: AnimalRigContext; bones: Record<string, Bone> } {
  const bones: Record<string, Bone> = {};
  for (const def of native.bones) {
    const joint = new Bone(); joint.name = def.name; joint.position.fromArray(def.pos);
    if (def.parent !== null) {
      const parent = bones[def.parent], rest = native.bones.find(row => row.name === def.parent);
      if (parent === undefined || rest === undefined) throw new Error('Missing native parent');
      joint.position.sub(new Vector3(...rest.pos)); parent.add(joint);
    }
    bones[def.name] = joint;
  }
  const mem = {}, position = new Vector3();
  return { bones, context: { bones,
    dims: { bodyY: native.bones[0]?.pos[1] ?? 0, bodyHalfLen: 0, bodyRadius: 0, headRadius: 0, legLen: 0, feet: [], halfWidth: 0 },
    dt: 1 / 60, t: 0, seed: .7, scale: 1, speed: 0, strafe: 0, phase: 0, state: 'attack', alive: true,
    deathT: -1, flinch: 0, brace: 0, attack: -1, lookTarget: new Vector3(), lookWeight: 0,
    position, yaw: 0, mem, animal: { mem, position, yOffset: 0 } } };
}

test('exact 22 joints and all declared pose DAGs bind', () => {
  expect(COLOSSUS_NATIVE_JOINTS).toEqual(native.bones.map(row => row.name));
  const {context,bones}=rig(); const animate=numericCreaturePose(colossusNativeClips());
  for (const stage of [0,1,2,3,4,6]) for(let i=0;i<=40;i++) {
    context.mem['tg-state']=stage;context.mem['tg-clock']=i/20;context.phase=i/40;context.speed=.8;
    context.deathT=stage===6?i/40:-1;context.t=i/20;context.flinch=stage===4?.8:0;animate(context);
    for(const joint of Object.values(bones)) expect([...joint.position,...joint.rotation.toArray().slice(0,3)].every(x=>typeof x==='number'&&Number.isFinite(x))).toBe(true);
  }
});
test('isolated source contains one unchanged guest, three strikes, five aliases and no persistent progression',()=>{
 const source=createColossusNativePreviewSource();expect(source.runtime?.spawns?.actors?.map(row=>row.kind)).toEqual(['tideRootColossus']);
 expect(source.state.shared.map(row=>row.name)).toEqual(['tg-state','tg-clock','tg-awake','tg-phase','tg-exposed']);
 expect(COLOSSUS_NATIVE_PREVIEW_DECISION_MEMORY).toBe(131072);
 const output=createColossusNativePreviewOutput({diagnosticOnly:true});
 expect(output.namedFiles?.map(row=>row.name)).toEqual(['poses/tide-root-colossus.json','practice/bodies.json','practice/looks.json','practice/pickups.json']);
 expect(source.quests).toEqual({flags:[],quests:[],triggers:[],dialogue:[]});expect(source.encounters).toEqual([]);expect(source.ledger).toEqual([]);
});

test('sweeps/slam retain full active pose, death suppresses live clocks and retry restores bind height', () => {
  const { context, bones } = rig(), animate = numericCreaturePose(colossusNativeClips());
  const joint = (name: string) => { const value = bones[name]; if (value === undefined) throw new Error('Missing joint'); return value; };
  for (const [stage, wind, active, arm] of [[1, .9, .25, 'arm-1'], [2, .9, .25, 'arm1'], [3, 1.1, .18, 'arm1']] as const) {
    context.mem['tg-state'] = stage; context.mem['tg-clock'] = wind * .8; animate(context);
    expect(joint(arm).rotation.x).toBeLessThan(-.5);
    context.mem['tg-clock'] = wind + active * .99; animate(context);
    expect(joint(arm).rotation.x).toBeLessThan(-.29);
  }
  context.deathT = 1; context.alive = false; animate(context);
  const snapshot = () => Object.values(bones).map(row => ({ position: row.position.toArray(), rotation: row.rotation.toArray() }));
  const dead = snapshot(); context.t = 100; context.flinch = 1; context.speed = 1; context.phase = .2;
  context.mem['tg-state'] = 1; context.mem['tg-clock'] = .8; animate(context); expect(JSON.stringify(snapshot())).toBe(JSON.stringify(dead));
  context.deathT = -1; context.alive = true; context.flinch = 0; context.t = 0; context.mem['tg-state'] = 0; animate(context);
  for (const side of [-1, 1]) for (const name of ['leg', 'shin', 'foot']) expect(Math.abs(joint(`${name}${side}`).rotation.x)).toBe(0);
  expect(joint('body').position.y).toBe(2.28); expect(joint('arm1').rotation.x).toBeCloseTo(0, 12); expect(joint('head').rotation.x).toBeCloseTo(0, 12);
});

test('original AI and time-driven strike timing are unchanged; missing legacy sockets are never advertised', () => {
  const strikes = TIDAL_GIANTS_STRIKES.filter(row => row.id.startsWith('strike.colossus.'));
  expect(strikes.map(row => [row.windup, row.active, row.recover])).toEqual([[.9, .25, .35], [.9, .25, .35], [1.1, .18, 1.5]]);
  expect(strikes.every(row => !('motion' in row))).toBe(true);
  expect(TIDAL_GIANTS_DECISIONS.find(row => row.id === 'driftwood.colossus.decision')?.source).toBe('behaviour/tide-root-colossus.as');
  const output = createColossusNativePreviewOutput({ diagnosticOnly: true });
  expect(output.namedFiles?.some(row => row.name === 'poses/tide-root-colossus.json')).toBe(true);
});
