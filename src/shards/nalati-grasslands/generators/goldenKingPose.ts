import * as v from 'valibot';
import speciesFrameRows from '../data/speciesRows.json' with {type:'json'};
import { numericChannelPrograms, type ClientChannels, type NumericChannelOutput } from '@wildshard/sdk/clientChannels';
import type { ClipChannel, ClipFactor, ClipTerm, ClipWhen } from '@wildshard/game/plugin/animation';

// Ordered scalar rows retain the original procedural pose's arithmetic. The
// page supplies only frame observations, floor smoothing and look angles.
type E = ClipFactor;
type PoseRow = { mem: string; cases: { when?: ClipWhen; sum: ClipTerm[] }[] } | { bone: string; channel: ClipChannel; cases: { when?: ClipWhen; sum: ClipTerm[] }[] };
const rows: PoseRow[] = [];
const term = (x: E): ClipTerm => typeof x === 'number' ? x : { of: [x] };
const add = (...x: E[]): E => ({ bounded: x.map(term) });
const mul = (...x: E[]): E => ({ bounded: [{ of: x }] });
const sub = (a: E, b: E): E => add(a, mul(-1, b));
const mix = (a: E, b: E, t: E): E => add(mul(sub(1, t), a), mul(t, b));
const cap = (x: E, min = 0, max = 1): E => ({ bounded: [term(x)], min, max });
const wave = (rate: number, offset = 0): E => ({ wave: 'phase', rate, offset });
const m = (name: string): E => ({ mem: `king.${name}` });
const raw = (name: string): E => ({ mem: name });
const set = (name: string, value: E, when?: ClipWhen): E => {
  rows.push({ mem: `king.${name}`, cases: [{ ...(when === undefined ? {} : { when }), sum: [term(value)] }] });
  return m(name);
};
const step = (x: E, a: number, b: number): E => {
  const t = cap({ bounded: [term(sub(x, a))], divide: b - a });
  return mul(t, t, sub(3, mul(2, t)));
};
const pose = (bone: string, channel: ClipChannel, value: E): void => { rows.push({ bone, channel, cases: [{ sum: [term(value)] }] }); };
const rotation = (bone: string, x: E, y: E, z: E): void => { pose(bone, 'rotation.x', x); pose(bone, 'rotation.y', y); pose(bone, 'rotation.z', z); };
const when = (name: string): ClipWhen => ({ mem: { key: `king.${name}`, above: 0 } });
const up = set('up', step(m('riseInput'), 0, 1));
const sit = set('sit', step(up, 0, .55)), stand = set('stand', step(up, .45, 1));
const kneel = set('kneel', step(raw('kneelS'), 0, 1)), raise = set('raise', step(raw('raiseS'), 0, 1));
const dead = set('dead', step(m('deathInput'), 0, 1));
const moving = set('moving', cap({ bounded: [term(m('speed'))], divide: 1.2 }));
const lie = set('lie', sub(1, sit));
const kneelDrop = set('kneelDrop', add(mul(.36, kneel), mul(.5, step(dead, 0, .5))));
set('bodyY', add(sub(sub(m('bodyYInput'), mul(.55, lie)), mul(.18, sub(1, stand), sit)), mul(-1, kneelDrop), mul(.01, m('breathe'), sub(1, moving))));
set('bodyP', add(mul(-1.52, lie), mul(.08, moving), mul(.12, kneel), mul(1.2, step(dead, .45, 1))));
set('spineY', 0); set('headP', add(-.05, mul(.25, m('flinch'))));
set('armRx', .1); set('armRz', -.18); set('elR', -.45);
set('armLx', .15); set('armLz', .2); set('elL', -.35);
const atk: E = { attack: true };
const wind = set('wind', step(atk, 0, .55)), cut = set('cutProgress', step(atk, .55, .75)), rec = set('recover', step(atk, .82, 1));
const k = set('keep', sub(1, rec));
const cutWhen = when('cut');
set('armRx', add(mul(mix(mix(.1, -2.3, wind), .9, cut), k), mul(.1, rec)), cutWhen);
set('armRz', sub(mul(mix(mix(-.18, -1.1, wind), m('wideRz'), cut), k), mul(.18, rec)), cutWhen);
set('elR', sub(mul(mix(mix(-.45, -1.1, wind), -.1, cut), k), mul(.45, rec)), cutWhen);
set('spineY', mul(mix(mix(0, .55, wind), m('wideSpine'), cut), k), cutWhen);
const backWhen = when('backCut');
set('armRx', add(mul(mix(mix(.1, -1.4, wind), .5, cut), k), mul(.1, rec)), backWhen);
set('armRz', sub(mul(mix(mix(-.18, .7, wind), -1.2, cut), k), mul(.18, rec)), backWhen);
set('elR', sub(mul(mix(mix(-.45, -1.3, wind), -.2, cut), k), mul(.45, rec)), backWhen);
set('spineY', mul(mix(mix(0, -.5, wind), .55, cut), k), backWhen);
set('bodyP', add(m('bodyP'), mul(mix(mix(0, -.12, wind), .3, cut), k)), cutWhen);
set('armLz', add(m('armLz'), mul(.4, wind, k)), cutWhen);
set('armLx', sub(m('armLx'), mul(.3, cut, k)), cutWhen);
const lift = set('lift', step(atk, 0, .3)), slam = set('slam', step(atk, .72, .82)), recover = set('burstRec', step(atk, .88, 1));
const remain = set('burstKeep', sub(1, recover)), burstWhen = when('burst');
set('armRx', add(mul(mix(mix(.1, -2.9, lift), .6, slam), remain), mul(.1, recover)), burstWhen);
set('armRz', sub(mul(mix(-.18, -.25, lift), remain), mul(.18, recover)), burstWhen);
set('elR', sub(mul(mix(mix(-.45, -.15, lift), -.5, slam), remain), mul(.45, recover)), burstWhen);
set('armLx', add(mul(mix(mix(.15, -2.4, lift), .4, slam), remain), mul(.15, recover)), burstWhen);
set('armLz', add(mul(mix(.2, .5, lift), remain), mul(.2, recover)), burstWhen);
set('bodyP', add(m('bodyP'), mul(add(mul(-.2, lift, m('hold')), mul(.55, slam)), remain)), burstWhen);
set('headP', add(m('headP'), mul(add(mul(-.35, lift, m('hold')), mul(.3, slam)), remain)), burstWhen);
set('bodyY', sub(m('bodyY'), mul(.2, slam, remain)), burstWhen);
const roarWhen = when('roar');
set('armRx', mix(m('armRx'), m('roarRx'), m('bump')), roarWhen);
set('armRz', mix(m('armRz'), -1.3, m('bump')), roarWhen);
set('armLx', mix(m('armLx'), m('roarLx'), m('bump')), roarWhen);
set('armLz', mix(m('armLz'), 1.3, m('bump')), roarWhen);
set('headP', sub(m('headP'), mul(.5, m('bump'))), roarWhen);
set('bodyP', sub(m('bodyP'), mul(.2, m('bump'))), roarWhen);
const raiseWhen: ClipWhen = { mem: { key: 'king.raise', above: .01 } };
for (const [key, value] of [['armRx', -1.35], ['armRz', .35], ['elR', -.9], ['armLx', -1.3], ['armLz', -.3], ['elL', -1], ['headP', -.2]] as const)
  set(key, mix(m(key), value, raise), raiseWhen);
