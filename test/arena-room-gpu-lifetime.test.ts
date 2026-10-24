// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import { BufferAttribute, BufferGeometry, Material, Mesh, Scene, Vector3, Raycaster } from 'three';
// oxlint-disable-next-line import/no-nodejs-modules -- Isolate collection with the actual fixture setup and exposed GC.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Own only the short-lived real-GC child configuration.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the installed runner without shell interpolation.
import { resolve as resolvePath } from 'node:path';
import { Scope } from '../src/engine/app/scope';
import { withOwner } from '../src/engine/app/ownership';
import { WorldRegistry } from '../src/engine/world/registry';
import { buildArenaRoomEncounter } from '../src/game/boss/arenaRoom';
import type { ShardContext } from '../src/game/plugin/context';
import { legacyDouble } from './fake/FakeGame';
import { SHAPES } from './fixtures/nalatiShapes';
import { titanPrograms } from './fixtures/titanInlineWitness';
import room from '../src/shards/nalati-grasslands/data/bossArenaRoom.json' with { type: 'json' };
import view from '../src/shards/nalati-grasslands/data/kurganView.json' with { type: 'json' };

const encounterRows = {
  definition: { id: 'room-fixture', name: 'Room', title: '', retryTitle: '', intro: 0, introShort: 0, phases: [{ at: 1, caption: '', name: '' }] },
  reward: { tier: 'RARE', name: 'Reward', flavour: '', prompt: 'TAKE' },
  page: { profile: null, body: 'room.king', identity: 'runtime', add: { kind: 'guard', variant: 'base', memory: {} }, damageTag: 'boss.room',
    maxZ: 10, reward: [0, 0, 0], respawn: [0, 0, 0], yaw: 0, presentation: { reach: 1, ringMax: 1, beamRadius: 1 },
    cuts: [{ id: 'cut', shape: { kind: 'sphere', radius: 1 }, windup: 0, active: 0, recover: 0, cooldown: 0, range: null, damage: 1, tags: [], weight: { kind: 'constant', value: 1 } }], hazards: {} },
  portal: { signal: 'door', spawn: { x: 0, z: 0, yaw: 0 }, end: 10, exitOffset: 1, slow: 1, fade: { out: 0, hold: 0, in: 0 }, keep: 'sky', near: 10, floor: { tolerance: .1, depth: 1 } },
  client: { light: { colour: 0xffffff, drop: 1 }, prewarm: { kind: 'guard', variant: 'base' }, system: 'room.power', debugZ: 1 },
  program: titanPrograms.rules,
};

async function installed() {
  if (!SHAPES.ready) throw new Error('The real shape fixture must be installed by test/setup.ts');
  const scope = new Scope('room-upload'), scene = new Scene(), registry = new WorldRegistry(), copies = new Map<string, BufferGeometry>();
  type Runtime = NonNullable<ShardContext['game']['runtime']>;
  type World = NonNullable<Runtime['world']>;
  const world = legacyDouble<World>({ game: legacyDouble<World['game']>({ scene }) });
  const ctx = legacyDouble<ShardContext>({ scope, app: legacyDouble<ShardContext['app']>({ registry }),
    game: legacyDouble<ShardContext['game']>({ runtime: legacyDouble<Runtime>({ world }) }) });
  const draws = { ready: true, handle: (id: string) => {
    const handle = SHAPES.handle(id);
    return { ...handle, copy: () => { const geometry = handle.copy();copies.set(id, geometry);return geometry; } };
  } };
  const encounter = await withOwner(scope, () => buildArenaRoomEncounter(ctx, { ...room, view }, encounterRows, draws, null));
  return { scope, scene, registry, copies, encounter, dispose: () => {
    scope.dispose();for (const geometry of copies.values()) geometry.dispose();
    encounter.dungeon.group.traverse(node => { if (node instanceof Mesh) { const material: unknown = node.material;if (material instanceof Material) material.dispose(); } });
    scene.clear();
  } };
}

