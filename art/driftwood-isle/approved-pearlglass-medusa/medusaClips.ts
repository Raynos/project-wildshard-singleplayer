import { numericChannelPrograms, type NumericChannelOutput } from '../../../src/sdk/clientChannels';
type Builder=Parameters<NumericChannelOutput['expr']>[0];
type Read=Parameters<NumericChannelOutput['expr']>[1];
function motion(b:Builder,r:Read){
 const n=(x:number)=>b.constant(x),add=(x:number,y:number)=>b.binary('add',x,y),sub=(x:number,y:number)=>b.binary('sub',x,y),mul=(x:number,y:number)=>b.binary('mul',x,y);
 const clamp=(x:number)=>b.binary('max',n(0),b.binary('min',n(1),x));
 const dead=clamp(r('frame',['deathT'])),live=sub(n(1),dead),attack=r('frame',['attack']);
 const ramp=(lo:number,hi:number)=>clamp(b.binary('div',sub(attack,n(lo)),n(hi-lo)));
 const active=b.binary('gt',attack,n(-.5));
 const tell=mul(active,mul(ramp(0,.28),sub(n(1),ramp(.31,.39))));
 const thrust=mul(active,mul(ramp(.31,.40),sub(n(1),ramp(.56,.90))));
 return {n,add,sub,mul,dead,live,tell,thrust,flinch:mul(live,clamp(r('frame',['flinch']))),wave:(offset:number)=>b.unary('sin',add(mul(r('frame',['t']),n(2.1)),n(offset)))};
}
/** Own-rig motion driven by the actual attack phase. Rigid transforms only;
 * no root lift, hidden geometry correction, cloned limb animation or memory clock.
 * Death requires existing physical corpse admission; standard flight-to-floor is unsafe. */
export function medusaClips(){
 const outputs:NumericChannelOutput[]=[];
 const channel=(joint:string,property:'position'|'rotation',axis:'x'|'y'|'z',expr:NumericChannelOutput['expr'])=>outputs.push({target:`joint.${joint.replaceAll('_','.')}`,path:[property,axis],expr});
 channel('body','rotation','x',(b,r)=>{const e=motion(b,r);return e.add(e.mul(e.n(-.08),e.flinch),e.mul(e.n(-.65),e.dead));});
 channel('body','rotation','z',(b,r)=>{const e=motion(b,r);return e.mul(e.n(.22),e.dead);});
 channel('bell','position','y',(b,r)=>{const e=motion(b,r);return e.add(e.n(.30),e.mul(e.live,e.add(e.mul(e.n(.045),e.wave(0)),e.add(e.mul(e.n(.12),e.tell),e.mul(e.n(-.08),e.thrust)))));});
 channel('head','rotation','y',(b,r)=>{const e=motion(b,r);return e.mul(e.live,e.mul(e.n(.035),e.wave(1)));});
 for(let k=0;k<8;k++)for(let j=0;j<3;j++){
  const phase=k*.7-j*.8,radial=Math.cos(k*Math.PI/4+.18);
  channel(`ribbon${k}_${j}`,'rotation','x',(b,r)=>{const e=motion(b,r);return e.add(e.mul(e.live,e.add(e.mul(e.n(.055+.015*j),e.wave(phase)),e.add(e.mul(e.n(-.10*radial),e.tell),e.mul(e.n(.12*radial),e.thrust)))),e.mul(e.n(.18+.07*j),e.dead));});
  channel(`ribbon${k}_${j}`,'rotation','z',(b,r)=>{const e=motion(b,r);return e.mul(e.live,e.add(e.mul(e.n(.04),e.wave(phase+1.4)),e.mul(e.n(.04*radial),e.flinch)));});
 }
 return {group:'creature.pose',states:['idle','alert','stalk','attack','dead'],scalars:[],programs:outputs.flatMap((row,i)=>numericChannelPrograms(`pearlglass-medusa.motion1.${i}`,'creature.pose',[row]))};
}
