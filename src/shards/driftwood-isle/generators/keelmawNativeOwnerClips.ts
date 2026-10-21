import { numericChannelPrograms, type NumericChannelOutput } from '@wildshard/sdk/clientChannels';

export const KEELMAW_NATIVE_JOINTS = ['body', 'neck1', 'head', 'jaw', 'tail1', 'tail2', 'tail3',
  'FL_shoulder', 'FL_carpus', 'FL_fetlock', 'FR_shoulder', 'FR_carpus', 'FR_fetlock',
  'BL_hip', 'BL_stifle', 'BL_hock', 'BR_hip', 'BR_stifle', 'BR_hock'];
type Builder = Parameters<NumericChannelOutput['expr']>[0];
type Read = Parameters<NumericChannelOutput['expr']>[1];
function terms(b: Builder, r: Read) {
  const n = (x: number) => b.constant(x), add = (a: number, c: number) => b.binary('add', a, c);
  const sub = (a: number, c: number) => b.binary('sub', a, c), mul = (a: number, c: number) => b.binary('mul', a, c);
  const smooth = (value: number) => { const t = b.binary('max', n(0), b.binary('min', n(1), value)); return mul(mul(t,t),sub(n(3),mul(n(2),t))); };
  const phase = r('strike', ['phase']), clock = r('strike', ['elapsed']);
  const stage = (value: number) => b.binary('gt', n(.5), b.unary('abs', sub(phase,n(value))));
  const active = smooth(b.binary('div',clock,n(.18)));
  const tell = add(mul(stage(1),smooth(b.binary('div',clock,n(.65)))),mul(stage(2),sub(n(1),active)));
  const snap = add(mul(stage(2),active),mul(stage(3),sub(n(1),smooth(b.binary('div',clock,n(.6))))));
  return { n, add, sub, mul, smooth, tell, snap };
}
/** Actual strike-owner clock drives retained bite amplitudes; hits/death latch the published endpoint.
 * No root displacement, gait claim, physical corpse recipe or shared-arena admission is implied. */
export function keelmawNativeOwnerClips(): { practiceTransition: { owner: 'isolated-practice'; joints: string[] };
  strikeIds: string[]; group: string; states: string[]; programs: ReturnType<typeof numericChannelPrograms> } {
  const rows: NumericChannelOutput[] = [];
  const channel = (joint: string, axis: 'x' | 'y', live: NumericChannelOutput['expr']) => rows.push({
    target: `joint.${joint}`, path: ['rotation',axis], expr: (b,r) => {
      const n = (x: number) => b.constant(x), add = (a: number,c: number) => b.binary('add',a,c);
      const sub = (a: number,c: number) => b.binary('sub',a,c), mul = (a: number,c: number) => b.binary('mul',a,c);
      const dead = b.binary('gt',r('transition',['kind']),n(1.5));
      const hit = b.binary('gt',r('transition',['kind']),n(.5));
      const duration = b.select(dead,n(1),n(.18));
      const t = b.binary('max',n(0),b.binary('min',n(1),b.binary('div',r('transition',['elapsed']),duration)));
      const weight = mul(hit,sub(n(1),mul(mul(t,t),sub(n(3),mul(n(2),t)))));
      const target = b.select(dead,n(joint === 'jaw' ? -.29 : 0),live(b,r));
      return add(mul(weight,r(`entry.${joint}`,['rotation',axis])),mul(sub(n(1),weight),target));
    },
  });
  channel('jaw','x',(b,r) => { const e=terms(b,r); return e.add(e.mul(e.n(.06),e.tell),e.mul(e.n(-.29),e.snap)); });
  channel('head','x',(b,r) => { const e=terms(b,r); return e.add(e.mul(e.n(-.055),e.tell),e.mul(e.n(.03),e.snap)); });
  channel('neck1','x',(b,r) => b.binary('mul',b.constant(-.012),b.unary('sin',b.binary('mul',r('frame',['t']),b.constant(1.6)))));
  for (const [index,name] of ['tail1','tail2','tail3'].entries()) channel(name,'y',(b,r) => {
    const e=terms(b,r); return e.add(e.mul(e.n(.012+index*.006),b.unary('sin',e.mul(r('frame',['t']),e.n(1.6)))),e.mul(e.n(.025+index*.015),e.tell));
  });
  return { practiceTransition: { owner: 'isolated-practice' as const, joints: KEELMAW_NATIVE_JOINTS },
    strikeIds: ['strike.keelmaw.bite'], group: 'creature.pose', states: ['idle','attack','alert'],
    programs: rows.flatMap((row,index) => numericChannelPrograms(`keelmaw-native-owner-v1.${index}`,'creature.pose',[row])) };
}
