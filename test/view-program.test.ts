import { expect, test } from 'vitest';
import { BoxGeometry, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Object3D, PerspectiveCamera, ShaderMaterial, Vector3 } from 'three';
import { parse } from 'valibot';
import { Scope } from '../src/engine/app/scope';
import { viewProgram, type ViewSlotActor } from '../src/engine/script/viewProgram';
import { ViewProgramSchema } from '../src/format/viewProgram';
import { compileScriptV2 } from '../src/sdk/bake/compileScriptV2';

// A made-up second program (marsh lanterns): each transform position i moves to the first column + i on x; the channel
// bank is the columns after the first.
const LANTERN = `
const IO: i32 = 1024; const HEADER: i32 = 128; const ENTRY: i32 = 24;
function entry(kind: i32): i32 { return IO + HEADER + (kind - 1) * ENTRY; }
function region(kind: i32): i32 { return IO + load<i32>(entry(kind) + 4); }
export function ws_abi(): i32 { return 2; }
export function ws_io(): i32 { return IO; }
export function ws_init(lo: i32, hi: i32, fuel: i32): i32 { return fuel; }
export function ws_view(dt: f64, alpha: f64, fuel: i32): i32 {
  const c = IO + load<i32>(region(15) + 20), t = region(17), out = region(18), nt = load<i32>(entry(17) + 12), nc = load<i32>(entry(18) + 12);
  for (let i = 0; i < nt; i++) {
    const at = t + i * 80; store<i32>(at, 0); store<i32>(at + 4, i); store<i32>(at + 8, 0); store<i32>(at + 12, 1);
    for (let k = 0; k < 16; k++) store<f32>(at + 16 + k * 4, 0);
    store<f32>(at + 16, 1); store<f32>(at + 36, 1); store<f32>(at + 56, 1); store<f32>(at + 76, 1); store<f32>(at + 64, <f32>(load<f64>(c) + <f64>i));
  }
  store<i32>(entry(17) + 16, nt); store<i32>(IO + 72, nt);
  for (let i = 0; i < nc; i++) store<f64>(out + i * 8, load<f64>(c + 8 + i * 8));
  store<i32>(entry(18) + 16, nc); store<i32>(IO + 76, nc);
  return fuel;
}`;
const rows = parse(ViewProgramSchema, { system: 'marsh.lantern', before: [], budget: { pages: 1, ioBytes: 4096, fuel: 100_000, targetMs: 5 },
  samples: [{ kind: 'player', field: 'x' }, { kind: 'constant', value: .25 }, { kind: 'floor', piece: 'jetty', field: 'height' }],
  channels: [{ kind: 'camera', field: 'y' }, { kind: 'look', look: 'marsh-lantern', param: 'glow' }],
  transforms: [{ kind: 'object', object: 'lantern' }], bounds: { translation: 100, scale: [.5, 2], shear: .01 } });

test('a view program lands its matrices on lent objects, its bank on the camera and looks, and restores on leave', async () => {
  const module = await compileScriptV2(LANTERN, { lane: 'view', ioBytes: 4096 });
  const scope = new Scope('marsh'), camera = new PerspectiveCamera(), lantern = new Object3D(), looks: [string, string, number][] = [];
  lantern.position.set(5, 1, 0);
  const player = { position: new Vector3(3, 0, 0), velocity: new Vector3(), yaw: 0 };
  const ports = (pieces: Record<string, number>) => ({ scope, player, camera, slots: () => null, values: () => null, object: (id: string) => { if (id !== 'lantern') throw new Error(id); return lantern; },
    floor: (piece: string) => { const height = pieces[piece]; return height === undefined ? null : () => height; },
    look: (look: string, param: string, value: number) => { looks.push([look, param, value]); } });
  try {
    expect(viewProgram(module, rows, ports({}))).toBeNull();
    const program = viewProgram(module, rows, ports({ jetty: 2 }));
    if (program === null) throw new Error('Missing program');
    program.frame(1 / 60);
    expect(lantern.position.x).toBeCloseTo(3); expect(lantern.matrixAutoUpdate).toBe(false);
    expect(camera.position.y).toBeCloseTo(.25); expect(looks).toEqual([['marsh-lantern', 'glow', 2]]);
    program.frame(1 / 60);
    expect(camera.position.y).toBeCloseTo(.5);
    expect(() => viewProgram(module, rows, ports({ jetty: 2 }))).toThrow('already lent');
  } finally { scope.dispose(); }
  expect(lantern.position.toArray()).toEqual([5, 1, 0]); expect(lantern.matrixAutoUpdate).toBe(true);
});

