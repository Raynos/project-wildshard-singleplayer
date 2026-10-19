// oxlint-disable-next-line import/no-nodejs-modules -- Exact native fixture and source-test measurement output.
import { readFileSync, writeFileSync } from 'node:fs';
import { Bone, Vector3, Matrix4, Box3 } from 'three';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import type { AnimalRigContext } from '../../../../src/engine/entities/animalRig';
import { numericCreaturePose } from '../../../../src/game/plugin/channelPrograms';
import { mantisEarlyKneeClips } from '../../../../src/shards/driftwood-isle/generators/mantisEarlyKneeClips';
import { mantisPrecontactClips } from '../../../../src/shards/driftwood-isle/generators/mantisPrecontactClips';

const native = v.parse(v.object({ bones: v.array(v.strictObject({ name: v.string(), parent: v.nullable(v.string()),
  pos: v.tuple([v.number(), v.number(), v.number()]) })), parts: v.array(v.object({ name: v.string(), positions: v.array(v.number()), skinIndices: v.array(v.number()), skinWeights: v.array(v.number()) })) }), JSON.parse(readFileSync('art/driftwood-isle/lowpoly-mantis/runtime-admission/v7-rigid1/mantis-v7-native.json', 'utf8')));
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

function snapshot(bones: Record<string, Bone>) {
  return Object.fromEntries(Object.entries(bones).map(([name, b]) => [name, [...b.position, ...b.quaternion]]));
}

