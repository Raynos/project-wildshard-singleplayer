import contactCurve from '../data/conchPlantedContact.json' with { type: 'json' };
import { numericChannelPrograms, type NumericChannelOutput } from '@wildshard/sdk/clientChannels';

type Builder = Parameters<NumericChannelOutput['expr']>[0];
type Read = Parameters<NumericChannelOutput['expr']>[1];
export const CONCH_READABLE_JOINTS = ['body', 'shell', 'head', 'eyestalkLeft', 'eyestalkRight',
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

/** Source-only motion4 upper-body study. The exact motion3 root, legs and death remain.
 * +Z is forward in the canonical native rig; negative arm X lifts the weapon/shield.
 * The shoulder hierarchy has no independent torso bone: shell and head provide upper-body
 * weight, never root pitch (which would move the unchanged lower body).
 * Stateless admitted poses cannot blend arbitrary interrupted stage changes; this study
 * guarantees continuous nominal cycles, not interrupted-transition acceptance. */
export function conchReadableClips(): {
  group: string; states: string[]; scalars: { name: string; path: string[]; fallback: number }[];
  programs: ReturnType<typeof numericChannelPrograms>;
} {
  const outputs: NumericChannelOutput[] = [];
  // Values are [ordinary preparation, counter preparation, active extension, recovery brace, hit].
  // Alignment is complete before windup ends, held across bounded runner/behavior skew.
  // Runner phase resets discard overshoot; these are authored clocks, not phase ports.
  const poses: Record<string, readonly [number, number, number, number, number]> = {
    'shell.x': [-.035, -.06, .025, -.02, -.20],
    'shell.y': [-.05, .09, -.025, .03, .10],
    'head.x': [-.08, -.12, .05, -.045, -.24],
    'head.z': [-.04, .09, -.015, .025, .12],
    'shieldArm.x': [0, -.12, -.18, -.16, .08],
    'shieldArm.z': [-.08, .16, .10, -.04, -.08],
    'shieldForearm.y': [0, .08, .08, -.10, 0],
    'rapierArm.x': [-.34, -.55, -.48, -.24, -.32],
    'rapierArm.z': [.10, .38, -.08, .13, .12],
    'rapierForearm.y': [.16, .24, -.40, .12, .12],
    'rapierArm.y': [.04, .08, -.40, .03, .04],
  };
  const channel = (joint: string, property: 'position' | 'rotation', axis: 'x' | 'y' | 'z', original: NumericChannelOutput['expr']) => {
    const pose = property === 'rotation' ? poses[`${joint}.${axis}`] : undefined;
    const expr: NumericChannelOutput['expr'] = pose === undefined ? original : (b, r) => {
      const n=(x:number)=>b.constant(x), mul=(x:number,y:number)=>b.binary('mul',x,y);
      const stage=r('scalars',['stage']), clock=r('scalars',['clock']);
      const eq=(x:number)=>mul(b.binary('gt',stage,n(x-.5)),b.binary('gt',n(x+.5),stage));
      const cycle=(windup:number, preparation:number)=>b.sample(clock, [
        [0,0], [windup*.40,preparation], [windup*.55,preparation],
        [windup-.10,pose[2]], [windup+.30,pose[2]],
        [windup+.55,pose[3]], [windup+.80,pose[3]*.35], [windup+1,0],
      ],'smoothstep');
      const shieldGuard=joint==='shieldArm'&&axis==='x'||joint==='shieldForearm'&&axis==='y';
      const ordinary=shieldGuard?b.sample(clock,[[0,0],[.6,0],[.8,pose[2]],[1.15,pose[3]],[1.6,0]],'smoothstep'):cycle(.6,pose[0]);
      const attack=b.binary('add',mul(eq(1),ordinary),mul(eq(3),cycle(.45,pose[1])));
      let flinch=b.binary('max',n(0),b.binary('min',n(1),r('frame',['flinch'])));
      // Keep the committed weapon aligned even with residual visual recoil.
      // Head/shield still recoil; a canceled stage immediately restores arm recoil.
      if(joint==='rapierArm'||joint==='rapierForearm'){
        const hold=(windup:number)=>b.sample(clock,[[0,0],[windup*.55,0],[windup-.10,1],[windup+.30,1],[windup+.55,0]],'smoothstep');
        const aligned=b.binary('add',mul(eq(1),hold(.6)),mul(eq(3),hold(.45)));
        flinch=mul(flinch,b.binary('sub',n(1),aligned));
      }
      // Recoil reduces offensive extension while raising the weapon clear of the floor.
      let living=b.binary('add',mul(attack,b.binary('sub',n(1),mul(n(.65),flinch))),mul(n(pose[4]),flinch));
      // A modest inward ready stance shares the turn between shoulder and forearm;
      // it reduces an active-to-rest forearm snap without hidden pose history.
      if(joint==='rapierArm'&&axis==='y') living=b.binary('add',living,n(-.40));
      // Preserve the established breathing channels. Guard remains an observed scalar;
      // stage4 retains the guarded brace even after the AI clears guard on impact.
      if(joint==='shell'&&axis==='x'||joint==='head'&&axis==='x')
        living=b.binary('add',living,mul(n(joint==='shell'?.008:-.015),b.unary('sin',mul(r('frame',['t']),n(1.7)))));
      if(joint==='shieldArm'&&axis==='x'||joint==='shieldForearm'&&axis==='y'){
        const amount=joint==='shieldArm'?-.24:-.22;
        const held=b.binary('max',b.binary('max',n(0),b.binary('min',n(1),r('scalars',['guard']))),eq(4));
        const ordinaryGuard=mul(eq(1),b.sample(clock,[[0,1],[.60,1],[.80,0]],'smoothstep'));
        const counter=mul(eq(3),b.sample(clock,[[0,1],[.18,0]],'smoothstep'));
        living=b.binary('add',living,mul(n(amount),b.binary('max',held,b.binary('add',ordinaryGuard,counter))));
      }
      // In death, motion3's attack gate is exactly zero. Algebraically remove that
      // dead branch here to stay below the unchanged 128-node admission bound.
      const e=motion(b,r);
      const fallback=joint==='rapierArm'&&axis==='x'?e.add(e.mul(e.n(-.12),e.flinch),e.mul(e.n(.42),e.dead))
        :joint==='rapierArm'&&axis==='z'?n(0)
        :joint==='rapierForearm'&&axis==='y'?e.mul(e.n(.25),e.dead):original(b,r);
      return b.select(b.binary('gt',n(0),r('frame',['deathT'])),living,fallback);
    };
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
  channel('rapierArm','rotation','y',b=>b.constant(0));
  channel('shell','rotation','y',b=>b.constant(0));
  channel('head','rotation','z',b=>b.constant(0));
  channel('shieldArm','rotation','z',b=>b.constant(0));
  return { group:'creature.pose',states:['stalk','attack','alert','idle'],
    scalars:[{name:'clock',path:['mem','regular-clock'],fallback:0},{name:'stage',path:['mem','conch-st'],fallback:0},{name:'guard',path:['mem','conch-guard'],fallback:0}],
    programs:outputs.flatMap((row,i) => numericChannelPrograms(`conch-character-native.motion4.${i}`,'creature.pose',[row])) };
}
