import { numericChannelPrograms, type NumericChannelOutput } from '@wildshard/sdk/clientChannels';

type Builder = Parameters<NumericChannelOutput['expr']>[0];
type Read = Parameters<NumericChannelOutput['expr']>[1];
type Keys = readonly (readonly [number, number])[];
export const MANTIS_COMPLETE_STRIKES = ['strike.splinter-mantis.first', 'strike.splinter-mantis.second'];

/** Authored FK keys, not a fitted foot target or a runtime reach solve. Hip yaw preserves leg height.
 * The stance interval is [0,.62]; its linear return is followed by the authored lifted return.
 * These are source candidates, not accepted planted-contact or anatomical trajectories. */
const HIP_SWEEP: Keys = [[0,1],[.62,-1],[.72,-.78],[.84,.12],[.94,.88],[1,1]];
const KNEE_LIFT: Keys = [[0,0],[.60,0],[.70,.14],[.82,.24],[.94,.10],[1,0]];
function motion(b: Builder, read: Read) {
  const constants = new Map<number,number>();
  const n=(v:number)=>{const old=constants.get(v);if(old!==undefined)return old;const id=b.constant(v);constants.set(v,id);return id;};
  const add=(a:number,c:number)=>b.binary('add',a,c),sub=(a:number,c:number)=>b.binary('sub',a,c),mul=(a:number,c:number)=>b.binary('mul',a,c);
  const clamp=(a:number)=>b.binary('max',n(0),b.binary('min',n(1),a));
  const smooth=(a:number)=>{const t=clamp(a);return mul(mul(t,t),sub(n(3),mul(n(2),t)));};
  const memo=<T>(make:()=>T):(()=>T)=>{let value:{result:T}|undefined;return()=>{value??={result:make()};return value.result;};};
  const phase=memo(()=>read('strike',['phase'])),index=memo(()=>read('strike',['index'])),elapsed=memo(()=>read('strike',['elapsed']));
  const eq=(a:number,c:number)=>mul(b.binary('gt',a,n(c-.5)),b.binary('gt',n(c+.5),a));
  const wind=memo(()=>eq(phase(),1)),active=memo(()=>eq(phase(),2)),recover=memo(()=>eq(phase(),3));
  const first=memo(()=>eq(index(),1)),second=memo(()=>eq(index(),2));
  const normalized=memo(()=>b.binary('div',elapsed(),b.select(first(),n(.75),n(.45))));
  const recovery=memo(()=>smooth(b.binary('div',elapsed(),b.select(first(),n(.12),n(1.1)))));
  const dead=memo(()=>smooth(read('frame',['deathT']))),live=memo(()=>sub(n(1),dead()));
  const kneeDead=memo(()=>smooth(mul(read('frame',['deathT']),n(2.5))));
  const sample=(clock:number,keys:Keys,linear=false)=>b.sample(clock,keys,linear?'linear':'smoothstep');
  const envelope=memo(()=>add(mul(wind(),smooth(mul(normalized(),n(4)))),add(active(),mul(recover(),sub(n(1),recovery())))));
  const selected=(side:number)=>side===-1?first():second();
  const strike=(side:number,keys:Keys,endpoint:number)=>mul(selected(side),add(mul(wind(),sample(normalized(),keys)),
    mul(n(endpoint),add(active(),mul(recover(),sub(n(1),recovery()))))));
  const whole=(keys:Keys,endpoint:number)=>add(mul(wind(),sample(normalized(),keys)),mul(n(endpoint),add(active(),mul(recover(),sub(n(1),recovery())))));
  const speed=memo(()=>clamp(b.binary('div',b.unary('abs',read('frame',['speed'])),n(1.15))));
  const gait=memo(()=>mul(speed(),sub(n(1),envelope())));
  const idle=memo(()=>b.unary('sin',mul(read('frame',['t']),n(1.8))));
  // Same real speed on both sides of a phase transition; no active-duration guess or phase-reset pulse.
  const drive=memo(()=>mul(envelope(),clamp(b.binary('div',b.unary('abs',read('frame',['speed'])),n(7)))));
  const flinch=memo(()=>mul(live(),clamp(read('frame',['flinch']))));
  return { n,add,sub,mul,smooth,sample,strike,whole,selected,
    get dead(){return dead();},get kneeDead(){return kneeDead();},get live(){return live();},get idle(){return idle();},
    get gait(){return gait();},get drive(){return drive();},get flinch(){return flinch();},get envelope(){return envelope();},
    get turn(){return sub(first(),second());},
    get travel(){return add(gait(),mul(n(.24),drive()));},
    gaitPhase:(offset:number)=>b.binary('mod',add(mul(read('frame',['phase']),n(2)),n(offset)),n(1)),
    alive:(value:number)=>mul(live(),value),
  };
}

/** Complete source choreography. Reads the existing authoritative phase-local clock through strict opt-in.
 * No root/physics changes. Native geometry, bone lengths, lower death and combat declarations stay preserved.
 * Long active is an extended moving lunge with short supporting steps, not repeated damage swings; speed drives compression across recovery.
 * This bounded attempt must be rejected if source contact/transition checks fail. */
