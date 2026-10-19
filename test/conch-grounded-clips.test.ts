// oxlint-disable-next-line import/no-nodejs-modules -- Read the exact candidate rig fixture.
import { readFileSync } from 'node:fs';
import { Bone, Vector3, Skeleton, SkinnedMesh, MeshBasicMaterial } from 'three';
import { packedCreatureBodies } from '../src/game/plugin/geometry';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import type { AnimalRigContext } from '../src/engine/entities/animalRig';
import { numericCreaturePose } from '../src/game/plugin/channelPrograms';
import { conchNativeClips } from '../src/shards/driftwood-isle/generators/conchNativeClips';
import { conchGroundedClips, CONCH_GROUNDED_JOINTS } from '../src/shards/driftwood-isle/generators/conchGroundedClips';

const metadata = v.parse(v.object({ bodies: v.array(v.unknown()) }), JSON.parse(readFileSync('art/driftwood-isle/approved-conch/runtime-admission/arena-candidate1/metadata.json', 'utf8')));
const native = v.parse(v.object({ bones: v.array(v.strictObject({ name: v.string(), parent: v.nullable(v.string()),
  pos: v.tuple([v.number(), v.number(), v.number()]) })) }), metadata.bodies[0]);
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
function bone(bones: Record<string, Bone>, name: string): Bone {
  const result = bones[name]; if (result === undefined) throw new Error(`Missing ${name}`); return result;
}


test('native15 pose addresses exact joints, preserves canonical bind and never stretches', () => {
  expect(CONCH_GROUNDED_JOINTS).toEqual(native.bones.map(row=>row.name));
  const clips=conchGroundedClips(), {context,bones}=rig();
  expect(new Set(clips.programs.flatMap(row=>row.numeric?.outputs.map(out=>out.target)??[]))).toEqual(new Set(CONCH_GROUNDED_JOINTS.map(name=>`joint.${name}`)));
  const binds=Object.fromEntries(Object.entries(bones).map(([name,value])=>[name,value.position.toArray()]));
  numericCreaturePose(clips)(context);
  for (const [name,value] of Object.entries(bones)) {
    if (name === 'body') expect(value.position.y).toBeCloseTo(context.dims.bodyY + .06); else expect(value.position.toArray()).toEqual(binds[name]);
    expect(value.rotation.x).toBeCloseTo(0); expect(value.rotation.y).toBeCloseTo(0); expect(value.rotation.z).toBeCloseTo(0);
    expect(value.scale.toArray()).toEqual([1,1,1]);
  }
});

test.each([[1,.6,1.6],[3,.45,1.45]])('stage %s uses actual attack timing', (stage,windup,end)=> {
  const {context,bones}=rig(), animate=numericCreaturePose(conchGroundedClips());
  context.mem['conch-st']=stage; context.mem['regular-clock']=windup*.9; animate(context);
  expect(bone(bones,'rapierArm').rotation.x).toBeCloseTo(.22);
  context.mem['regular-clock']=windup+.1; animate(context);
  expect(bone(bones,'rapierArm').rotation.x).toBeCloseTo(-.30);
  expect(bone(bones,'rapierForearm').rotation.y).toBeCloseTo(-.35);
  context.mem['regular-clock']=end; animate(context); expect(bone(bones,'rapierArm').rotation.x).toBeCloseTo(0);
});

test('guard reads real field, interruption drops attack and settled death cannot restart',()=> {
  const {context,bones}=rig(), animate=numericCreaturePose(conchGroundedClips());
  context.mem['conch-st']=1;context.mem['conch-guard']=1;context.mem['regular-clock']=.4;animate(context);
  expect(bone(bones,'shieldArm').rotation.x).toBeCloseTo(-.24);
  context.mem['conch-st']=4;context.mem['conch-guard']=0;context.flinch=1;animate(context);
  expect(bone(bones,'rapierArm').rotation.x).toBeCloseTo(.12);
  expect(bone(bones,'shieldForearm').rotation.y).toBeCloseTo(0);
  context.alive=false;context.deathT=1;animate(context);
  const final=Object.values(bones).map(value=>({position:value.position.toArray(),rotation:value.rotation.toArray().map(x=>x===0?0:x)}));
  context.mem['conch-st']=3;context.mem['conch-guard']=1;context.mem['regular-clock']=.55;context.speed=1;context.t=99;context.phase=.25;animate(context);
  expect(Object.values(bones).map(value=>({position:value.position.toArray(),rotation:value.rotation.toArray().map(x=>x===0?0:x)}))).toEqual(final);
});

test('gait alternates and finite pose sweep preserves non-root translations and unit scales',()=> {
  const {context,bones}=rig(), animate=numericCreaturePose(conchGroundedClips());
  context.speed=1;context.phase=.25;animate(context);
  expect(bone(bones,'legLeft').rotation.x).toBeCloseTo(.13);
  expect(bone(bones,'legRight').rotation.x).toBeCloseTo(-.13);
  const binds=Object.fromEntries(Object.entries(bones).map(([name,value])=>[name,value.position.toArray()]));
  for (const stage of [0,1,2,3,4,5]) for(let i=0;i<=50;i++) {
    context.mem['conch-st']=stage;context.mem['regular-clock']=i/20;context.mem['conch-guard']=stage===1?1:0;
    context.phase=i/50;context.t=i/20;context.deathT=stage===5?i/50:-1;animate(context);
    for(const [name,value] of Object.entries(bones)) {
      expect([...value.position,...value.rotation.toArray().slice(0,3)].every(x=>typeof x==='number'&&Number.isFinite(x))).toBe(true);
      if(name!=='body') expect(value.position.toArray()).toEqual(binds[name]);
      expect(value.scale.toArray()).toEqual([1,1,1]);
    }
  }
});