const animate = numericCreaturePose(mantisPrecontactClips()), fallback = numericCreaturePose(mantisEarlyKneeClips());
function pose(stage: number, phase: number, clock: number, attack: number, old = false, extra: Partial<AnimalRigContext> = {}) {
  const f = rig(); Object.assign(f.context, extra, { attack });
  Object.assign(f.context.mem, { 'mantis-st': stage, 'mantis-pose-phase': phase, 'mantis-pose-clock': clock });
  (old ? fallback : animate)(f.context); return f;
}
const report: Record<string, unknown> = { acceptance: false, scope: 'Exact native weighted vertices, fixed identity root, source evaluator only; no runtime world/contact claim' };
function weighted(f: ReturnType<typeof rig>, prefix = '') {
  bone(f.bones, 'body').updateMatrixWorld(true);
  const transforms = native.bones.map(b => bone(f.bones, b.name).matrixWorld.clone().multiply(new Matrix4().makeTranslation(...b.pos).invert()));
  return native.parts.filter(p => p.name.startsWith(prefix)).flatMap(p => {
    const result: Vector3[] = [];
    for (let i = 0; i < p.positions.length / 3; i++) {
      const position = new Vector3().fromArray(p.positions, i * 3), value = new Vector3(); let total = 0;
      for (let j = 0; j < 4; j++) {
        const index = p.skinIndices[i * 4 + j], weight = p.skinWeights[i * 4 + j];
        if (index === undefined || weight === undefined || transforms[index] === undefined) throw new Error('Missing skin influence');
        value.addScaledVector(position.clone().applyMatrix4(transforms[index]), weight); total += weight;
      }
      if (Math.abs(total - 1) > 1e-7) throw new Error('Invalid skin weights'); result.push(value);
    }
    return result;
  });
}
function distance(a: Vector3[], b: Vector3[]) { return Math.max(...a.map((p, i) => { const q = b[i]; if (!q) throw new Error('Missing point'); return p.distanceTo(q); })); }
test('strict numeric source admission: bounded DAG, frame attack, no local history or joint feedback', () => {
  const clips = mantisPrecontactClips();
  expect(clips.programs.every(p => p.nodes.length <= 128 && p.locals === undefined)).toBe(true);
  const inputs = clips.programs.flatMap(p => p.numeric?.inputs ?? []);
  expect(inputs.some(i => i.owner === 'frame' && i.path[0] === 'attack')).toBe(true);
  expect(inputs.every(i => i.owner === 'frame' || i.owner === 'scalars')).toBe(true);
  report.admission = { programs: clips.programs.length, maxNodes: Math.max(...clips.programs.map(p => p.nodes.length)) };
});
test.each([[1, -1, .75], [3, 1, .45]])('stage %s continuous keys, stale observer precedence and same-tick active', (stage, side, duration) => {
  for (const phase of [0, 1, 2, 3]) for (const clock of [0, .1, 1.5]) {
    for (const [attack, shoulder, elbow] of [[0, 0, 0], [.3, -.45, .35], [.45, -.45, .35], [.95, .65, -.65], [1, .65, -.65]]) {
      if (attack === undefined || shoulder === undefined || elbow === undefined) throw new Error('Missing key');
      const f = pose(stage, phase, clock, attack);
      expect(bone(f.bones, `raptor${side}`).rotation.x).toBeCloseTo(shoulder, 12);
      expect(bone(f.bones, `raptor${side}_elbow`).rotation.x).toBeCloseTo(elbow, 12);
    }
  }
  const endpoint = snapshot(pose(stage, 1, duration, 1).bones);
  expect(snapshot(pose(stage, 1, duration - .1, -1).bones)).toEqual(endpoint);
  expect(snapshot(pose(stage, 2, 0, -1).bones)).toEqual(endpoint);
  expect(snapshot(pose(stage, 3, 0, -1).bones)).toEqual(endpoint);
  for (const clock of [.1, .6, 2, 50]) expect(snapshot(pose(stage, 2, clock, -1).bones)).toEqual(endpoint);
  expect(snapshot(pose(stage, 3, stage === 1 ? .12 : 1.1, -1).bones)).toEqual(snapshot(pose(stage, 0, 0, -1).bones));
  for (const key of [0, .3, .45, .95, 1]) {
    const a = pose(stage, 1, 0, Math.max(0, key - 1e-7)), b = pose(stage, 1, 0, Math.min(1, key + 1e-7));
    expect(distance(weighted(a), weighted(b))).toBeLessThan(1e-5);
  }
});
test('first recovery to second windup and stage 0/2/5 cannot leak stale attack', () => {
  const f = pose(1, 3, .12, -1); // Reuse the fixture to expose accidental history.
  Object.assign(f.context.mem, { 'mantis-st': 3 }); f.context.attack = 0; animate(f.context);
  expect(snapshot(f.bones)).toEqual(snapshot(pose(3, 0, 0, 0).bones));
  f.context.attack = .7; animate(f.context);
  expect(snapshot(f.bones)).toEqual(snapshot(pose(3, 1, 0, .7).bones));
  expect(bone(f.bones, 'raptor-1').rotation.x).toBe(0);
  for (const stage of [0, 2, 5]) for (const phase of [0, 1, 2, 3]) for (const attack of [-1, 0, .7, 1])
    expect(snapshot(pose(stage, phase, .1, attack).bones)).toEqual(snapshot(pose(stage, 0, 0, -1).bones));
});
test('lower-body living gait and accelerated death are candidate6-exact', () => {
  let cases = 0;
  for (const stage of [0, 1, 2, 3, 5]) for (const phase of [0, 1, 2, 3]) for (const attack of [-1, 0, .3, .7, 1])
    for (const deathT of [-1, 0, .05, .2, .4, .7, 1]) {
      const extra = { t: .23, speed: .8, phase: .37, deathT, alive: deathT < 0, flinch: .25 };
      const a = snapshot(pose(stage, phase, .1, attack, true, extra).bones), b = snapshot(pose(stage, phase, .1, attack, false, extra).bones);
      for (const name of Object.keys(a)) if (name.startsWith('leg') || stage === 5 || deathT === 1) expect(b[name]).toEqual(a[name]);
      cases++;
    }
  // Nonattack gait keeps root and every other joint exact, including idle breathing.
  for (const gait of [0, .1, .3, .7, 1]) expect(snapshot(pose(0, 0, 0, -1, false, { phase: gait, speed: .8 }).bones)).toEqual(snapshot(pose(0, 0, 0, -1, true, { phase: gait, speed: .8 }).bones));
  report.parityCases = cases;
}, 120000);
test.each([[1, -1, .75], [3, 1, .45]])('stage %s weighted native blade travel, boundary continuity and local contact', (stage, side, duration) => {
  const prefix = `raptor${side}`;
  const baselineJump = distance(weighted(pose(stage, 1, duration, .99, true), prefix), weighted(pose(stage, 2, 0, -1, true), prefix));
  const endpointJump = distance(weighted(pose(stage, 1, duration, 1), prefix), weighted(pose(stage, 1, duration, -1), prefix));
  const travel = distance(weighted(pose(stage, 1, 0, .45), prefix), weighted(pose(stage, 1, 0, .95), prefix));
  let minBladeY = Infinity, minAllY = Infinity, maxVertexStep = 0, maxShoulderStep = 0;
  for (let offset = 0; offset < 10; offset++) {
    let previous: Vector3[] | undefined, previousShoulder: number | undefined;
    for (let t = offset / 300; t <= duration + .1; t += 1 / 30) {
      const f = pose(stage, 1, Math.floor(t * 10) / 10, t < duration ? t / duration : -1);
      const points = weighted(f, prefix), shoulder = bone(f.bones, prefix).rotation.x;
      minBladeY = Math.min(minBladeY, ...points.map(p => p.y)); minAllY = Math.min(minAllY, ...weighted(f).map(p => p.y));
      if (previous) maxVertexStep = Math.max(maxVertexStep, distance(previous, points));
      if (previousShoulder !== undefined) maxShoulderStep = Math.max(maxShoulderStep, Math.abs(previousShoulder - shoulder));
      previous = points; previousShoulder = shoulder;
    }
  }
  expect(baselineJump).toBeGreaterThan(.5); expect(endpointJump).toBe(0); expect(travel).toBeGreaterThan(.5);
  expect(maxShoulderStep).toBeLessThan(.25); expect(maxVertexStep).toBeLessThan(baselineJump * .4);
  expect(minBladeY).toBeGreaterThan(0); expect(minAllY).toBeGreaterThan(0);
  report[`strike${stage}`] = { duration, baselineJump, endpointJump, travel, maxVertexStep, maxShoulderStep, minBladeY, minAllY, samplesHz: 30, offsetSamples: 10, contactAcceptance: false };
  writeFileSync('docs/reviews/mantis-precontact-independent/source/baseline-results.json', `${JSON.stringify(report, null, 2)}\n`);
});