const sitArms = set('sitArms', mul(sit, sub(1, stand)));
for (const [key, value, resting] of [['armRx', .6, .1], ['armLx', .6, .1], ['armRz', -.5, -.15], ['armLz', .5, .15]] as const)
  set(key, mix(mix(m(key), value, sitArms), resting, lie), when('sitting'));
set('headP', add(m('headP'), mul(.4, lie, sub(1, sit))), when('sitting'));
pose('cape', 'scale', { bounded: [term(raw('cape'))], min: .001 });
pose('crown', 'scale', { bounded: [term(raw('crown'))], min: .001 });
pose('body', 'position.x', 0); pose('body', 'position.y', m('bodyY')); pose('body', 'position.z', mul(-.35, lie));
rotation('body', m('bodyP'), 0, mul(.03, wave(Math.PI * 2), moving));
rotation('spine', add(.02, mul(.1, kneel), mul(.02, m('breathe'))), add(m('spineY'), mul(m('lookYaw'), .3)), 0);
rotation('chest', .02, mul(m('lookYaw'), .25), 0);
rotation('head', sub(m('headP'), mul(m('lookPitch'), .6)), mul(m('lookYaw'), .45), mul(.04, { wave: 't', rate: .7 }));
rotation('cape', sub(add(.08, mul(.12, moving), mul(.05, m('capeWave'))), mul(.3, lie)), mul(.06, wave(Math.PI * 2)), mul(.03, { wave: 't', rate: .8 }));
const armSw = set('armSwing', mul(wave(Math.PI * 2), .3, moving));
rotation('armR_sh', add(m('armRx'), mul(armSw, .4), mul(.8, dead)), 0, m('armRz'));
rotation('armR_el', m('elR'), 0, -.1); rotation('armR_hand', .25, 0, 0);
rotation('armL_sh', add(sub(m('armLx'), armSw), mul(.8, dead)), 0, m('armLz'));
rotation('armL_el', m('elL'), 0, .1); rotation('armL_hand', .1, 0, 0);
for (const side of ['L', 'R'] as const) {
  const sx = side === 'L' ? 1 : -1, lsw = wave(Math.PI * 2, sx > 0 ? 0 : Math.PI);
  const kneelLeg = set(`kneel${side}`, { bounded: [term(side === 'R' ? kneel : 0)], min: 0 });
  // max(kneel, death step), expressed without changing the scalar interpreter.
  const deathLeg = step(dead, 0, .5);
  const knee = set(`knee${side}`, add(kneelLeg, { bounded: [term(sub(deathLeg, kneelLeg))], min: 0 }));
  const standLeg = side === 'L' ? mul(kneel, sub(1, deathLeg)) : 0;
  const sitHip = mul(-1.52, sit, sub(1, stand));
  rotation(`leg${side}_hip`, add(mul(-.5, lsw, moving), sitHip, mul(-.6, m('rising')), mul(-1.35, standLeg), mul(.25, knee)), 0, sx * .05);
  rotation(`leg${side}_knee`, add(mul(add(.3, mul(.45, { bounded: [term(lsw)], min: 0 })), moving), mul(1.2, m('rising')), mul(1.45, standLeg), mul(1.55, knee)), 0, 0);
  rotation(`leg${side}_foot`, sub(sub(mul(-.15, lsw, moving), mul(.3, knee)), mul(.1, standLeg)), 0, 0);
}


