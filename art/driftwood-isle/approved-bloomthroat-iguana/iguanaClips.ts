import { numericChannelPrograms, type NumericChannelOutput } from '../../../src/sdk/clientChannels';
type Builder=Parameters<NumericChannelOutput['expr']>[0];
type Read=Parameters<NumericChannelOutput['expr']>[1];
function motion(b:Builder,r:Read){
 const n=(x:number)=>b.constant(x),add=(x:number,y:number)=>b.binary('add',x,y),sub=(x:number,y:number)=>b.binary('sub',x,y),mul=(x:number,y:number)=>b.binary('mul',x,y);
 const clamp=(x:number)=>b.binary('max',n(0),b.binary('min',n(1),x));
 const dead=clamp(r('frame',['deathT'])),live=sub(n(1),dead),attack=r('frame',['attack']);
 const ramp=(lo:number,hi:number)=>clamp(b.binary('div',sub(attack,n(lo)),n(hi-lo))),active=b.binary('gt',attack,n(-.5));
 const tell=mul(active,mul(ramp(0,.25),sub(n(1),ramp(.30,.38)))),strike=mul(active,mul(ramp(.30,.40),sub(n(1),ramp(.48,.85))));
 return {n,add,sub,mul,clamp,dead,live,tell,strike,flinch:mul(live,clamp(r('frame',['flinch']))),wave:(phase:number)=>b.unary('sin',add(mul(r('frame',['t']),n(2.8)),n(phase)))};
}
/** All transforms address this model's real bones. Identity-oriented absolute
 * native pivots, no Blender-axis reuse, root lift, scaling or callbacks.
 * Death pose is a grounded sag source candidate; physical death not admitted. */
export function iguanaClips(){
 const outputs:NumericChannelOutput[]=[];
 const channel=(joint:string,property:'position'|'rotation',axis:'x'|'y'|'z',expr:NumericChannelOutput['expr'])=>outputs.push({target:`joint.${joint}`,path:[property,axis],expr});
 channel('neck','rotation','x',(b,r)=>{const e=motion(b,r);return e.add(e.mul(e.n(.18),e.dead),e.mul(e.live,e.add(e.mul(e.n(-.09),e.tell),e.mul(e.n(.12),e.strike))));});
 channel('head','rotation','x',(b,r)=>{const e=motion(b,r);return e.add(e.mul(e.n(.09),e.dead),e.add(e.mul(e.n(-.10),e.flinch),e.mul(e.live,e.mul(e.n(.012),e.wave(0)))));});
 channel('jaw','rotation','x',(b,r)=>{const e=motion(b,r);return e.mul(e.live,e.mul(e.n(.20),e.strike));});
 for(let j=0;j<7;j++){
  channel(`bloom${j}`,'rotation','z',(b,r)=>{const e=motion(b,r);return e.add(e.mul(e.n((j-3)*.045),e.dead),e.mul(e.live,e.add(e.mul(e.n((j-3)*.055),e.tell),e.mul(e.n(.018),e.wave(j*.5)))));});
  channel(`bloom${j}`,'rotation','x',(b,r)=>{const e=motion(b,r);return e.add(e.mul(e.n(.12),e.dead),e.mul(e.live,e.add(e.mul(e.n(-.20),e.tell),e.mul(e.n(.09),e.strike))));});
 }
 for(let j=0;j<4;j++)channel(`tail${j}`,'rotation','y',(b,r)=>{const e=motion(b,r);return e.add(e.mul(e.n(.025),e.dead),e.mul(e.live,e.add(e.mul(e.n(.025),e.wave(j*.6)),e.mul(e.n(-.045),e.strike))));});
 for(const [i,joint] of ['legFL','legFR','legBL','legBR'].entries()){
  channel(joint,'position','y',(b,r)=>{const e=motion(b,r);const speed=e.clamp(r('frame',['speed']));return e.add(e.n(i<2?-.04:-.12),e.mul(e.live,e.mul(speed,e.mul(e.n(.055),b.binary('max',e.n(0),e.wave(i%2*Math.PI))))));});
  channel(joint,'position','z',(b,r)=>{const e=motion(b,r);return e.add(e.n(i<2?.82:-.50),e.mul(e.live,e.mul(e.clamp(r('frame',['speed'])),e.mul(e.n(.075),e.wave(i%2*Math.PI)))));});
 }
 return {group:'creature.pose',states:['idle','alert','stalk','attack','dead'],scalars:[],programs:outputs.flatMap((row,i)=>numericChannelPrograms(`bloomthroat-iguana.motion1.${i}`,'creature.pose',[row]))};
}
