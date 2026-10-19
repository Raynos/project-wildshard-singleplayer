import { numericChannelPrograms, type NumericChannelOutput } from '@wildshard/sdk/clientChannels';

export const BRINE_PITCHER_JOINTS = ['body', 'head', 'leftHead', 'rightHead', 'headLid', 'leftHeadLid', 'rightHeadLid'];
type Builder = Parameters<NumericChannelOutput['expr']>[0];
type Read = Parameters<NumericChannelOutput['expr']>[1];
function expression(b: Builder, r: Read, index: number) {
  const n = (v: number) => b.constant(v), add = (a: number, c: number) => b.binary('add', a, c), mul = (a: number, c: number) => b.binary('mul', a, c), sub = (a: number, c: number) => b.binary('sub', a, c);
  const clamp = (v: number) => b.binary('max', n(0), b.binary('min', n(1), v));
  const smooth = (v: number) => { const t = clamp(v); return mul(mul(t,t),sub(n(3),mul(n(2),t))); };
  const ramp = (start: number, duration: number) => smooth(b.binary('div', sub(r('scalars',['clock']),n(start)), n(duration)));
  const active = b.binary('gt', n(.5), b.unary('abs', sub(r('scalars',['step']), n(index+1))));
  const wind = index === 0 ? 1.15 : .95, strike = index === 0 ? .16 : .14;
  const tell = mul(active,mul(ramp(0,wind*.75),sub(n(1),ramp(wind,strike))));
  const snap = mul(active,mul(ramp(wind,strike),sub(n(1),ramp(wind+strike,.8))));
  const dead = smooth(r('frame',['deathT'])), live = sub(n(1),dead);
  const idle = mul(live,mul(n(.025),b.unary('sin',add(mul(r('frame',['t']),n(1.4)),n(index*1.8)))));
  const hit = mul(live,clamp(r('frame',['flinch'])));
  return { n,add,mul,dead,live,idle,hit,tell,snap };
}
/** Absolute bind pivots stay fixed. Only heads and their child lids articulate. */
export function brinePitcherNativeClips(): { group: string; states: string[]; scalars: { name: string; path: string[]; fallback: number }[]; programs: ReturnType<typeof numericChannelPrograms> } {
  const rows: NumericChannelOutput[] = [];
  const channel = (joint: string, axis: 'x' | 'z', expr: NumericChannelOutput['expr']) => rows.push({ target: `joint.${joint}`, path: ['rotation',axis], expr });
  for (const [index,joint] of ['head','leftHead','rightHead'].entries()) {
    channel(joint,'x',(b,r) => { const e=expression(b,r,index);return e.add(e.idle,e.add(e.mul(e.live,e.add(e.mul(e.n(-.12),e.tell),e.mul(e.n(.24),e.snap))),e.add(e.mul(e.n(-.12),e.hit),e.mul(e.n(.40),e.dead)))); });
    channel(`${joint}Lid`,'x',(b,r) => { const e=expression(b,r,index);return e.add(e.mul(e.n(2),e.idle),e.add(e.mul(e.live,e.add(e.mul(e.n(-.40),e.tell),e.mul(e.n(.50),e.snap))),e.add(e.mul(e.n(.18),e.hit),e.mul(e.n(.85),e.dead)))); });
    channel(joint,'z',(b,r) => { const e=expression(b,r,index);return e.mul(e.n(index===1?.18:index===2?-.18:0),e.dead); });
  }
  return { group:'creature.pose', states:['idle','attack','alert'], scalars:[{ name:'step',path:['mem','pitcher-step'],fallback:0 },{ name:'clock',path:['mem','pitcher-clock'],fallback:0 }], programs: rows.flatMap((row,i)=>numericChannelPrograms(`pitcher-native-v1.${i}`,'creature.pose',[row])) };
}