// Resolve ordered scratch assignments at build time, then emit only the DAG
// each joint actually needs. No scratch interpreter or executable code ships.
type IR = { op: 'n'; value: number } | { op: 'read'; key: string } | { op: 'sin' | 'abs'; a: IR }
  | { op: 'add' | 'sub' | 'mul' | 'div' | 'min' | 'max' | 'gt' | 'mod'; a: IR; b: IR } | { op: 'select'; test: IR; yes: IR; no: IR };
const vars = new Map<string, IR>();
const lit = (value: number): IR => ({ op: 'n', value });
const binary = (op: Extract<IR, { b: IR }>['op'], a: IR, b: IR): IR => ({ op, a, b });
const input = (key: string): IR => ({ op: 'read', key });
const sumIR = (terms: readonly ClipTerm[]): IR => terms.map(termIR).reduce((a, b) => binary('add', a, b));
function termIR(t: ClipTerm): IR {
  if (typeof t === 'number') return lit(t);
  const value = t.of.map(factorIR).reduce((a, b) => binary('mul', a, b));
  return t.when === undefined ? value : { op: 'select', test: condition(t.when), yes: value, no: lit(0) };
}
function condition(w: ClipWhen): IR {
  const field = w.mem;
  if (field === undefined) throw new Error('King pose has only scalar conditions');
  const value = factorIR({ mem: field.key });
  return binary('gt', value, lit(field.above ?? ((field.atLeast ?? 0) - Number.EPSILON)));
}
function factorIR(f: E): IR {
  if (typeof f === 'number') return lit(f);
  if ('mem' in f) return ['up', 'sit', 'stand', 'kneel', 'raise', 'dead', 'wind', 'cutProgress', 'recover', 'keep', 'lift', 'slam', 'burstRec', 'burstKeep'].some(key => f.mem === `king.${key}`) ? input(f.mem) : vars.get(f.mem) ?? input(f.mem);
  if ('attack' in f) return input('attack');
  if ('wave' in f) {
    let a = binary('mul', input(f.wave), lit(f.rate));
    if (f.offset !== undefined) a = binary('add', a, lit(f.offset));
    const value: IR = { op: 'sin', a };
    return f.abs === true ? { op: 'abs', a: value } : value;
  }
  if ('bounded' in f) {
    let value = sumIR(f.bounded);
    if (f.max !== undefined) value = binary('min', lit(f.max), value);
    if (f.min !== undefined) value = binary('max', lit(f.min), value);
    return f.divide === undefined ? value : binary('div', value, lit(f.divide));
  }
  throw new Error('Unexpected king pose factor');
}
const final: { bone: string; channel: ClipChannel; ir: IR }[] = [];
for (const row of rows) {
  const first = row.cases[0]; if (first === undefined) throw new Error('Missing king pose scalar');
  const value = sumIR(first.sum);
  if ('mem' in row) vars.set(row.mem, first.when === undefined ? value : { op: 'select', test: condition(first.when), yes: value, no: vars.get(row.mem) ?? input(row.mem) });
  else final.push({ bone: row.bone, channel: row.channel, ir: value });
}
function compile(b: ClientChannels, read: Parameters<NumericChannelOutput['expr']>[1], ir: IR, cache: Map<string, number>): number {
  const key = JSON.stringify(ir), old = cache.get(key); if (old !== undefined) return old;
  const at = (() => {
    if (ir.op === 'n') return b.constant(ir.value);
    if (ir.op === 'read') {
      if(ir.key==='ground'||ir.key==='alive')return read('surface',[ir.key]);
      if (ir.key === 'lookYaw' || ir.key === 'lookPitch') return read('look',[ir.key === 'lookYaw' ? 'yaw' : 'pitch']);
      return read('frame',ir.key === 'bodyY' ? ['dims','bodyY'] : ['attack','phase','t','seed','speed','flinch','deathT','dt'].includes(ir.key) ? [ir.key] : ['mem',ir.key.replaceAll('.', '')]);
    }
    if (ir.op === 'select') return b.select(compile(b, read, ir.test, cache), compile(b, read, ir.yes, cache), compile(b, read, ir.no, cache));
    const a = compile(b, read, ir.a, cache);
    return 'b' in ir ? b.binary(ir.op, a, compile(b, read, ir.b, cache)) : b.unary(ir.op, a);
  })();
  cache.set(key, at); return at;
}
const programs = final.flatMap((row, i) => {
  const [group, axis] = row.channel.split('.');
  const axes = group === 'scale' ? ['x', 'y', 'z'] : [axis];
  const cache = new WeakMap<ClientChannels, Map<string, number>>();
  return numericChannelPrograms(`king.${i}`, 'creature.pose', axes.map(a => ({ target: `joint.${row.bone.replaceAll('_', '.')}`, path: [group ?? '', a ?? ''] as const, expr: (b, read) => {
    let memo = cache.get(b); if (memo === undefined) { memo = new Map(); cache.set(b, memo); }
    return compile(b, read, row.ir, memo);
  } })));
});
// Detached view facts are numeric rows too; no draw-rate shard program runs.
const readIR=(key:string):IR=>({op:'read',key});
const addIR=(...values:IR[]):IR=>values.reduce((a,b)=>binary('add',a,b));
const mulIR=(...values:IR[]):IR=>values.reduce((a,b)=>binary('mul',a,b));
const subIR=(a:IR,b:IR):IR=>binary('sub',a,b);
const capIR=(a:IR):IR=>binary('max',lit(0),binary('min',lit(1),a));
const stepIR=(a:IR,lo=0,hi=1):IR=>{const t=capIR(binary('div',subIR(a,lit(lo)),lit(hi-lo)));return mulIR(t,t,subIR(lit(3),mulIR(lit(2),t)));};
const sinIR=(a:IR):IR=>({op:'sin',a});
const bumpIR=(a:IR):IR=>sinIR(mulIR(lit(Math.PI),capIR(a)));
const gtIR=(a:IR,b:IR):IR=>binary('gt',a,b);
const selectIR=(test:IR,yes:IR,no:IR):IR=>({op:'select',test,yes,no});
const equalIR=(a:IR,value:number):IR=>gtIR(lit(.1),{op:'abs',a:subIR(a,lit(value))});
const actIR=readIR('act'),attackIR=readIR('attack'),strikeIR=readIR('strike'),timeIR=readIR('t'),seedIR=readIR('seed');
const liveAttack=gtIR(attackIR,lit(-1e-12)),cutIR=mulIR(equalIR(actIR,1),liveAttack),wideIR=gtIR(strikeIR,lit(1.5));
const riseIR=selectIR(equalIR(readIR('pose'),0),readIR('rise'),lit(1)),upIR=stepIR(riseIR),standIR=stepIR(upIR,.45,1);
const deathIR=binary('max',lit(0),readIR('deathT'));
const inputs:Record<string,IR>={
 riseInput:riseIR,deathInput:deathIR,speed:readIR('speed'),bodyYInput:readIR('bodyY'),flinch:readIR('flinch'),
 breathe:sinIR(addIR(mulIR(timeIR,lit(1.3)),mulIR(seedIR,lit(5)))),capeWave:sinIR(addIR(mulIR(timeIR,lit(1.1)),mulIR(readIR('phase'),lit(Math.PI*2)))),
 cut:cutIR,backCut:mulIR(cutIR,equalIR(binary('mod',strikeIR,lit(2)),1)),wideRz:selectIR(wideIR,lit(.9),lit(.35)),wideSpine:selectIR(wideIR,lit(-.8),lit(-.45)),
 burst:mulIR(equalIR(actIR,2),liveAttack),hold:gtIR(lit(.72),attackIR),roar:mulIR(binary('max',equalIR(actIR,3),equalIR(actIR,4)),liveAttack),bump:bumpIR(attackIR),
 roarRx:selectIR(equalIR(actIR,4),lit(-2.2),lit(-.6)),roarLx:selectIR(equalIR(actIR,4),lit(-1.2),lit(-.6)),
 sitting:binary('max',gtIR(subIR(lit(1),stepIR(upIR,0,.55)),lit(.02)),gtIR(lit(.98),standIR)),rising:bumpIR(standIR),
 lookYaw:readIR('lookYaw'),lookPitch:readIR('lookPitch'),up:upIR,sit:stepIR(upIR,0,.55),stand:standIR,kneel:stepIR(readIR('kneelS')),raise:stepIR(readIR('raiseS')),dead:stepIR(deathIR),
 wind:stepIR(attackIR,0,.55),cutProgress:stepIR(attackIR,.55,.75),recover:stepIR(attackIR,.82,1),keep:subIR(lit(1),stepIR(attackIR,.82,1)),
 lift:stepIR(attackIR,0,.3),slam:stepIR(attackIR,.72,.82),burstRec:stepIR(attackIR,.88,1),burstKeep:subIR(lit(1),stepIR(attackIR,.88,1)),
};
const observationCache=new WeakMap<ClientChannels,Map<string,number>>();
const observationOutputs:NumericChannelOutput[]=Object.entries(inputs).map(([key,ir])=>({target:'mem',path:[`king${key}`],expr:(b,read)=>{
 let memo=observationCache.get(b);if(memo===undefined){memo=new Map();observationCache.set(b,memo);}return compile(b,read,ir,memo);
}}));
const observationPrograms=numericChannelPrograms('king.observe','king.observe',observationOutputs);

