import { expect, test, vi } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { parse } from 'valibot';
import { App } from '../src/engine/app/app';
import { Scope } from '../src/engine/app/scope';
import { createLevelInstallation } from '../src/engine/level/installation';
import { WorldRegistry } from '../src/engine/world/registry';
import { shardContext } from '../src/game/plugin/context';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { emptyShardfile } from '../src/sdk/author';
import { MANIFEST as TEMPLATE } from '../src/shards/_template/discovery.generated';
import { installViewProgram, lendViewCell, lendViewFrame, lendViewValues } from '../src/game/shardfile/clientViewProgram';
import { compileScriptV2 } from '../src/sdk/bake/compileScriptV2';
import { ViewProgramSchema } from '../src/format/viewProgram';
import { ViewLane, prepareViewMemory, type ViewLaneRows } from '../src/engine/script/viewLane';

// G600 L7: an owner's inline frame slot. The program samples one lent value and writes it to one lent cell.
const COPY = `
const IO: i32 = 1024; const HEADER: i32 = 128; const ENTRY: i32 = 24;
function entry(kind: i32): i32 { return IO + HEADER + (kind - 1) * ENTRY; }
function region(kind: i32): i32 { return IO + load<i32>(entry(kind) + 4); }
export function ws_abi(): i32 { return 2; }
export function ws_io(): i32 { return IO; }
export function ws_init(lo: i32, hi: i32, fuel: i32): i32 { return fuel; }
export function ws_view(dt: f64, alpha: f64, fuel: i32): i32 {
  const c = IO + load<i32>(region(15) + 20), out = region(18);
  store<f64>(out, load<f64>(c)); store<i32>(entry(18) + 16, 1); store<i32>(IO + 76, 1);
  return fuel;
}`;
const rows = parse(ViewProgramSchema, { slot: 'owner.frame', budget: { pages: 1, ioBytes: 4096, fuel: 100_000, targetMs: 5 },
  samples: [{ kind: 'value', source: 'owner', field: 'v' }], channels: [{ kind: 'cell', cell: 'owner.cell' }], transforms: [], bounds: { translation: 0, scale: [1, 1], shear: 0 } });
const feature = { kind: 'view.program' as const, id: 'owner-frame', module: 'views/owner.wasm', rows };

function context(name: string): ReturnType<typeof shardContext> {
  const scope = new Scope(name), product = createShardProduct({ slug: 'slot-fixture', revision: 1, sections: new Map(), files: new Map(),
    shardfile: emptyShardfile({ slug: 'slot-fixture', name: 'Slot fixture', author: 'Test', revision: 1, seed: 1 }),
    read: () => Promise.reject(new Error('A frame slot needs no file read')) });
  const level = createLevelInstallation(new App(), scope, {}, () => ({ set: () => undefined, detail: () => undefined }));
  const ctx = shardContext(level.context, TEMPLATE, { shard: TEMPLATE, rows: new Map(), bag: { tab: () => () => undefined, fragment: () => () => undefined } }, product);
  Object.defineProperty(ctx.game, 'runtime', { value: { world: { registry: new WorldRegistry(), player: { position: new Vector3(), velocity: new Vector3(), yaw: 0 }, game: { camera: new PerspectiveCamera() } } } });
  return ctx;
}

