import { numericChannelPrograms, type ClientChannels, type NumericChannelOutput } from '@wildshard/sdk/clientChannels';
import { parsePrivateScene, type PrivateScene, type ClientChannelProgram } from '@wildshard/format/clientChannels';
import * as THREE from 'three';
import { TITAN_PLACE } from './stormTitanFight';

/** Retained original static construction. Pose, shader hooks and hazards stay live. */
function rng(seed: number): () => number { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
interface Puff { bone: THREE.Object3D; p: THREE.Vector3; r: number; ph: number }
interface PuffRow { bone: string; p: number[]; r: number; ph: number; colour: number[] }
export function titanPuffs(phone: boolean): PuffRow[] {
  const root = new THREE.Object3D(), chest = new THREE.Object3D(), head = new THREE.Object3D();
  const armR: [THREE.Object3D, THREE.Object3D, THREE.Object3D] = [new THREE.Object3D(), new THREE.Object3D(), new THREE.Object3D()];
  const armL: [THREE.Object3D, THREE.Object3D, THREE.Object3D] = [new THREE.Object3D(), new THREE.Object3D(), new THREE.Object3D()];
  const list: Puff[] = [];
  const r = rng(0x7174a);
  const add = (bone: THREE.Object3D, x: number, y: number, z: number, rad: number): void => { list.push({ bone, p: new THREE.Vector3(x, y, z), r: rad, ph: r() * 6.28 }); };
  const dir = (): THREE.Vector3 => { const u = r() * 2 - 1, a = r() * 6.283; const s = Math.sqrt(1 - u * u); return new THREE.Vector3(s * Math.cos(a), u, s * Math.sin(a)); };
  // torso: an ellipsoid shell, broad at the shoulders
  for (let i = 0; i < 130; i++) { const d = dir(), k = 0.6 + 0.4 * r(), y = 11 + d.y * 12 * k; add(chest, d.x * 10 * k * (0.75 + 0.45 * (y / 24)), y, d.z * 6.5 * k, 3.2 + r() * 3); }
  // the skirt: the cloud sea he rises from — wide, heavy, down past the rim
  for (let i = 0; i < 70; i++) { const a = r() * 6.283, rr = 7 + r() * 10, y = -16 + r() * 18; add(root, Math.cos(a) * rr * (1 + (-y) * 0.03), y, Math.sin(a) * rr * 0.8, 4.5 + r() * 4 + Math.max(0, -y) * 0.12); }
  // head, the pointed helmet, the beard
  for (let i = 0; i < 26; i++) { const d = dir(), k = 0.5 + 0.5 * r(); add(head, d.x * 4.2 * k, d.y * 4.6 * k, d.z * 4 * k, 1.8 + r() * 1.4); }
  for (let i = 0; i < 18; i++) { const u = i / 17, a = i * 2.4; add(head, Math.cos(a) * 4.6 * (1 - u), 3 + u * 11, Math.sin(a) * 4.4 * (1 - u), 0.6 + 3.2 * (1 - u)); }
  for (let i = 0; i < 16; i++) { const u = r(); add(head, (r() - 0.5) * 5 * (1 - u * 0.6), -2 - u * 7, 3.4 + r() * 1.5, 1.6 + r() * 1.2); }
  // arms: upper + fore along −y, a fist
  for (const arm of [armR, armL]) {
    for (let s = 0; s < 2; s++) for (let i = 0; i < 12; i++) { const u = i / 11; add(arm[s] ?? chest, (r() - 0.5) * 2.2, -u * 13.5, (r() - 0.5) * 2.2, (s === 0 ? 4.2 : 3.4) - u * 0.8 + r() * 0.6); }
    add(arm[2], 0, 0, 0, 3.4);
  }
  // the cloak: off the shoulders, streaming back and down
  for (let i = 0; i < 44; i++) { const u = r(), v = r() - 0.5; add(chest, v * 26 * (0.7 + 0.5 * u), 22 - u * 32, -5 - u * 7 - Math.abs(v) * 3, 3.5 + r() * 2.5); }

  // the cumulus's small heads: a smaller puff budding out of the outer side of most big ones (a cauliflower silhouette,
  // not a string of balls); per puff, how exposed it is (its distance out from its bone's cluster) shades it
  const centre = new Map<THREE.Object3D, { c: THREE.Vector3; n: number; max: number }>();
  for (const pf of list) { const e = centre.get(pf.bone) ?? { c: new THREE.Vector3(), n: 0, max: 0 }; e.c.add(pf.p); e.n++; centre.set(pf.bone, e); }
  for (const e of centre.values()) e.c.multiplyScalar(1 / Math.max(1, e.n));
  for (const pf of list) { const e = centre.get(pf.bone); if (e) e.max = Math.max(e.max, pf.p.distanceTo(e.c)); }
  const buds = phone ? 1 : 2;
  const primaries = list.length;
  for (let i = 0; i < primaries; i++) {
    const pf = list[i], e = pf ? centre.get(pf.bone) : undefined;
    if (!pf || !e) continue;
    for (let b = 0; b < buds; b++) {
      const out = pf.p.clone().sub(e.c); if (out.lengthSq() < 1e-4) out.set(0, 1, 0);
      out.normalize().add(dir().multiplyScalar(0.7)).normalize();
      const k = 0.72 + 0.2 * r();
      add(pf.bone, pf.p.x + out.x * pf.r * k, pf.p.y + out.y * pf.r * k, pf.p.z + out.z * pf.r * k, pf.r * (0.34 + 0.2 * r()));
    }
  }
  const exposure = list.map((pf) => { const e = centre.get(pf.bone); return e && e.max > 0 ? Math.min(1, pf.p.distanceTo(e.c) / e.max) : 0.7; });

  const bones = { root, chest, head, upperR: armR[0], foreR: armR[1], handR: armR[2], upperL: armL[0], foreL: armL[1], handL: armL[2] };
  return list.map((pf, i) => {
    const bone = Object.entries(bones).find(([, value]) => value === pf.bone)?.[0];
    if (bone === undefined) throw new Error('Titan puff has no retained bone');
    const low = pf.bone === root ? 0.72 : pf.p.z < -4.5 ? 0.78 : 0.92 + 0.08 * Math.sin(i * 1.7);
    const k = low * (0.45 + 0.6 * (exposure[i] ?? 0.7));
    return { bone, p: pf.p.toArray(), r: pf.r, ph: pf.ph, colour: [0.95 * k, 0.97 * k, 1.05 * k] };
  });
}

export function flameClusterGeometry(phone: boolean): THREE.BufferGeometry {
  const S = phone ? 8 : 12, R = phone ? 6 : 9;
  const tongues: [number, number, number, number][] = [[0, 0, 1.0, 1.0], [0.75, 0.35, 0.72, 0.8], [-0.55, -0.6, 0.6, 0.75]]; // x, z, height, width
  const pos: number[] = [], nrm: number[] = [], aH: number[] = [], aS: number[] = [], idx: number[] = [];
  tongues.forEach(([ox, oz, hh, ww], k) => {
    const base = pos.length / 3;
    for (let j = 0; j <= R; j++) {
      const v = j / R, y = v * 2.6 * hh;
      const r = (j === R ? 0 : 0.85 * ww * Math.sin(Math.PI * v ** 0.62) ** 0.85 + 0.02) * (1 - 0.15 * v);
      for (let i = 0; i < S; i++) {
        const a = (i / S) * Math.PI * 2;
        pos.push(ox + Math.cos(a) * r, y, oz + Math.sin(a) * r);
        nrm.push(Math.cos(a), 0.25, Math.sin(a));
        aH.push(v); aS.push(k * 0.37 + 0.11);
      }
    }
    for (let j = 0; j < R; j++) for (let i = 0; i < S; i++) {
      const a = base + j * S + i, b = base + j * S + ((i + 1) % S), c = a + S, d = b + S;
      idx.push(a, c, b, b, c, d);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('aH', new THREE.Float32BufferAttribute(aH, 1));
  g.setAttribute('aS', new THREE.Float32BufferAttribute(aS, 1));
  g.setIndex(idx);
  return g;
}

function mergeTwo(a: THREE.BufferGeometry, b: THREE.BufferGeometry): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  const pa = a.getAttribute('position'), pb = b.getAttribute('position');
  const pos = new Float32Array((pa.count + pb.count) * 3);
  for (let i = 0; i < pa.count; i++) { pos[i * 3] = pa.getX(i); pos[i * 3 + 1] = pa.getY(i); pos[i * 3 + 2] = pa.getZ(i); }
  for (let i = 0; i < pb.count; i++) { const k = (pa.count + i) * 3; pos[k] = pb.getX(i); pos[k + 1] = pb.getY(i); pos[k + 2] = pb.getZ(i); }
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const ia = a.getIndex(), ib = b.getIndex(), idx: number[] = [];
  if (ia) for (let i = 0; i < ia.count; i++) idx.push(ia.getX(i)); else for (let i = 0; i < pa.count; i++) idx.push(i);
  if (ib) for (let i = 0; i < ib.count; i++) idx.push(ib.getX(i) + pa.count); else for (let i = 0; i < pb.count; i++) idx.push(i + pa.count);
  out.setIndex(idx);
  return out;
}


/** Three's ordinary serialized BufferGeometry, without its random serialization UUID. */
function geometryRow(g: THREE.BufferGeometry) {
  const out = new THREE.BufferGeometry().copy(g).toJSON();
  const { uuid: _uuid, ...row } = out; g.dispose();
  return row;
}
export function titanGeometry(): { phone: { puffs: PuffRow[]; flames: Omit<THREE.BufferGeometryJSON, 'uuid'> }; desktop: { puffs: PuffRow[]; flames: Omit<THREE.BufferGeometryJSON, 'uuid'> }; eyes: Omit<THREE.BufferGeometryJSON, 'uuid'> } {
  const eg = new THREE.SphereGeometry(0.9, 10, 8), eg2 = eg.clone();
  eg.translate(-1.8, 0.8, 4.1); eg2.translate(1.8, 0.8, 4.1);
  const eyes = geometryRow(mergeTwo(eg, eg2)); eg.dispose(); eg2.dispose();
  return { phone: { puffs: titanPuffs(true), flames: geometryRow(flameClusterGeometry(true)) },
    desktop: { puffs: titanPuffs(false), flames: geometryRow(flameClusterGeometry(false)) }, eyes };
}

/** Private transforms and construction rows; the native view only lends bones and materials. */
export function titanBodyRows(): { scene: PrivateScene; geometry: Record<string, Omit<THREE.BufferGeometryJSON, 'uuid'>>; [row: string]: unknown } {
  const nodes = [
    { kind: 'group', id: 'view', children: ['root', 'ring'] },
    { kind: 'group', id: 'root', children: ['chest'] },
    { kind: 'group', id: 'chest', position: [0,3,0], children: ['head','upperR','upperL','heart'] },
    { kind: 'group', id: 'head', position: [0,27,1.5], children: ['eyes'] },
    ...(['R','L'] as const).flatMap(side => [
      { kind: 'group', id: `upper${side}`, position: [side === 'R' ? -11.5 : 11.5,21,0], children: [`fore${side}`] },
      { kind: 'group', id: `fore${side}`, position: [0,-14,0], children: [`hand${side}`] },
      { kind: 'group', id: `hand${side}`, position: [0,-13,0], children: [] },
    ]),
    { kind: 'mesh', id: 'heart', position: [0,17,5.2], geometry: 'heart', material: 'heart', missing: 'empty', children: ['glow','dome'] },
    { kind: 'mesh', id: 'glow', geometry: 'glow', material: 'glow', missing: 'empty' },
    { kind: 'mesh', id: 'dome', geometry: 'dome', material: 'dome', missing: 'empty', visible: false },
    { kind: 'mesh', id: 'eyes', geometry: 'eyes', material: 'eyes', missing: 'empty' },
    { kind: 'mesh', id: 'ring', geometry: 'ring', material: 'ring', missing: 'empty', visible: false },
  ];
  return { scene: parsePrivateScene({ version: 1, root: 'view', nodes, materials: ['heart','glow','ring','dome','eyes'].map(id => ({ kind: 'port', id, source: id })) }),
    geometry: { heart: geometryRow(new THREE.IcosahedronGeometry(2.2,2)), glow: geometryRow(new THREE.SphereGeometry(4.4,24,16)),
      dome: geometryRow(new THREE.SphereGeometry(5.2,32,16)), ring: geometryRow(new THREE.TorusGeometry(7.5,.5,6,56)) },
    // game/boss/encounterView CloudBody: the self-lit heart, its glow, the gold ring and the dome; dark cumulus churning on the bones
    materials: { heart: { kind: 'basic', colour: [1.6,1.9,3.8], additive: false }, glow: { kind: 'fx', mode: 'beam', colour: [.55,.7,2.4], alpha: .8 },
      ring: { kind: 'basic', colour: [2.6,1.9,.6], additive: true, opacity: 0 }, dome: { kind: 'fx', mode: 'dome', colour: [2,1.6,.7], alpha: .85 },
      eyes: { kind: 'basic', colour: [3.2,3.4,4.2], additive: false } },
    group: 'titan.pose', root: 'root', scale: TITAN_PLACE.bodyScale, shown: ['heart','eyes'],
    puffs: { bones: ['root','chest','head','upperR','foreR','handR','upperL','foreL','handL'], detail: 2, name: 'titan-cloud', look: 'nalati-titan-cloud',
      swell: [.08,.9], drift: [.37,.29,.5], spin: .05, squash: .9 },
    params: { time: 't', focus: 'heart', glow: 'glow', flash: 'flash', alpha: 'alpha', fogColour: 'fogC', fog: 'fog' },
    focus: { part: 'heart', open: 'heartOpen', colour: [[1.6,1.9,3.8],[3.2,3.1,4.2]], glow: 'glow', glowAlpha: [.55,.45], lookGlow: [.3,.6], ring: 'ring', spin: .8, pulse: [.7,.3,9], dome: 'dome' } };
}

/** The bone and heart draw law becomes bounded numeric channels, never an AS frame tick. */
export function titanPoseRows(): ClientChannelProgram[] {
  const outputs: NumericChannelOutput[] = [];
  const pose = (target: string, path: [string,string], expr: NumericChannelOutput['expr']) => outputs.push({ target, path, expr });
  const root = (axis: string, expr: NumericChannelOutput['expr']) => pose('root',['position',axis],expr);
  const turn = (target: string, axis: string, expr: NumericChannelOutput['expr']) => pose(target,['rotation',axis],expr);
  root('x',(b,r) => b.binary('add',r('place',['x']),b.binary('mul',b.binary('mul',b.unary('sin',b.binary('mul',b.clock('time'),b.constant(.11))),b.constant(42)),r('pose',['stride']))));
  root('y',(b,r) => b.binary('sub',b.binary('sub',b.binary('sub',b.binary('add',r('place',['ground']),b.constant(4)),b.binary('mul',b.constant(80),b.binary('sub',b.constant(1),r('pose',['rise'])))),b.binary('mul',b.constant(20),r('pose',['kneel']))),b.binary('mul',b.constant(8),r('pose',['bend']))));
  root('z',(b,r) => b.binary('add',b.binary('add',r('place',['z']),b.binary('mul',b.constant(18),r('pose',['bend']))),b.binary('mul',b.constant(10),r('pose',['kneel']))));
  turn('root','y',(b,r) => b.binary('add',b.binary('mul',b.unary('sin',b.binary('mul',b.clock('time'),b.constant(.21))),b.constant(.06)),b.binary('mul',b.binary('mul',b.unary('cos',b.binary('mul',b.clock('time'),b.constant(.11))),b.constant(.18)),r('pose',['stride']))));
  turn('chest','x',(b,r) => b.binary('add',b.binary('add',b.binary('mul',b.constant(.62),r('pose',['bend'])),b.binary('mul',b.constant(.22),r('pose',['kneel']))),b.binary('mul',b.unary('sin',b.binary('mul',b.clock('time'),b.constant(.7))),b.constant(.02))));
  turn('chest','z',b => b.binary('mul',b.unary('sin',b.binary('mul',b.clock('time'),b.constant(.33))),b.constant(.03)));
  turn('head','x',(b,r) => b.binary('add',b.binary('mul',b.constant(-.35),r('pose',['bend'])),b.constant(.12)));
  turn('upperR','x',(b,r) => b.unary('neg',b.binary('add',b.constant(.35),b.binary('mul',b.constant(2.35),r('pose',['raise'])))));
  turn('upperR','z',(b,r) => b.binary('add',b.constant(-.35),b.binary('mul',b.constant(.2),r('pose',['raise']))));
  turn('foreR','x',(b,r) => b.unary('neg',b.binary('add',b.constant(.4),b.binary('mul',b.constant(.5),b.binary('sub',b.constant(1),r('pose',['raise']))))));
  turn('upperL','x',(b,r) => b.unary('neg',b.binary('add',b.constant(.5),b.binary('mul',b.constant(1.4),r('pose',['castL'])))));
  turn('upperL','z',(b,r) => b.binary('sub',b.constant(.4),b.binary('mul',b.constant(.2),r('pose',['castL']))));
  turn('foreL','x',(b,r) => b.unary('neg',b.binary('sub',b.constant(.8),b.binary('mul',b.constant(.5),r('pose',['castL'])))));
  for (const axis of ['x','y','z']) pose('heart',['scale',axis],(b,r) => b.binary('add',b.binary('add',b.constant(1),b.binary('mul',b.constant(.08),b.unary('sin',b.binary('mul',b.clock('time'),b.constant(7))))),b.binary('mul',b.constant(.25),r('pose',['heartOpen']))));
  return outputs.flatMap((output,i) => numericChannelPrograms(`titan.pose.${i}`,'titan.pose',[output]));
}

/** All arena draw resources are owned by the admitted scene; no live geometry constructors. */
export function titanArenaRows(radius: number, cell: number, grid: number): { scene: PrivateScene; geometry: Record<string, Omit<THREE.BufferGeometryJSON, 'uuid'>>; scorch: number[] } {
  const origin = new THREE.Vector3();
  const scorch = new THREE.PlaneGeometry(cell * 1.25, cell * 1.25); scorch.rotateX(-Math.PI / 2);
  const funnel = new THREE.LatheGeometry([[.9,0],[1.5,3],[2.6,7],[4.4,11],[6.4,14.5]].map(([x,y]) => new THREE.Vector2(x,y)),28);
  const geometry = { wall0: geometryRow(new THREE.CylinderGeometry(radius,radius,46,72,1,true)),
    wall1: geometryRow(new THREE.CylinderGeometry(radius+3,radius+3,46,72,1,true)), funnel: geometryRow(funnel),
    debris: geometryRow(new THREE.TetrahedronGeometry(.28)), scorch: geometryRow(scorch) };
  const nodes = [
    { kind: 'group', id: 'arena', children: ['wall0','wall1','funnel0','funnel1','funnel2','debris','scorch'] },
    ...[0,1].map(i => ({ kind: 'mesh', id: `wall${i}`, name: 'titan-storm-wall', geometry: `wall${i}`, material: `wall${i}`, missing: 'empty', visible: false, renderOrder: 12 })),
    ...[0,1,2].map(i => ({ kind: 'mesh', id: `funnel${i}`, name: 'titan-whirlwind', geometry: 'funnel', material: 'funnel', missing: 'empty', visible: false, renderOrder: 11 })),
    { kind: 'mesh', id: 'debris', name: 'titan-debris', geometry: 'debris', material: 'debris', missing: 'empty', instances: 120, frustumCulled: false },
    { kind: 'mesh', id: 'scorch', name: 'titan-scorch', geometry: 'scorch', material: 'scorch', missing: 'empty', instances: grid * grid, frustumCulled: false, renderOrder: 2 },
  ];
  const pixels = new Uint8Array(64*64*4);
  for (let y=0;y<64;y++) for(let x=0;x<64;x++) {
    const distance = origin.set(x+.5-32,y+.5-32,0).length(), u = Math.max(0,Math.min(1,(distance-6)/26));
    const alpha = u<.7 ? 1-u/.7*.15 : .85*(1-(u-.7)/.3), at=(y*64+x)*4;
    pixels[at]=255; pixels[at+1]=255; pixels[at+2]=255; pixels[at+3]=Math.round(alpha*255);
  }
  return { scene: parsePrivateScene({ version: 1, root: 'arena', nodes, materials: ['wall0','wall1','funnel','debris','scorch'].map(id => ({ kind: 'port', id, source: id })) }), geometry, scorch: [...pixels] };
}

/** Interpolation stays on the client; the script publishes only coarse fight observations. */
export function titanFightPoseRows(): ClientChannelProgram[] {
  const output: NumericChannelOutput[] = [];
  const add = (target: string, key: string, expr: NumericChannelOutput['expr']) => output.push({ target, path: [key], expr });
  const active = (b: ClientChannels, r: Parameters<NumericChannelOutput['expr']>[1]) => b.binary('mul',b.binary('gt',r('fight',['fighting']),b.constant(0)),b.binary('gt',b.constant(0),r('fight',['victoryT'])));
  const smooth = (b: ClientChannels, before: number, want: number, rate: number) => b.binary('add',before,b.binary('mul',b.binary('sub',want,before),b.binary('min',b.constant(1),b.binary('mul',b.clock('delta'),b.constant(rate)))));
  add('pose','kneel',(b,r) => b.select(active(b,r),smooth(b,r('pose',['kneel']),b.binary('gt',b.constant(.1),b.unary('abs',b.binary('sub',r('fight',['phase']),b.constant(1)))),1.5),r('pose',['kneel'])));
  add('pose','stride',(b,r) => b.select(active(b,r),smooth(b,r('pose',['stride']),b.binary('gt',r('fight',['phase']),b.constant(1)),.5),r('pose',['stride'])));
  add('pose','rise',(b,r) => b.select(b.binary('gt',r('fight',['victoryT']),b.constant(-.1)),b.binary('max',b.constant(0),b.binary('sub',b.constant(1),b.binary('div',r('fight',['victoryT']),b.constant(6)))),r('pose',['rise'])));
  add('alpha','value',(b,r) => {
    const phase2=b.binary('gt',b.constant(.1),b.unary('abs',b.binary('sub',r('fight',['phase']),b.constant(1))));
    const want=b.select(phase2,b.select(r('fight',['domeBroken']),b.constant(.8),b.constant(.55)),b.constant(1));
    const live=b.select(active(b,r),smooth(b,r('alpha',['value']),want,2),r('alpha',['value']));
    return b.select(b.binary('gt',r('fight',['victoryT']),b.constant(-.1)),b.binary('max',b.constant(0),b.binary('sub',b.constant(1),b.binary('div',r('fight',['victoryT']),b.constant(3.5)))),live);
  });
  add('pose','heartOpen',(b,r) => smooth(b,r('pose',['heartOpen']),r('fight',['open']),6));
  add('flash','value',(b,r) => b.binary('max',b.binary('max',b.constant(0),b.binary('sub',r('flash',['value']),b.binary('mul',b.clock('delta'),b.constant(3)))),r('fight',['flash'])));
  return output.flatMap((row,i) => numericChannelPrograms(`titan.fight.${i}`,'titan.fight',[row]));
}