test('unchanged lower-body, head, abdomen DAGs remain byte-exact after program identity normalization', () => {
  const before = mantisEarlyKneeClips(), after = mantisPrecontactClips();
  expect(after.scalars).toEqual(before.scalars); expect(after.states).toEqual(before.states);
  let exact = 0;
  for (let i = 0; i < before.programs.length; i++) {
    const a = before.programs[i], b = after.programs[i]; if (!a || !b) throw new Error('Missing channel');
    const target = a.numeric?.outputs[0]?.target ?? '';
    if (target.startsWith('joint.leg') || target === 'joint.head' || target === 'joint.abdomen') {
      expect(JSON.stringify(b).replaceAll('motion7.', 'motion6.')).toBe(JSON.stringify(a)); exact++;
    }
  }
  expect(exact).toBe(14);
});

import { StrikeRunner, type StrikeActor, type StrikeSpec } from '../../../../src/engine/ai/strikes';
import { DRIFTWOOD_REGULAR_STRIKES } from '../../../../src/shards/driftwood-isle/generators/driftwoodRegularCombat';

const independent: Record<string, unknown> = {};
test('independent: missing memory, reused rig Retry and all cancelled recovery phases', () => {
  const f = rig(); animate(f.context);
  expect(snapshot(f.bones)).toEqual(snapshot(pose(0, 0, 0, -1).bones));
  Object.assign(f.context.mem, {'mantis-st': 3, 'mantis-pose-phase': 1}); f.context.attack = .7; animate(f.context);
  for (const key of Object.keys(f.context.mem)) delete f.context.mem[key];
  f.context.attack = -1; animate(f.context);
  expect(snapshot(f.bones)).toEqual(snapshot(pose(0, 0, 0, -1).bones));
  for (const stage of [1, 3]) for (const phase of [0, 2, 3]) for (const clock of [0, .01, .1, .12, .5, 1.1, 5])
    expect(snapshot(pose(stage, phase, clock, -1).bones)).toEqual(snapshot(pose(stage, phase, clock, -1, true).bones));
});