test('instanced copies, bones, visibility, opacity, uniforms and per-copy attributes are targets, restored on leave', async () => {
  const module = await compileScriptV2(LANTERN, { lane: 'view', ioBytes: 4096 });
  const scope = new Scope('marsh.herd'), shape = new BoxGeometry(), fades = new InstancedBufferAttribute(new Float32Array([.1, .2]), 1);
  shape.setAttribute('aFade', fades);
  const herd = new InstancedMesh(shape, new MeshBasicMaterial(), 2), ghost = new Mesh(new BoxGeometry(), new ShaderMaterial({ uniforms: { uFade: { value: 0 } }, transparent: true }));
  const rider = new Group(), arm = new Object3D(); arm.name = 'arm'; rider.add(arm); ghost.visible = false;
  const objects: Record<string, Object3D> = { herd, ghost, rider };
  const marsh = parse(ViewProgramSchema, { ...rows, samples: [{ kind: 'player', field: 'x' }, ...[1, .4, .7, .9].map(value => ({ kind: 'constant', value }))],
    channels: [{ kind: 'visible', object: 'ghost' }, { kind: 'opacity', object: 'ghost' }, { kind: 'uniform', object: 'ghost', uniform: 'uFade' },
      { kind: 'attribute', object: 'herd', attribute: 'aFade', index: 1, component: 0 }],
    transforms: [{ kind: 'instance', object: 'herd', index: 1 }, { kind: 'bone', object: 'rider', bone: 'arm' }] });
  const program = viewProgram(module, marsh, { scope, player: { position: new Vector3(4, 0, 0), velocity: new Vector3(), yaw: 0 }, camera: new PerspectiveCamera(),
    floor: () => null, slots: () => null, values: () => null, look: () => undefined, object: id => { const found = objects[id]; if (found === undefined) throw new Error(id); return found; } });
  if (program === null) throw new Error('Missing program');
  try {
    program.frame(1 / 60);
    const copy = new Matrix4(); herd.getMatrixAt(1, copy);
    expect(new Vector3().setFromMatrixPosition(copy).x).toBeCloseTo(4); expect(arm.position.x).toBeCloseTo(5);
    expect(ghost.visible).toBe(true); expect(ghost.material.opacity).toBeCloseTo(.4); expect(ghost.material.uniforms['uFade']?.value).toBeCloseTo(.7);
    expect(fades.getX(1)).toBeCloseTo(.9); expect(fades.getX(0)).toBeCloseTo(.1);
  } finally { scope.dispose(); }
  const copy = new Matrix4(); herd.getMatrixAt(1, copy);
  expect(copy.equals(new Matrix4())).toBe(true); expect(arm.position.x).toBe(0); expect(ghost.visible).toBe(false);
  expect(ghost.material.opacity).toBe(1); expect(ghost.material.uniforms['uFade']?.value).toBe(0); expect(fades.getX(1)).toBeCloseTo(.2);
});