test('real packed consumer and THREE skin preserve canonical rest and isolated forward frame',async()=> {
  const directory='art/driftwood-isle/approved-conch/runtime-admission/arena-candidate1';
  const packedMetadata:unknown=JSON.parse(readFileSync(`${directory}/metadata.json`,'utf8'));
  const bytes=new Uint8Array(readFileSync(`${directory}/payload.bin`));
  const bodies=packedCreatureBodies(packedMetadata,undefined,()=>Promise.resolve(bytes));await bodies.preload();
  const body=bodies.copy('conch-duelist','conch-duelist');
  expect(body.bones).toEqual(native.bones);expect(body.hardParts).toHaveLength(15);
  expect(()=>bodies.copy('brine-puffer','brine-puffer')).toThrow();
  const {bones}=rig(), root=bone(bones,'body');root.updateMatrixWorld(true);
  const skeleton=new Skeleton(Object.values(bones)), material=new MeshBasicMaterial();
  let count=0;
  for(const geometry of body.hardParts) {
    const mesh=new SkinnedMesh(geometry,material);mesh.bind(skeleton);skeleton.update();
    const positions=geometry.getAttribute('position');
    for(let i=0;i<positions.count;i++) {
      const rest=new Vector3().fromBufferAttribute(positions,i);
      expect(mesh.applyBoneTransform(i,rest.clone()).distanceTo(rest)).toBeLessThan(1e-6);count++;
    }
    geometry.dispose();
  }
  expect(count).toBe(7338);expect(bone(bones,'head').getWorldPosition(new Vector3()).z).toBeGreaterThan(0);
  skeleton.dispose();material.dispose();
});


test('grounded correction changes only root height; attack return and interruption are bounded', () => {
  const { context, bones } = rig(), animate = numericCreaturePose(conchGroundedClips());
  for (const [stage, end] of [[1, 1.6], [3, 1.45]] as const) {
    context.mem['conch-st'] = stage; context.mem['regular-clock'] = end - .00001; animate(context);
    const before = Object.values(bones).map(joint => joint.quaternion.clone());
    context.mem['conch-st'] = 2; context.mem['regular-clock'] = 0; animate(context);
    Object.values(bones).forEach((joint, i) => { const previous = before[i]; if (previous === undefined) throw new Error('Missing previous pose'); expect(joint.quaternion.angleTo(previous)).toBeLessThan(.0001); });
  }
  context.mem['conch-st'] = 1; context.mem['conch-guard'] = 1; context.mem['regular-clock'] = .4; animate(context);
  context.mem['conch-st'] = 4; context.mem['conch-guard'] = 0; context.flinch = 1; animate(context);
  expect(bone(bones, 'body').position.y).toBeCloseTo(1.10);
  expect(bone(bones, 'rapierArm').rotation.x).toBeCloseTo(.12);
  expect(bone(bones, 'shieldArm').rotation.x).toBeCloseTo(.08);
  context.flinch = 0; context.mem['conch-st'] = 2; animate(context);
  expect(bone(bones, 'rapierArm').rotation.x).toBeCloseTo(0);
});


test('every motion2 channel matches frozen motion1 except explicit root height', () => {
  const a = rig(), b = rig(); const nativePose = numericCreaturePose(conchNativeClips()), groundedPose = numericCreaturePose(conchGroundedClips());
  for (const stage of [0, 1, 2, 3, 4, 5]) for (let i = 0; i <= 60; i++) {
    const fraction = i / 60;
    for (const { context } of [a, b]) {
      context.mem['conch-st'] = stage; context.mem['regular-clock'] = fraction * 1.6;
      context.mem['conch-guard'] = stage === 1 && fraction < .375 ? 1 : 0;
      context.flinch = stage === 4 ? fraction : 0; context.speed = stage === 0 ? 1 : 0;
      context.phase = fraction; context.t = fraction; context.deathT = stage === 5 ? fraction : -1; context.alive = stage !== 5;
    }
    nativePose(a.context); groundedPose(b.context);
    for (const name of CONCH_GROUNDED_JOINTS) {
      const original = bone(a.bones, name), next = bone(b.bones, name);
      expect(next.rotation.toArray()).toEqual(original.rotation.toArray());
      expect(next.scale.toArray()).toEqual(original.scale.toArray());
      if (name !== 'body') expect(next.position.toArray()).toEqual(original.position.toArray());
      else { const dead = stage === 5 ? fraction * fraction * (3 - 2 * fraction) : 0;
        expect(next.position.y - original.position.y).toBeCloseTo(.06 + 1.01 * dead); }
    }
  }
});