// Retain the shipped per-frame smoothing and floor arithmetic as visual data.
const frameNumber=v.pipe(v.number(),v.finite()),frameKey=v.pipe(v.string(),v.minLength(1),v.maxLength(96),v.check(value=>!['__proto__','prototype','constructor'].includes(value)));
const surfaceRows=v.parse(v.object({smooth:v.pipe(v.array(v.object({input:frameKey,output:frameKey,rate:frameNumber,initial:v.nullable(frameNumber)})),v.maxLength(16)),
  floor:v.object({field:frameKey,lift:frameKey,death:frameKey,delay:frameNumber,rate:frameNumber}),look:v.tuple([frameNumber,frameNumber,frameNumber]),group:frameKey}),speciesFrameRows.kingFrame);
v.parse(v.record(frameKey,frameNumber),speciesFrameRows.kingPoseDefaults);
v.parse(v.pipe(v.array(v.unknown()),v.maxLength(32)),observationPrograms);
const surfaceValues=new Map(surfaceRows.smooth.map(row=>[row.output,addIR(readIR(row.output),mulIR(subIR(readIR(row.input),readIR(row.output)),binary('min',lit(1),mulIR(readIR('dt'),lit(row.rate)))))]));
const floor=surfaceRows.floor,deathNext=selectIR(readIR('alive'),readIR(floor.death),addIR(readIR(floor.death),readIR('dt')));
const yOffset=subIR(addIR(subIR(surfaceValues.get(floor.field)??readIR(floor.field),readIR('ground')),readIR(floor.lift)),mulIR(binary('max',lit(0),subIR(deathNext,lit(floor.delay))),lit(floor.rate)));
const surfaceCache=new WeakMap<ClientChannels,Map<string,number>>();
const surfaceOutputs:NumericChannelOutput[]=[...surfaceValues.entries(),[floor.death,deathNext]as const].map(([key,ir])=>({target:'mem',path:[key],expr:(b,read)=>{
  let cache=surfaceCache.get(b);if(cache===undefined){cache=new Map();surfaceCache.set(b,cache);}return compile(b,read,ir,cache);
}}));
surfaceOutputs.push({target:'visual',path:['yOffset'],expr:(b,read)=>{let cache=surfaceCache.get(b);if(cache===undefined){cache=new Map();surfaceCache.set(b,cache);}return compile(b,read,yOffset,cache);}});
const surfacePrograms=numericChannelPrograms('king.surface','king.surface',surfaceOutputs);
export const GOLDEN_KING_POSE = { group: 'creature.pose', programs: [...programs,...observationPrograms,...surfacePrograms] };

