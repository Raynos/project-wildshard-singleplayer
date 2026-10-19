import { numericChannelPrograms, type NumericChannelOutput } from '@wildshard/sdk/clientChannels';
/** Native numeric poses, no runtime callbacks or arbitrary root displacement.
 * Idle holds planted feet. Attack is a readable open/close bite. Tail sweep is
 * anticipation only until an explicit combat strike declaration is reviewed.
 * Death closes the jaw in place; physical corpse support must be independently admitted.
 */
export function keelmawNativeClips() {
 const rows: NumericChannelOutput[]=[];
 const channel=(joint:string,axis:'x'|'y'|'z',expr:NumericChannelOutput['expr'])=>rows.push({target:`joint.${joint}`,path:['rotation',axis],expr});
 const terms=(b:Parameters<NumericChannelOutput['expr']>[0],r:Parameters<NumericChannelOutput['expr']>[1])=>{
  const n=(x:number)=>b.constant(x),add=(x:number,y:number)=>b.binary('add',x,y),mul=(x:number,y:number)=>b.binary('mul',x,y),sub=(x:number,y:number)=>b.binary('sub',x,y);
  const clamp=(x:number)=>b.binary('max',n(0),b.binary('min',n(1),x));
  const smooth=(x:number)=>{const q=clamp(x);return mul(mul(q,q),sub(n(3),mul(n(2),q)));};
  const ramp=(start:number,duration:number)=>smooth(b.binary('div',sub(r('scalars',['clock']),n(start)),n(duration)));
  const dead=smooth(r('frame',['deathT'])),live=sub(n(1),dead),active=b.binary('gt',r('scalars',['step']),n(.5));
  const tell=mul(active,mul(ramp(0,.65),sub(n(1),ramp(.8,.18)))),snap=mul(active,mul(ramp(.8,.18),sub(n(1),ramp(1.15,.6))));
  const idle=mul(live,b.unary('sin',mul(r('frame',['t']),n(1.6)))),hit=mul(live,clamp(r('frame',['flinch'])));
  return{n,add,mul,sub,dead,live,tell,snap,idle,hit};
 };
 channel('jaw','x',(b,r)=>{const e=terms(b,r);return e.add(e.mul(e.n(-.29),e.dead),e.mul(e.live,e.add(e.mul(e.n(.06),e.tell),e.mul(e.n(-.29),e.snap))));});
 channel('head','x',(b,r)=>{const e=terms(b,r);return e.add(e.mul(e.n(-.055),e.hit),e.mul(e.live,e.add(e.mul(e.n(-.055),e.tell),e.mul(e.n(.03),e.snap))));});
 channel('neck1','x',(b,r)=>{const e=terms(b,r);return e.mul(e.n(-.012),e.idle);});
 for(const [i,name]of ['tail1','tail2','tail3'].entries()) channel(name,'y',(b,r)=>{const e=terms(b,r);return e.mul(e.live,e.add(e.mul(e.n(.012+i*.006),e.idle),e.mul(e.n(.025+i*.015),e.tell)));});
 return {group:'creature.pose',states:['idle','attack','alert'],scalars:[{name:'step',path:['mem','keelmaw-step'],fallback:0},{name:'clock',path:['mem','keelmaw-clock'],fallback:0}],programs:rows.flatMap((row,i)=>numericChannelPrograms(`keelmaw-native-v1.${i}`,'creature.pose',[row]))};
}