function upload(geometry: BufferGeometry): number {
  let released = 0;
  const position: unknown = geometry.getAttribute('position');const index = geometry.index;
  if (!(position instanceof BufferAttribute)) throw new Error('Missing plain room positions');
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    if (!(attribute instanceof BufferAttribute)) throw new Error('Expected owned room attribute');
    const count = attribute.count, before = attribute.array.byteLength;
    // Renderer calls onUpload only after copying exactly these bytes to GL.
    const payload = attribute.array.slice();
    attribute.onUploadCallback();
    expect(attribute.count).toBe(count);
    if (name === 'position') expect(attribute.array).toEqual(payload);
    released += before - attribute.array.byteLength;
  }
  expect(geometry.getAttribute('position')).toBe(position);expect(geometry.index).toBe(index);
  return released;
}

function rayHit(mesh: Mesh): { distance: number; point: number[] } {
  const geometry: unknown = mesh.geometry;
  if (!(geometry instanceof BufferGeometry)) throw new Error('Expected room geometry');
  const position: unknown = geometry.getAttribute('position');const index = geometry.index;
  if (!(position instanceof BufferAttribute)) throw new Error('Missing plain room positions');
  const a = new Vector3(), b = new Vector3(), c = new Vector3(), normal = new Vector3();
  for (let triangle = 0; triangle < (index?.count ?? position.count) / 3; triangle++) {
    const vertex = (corner: number): number => index?.getX(triangle * 3 + corner) ?? triangle * 3 + corner;
    a.fromBufferAttribute(position, vertex(0));b.fromBufferAttribute(position, vertex(1));c.fromBufferAttribute(position, vertex(2));
    normal.crossVectors(b.clone().sub(a), c.clone().sub(a));if (normal.lengthSq() === 0) continue;
    mesh.updateWorldMatrix(true, false);
    const point = a.add(b).add(c).divideScalar(3).applyMatrix4(mesh.matrixWorld);
    normal.transformDirection(mesh.matrixWorld);
    const hit = new Raycaster(point.clone().addScaledVector(normal, 2), normal.negate()).intersectObject(mesh, false)[0];
    if (hit !== undefined) return { distance: hit.distance, point: hit.point.toArray() };
  }
  throw new Error('No room triangle was picked');
}

test('private room uploads release fixed channels, preserving templates, picking, sand and lazy interior', async () => {
  const live = await installed();
  try {
    const dungeon = live.encounter.dungeon, sandRow = view.scene.nodes.find(node => node.id === room.sand);
    if (sandRow === undefined || !('geometry' in sandRow)) throw new Error('Missing sand source');
    const sand = live.copies.get(sandRow.geometry);if (sand === undefined) throw new Error('Missing sand copy');
    let mesh: Mesh | undefined;
    dungeon.group.traverse(node => { if (node instanceof Mesh && node.geometry !== sand && mesh === undefined) mesh = node; });
    if (mesh === undefined) throw new Error('Missing fixed room mesh');
    const sandColour: unknown = sand.getAttribute('color');if (!(sandColour instanceof BufferAttribute)) throw new Error('Missing sand colours');
    const before = rayHit(mesh), sandColourVersion = sandColour.version;
    const sandBytes = Object.values(sand.attributes).reduce((sum, attribute) => sum + attribute.array.byteLength, 0);
    await dungeon.buildStaticSliced(() => Promise.resolve());
    const main = new Set(view.scene.nodes.flatMap(node => 'geometry' in node ? [node.geometry] : []));
    let released = 0, interiorOnly = 0;
    for (const [id, geometry] of live.copies) {
      const template = SHAPES.handle(id).copy();
      try {
        for (const [name, attribute] of Object.entries(geometry.attributes)) {
          if (name === 'light') continue;
          expect(attribute.array).toEqual(template.getAttribute(name).array);
        }
        const bytes = upload(geometry);released += bytes;if (!main.has(id)) interiorOnly += bytes;
        if (geometry !== sand) for (const [name, attribute] of Object.entries(geometry.attributes)) {
          if (name !== 'position') expect(attribute.array.byteLength).toBe(0);
        }
        expect(template.getAttribute('position').array.byteLength).toBeGreaterThan(0);
      } finally { template.dispose(); }
    }
    process.stdout.write(`arena.room upload proof: ${String(released)} bytes (${String(interiorOnly)} lazy interior, ${String(released - interiorOnly)} shell/effects)\n`);
    expect(released).toBeGreaterThan(0);expect(rayHit(mesh)).toEqual(before);
    expect(Object.values(sand.attributes).reduce((sum, attribute) => sum + attribute.array.byteLength, 0)).toBe(sandBytes);
    dungeon.setVisible(true);dungeon.addSand(0, 0, 3, .7);dungeon.update(.1, 0);
    expect(sandColour.version).toBeGreaterThan(sandColourVersion);expect(dungeon.sandAt(0, 0)).toBeGreaterThan(0);
  } finally { live.dispose(); }
  const rebuilt = await installed();
  try {
    for (const geometry of rebuilt.copies.values()) if (geometry.hasAttribute('normal')) expect(geometry.getAttribute('normal').array.byteLength).toBeGreaterThan(0);
  } finally { rebuilt.dispose(); }
});