test('pool slots sample their actors and address each actor\'s object, re-claimed when a slot\'s identity changes', async () => {
  const module = await compileScriptV2(LANTERN, { lane: 'view', ioBytes: 4096 });
  const scope = new Scope('marsh.watch'), drawn = (): Mesh<BoxGeometry, MeshBasicMaterial> => new Mesh(new BoxGeometry(), new MeshBasicMaterial({ transparent: true }));
  const lifts: Record<string, number> = {};
  const actor = (identity: string, x: number): ViewSlotActor => ({ identity, object: drawn(), x, y: 0, z: 0, yaw: 0, alive: true, ground: 2, field: () => .5,
    set: (name, value) => { lifts[`${identity}.${name}`] = value; } });
  const first = actor('a', .3), second = actor('b', 0), slots: (ViewSlotActor | null)[] = [first, second];
  const watch = parse(ViewProgramSchema, { ...rows, pools: [{ id: 'watch', group: 'marsh.watch', count: 2, fields: ['fade'] }], samples: [{ kind: 'pool', pool: 'watch' }],
    channels: [{ kind: 'opacity', object: { pool: 'watch', slot: 0 } }, { kind: 'color', object: { pool: 'watch', slot: 0 }, color: [1, .5, 0] }, { kind: 'field', pool: 'watch', slot: 0, field: 'lift' }], transforms: [{ kind: 'object', object: { pool: 'watch', slot: 1 } }] });
  const ports = (lent: boolean) => ({ scope, player: { position: new Vector3(), velocity: new Vector3(), yaw: 0 }, camera: new PerspectiveCamera(), floor: () => null, values: () => null,
    slots: (group: string) => lent && group === 'marsh.watch' ? { actor: (slot: number) => slots[slot] ?? null } : null,
    look: () => undefined, object: (id: string): Object3D => { throw new Error(id); } });
  expect(viewProgram(module, watch, ports(false))).toBeNull();
  const program = viewProgram(module, watch, ports(true));
  if (program === null) throw new Error('Missing program');
  const third = actor('c', .6);
  const opacity = (slot: ViewSlotActor): number => { const mesh = slot.object; if (!(mesh instanceof Mesh) || !(mesh.material instanceof MeshBasicMaterial)) throw new Error('Missing mesh'); return mesh.material.opacity; };
  try {
    program.frame(1 / 60);
    expect(opacity(first)).toBeCloseTo(.3); expect(second.object.position.x).toBeCloseTo(1); expect(lifts['a.lift']).toBe(0);
    const tint = (slot: ViewSlotActor): number => { const mesh = slot.object; if (!(mesh instanceof Mesh) || !(mesh.material instanceof MeshBasicMaterial)) throw new Error('Missing mesh'); return mesh.material.color.getHex(); };
    expect(tint(first)).toBe(0); // the bank's second value is slot 0's y (0): base colour × 0
    slots[0] = third; slots[1] = null;
    program.frame(1 / 60);
    expect(opacity(first)).toBe(1); expect(tint(first)).toBe(0xffffff); expect(opacity(third)).toBeCloseTo(.6); expect(second.object.position.x).toBe(0); expect(second.object.matrixAutoUpdate).toBe(true);
  } finally { scope.dispose(); }
  expect(opacity(third)).toBe(1);
  expect(() => parse(ViewProgramSchema, { ...watch, transforms: [{ kind: 'object', object: { pool: 'watch', slot: 2 } }] })).toThrow();
});

test('lent values and the player yaw are sample columns; a missing source installs nothing', async () => {
  const module = await compileScriptV2(LANTERN, { lane: 'view', ioBytes: 4096 });
  const scope = new Scope('marsh.carry'), lantern = new Object3D(), law: Record<string, number> = { goal: 3 };
  const carry = parse(ViewProgramSchema, { ...rows, samples: [{ kind: 'player', field: 'yaw' }, { kind: 'value', source: 'carry', field: 'goal' }],
    channels: [{ kind: 'look', look: 'marsh-lantern', param: 'goal' }], transforms: [{ kind: 'object', object: 'lantern' }] });
  const looks: number[] = [];
  const ports = (lent: boolean) => ({ scope, player: { position: new Vector3(), velocity: new Vector3(), yaw: .5 }, camera: new PerspectiveCamera(), floor: () => null, slots: () => null,
    values: (source: string) => lent && source === 'carry' ? (field: string) => law[field] ?? Number.NaN : null,
    look: (_look: string, _param: string, value: number) => { looks.push(value); }, object: () => lantern });
  try {
    expect(viewProgram(module, carry, ports(false))).toBeNull();
    const program = viewProgram(module, carry, ports(true)); if (program === null) throw new Error('Missing program');
    program.frame(1 / 60);
    expect(lantern.position.x).toBeCloseTo(.5); expect(looks).toEqual([3]);
    law['goal'] = Number.NaN; expect(() => { program.frame(1 / 60); }).toThrow('not finite');
  } finally { scope.dispose(); }
});
