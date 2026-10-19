import { numericChannelPrograms, type NumericChannelOutput, type ClientChannels } from '@wildshard/sdk/clientChannels';
// Build-time scalar algebra. Only bounded numeric DAG rows ship to the pose owner.
type E = number | { read: string; path: readonly string[] } | { unary: 'sin' | 'cos' | 'abs'; a: E }
  | { binary: 'add' | 'sub' | 'mul' | 'div' | 'min' | 'max' | 'gt'; a: E; b: E } | { test: E; yes: E; no: E };
const r = (read: string, ...path: string[]): E => ({ read, path });
const op = (binary: Extract<E, { binary: string }>['binary'], a: E, b: E): E => ({ binary, a, b });
const add = (...v: E[]): E => v.reduce((a, b) => op('add', a, b));
const mul = (...v: E[]): E => v.reduce((a, b) => op('mul', a, b));
const sub = (a: E, b: E): E => op('sub', a, b);
const div = (a: E, b: E): E => op('div', a, b);
const max = (...v: E[]): E => v.reduce((a, b) => op('max', a, b));
const min = (a: E, b: E): E => op('min', a, b);
const cap = (a: E): E => max(0, min(1, a));
const sin = (a: E): E => ({ unary: 'sin', a });
const cos = (a: E): E => ({ unary: 'cos', a });
const abs = (a: E): E => ({ unary: 'abs', a });
const choose = (test: E, yes: E, no: E): E => ({ test, yes, no });
const gt = (a: E, b: E): E => op('gt', a, b);
const mix = (a: E, b: E, t: E): E => add(mul(sub(1, t), a), mul(t, b));
const step = (a: E, lo = 0, hi = 1): E => { const t = cap(div(sub(a, lo), hi - lo)); return mul(t, t, sub(3, mul(2, t))); };
const bump = (a: E, lo: number, hi: number): E => { const t = cap(div(sub(a, lo), hi - lo)); return sin(mul(Math.PI, t)); };
const time = r('frame', 't'), seed = r('frame', 'seed'), phase = mul(r('frame', 'phase'), Math.PI * 2), speed = r('frame', 'speed'), attack = r('frame', 'attack');
const dead = step(max(0, r('frame', 'deathT'))), moving = cap(speed), active = gt(attack, -1e-9);
const wave = (rate: number, offset: E = 0): E => sin(add(mul(time, rate), offset));
function compile(b: ClientChannels, read: Parameters<NumericChannelOutput['expr']>[1], e: E, cache: Map<string, number>): number {
  const key = JSON.stringify(e), old = cache.get(key); if (old !== undefined) return old;
  const n = typeof e === 'number' ? b.constant(e) : 'read' in e ? read(e.read, e.path)
    : 'test' in e ? b.select(compile(b, read, e.test, cache), compile(b, read, e.yes, cache), compile(b, read, e.no, cache))
    : 'binary' in e ? b.binary(e.binary, compile(b, read, e.a, cache), compile(b, read, e.b, cache))
    : b.unary(e.unary, compile(b, read, e.a, cache));
  cache.set(key, n); return n;
}
function pose(id: string, build: (set: (bone: string, channel: string, e: E, additive?: boolean) => void,
  mem: (key: string, fallback?: number) => E) => void, options: { alive?: boolean; look?: readonly [number, number, number] } = {}) {
  const scalars: { name: string; path: readonly ['mem', string]; fallback: number }[] = [], outputs: { bone: string; channel: string; value: E }[] = [];
  const mem = (key: string, fallback = 0): E => {
    if (!scalars.some(row => row.name === key)) scalars.push({ name: key, path: ['mem', key], fallback });
    return r('scalars', key);
  };
  build((bone, channel, e, additive = false) => {
    const [group = 'rotation', axis = 'x'] = channel.split('.');
    outputs.push({ bone, channel, value: additive ? add(r(`joint.${bone.replaceAll('_', '.')}`, group, axis), e) : e });
  }, mem);
  const programs = outputs.flatMap((row, i) => numericChannelPrograms(`pose.${id}.${i}`, 'creature.pose', [{
    target: `joint.${row.bone.replaceAll('_', '.')}`, path: row.channel.split('.') as [string, string],
    expr: (b, read) => compile(b, read, row.value, new Map()),
  }]));
  return { group: 'creature.pose', programs, scalars, ...options };
}
export const SPECIES_POSES = {
  horse: pose('horse', (set, m) => {
    const rear=step(m('horserear')),buck=m('horsebuck'),headUp=m('horseheadUp'),pin=m('horsepin'),lead=m('horseturnLead'),graze=m('horsegraze');
    const impulse=(key:string) => choose(mul(m('horsealive'),gt(m(key),0)),bump(sub(1,cap(m(`pose${key}`))),0,1),0);
    const kick=impulse('kick'),stamp=impulse('stamp'),toss=impulse('toss'),run=cap(div(sub(speed,3),9));
    const ph=wave(6.5),up=mul(max(0,ph),buck),th=mul(rear,.78);
    set('body','rotation.x',add(mul(-1,th),mul(.4,up),mul(-.1,max(0,mul(-1,ph)),buck),mul(.3,kick)),true);
    set('body','position.y',add(mul(.6,sin(th)),mul(.12,abs(ph),buck)),true);
    set('body','position.z',sub(m('horsebaseZ'),mul(.31,sub(1,cos(th)))));
    set('body','rotation.z',mul(.15,m('buckDir',1),up),true);
    set('neck1','rotation.x',add(mul(-.35,rear),mul(.45,up),mul(.4,kick),mul(1.35,graze),mul(-.28,headUp),mul(-.35,toss)),true);
    set('neck2','rotation.x',add(mul(-.1,graze),mul(-.1,headUp)),true);
    set('head','rotation.x',add(mul(.25,rear),mul(-1.55,graze),mul(.15,headUp),mul(.3,toss)),true);
    set('neck1','rotation.y',mul(.2,lead),true);set('neck2','rotation.y',mul(.2,lead),true);set('head','rotation.y',mul(.16,lead),true);set('head','rotation.z',mul(-.06,lead),true);
    for(const [s,offset] of [['L',0],['R',2]] as const){
      set(`F${s}_shoulder`,'rotation.x',add(mul(-1,add(.5,mul(.25,wave(7,offset))),rear),s==='R'?mul(-.5,stamp):0),true);
      set(`F${s}_carpus`,'rotation.x',add(mul(1.5,rear),s==='R'?stamp:0),true);set(`F${s}_fetlock`,'rotation.x',mul(.4,rear),true);
      set(`B${s}_hip`,'rotation.x',add(mul(th,.85),mul(.9,up),mul(1.2,kick)),true);set(`B${s}_stifle`,'rotation.x',add(mul(.25,rear),mul(-.5,up)),true);set(`B${s}_hock`,'rotation.x',mul(-.5,kick),true);
    }
    for(const ear of ['earL','earR'])set(ear,'rotation.x',sub(mul(1.2,pin),mul(.3,headUp)),true);
    const ws=mul(m('horseWindStrength'),sub(1,run)),across=sub(mul(m('horseWindX'),cos(r('frame','yaw'))),mul(m('horseWindZ'),sin(r('frame','yaw'))));
    const gust=add(.6,mul(.4,wave(.9,mul(seed,5))),mul(.25,wave(3.7,seed)));
    const swing=add(mul(sin(sub(phase,1.2)),add(.1,mul(.22,run))),mul(.05,wave(1.7,mul(seed,3))),mul(.03,wave(4.1,seed)),mul(ws,gust,add(mul(.25,across),mul(.06,wave(5.3,mul(seed,2))))));
    set('mane1','rotation.x',add(mul(-.35,run),mul(-.1,rear)));set('mane1','rotation.y',0);set('mane1','rotation.z',add(mul(.25,run),mul(.7,swing)));
    set('mane2','rotation.x',add(mul(-.45,run),mul(-.1,rear)));set('mane2','rotation.y',0);set('mane2','rotation.z',add(mul(.3,run),swing));
    const lag=sin(sub(phase,2));
    set('tail2','rotation.x',add(mul(-.2,run),mul(.06,lag,run),mul(.3,buck),mul(-.12,ws,gust)));set('tail2','rotation.y',0);
    set('tail2','rotation.z',add(mul(.1,wave(1.1,mul(seed,4)),sub(1,run)),mul(.08,lag,run),mul(.3,ws,gust,across)));
    set('tail3','rotation.x',add(mul(-.35,run),mul(.08,lag,run),mul(-.15,ws,gust)));set('tail3','rotation.y',0);
    set('tail3','rotation.z',add(mul(.14,wave(1.1,add(-.8,mul(seed,4))),sub(1,run)),mul(.1,lag,run),mul(.35,ws,gust,across)));
  }),

  balbal: pose('balbal', (set, m) => {
    const rise = m('rise', 1), grind = mul(m('field'), min(1, mul(sub(1, rise), 3)), gt(rise, .02));
    const emerge = sub(1, m('emerge', 1)), kneel = step(dead, 0, .5), topple = step(dead, .45, 1);
    const wind = step(attack, 0, .52), cut = step(attack, .52, .58), rec = step(attack, .82, 1), hold = sub(1, rec);
    const knee = choose(active, mul(mix(mix(0, .15, wind), .55, cut), hold), 0);
    const swing = mul(sin(phase), .28, moving);
    const arm = (a: number, b: number, c: number) => add(mul(mix(mix(a, b, wind), c, cut), hold), mul(a, rec));
    set('body', 'position.y', sub(r('frame', 'dims', 'bodyY'), add(mul(.06, abs(sin(phase)), moving), mul(.4, kneel), mul(.2, topple), mul(.12, knee))));
    set('body', 'rotation.x', add(.04, mul(.08, moving), mul(1.3, topple), mul(.05, grind, wave(31)),
      choose(active, add(mul(mix(mix(0, -.24, wind), .52, cut), hold), mul(wave(40), .012, wind, sub(1, cut))), 0)));
    set('body', 'rotation.y', 0); set('body', 'rotation.z', add(mul(.05, sin(phase), moving), mul(.05, grind, wave(27, 1)), choose(active, mul(mix(mix(0, .08, wind), -.04, cut), hold), 0)));
    set('spine', 'rotation.x', add(.04, mul(.1, r('frame', 'brace')))); set('spine', 'rotation.y', add(choose(active, mul(mix(mix(0, .35, wind), -.2, cut), hold), 0), mul(r('look', 'yaw'), .3))); set('spine', 'rotation.z', 0);
    set('chest', 'rotation.x', .02); set('chest', 'rotation.y', mul(r('look', 'yaw'), .2)); set('chest', 'rotation.z', 0);
    set('head', 'rotation.x', add(-.1, mul(-.4, r('look', 'pitch')), mul(.2, r('frame', 'flinch')), mul(.3, kneel))); set('head', 'rotation.y', mul(r('look', 'yaw'), .5)); set('head', 'rotation.z', 0);
    const rot = (bone: string, x: E, y: E = 0, z: E = 0) => { set(bone, 'rotation.x', x); set(bone, 'rotation.y', y); set(bone, 'rotation.z', z); };
    rot('armR_sh', add(choose(active, arm(.2, -3, 1.15), sub(.2, add(mul(.9, emerge), mul(.4, grind)))), mul(.4, swing), mul(.6, dead)), 0, choose(active, arm(-.22, -.35, .05), -.22));
    rot('armR_el', choose(active, arm(-.45, -.95, -.05), -.45), 0, -.1); rot('armR_hand', choose(active, arm(.3, .7, -.2), .3));
    rot('armL_sh', add(.12, mul(-.5, swing), mul(-.5, emerge), mul(.6, dead)), 0, .16); rot('armL_el', add(-1.35, mul(.3, moving)), .35, .3); rot('armL_hand', .2);
    for (const [side, sx, offset] of [['L', 1, 0], ['R', -1, Math.PI]] as const) {
      const stride = sin(add(phase, offset));
      rot(`leg${side}_hip`, add(mul(-.42, stride, moving), mul(.15, kneel), mul(-.4, topple), mul(-.5, knee)), 0, sx * .06);
      rot(`leg${side}_knee`, add(mul(add(.3, mul(.4, max(0, stride))), moving), mul(1.7, kneel), knee)); rot(`leg${side}_foot`, sub(mul(-.15, stride, moving), mul(.5, knee)));
    }
  }, { look: [1.85, .8, .4] }),
  canid: pose('canid', (set, m) => {
    const low = cap(m('low')), snarl = cap(m('snarl')), howl = cap(m('howl'));
    const coil = choose(active, bump(attack, 0, .42), 0), spring = choose(active, bump(attack, .3, .8), 0), snap = choose(active, bump(attack, .62, 1), 0), crouch = max(mul(low, .7), coil);
    set('body', 'position.y', add(mul(-.12, crouch), mul(-.02, snarl), mul(.28, spring, spring)), true);
    for (const [bone, value] of [['body', sub(mul(.06, crouch), mul(.22, spring))], ['neck1', sub(mul(.25, crouch), mul(.9, howl))], ['neck2', sub(mul(.08, crouch), mul(.35, howl))], ['head', add(mul(-.2, crouch), mul(-.5, howl), mul(-.25, spring))]] as const) set(bone, 'rotation.x', value, true);
    for (const s of ['L', 'R']) {
      set(`F${s}_shoulder`, 'rotation.x', mul(-.9, spring), true); set(`F${s}_carpus`, 'rotation.x', add(mul(.3, spring), mul(.35, crouch)), true);
      set(`B${s}_hip`, 'rotation.x', sub(mul(.35, crouch), mul(.4, spring)), true); set(`B${s}_stifle`, 'rotation.x', mul(-.3, crouch), true); set(`ear${s}`, 'rotation.x', mul(max(snarl, coil, spring), .81), true);
    }
    const pant = choose(gt(speed, 3), add(.12, mul(.06, wave(9, mul(seed, 5)))), mul(.02, max(0, wave(.9, mul(seed, 3)))));
    set('jaw', 'rotation.x', max(pant, mul(.22, snarl), mul(.6, howl), mul(.55, snap)));
    const run = cap(div(sub(speed, 4), 5)); set('tail', 'rotation.x', sub(mul(.25, run), mul(.25, low)), true);
    set('tail2', 'rotation.x', add(mul(.35, run), mul(.1, wave(1.3, seed)))); set('tail2', 'rotation.y', 0);
    set('tail2', 'rotation.z', add(mul(.22, sin(sub(phase, .9)), add(.4, run)), mul(.08, wave(.8, mul(seed, 2)))));
  }, { alive: true }),
  canidDead: pose('canid-dead', set => { set('jaw', 'rotation.x', mul(.25, dead)); }, { alive: false }),
  leopard: pose('leopard', (set, m) => {
    const low = cap(m('low')), snarl = cap(m('snarl')), leap = cap(m('leap')), rake = choose(active, bump(attack, .25, .65), 0), rake2 = choose(active, bump(attack, .55, .95), 0);
    set('body', 'position.y', add(mul(-.14, low), mul(-.04, snarl)), true); set('body', 'rotation.x', add(mul(.04, low), mul(-.18, leap), mul(-.08, max(rake, rake2))), true);
    set('neck1', 'rotation.x', sub(mul(.3, low), mul(.1, leap)), true); set('head', 'rotation.x', add(mul(-.25, low), mul(.15, leap)), true);
    for (const [s, sign, swipe] of [['L', 1, rake2], ['R', -1, rake]] as const) {
      set(`F${s}_shoulder`, 'rotation.x', sub(mul(-1.1, leap), mul(1.3, swipe)), true); set(`F${s}_shoulder`, 'rotation.z', mul(sign * .35, swipe), true);
      set(`F${s}_carpus`, 'rotation.x', add(mul(.4, low), mul(-.3, leap), mul(.6, swipe)), true); set(`B${s}_hip`, 'rotation.x', add(mul(.45, low), mul(.7, leap)), true);
      set(`B${s}_stifle`, 'rotation.x', add(mul(-.35, low), mul(-.3, leap)), true); set(`ear${s}`, 'rotation.x', mul(.9, max(snarl, leap)), true);
    }
    set('jaw', 'rotation.x', max(mul(.3, snarl), mul(.4, max(rake, rake2)), mul(.25, leap))); set('tail', 'rotation.x', add(mul(-.25, low), mul(.5, leap)), true);
    set('tail2', 'rotation.x', add(mul(.45, leap), -.15, mul(.1, wave(.9, seed)))); set('tail2', 'rotation.y', 0);
    set('tail2', 'rotation.z', mul(.3, sin(add(mul(time, choose(gt(low, .3), 7, 1.1)), mul(seed, 4))), add(.3, mul(.7, sub(1, leap)))));
  }, { alive: true }),
  eagle: pose('eagle', (set, m) => {
    const flap = mul(cap(m('flap', .3)), sub(1, dead)), fold = cap(m('fold')), ground = cap(m('ground')), bank = m('bank');
    const f = add(mul(time, add(4.5, mul(3, ground))), mul(seed, 7)), beat = mul(sin(f), add(mul(.55, flap), mul(.5, ground))), lag = mul(sin(sub(f, .8)), add(mul(.35, flap), mul(.3, ground))), dihedral = mul(.12, sub(1, fold), sub(1, ground));
    const rot = (bone: string, x: E, y: E = 0, z: E = 0) => { set(bone, 'rotation.x', x); set(bone, 'rotation.y', y); set(bone, 'rotation.z', z); };
    rot('body', add(mul(1.1, fold), mul(-.5, ground), mul(.8, dead)), 0, mul(bank, sub(1, ground))); set('body', 'position.y', mul(-.03, beat));
    for (const [s, sign] of [['L', 1], ['R', -1]] as const) {
      rot(`wing${s}1`, 0, mul(sign, add(mul(1.25, fold), mul(.35, ground))), mul(sign, add(beat, dihedral, mul(-.25, fold), mul(.35, ground), mul(-.6, dead))));
      rot(`wing${s}2`, 0, mul(sign, add(mul(.9, fold), mul(.6, ground))), mul(sign, add(lag, mul(-.1, fold), mul(-.5, ground)))); rot(`leg${s}`, sub(mul(.9, sub(1, ground), sub(1, mul(.5, fold))), mul(.2, ground)));
    }
    rot('tail', add(mul(-.1, fold), mul(.3, ground)), 0, mul(-.3, bank)); rot('neck', add(mul(-.3, fold), mul(.4, ground)));
    rot('head', add(mul(.2, fold), mul(-.3, ground), mul(.1, wave(2, seed))), mul(.3, wave(.7, seed)));
  }),
};