test('uploaded fixed backing collects while its room remains live', async () => {
  const gc: unknown = Reflect.get(globalThis, 'gc');
  if (typeof gc !== 'function') {
    if (process.env['WS_ARENA_GC'] === '1') throw new Error('Collection proof requires --expose-gc');
    mkdirSync('tmp', { recursive: true });const directory = mkdtempSync(resolvePath('tmp/arena-upload-gc-'));
    try {
      const config = resolvePath(directory, 'vitest.config.mjs');
      writeFileSync(config, `import config from '../../vitest.config.ts';export default {...config,test:{...config.test,include:['test/arena-room-gpu-lifetime.test.ts'],maxWorkers:1,execArgv:['--expose-gc']}};`);
      const output = execFileSync(process.execPath, ['--expose-gc', resolvePath('node_modules/vitest/vitest.mjs'), 'run', 'test/arena-room-gpu-lifetime.test.ts', '--config', config, '-t', 'uploaded fixed backing collects'], {
        env: { ...process.env, WS_ARENA_GC: '1', NO_COLOR: '1' }, encoding: 'utf8', stdio: 'pipe', timeout: 30_000,
      });expect(output).toContain('1 passed');
    } finally { rmSync(directory, { recursive: true, force: true }); }
    return;
  }
    const live = await installed();
    try {
      const sent = (): WeakRef<object> => {
        const lid = view.scene.nodes.find(node => node.id === room.lid);
        if (lid === undefined || !('geometry' in lid)) throw new Error('Missing lid source');
        const geometry = live.copies.get(lid.geometry);if (geometry === undefined) throw new Error('Missing lid copy');
        const normal: unknown = geometry.getAttribute('normal');if (!(normal instanceof BufferAttribute)) throw new Error('Missing lid normals');
        const reference = new WeakRef<object>(normal.array.buffer);
        expect(normal.array.byteLength).toBeGreaterThan(0);upload(geometry);return reference;
      };
      const reference = sent();
      for (let turn = 0; turn < 40; turn++) {
        await new Promise<void>(resolve => { setTimeout(resolve, 0); });Reflect.apply(gc, globalThis, []);
        if (reference.deref() === undefined) break;
      }
      expect(reference.deref()).toBeUndefined();
      expect(live.scope.disposed).toBe(false);expect(live.scene.children).toContain(live.encounter.dungeon.group);
      for (const geometry of live.copies.values()) expect(geometry.getAttribute('position').array.byteLength).toBeGreaterThan(0);
    } finally { live.dispose(); }
});
