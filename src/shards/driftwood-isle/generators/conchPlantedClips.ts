import contactCurve from '../data/conchPlantedContact.json' with { type: 'json' };
import { numericChannelPrograms, type NumericChannelOutput } from '@wildshard/sdk/clientChannels';

type Builder = Parameters<NumericChannelOutput['expr']>[0];
type Read = Parameters<NumericChannelOutput['expr']>[1];
export const CONCH_PLANTED_JOINTS = ['body', 'shell', 'head', 'eyestalkLeft', 'eyestalkRight',
  'shieldArm', 'shieldForearm', 'rapierArm', 'rapierForearm',
  'legLeft', 'legLeftKnee', 'legLeftAnkle', 'legRight', 'legRightKnee', 'legRightAnkle'];

function motion(b: Builder, read: Read) {
  const n = (x: number) => b.constant(x), add = (a: number, c: number) => b.binary('add', a, c);
  const sub = (a: number, c: number) => b.binary('sub', a, c), mul = (a: number, c: number) => b.binary('mul', a, c);
  const clamp = (x: number) => b.binary('max', n(0), b.binary('min', n(1), x));
  const smooth = (x: number) => { const t = clamp(x); return mul(mul(t,t),sub(n(3),mul(n(2),t))); };
  const memo = (make: () => number) => { let value: number | undefined; return () => { value ??= make(); return value; }; };
  const stage = memo(() => read('scalars',['stage'])), clock = memo(() => read('scalars',['clock']));
  const equal = (x: number) => mul(b.binary('gt',stage(),n(x-.5)),b.binary('gt',n(x+.5),stage()));
  const moving = memo(() => b.binary('gt',n(0),read('frame',['deathT'])));
  const attack = memo(() => mul(moving(),add(equal(1),equal(3))));
  const dead = memo(() => smooth(read('frame',['deathT']))), live = memo(() => sub(n(1),dead()));
  const windup = memo(() => b.select(equal(3),n(.45),n(.6)));
  const ramp = (lo: number, hi: number) => smooth(b.binary('div',sub(clock(),lo),sub(hi,lo)));
  const tell = memo(() => mul(attack(),mul(ramp(n(0),mul(windup(),n(.8))),sub(n(1),ramp(windup(),add(windup(),n(.1)))))));
  const thrust = memo(() => mul(attack(),mul(ramp(windup(),add(windup(),n(.1))),sub(n(1),ramp(add(windup(),n(.1)),add(windup(),n(1)))))));
  return { n, add, sub, mul, get dead() { return dead(); },
    get counter() { return equal(3); }, get tell() { return tell(); }, get thrust() { return thrust(); },
    get guard() { return clamp(read('scalars',['guard'])); },
    get flinch() { return mul(live(),clamp(read('frame',['flinch']))); },
    get idle() { return b.unary('sin',mul(read('frame',['t']),n(1.7))); },
    gait: (offset: number) => mul(mul(moving(),mul(clamp(read('frame',['speed'])),equal(0))),b.unary('sin',add(mul(read('frame',['phase']),n(Math.PI*2)),n(offset)))),
    positive: (x: number) => b.binary('max',n(0),x), alive: (x: number) => mul(live(),x) };
}

/** Bounded motion3 contact trial. Geometry, bind rig, combat and admission stay unchanged.
 * Living feet alternate small vertical steps around a fixed support plane; recoil is upper-body only.
 * Death root height is sampled from this exact weighted mesh and pose, not inferred from bodyY.
 * This curve applies to the isolated upright-world arena only, never arbitrary physics ragdolls. */