test('independent: full quaternions at 60/30Hz plus low-cadence gaps', () => {
  const rows = [];
  for (const [stage, duration] of [[1,.75],[3,.45]]) for (const hz of [60,30,10]) {
    if (stage === undefined || duration === undefined) throw new Error('Missing spec');
    let maxAngle = 0, maxTravel = 0;
    for (let offset = 0; offset < 20; offset++) {
      let previous: ReturnType<typeof rig> | undefined;
      for (let t = offset / (hz * 20); t < duration + 1 / hz; t += 1 / hz) {
        const f = pose(stage, 1, 0, Math.min(t / duration, 1));
        if (previous) {
          for (const name of Object.keys(f.bones)) maxAngle = Math.max(maxAngle, bone(previous.bones,name).quaternion.angleTo(bone(f.bones,name).quaternion));
          maxTravel = Math.max(maxTravel, distance(weighted(previous,'raptor'),weighted(f,'raptor')));
        }
        previous = f;
      }
    }
    if (hz >= 30) expect(maxAngle).toBeLessThan(.25);
    rows.push({stage,hz,offsets:20,maxAngle,maxTravel});
  }
  independent.sampling = rows;
}, 120000);

test('independent: actual candidate6 death inputs and full-world weighted geometry are exact', () => {
  const schema = v.array(v.object({ world: v.array(v.number()), bones: v.record(v.string(), v.array(v.number())), floor:v.number(), poseInputs:v.optional(v.object({boutTime:v.number(),speed:v.number(),gait:v.number(),deathT:v.number(),flinch:v.number(),alive:v.boolean(),mem:v.record(v.string(),v.number())})) }));
  const rows = [];
  for (const path of ['docs/reviews/mantis-early-knee-moving/run1/render-trace.json','docs/reviews/mantis-early-knee-supplement/run1/render-trace.json']) {
    const trace = v.parse(schema, JSON.parse(readFileSync(path,'utf8')));
    let cases = 0, minWorldY = Infinity, maxCapturedError = 0, maxVertexError = 0;
    for (const row of trace) {
      const input = row.poseInputs;
      if (!input || input.alive || input.mem['mantis-st'] !== 5) continue;
      const extra = {t:input.boutTime,speed:input.speed,phase:input.gait,deathT:input.deathT,flinch:input.flinch,alive:input.alive};
      const stage=5, phase=input.mem['mantis-pose-phase'] ?? 0, clock=input.mem['mantis-pose-clock'] ?? 0;
      const prior=pose(stage,phase,clock,-1,true,extra), after=pose(stage,phase,clock,-1,false,extra);
      expect(snapshot(after.bones)).toEqual(snapshot(prior.bones));
      // Missing historical frame.attack is not invented: stage5 algebra masks every value.
      expect(snapshot(pose(stage,phase,clock,.7,false,extra).bones)).toEqual(snapshot(after.bones));
      const snap=snapshot(after.bones);
      for (const [name,values] of Object.entries(snap)) for(let i=0;i<values.length;i++) maxCapturedError=Math.max(maxCapturedError,Math.abs((values[i] ?? Infinity)-(row.bones[name]?.[i] ?? -Infinity)));
      const world=new Matrix4().fromArray(row.world), a=weighted(prior).map(p=>p.applyMatrix4(world)), b=weighted(after).map(p=>p.applyMatrix4(world));
      maxVertexError=Math.max(maxVertexError,distance(a,b)); minWorldY=Math.min(minWorldY,...b.map(p=>p.y-row.floor)); cases++;
    }
    expect(cases).toBeGreaterThan(0); expect(maxCapturedError).toBeLessThan(1e-12); expect(maxVertexError).toBe(0); expect(minWorldY).toBeGreaterThan(0);
    rows.push({path,cases,minWorldY,maxCapturedError,maxVertexError,omitted:'living/missing-input rows; no reconstruction of absent attack'});
  }
  independent.worldDeaths=rows;
  writeFileSync('docs/reviews/mantis-precontact-independent/source/independent-results.json',JSON.stringify(independent,null,2)+'\n');
},120000);