export function mantisCompleteMotionClips(): { group: string; states: string[]; strikeIds: string[]; programs: ReturnType<typeof numericChannelPrograms> } {
  const outputs:NumericChannelOutput[]=[];
  const channel=(joint:string,property:'position'|'rotation',axis:'x'|'y'|'z',expr:NumericChannelOutput['expr'])=>{
    outputs.push({target:`joint.${joint.replaceAll('_','.')}`,path:[property,axis],expr});
  };
  channel('body','position','y',(b,r)=>{const e=motion(b,r);return e.add(r('frame',['dims','bodyY']),e.add(e.alive(e.add(e.mul(e.n(.008),e.idle),e.mul(e.n(.075),e.envelope))),e.add(e.mul(e.n(-.80),e.dead),e.mul(e.n(.09),e.flinch))));});
  channel('body','rotation','x',(b,r)=>{const e=motion(b,r);return e.add(e.alive(e.add(e.whole([[0,0],[.3,-.035],[.48,-.035],[1,.045]],.045),e.mul(e.n(.035),e.drive))),e.mul(e.n(-.12),e.flinch));});
  channel('body','rotation','z',(b,r)=>{const e=motion(b,r);return e.mul(e.n(.40),e.dead);});
  channel('neck','rotation','x',(b,r)=>{const e=motion(b,r);return e.add(e.alive(e.add(e.mul(e.n(.015),e.idle),e.add(e.whole([[0,0],[.32,-.10],[.48,-.10],[1,.12]],.12),e.mul(e.n(.055),e.drive)))),e.add(e.mul(e.n(-.15),e.flinch),e.mul(e.n(.25),e.dead)));});
  channel('head','rotation','x',(b,r)=>{const e=motion(b,r);return e.add(e.alive(e.add(e.mul(e.n(-.02),e.idle),e.mul(e.n(-.07),e.drive))),e.mul(e.n(.30),e.dead));});
  channel('head','rotation','y',(b,r)=>{const e=motion(b,r);return e.alive(e.mul(e.n(.045),e.mul(e.turn,e.envelope)));});
  channel('abdomen','rotation','x',(b,r)=>{const e=motion(b,r);return e.add(e.alive(e.add(e.mul(e.n(.018),e.idle),e.mul(e.n(-.06),e.drive))),e.mul(e.n(.05),e.dead));});
  for(const side of [-1,1]) {
    for(const index of [0,1]) {
      channel(`wing${side}_${index}`,'rotation','z',(b,r)=>{const e=motion(b,r);return e.mul(e.n(side),e.add(e.alive(e.add(e.mul(e.n(.025),e.idle),e.whole([[0,0],[.34,.09],[.52,.09],[1,.025]],.025))),e.mul(e.n(index===0?.18:.08),e.dead)));});
      const offset=(side===-1?index:1-index)*.5;
      channel(`leg${side}_${index}`,'rotation','x',(b,r)=>{const e=motion(b,r);return e.mul(e.n(-.18),e.dead);});
      channel(`leg${side}_${index}`,'rotation','y',(b,r)=>{const e=motion(b,r);return e.alive(e.mul(e.n(-side*(index===0?.28:.235)),e.mul(e.travel,e.sample(e.gaitPhase(offset),HIP_SWEEP,true))));});
      channel(`leg${side}_${index}`,'rotation','z',(b,r)=>{const e=motion(b,r);return e.mul(e.n(side*1.4),e.dead);});
      channel(`leg${side}_${index}_knee`,'rotation','z',(b,r)=>{const e=motion(b,r);return e.mul(e.n(side),e.add(e.alive(e.mul(e.travel,e.sample(e.gaitPhase(offset),KNEE_LIFT))),e.add(e.mul(e.n(.38),e.kneeDead),e.mul(e.n(2),e.mul(e.kneeDead,e.sub(e.n(1),e.kneeDead))))));});
    }
    const limb=`raptor${side}`;
    channel(limb,'rotation','x',(b,r)=>{const e=motion(b,r);return e.add(e.alive(e.add(e.strike(side,[[0,0],[.3,-.45],[.45,-.45],[1,.65]],.65),e.mul(e.n(.12),e.mul(e.selected(side),e.drive)))),e.add(e.mul(e.n(-.10),e.flinch),e.mul(e.n(side===-1?.38:.52),e.dead)));});
    channel(limb,'rotation','z',(b,r)=>{const e=motion(b,r);return e.mul(e.n(side),e.add(e.alive(e.whole([[0,0],[.3,.08],[.45,.08],[1,0]],0)),e.mul(e.n(side===-1?1.30:1.48),e.dead)));});
    channel(`${limb}_elbow`,'rotation','x',(b,r)=>{const e=motion(b,r);return e.add(e.alive(e.add(e.strike(side,[[0,0],[.3,.35],[.45,.35],[1,-.65]],-.65),e.mul(e.n(-.08),e.mul(e.selected(side),e.drive)))),e.mul(e.n(side===-1?.72:.85),e.dead));});
    channel(`${limb}_hook`,'rotation','y',(b,r)=>{const e=motion(b,r);return e.mul(e.n(side),e.add(e.alive(e.strike(side,[[0,0],[.45,0],[1,-.32]],-.32)),e.mul(e.n(side===-1?.10:.20),e.dead)));});
  }
  return {group:'creature.pose',states:['stalk','attack','alert','idle'],strikeIds:[...MANTIS_COMPLETE_STRIKES],
    programs:outputs.flatMap((row,i)=>numericChannelPrograms(`mantis-v7-native.complete.${i}`,'creature.pose',[row]))};
}