export function conchPlantedClips(): {
  group: string; states: string[]; scalars: { name: string; path: string[]; fallback: number }[];
  programs: ReturnType<typeof numericChannelPrograms>;
} {
  const outputs: NumericChannelOutput[] = [];
  const channel = (joint: string, property: 'position' | 'rotation', axis: 'x' | 'y' | 'z', expr: NumericChannelOutput['expr']) => {
    outputs.push({ target: `joint.${joint}`, path: [property,axis], expr });
  };
  channel('body','position','y',(b,r) => {
    const e=motion(b,r), t=b.binary('max',e.n(0),b.binary('min',e.n(1),r('frame',['deathT'])));
    const keys: [number,number][]=contactCurve.heights.map((height,i)=>[i/(contactCurve.heights.length-1),height]);
    if(keys.length!==97) throw new Error('Conch requires its exact 97-knot curve');
    let height=b.sample(t,keys.slice(0,25),'linear');
    for(let part=1;part<4;part++) height=b.select(b.binary('gt',t,e.n(part/4)),b.sample(t,keys.slice(part*24,part*24+25),'linear'),height);
    return e.add(r('frame',['dims','bodyY']),height);
  });
  channel('body','rotation','x',(b) => b.constant(0));
  channel('body','rotation','z',(b,r) => { const e=motion(b,r); return e.mul(e.n(.75),e.dead); });
  channel('shell','rotation','x',(b,r) => { const e=motion(b,r); return e.alive(e.add(e.mul(e.n(.008),e.idle),e.mul(e.n(-.10),e.flinch))); });
  channel('head','rotation','x',(b,r) => { const e=motion(b,r); return e.add(e.alive(e.mul(e.n(-.015),e.idle)),e.add(e.mul(e.n(-.08),e.flinch),e.mul(e.n(.25),e.dead))); });
  for (const [side,sign] of [['Left',-1],['Right',1]] as const) {
    channel(`eyestalk${side}`,'rotation','z',(b,r) => { const e=motion(b,r); return e.mul(e.n(sign),e.add(e.alive(e.mul(e.n(.025),e.idle)),e.mul(e.n(.18),e.dead))); });
    const offset=side==='Left'?0:Math.PI;
    // Native hip relative Y is -.18m on both sides; bind pivots and scales are unchanged.
    channel(`leg${side}`,'position','y',(b,r) => { const e=motion(b,r); return e.add(e.n(-.18),e.alive(e.mul(e.n(.035),e.positive(e.gait(offset))))); });
    channel(`leg${side}`,'rotation','y',(b,r) => { const e=motion(b,r); return e.alive(e.mul(e.n(.08),e.gait(offset))); });
    channel(`leg${side}`,'rotation','x',(b,r) => { const e=motion(b,r); return e.mul(e.n(-.18),e.dead); });
    channel(`leg${side}Knee`,'rotation','x',(b,r) => { const e=motion(b,r); return e.mul(e.n(-.28),e.dead); });
    channel(`leg${side}Ankle`,'rotation','x',(b,r) => { const e=motion(b,r); return e.mul(e.n(.18),e.dead); });
  }
  channel('shieldArm','rotation','x',(b,r) => { const e=motion(b,r); return e.add(e.alive(e.mul(e.n(-.24),e.guard)),e.add(e.mul(e.n(.08),e.flinch),e.mul(e.n(.4),e.dead))); });
  channel('shieldForearm','rotation','y',(b,r) => { const e=motion(b,r); return e.add(e.alive(e.mul(e.n(-.22),e.guard)),e.mul(e.n(.3),e.dead)); });
  channel('rapierArm','rotation','x',(b,r) => { const e=motion(b,r); return e.add(e.alive(e.add(e.mul(e.n(-.18),e.tell),e.mul(e.n(-.30),e.thrust))),e.add(e.mul(e.n(-.12),e.flinch),e.mul(e.n(.42),e.dead))); });
  channel('rapierArm','rotation','z',(b,r) => { const e=motion(b,r); return e.alive(e.mul(e.n(.28),e.mul(e.counter,e.tell))); });
  channel('rapierForearm','rotation','y',(b,r) => { const e=motion(b,r); return e.add(e.alive(e.add(e.mul(e.n(.12),e.tell),e.mul(e.n(-.35),e.thrust))),e.mul(e.n(.25),e.dead)); });
  return { group:'creature.pose',states:['stalk','attack','alert','idle'],
    scalars:[{name:'clock',path:['mem','regular-clock'],fallback:0},{name:'stage',path:['mem','conch-st'],fallback:0},{name:'guard',path:['mem','conch-guard'],fallback:0}],
    programs:outputs.flatMap((row,i) => numericChannelPrograms(`conch-character-native.motion3.${i}`,'creature.pose',[row])) };
}