test('independent: exact StrikeRunner clocks and capsule vertex overlap diagnostic', () => {
  const rows=[];
  for(const [stage,duration] of [[1,.75],[3,.45]]) for(const mode of ['close','approach','obstructed','long-active']) {
    if(stage === undefined || duration === undefined) throw new Error('Missing strike');
    const declaration=DRIFTWOOD_REGULAR_STRIKES.find(s=>s.id===`strike.splinter-mantis.${stage===1?'first':'second'}`);
    if(!declaration) throw new Error('Missing strike');
    const spec:StrikeSpec={...declaration,weight:()=>1};
    const runner=new StrikeRunner(), position={x:0,y:0,z:0};
    let time=0, attackT=-1, attackDur=1, speed=0, firstHit:number|null=null, firstOverlap:number|null=null, endpoint:number|null=null, activeStart:number|null=null, recovery:number|null=null;
    let overlapBeforeDamage=0;
    const actor:StrikeActor={position,alive:true,scale:1,yaw:0,startAttack:(dur)=>{attackT=0;attackDur=dur;},cancelAttack:()=>{attackT=-1;},setMotion:(_yaw,v)=>{speed=v;}};
    const target={x:0,y:0,z:mode==='close'?.8:2.8};
    runner.start(spec,actor,target);
    for(let i=0;i<240 && runner.state!=='idle';i++) {
      const dt=1/60; time+=dt;
      // Deterministic integration only, not Rapier: authoritative runner and exact documented attack clock formula.
      if(mode!=='long-active' && mode!=='obstructed') position.z+=speed*dt;
      if(attackT>=0) attackT+=dt;
      runner.update(dt,{actor,target,canReach:()=>mode!=='obstructed',hit:()=>{firstHit??=time;}});
      if(runner.state==='active') activeStart??=time;
      if(runner.state==='recover') recovery??=time;
      const attack=attackT<0?-1:Math.min(1,attackT/attackDur);
      const phase=runner.state==='windup'?1:runner.state==='active'?2:runner.state==='recover'?3:0;
      const f=pose(stage,phase,runner.snapshot().elapsed,attack);
      if(Math.abs(bone(f.bones,`raptor${stage===1?-1:1}`).rotation.x-.65)<1e-12) endpoint??=time;
      // A native vertex inside the real Player radius.38,height1.8 capsule is sufficient overlap,
      // but no positive result would not rule out an intersecting triangle.
      const inside=weighted(f,`raptor${stage===1?-1:1}`).some(p=>{
        const y=Math.min(1.42,Math.max(.38,p.y));
        return p.x*p.x+(p.y-y)**2+(p.z+position.z-target.z)**2<.38**2;
      });
      if(inside) {firstOverlap??=time;if(firstHit===null) overlapBeforeDamage++;}
    }
    expect(activeStart).not.toBeNull(); expect(endpoint).not.toBeNull();
    expect(endpoint ?? Infinity).toBeLessThanOrEqual(activeStart ?? 0);
    if(mode==='close'||mode==='approach') expect(firstHit).not.toBeNull();
    else expect(firstHit).toBeNull();
    if(mode==='long-active') expect((recovery??0)-(activeStart??0)).toBeGreaterThan(1.7);
    rows.push({stage,mode,firstHit,firstOverlap,overlapBeforeDamage,endpoint,activeStart,recovery,scope:'Exact StrikeRunner; deterministic straight-line root integration, not actual physics or visual acceptance'});
  }
  independent.strikeClocks=rows;
  writeFileSync('docs/reviews/mantis-precontact-independent/source/independent-results.json',JSON.stringify(independent,null,2)+'\n');
},120000);