test('a slot program installs no system and runs only where its owner calls the frame, whichever side comes first', async () => {
  const module = await compileScriptV2(COPY, { lane: 'view', ioBytes: 4096 });
  const NativeMemory = WebAssembly.Memory, NativeInstance = WebAssembly.Instance;
  expect(() => parse(ViewProgramSchema, { ...rows, system: 'owner.system' })).toThrow('one update system or one owner slot');
  for (const order of ['install first', 'lend first'] as const) {
    const allocated: WebAssembly.Memory[] = [], instantiated: WebAssembly.Instance[] = [];
    const memory = vi.spyOn(WebAssembly, 'Memory').mockImplementation(class extends NativeMemory {
      constructor(descriptor: WebAssembly.MemoryDescriptor) { super(descriptor); allocated.push(this); }
    });
    const instance = vi.spyOn(WebAssembly, 'Instance').mockImplementation(class extends NativeInstance {
      constructor(compiled: WebAssembly.Module, imports?: WebAssembly.Imports) { super(compiled, imports); instantiated.push(this); }
    });
    const ctx = context(order), system = vi.spyOn(ctx, 'system'), cell = { value: -1 }, values = { v: 2 };
    const lendAll = (): ReturnType<typeof lendViewFrame> => {
      lendViewValues(ctx.scope, 'owner', () => values.v); lendViewCell(ctx.scope, 'owner.cell', cell);
      return lendViewFrame(ctx.scope, 'owner.frame');
    };
    let slot: ReturnType<typeof lendViewFrame>;
    if (order === 'install first') {
      installViewProgram(ctx, feature, module); expect(cell.value).toBe(-1);
      expect(allocated).toHaveLength(1); expect(instantiated).toHaveLength(0);
      const fresh = allocated[0]; if (fresh === undefined) throw new Error('Missing reserved memory');
      expect(new Uint8Array(fresh.buffer).every(value => value === 0)).toBe(true);
      slot = lendAll();
    }
    else { slot = lendAll(); slot.frame(1 / 60, 0); expect(cell.value).toBe(-1); installViewProgram(ctx, feature, module); }
    try {
      expect(allocated).toHaveLength(1); expect(instantiated).toHaveLength(1);
      expect(system).not.toHaveBeenCalled(); expect(cell.value).toBe(-1);
      slot.frame(1 / 60, 0); expect(cell.value).toBe(2);
      values.v = 5; expect(cell.value).toBe(2); slot.frame(1 / 60, 1 / 60); expect(cell.value).toBe(5);
      expect(() => lendViewFrame(ctx.scope, 'owner.frame')).toThrow('cannot be lent');
      expect(() => { installViewProgram(ctx, feature, module); }).toThrow('cannot be lent');
      expect(allocated).toHaveLength(1);
    } finally { ctx.scope.dispose(); memory.mockRestore(); instance.mockRestore(); }
    expect(cell.value).toBe(-1);
  }
});

test('prepared view memories admit once for their exact live owner, bytes and fixed pages', async () => {
  const module = await compileScriptV2(COPY, { lane: 'view', ioBytes: 4096 }), scope = new Scope('prepared-view'), foreign = new Scope('foreign-view');
  const laneRows: ViewLaneRows = { bindings: [{ handle: 1, columns: 1 }], transforms: [], channels: 1,
    bounds: rows.bounds, targetMs: 5, fuel: 100_000 };
  const targets = { write: () => undefined, channels: () => undefined, upload: () => undefined };
  const token = prepareViewMemory(module, 1, scope);
  const construct = (memory: typeof token, owner = scope, bytes = module, pages = 1): ViewLane =>
    new ViewLane(bytes, pages, laneRows, targets, [0, 0], { memory, scope: owner });
  try {
    expect(() => construct({ pages: 1 })).toThrow('reservation');
    expect(() => construct(token, foreign)).toThrow('reservation');
    expect(() => construct(token, scope, module, 2)).toThrow('declared');
    // An otherwise valid module with an extra empty-name custom section is a different image.
    expect(() => construct(token, scope, Uint8Array.from([...module, 0, 1, 0]))).toThrow('reservation');
    const view = construct(token), other = construct(prepareViewMemory(module, 1, foreign), foreign);
    expect(view.memory).not.toBe(other.memory);
    new Uint8Array(view.memory.buffer)[0] = 99;
    expect(new Uint8Array(other.memory.buffer)[0]).toBe(0);
    expect(() => construct(token)).toThrow('reservation');
    const abandoned = prepareViewMemory(module, 1, scope); scope.dispose();
    expect(() => construct(abandoned)).toThrow('reservation');
    expect(() => prepareViewMemory(module, 1, scope)).toThrow('ended');
  } finally { scope.dispose(); foreign.dispose(); }
});
