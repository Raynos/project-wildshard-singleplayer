import { expect, test } from 'vitest';
import { Object3D, PerspectiveCamera, Vector3 } from 'three';
import { parse } from 'valibot';
import { Scope } from '../src/engine/app/scope';
import { viewProgram } from '../src/engine/script/viewProgram';
import { ViewProgramSchema } from '../src/format/viewProgram';
import { compileScriptV2 } from '../src/sdk/bake/compileScriptV2';

// A made-up second program (a marsh lantern): its one transform follows the first column on x, its bank is the second
// and third columns (a camera bob, a look's glow).
const LANTERN = `
const IO: i32 = 1024; const HEADER: i32 = 128; const ENTRY: i32 = 24;
function entry(kind: i32): i32 { return IO + HEADER + (kind - 1) * ENTRY; }
function region(kind: i32): i32 { return IO + load<i32>(entry(kind) + 4); }
export function ws_abi(): i32 { return 2; }
export function ws_io(): i32 { return IO; }
export function ws_init(lo: i32, hi: i32, fuel: i32): i32 { return fuel; }
export function ws_view(dt: f64, alpha: f64, fuel: i32): i32 {
  const c = IO + load<i32>(region(15) + 20), t = region(17), out = region(18);
  store<i32>(t, 0); store<i32>(t + 4, 0); store<i32>(t + 8, 0); store<i32>(t + 12, 1);
  for (let k = 0; k < 16; k++) store<f32>(t + 16 + k * 4, 0);
  store<f32>(t + 16, 1); store<f32>(t + 36, 1); store<f32>(t + 56, 1); store<f32>(t + 76, 1); store<f32>(t + 64, <f32>load<f64>(c));
  store<i32>(entry(17) + 16, 1); store<i32>(IO + 72, 1);
  store<f64>(out, load<f64>(c + 8)); store<f64>(out + 8, load<f64>(c + 16));
  store<i32>(entry(18) + 16, 2); store<i32>(IO + 76, 2);
  return fuel;
}`;
const rows = parse(ViewProgramSchema, { system: 'marsh.lantern', before: [], budget: { pages: 1, ioBytes: 4096, fuel: 100_000, targetMs: 5 },
  samples: [{ kind: 'player', field: 'x' }, { kind: 'constant', value: .25 }, { kind: 'floor', piece: 'jetty', field: 'height' }],
  channels: [{ kind: 'camera', field: 'y' }, { kind: 'look', look: 'marsh-lantern', param: 'glow' }],
  transforms: [{ object: 'lantern' }], bounds: { translation: 100, scale: [.5, 2], shear: .01 } });

test('a view program lands its matrices on lent objects, its bank on the camera and looks, and restores on leave', async () => {
  const module = await compileScriptV2(LANTERN, { lane: 'view', ioBytes: 4096 });
  const scope = new Scope('marsh'), camera = new PerspectiveCamera(), lantern = new Object3D(), looks: [string, string, number][] = [];
  lantern.position.set(5, 1, 0);
  const player = { position: new Vector3(3, 0, 0), velocity: new Vector3() };
  const ports = (pieces: Record<string, number>) => ({ scope, player, camera, object: (id: string) => { if (id !== 'lantern') throw new Error(id); return lantern; },
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
