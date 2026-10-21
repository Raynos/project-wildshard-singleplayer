import { numericChannelPrograms, type NumericChannelOutput } from '@wildshard/sdk/clientChannels';

const BRINE_PITCHER_JOINTS = ['body', 'head', 'leftHead', 'rightHead', 'headLid', 'leftHeadLid', 'rightHeadLid'];
type Builder = Parameters<NumericChannelOutput['expr']>[0];
type Read = Parameters<NumericChannelOutput['expr']>[1];
function expression(b: Builder, r: Read, index: number) {
  const constants = new Map<number, number>();
  const n = (value: number) => { const found = constants.get(value); if (found !== undefined) return found; const node = b.constant(value); constants.set(value,node); return node; };
  const add = (a: number, c: number) => b.binary('add', a, c), mul = (a: number, c: number) => b.binary('mul', a, c), sub = (a: number, c: number) => b.binary('sub', a, c);
  const clamp = (v: number) => b.binary('max', n(0), b.binary('min', n(1), v));
  const smooth = (v: number) => { const t = clamp(v); return mul(mul(t,t),sub(n(3),mul(n(2),t))); };
  const wind = index === 0 ? 1.15 : .95, strike = index === 0 ? .16 : .14;
  const phase = r('strike',['phase']);
  const clock = add(r('strike',['elapsed']),add(mul(b.binary('gt',phase,n(1.5)),n(wind)),mul(b.binary('gt',phase,n(2.5)),n(strike))));
  const ramp = (start: number, duration: number) => smooth(b.binary('div', sub(clock,n(start)), n(duration)));
  const active = b.binary('gt', n(.5), b.unary('abs', sub(r('strike',['index']), n(index === 0 ? 1 : 2))));
  const tell = mul(active,mul(ramp(0,wind*.75),sub(n(1),ramp(wind,strike))));
  const snap = mul(active,mul(ramp(wind,strike),sub(n(1),ramp(wind+strike,.8))));
  const idle = mul(n(.025),b.unary('sin',add(mul(r('frame',['t']),n(1.4)),n(index*1.8))));
  const hit = clamp(r('frame',['flinch']));
  return { n,add,mul,idle,hit,tell,snap };
}
/** Retained native7 rig with explicit native-owner hit/death entry poses.
 * Living shapes follow the actual strike phase and clock, not guest memory. Death blends the actual lethal
 * endpoint into the same authored droop, not a reset idle pose or second clock.
 * This declaration grants no physical/contact or visual acceptance.
 */
export function brinePitcherNativeOwnerClips(): { practiceTransition: { owner: 'isolated-practice'; joints: string[] }; group: string; states: string[]; strikeIds: string[]; programs: ReturnType<typeof numericChannelPrograms> } {
  const rows: NumericChannelOutput[] = [];
  const channel = (joint: string, axis: 'x' | 'z', expr: NumericChannelOutput['expr']) => rows.push({
    target: `joint.${joint}`, path: ['rotation',axis], expr: (b,r) => {
      const constants = new Map<number, number>();
      const n = (value: number) => { const found = constants.get(value); if (found !== undefined) return found; const node = b.constant(value); constants.set(value,node); return node; };
      const add = (a: number, c: number) => b.binary('add', a, c);
      const mul = (a: number, c: number) => b.binary('mul', a, c);
      const sub = (a: number, c: number) => b.binary('sub', a, c);
      const dead = b.binary('gt', r('transition', ['kind']), n(1.5));
      const hit = b.binary('gt', r('transition', ['kind']), n(.5));
      const duration = add(mul(dead,n(1)),mul(sub(n(1),dead),n(.18)));
      const t = b.binary('min',n(1),b.binary('max',n(0),b.binary('div',r('transition',['elapsed']),duration)));
      const weight = mul(hit,sub(n(1),mul(mul(t,t),sub(n(3),mul(n(2),t)))));
      const end = axis === 'x' ? joint.endsWith('Lid') ? .85 : .40 : joint === 'leftHead' ? .18 : joint === 'rightHead' ? -.18 : 0;
      const target = add(mul(dead,n(end)),mul(sub(n(1),dead),expr(b,r)));
      return add(mul(weight,r(`entry.${joint}`,['rotation',axis])),mul(sub(n(1),weight),target));
    },
  });
  for (const [index,joint] of ['head','leftHead','rightHead'].entries()) {
    channel(joint,'x',(b,r) => { const e=expression(b,r,index);return e.add(e.idle,e.add(e.add(e.mul(e.n(-.12),e.tell),e.mul(e.n(.24),e.snap)),e.mul(e.n(-.12),e.hit))); });
    channel(`${joint}Lid`,'x',(b,r) => { const e=expression(b,r,index);return e.add(e.mul(e.n(2),e.idle),e.add(e.add(e.mul(e.n(-.40),e.tell),e.mul(e.n(.50),e.snap)),e.mul(e.n(.18),e.hit))); });
    channel(joint,'z',b => b.constant(0));
  }
  return { practiceTransition: { owner: 'isolated-practice' as const, joints: BRINE_PITCHER_JOINTS }, group:'creature.pose', states:['idle','attack','alert'], strikeIds: ['strike.pitcher.crown','strike.pitcher.bilateral'], programs: rows.flatMap((row,i)=>numericChannelPrograms(`pitcher-native-owner-v1.${i}`,'creature.pose',[row])) };
}