function triangleHit(a: Vector3[], b: Vector3[]) {
  const a0 = a[0], a1 = a[1], a2 = a[2], b0 = b[0], b1 = b[1], b2 = b[2];
  if (!a0 || !a1 || !a2 || !b0 || !b1 || !b2) throw new Error('Incomplete triangle');
  const ae = [a1.clone().sub(a0), a2.clone().sub(a1), a0.clone().sub(a2)], be = [b1.clone().sub(b0), b2.clone().sub(b1), b0.clone().sub(b2)];
  const an = a1.clone().sub(a0).cross(a2.clone().sub(a0)), bn = b1.clone().sub(b0).cross(b2.clone().sub(b0));
  const axes = [an, bn, ...ae.flatMap(x => be.map(y => x.clone().cross(y))), ...ae.map(x => an.clone().cross(x)), ...be.map(x => bn.clone().cross(x))];
  for (const axis of axes) {
    if (axis.lengthSq() < 1e-20) continue; axis.normalize();
    const ap = a.map(p => p.dot(axis)), bp = b.map(p => p.dot(axis));
    if (Math.max(...ap) < Math.min(...bp) - 1e-9 || Math.max(...bp) < Math.min(...ap) - 1e-9) return false;
  }
  return true;
}

test('independent: weighted arm versus central anatomy triangle surface intersections', () => {
  const rows=[];
  for(const stage of [1,3]) {
    const samples=[];
    for(let k=0;k<=40;k++) {
      const attack=k/40, f=pose(stage,1,0,attack);
      const armParts=native.parts.filter(p=>p.name.startsWith(`raptor${stage===1?-1:1}`)).map(p=>({name:p.name,points:weighted(f,p.name).slice(0,p.positions.length/3)}));
      const central=native.parts.filter(p=>['body','neck','head','abdomen'].includes(p.name)).map(p=>({name:p.name,points:weighted(f,p.name).slice(0,p.positions.length/3)}));
      const hits=[];
      for(const a of armParts) for(const b of central) {
        if(!new Box3().setFromPoints(a.points).intersectsBox(new Box3().setFromPoints(b.points))) continue;
        let hit=false;
        for(let x=0;x<a.points.length&&!hit;x+=3) for(let y=0;y<b.points.length&&!hit;y+=3) {
          const ta=a.points.slice(x,x+3),tb=b.points.slice(y,y+3);
          if(new Box3().setFromPoints(ta).intersectsBox(new Box3().setFromPoints(tb))&&triangleHit(ta,tb)) hit=true;
        }
        if(hit) hits.push(`${a.name}:${b.name}`);
      }
      if(hits.length) samples.push({attack,hits});
    }
    rows.push({stage,samples});
  }
  independent.armBodyIntersections={rows,scope:'Triangle surface crossing at41 keys per strike; includes intentional shoulder attachment, excludes containment and world obstacles'};
  writeFileSync('docs/reviews/mantis-precontact-independent/source/independent-results.json',JSON.stringify(independent,null,2)+'\n');
},120000);
