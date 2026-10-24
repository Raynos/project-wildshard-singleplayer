// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest';
import { Box3, BoxGeometry, BufferGeometry, BufferAttribute, InstancedMesh, MeshStandardMaterial, Vector3, Group } from 'three';
import { defineModel, modelContext } from '../src/engine/models/model';
import { place, placeSliced } from '../src/engine/models/place';
import { Scope } from '../src/engine/app/scope';
import { withOwner, enteredOwner } from '../src/engine/app/ownership';
import * as bootPlan from '../src/engine/boot/plan';
import { SkyRig } from '../src/engine/world/skyRig';
import type { ShardContext } from '../src/game/plugin/context';
import { WorldScenePlacement } from '../src/game/shardfile/worldScenePlacement';
import { parseWorldScenePlacement } from '../src/format/worldScenePlacement';
import { WorldRegistry } from '../src/engine/world/registry';

test('existing sliced placer matches native output and RNG while preserving owner across every yield', async () => {
  async function build(sliced: boolean) {
    const scope = new Scope('slice-oracle'), registry = new WorldRegistry(), material = new MeshStandardMaterial();
    const geometry: BoxGeometry[] = [], sequence: unknown[] = [];
    const model = defineModel({ id: 'fixture/slice', name: 'Slice', category: 'props', pipeline: 'code', file: 'fixture.json', defaults: { width: 1 },
      variants: [{ id: 'wide', label: 'Wide', params: { width: 2 } }],
      build: (_ctx, params, rng) => {
        expect(enteredOwner()).toBe(scope); sequence.push(['build', params.width, rng.next()]);
        const shape = new BoxGeometry(params.width, 2, 1); geometry.push(shape); return [{ geometry: shape, material }];
      },
      colliders: params => { expect(enteredOwner()).toBe(scope); sequence.push(['contact', params.width]);
        return [{ kind: 'box', x: 0, y: 1, z: 0, hx: params.width / 2, hy: 1, hz: .5 }]; } });
    const poses = Array.from({ length: 24 }, (_, i) => ({ x: i * 3, y: 2, z: i % 4, yaw: .25, ...(i % 2 ? { variant: 'wide' } : {}) }));
    const options = { ctx: modelContext(null), registry, draw: 'instanced' as const, piece: { id: 'slice' } };
    let yields = 0;
    try {
      const placed = await withOwner(scope, () => sliced ? placeSliced(model, poses, options, () => {
        yields++; expect(registry.pieces).toHaveLength(0); return Promise.resolve();
      }) : place(model, poses, options));
      await placed.registered;
      const draws: unknown[] = [];
      placed.object.traverse(node => {
        if (!(node instanceof InstancedMesh)) return;
        const shape: unknown = node.geometry; if (!(shape instanceof BufferGeometry)) throw new Error('Missing native geometry');
        const position: unknown = shape.getAttribute('position');
        if (!(position instanceof BufferAttribute)) throw new Error('Missing native positions');
        draws.push([node.count, [...node.instanceMatrix.array], [...position.array], shape.index === null ? null : [...shape.index.array]]);
      });
      return { native: { sequence, contacts: placed.colliders, copies: placed.copies, draw: placed.drawnAs, draws,
        boxes: poses.map((_, i) => { const b = placed.copyBox(i, new Box3()); return b.min.toArray().concat(b.max.toArray()); }),
        nearest: placed.nearest(new Vector3(10, 2, 0)), pieces: registry.pieces.map(piece => ({ id: piece.id, colliders: piece.colliders })) }, yields };
    } finally { scope.dispose(); registry.retire(); for (const shape of geometry) shape.dispose(); material.dispose(); }
  }
  const original = await build(false), sliced = await build(true);
  expect(sliced.native).toEqual(original.native); expect(sliced.yields).toBeGreaterThan(24);
});


test.each(['live', 'disposed', 'retiring-ancestor'] as const)('scene placement rechecks its %s owner before resuming', async retired => {
  const owner = new Scope('scene-slices');
  const child = owner.child('tile'), registry = new WorldRegistry(), sky: unknown = Object.create(SkyRig.prototype);
  const building: { scope: Scope | null } = { scope: null };
  if (!(sky instanceof SkyRig)) throw new Error('Missing sky');
  const game = {}, context = { scope: owner, app: { registry }, game } as ShardContext;
  Object.assign(game, { runtime: { world: { sky, game, registry } } });
  const geometry = new BoxGeometry(), material = new MeshStandardMaterial(), contacts = vi.fn(() => { expect(enteredOwner()).toBe(building.scope); return []; });
  const model = defineModel<Record<string, unknown>>({ id: 'fixture/paused', name: 'Paused', category: 'props', pipeline: 'code', file: 'fixture.json', defaults: {},
    build: () => { const current = enteredOwner(); if (current === null || !current.belongsTo(owner)) throw new Error('Wrong build owner'); building.scope = current; return [{ geometry, material }]; }, colliders: contacts });
  let release = () => { /* assigned synchronously below */ };
  const gate = new Promise<void>(resolve => { release = resolve; }); let pauses = 0;
  vi.spyOn(bootPlan, 'slicer').mockImplementation(() => Object.assign(async () => { /* no progress callback */ }, { due: () => ++pauses === 1 ? gate : null }));
  const row = parseWorldScenePlacement({ id: 'paused', model: 'fixture', draw: 'instanced', piece: { id: 'paused' },
    poses: Array.from({ length: 4 }, (_, i) => ({ x: 3 + i, y: 0, z: 4, yxz: { yaw: 0, scale: 1 } })) });
  const handle = new WorldScenePlacement(context, row, { model: () => model }, owner, new Map(), []);
  const outcome = async (): Promise<unknown> => { try { await handle.attach(36, child, new Group()); return null; } catch (error) { return error; } };
  const pending = outcome();
  try {
    for (let i = 0; i < 8; i++) await Promise.resolve();
    expect(pauses).toBe(1); expect(contacts).not.toHaveBeenCalled(); expect(registry.pieces).toHaveLength(0);
    if (retired === 'live') {
      release(); expect(await pending).toBeNull(); expect(contacts).toHaveBeenCalledTimes(4);
      expect(registry.pieces.some(piece => piece.id === 'paused.t36')).toBe(true);
      child.dispose(); expect(registry.pieces).toHaveLength(0); return;
    }
    const retirement = retired === 'disposed' ? null : owner.disposeSteps();
    if (retirement === null) child.dispose(); else { owner.onDisposeSteps(function* barrier() { yield; yield; }); retirement.next(); expect(building.scope?.disposed).toBe(false); expect(building.scope?.disposing).toBe(true); }
    release(); expect(await pending).toEqual(new Error('Scene placement owner is disposed'));
    expect(contacts).not.toHaveBeenCalled(); expect(registry.pieces).toHaveLength(0);
    if (retirement !== null) Array.from(retirement);
  } finally { release(); owner.dispose(); registry.retire(); geometry.dispose(); material.dispose(); }
});

test.each(['render', 'colliders'] as const)('a cached placement does not publish %s into a retiring ring', async layer => {
  const owner = new Scope('resident'), ancestor = new Scope('ring'), holder = ancestor.child('tile'), keeper = owner.child('other ring');
  const registry = new WorldRegistry(), sky: unknown = Object.create(SkyRig.prototype), game = {};
  if (!(sky instanceof SkyRig)) throw new Error('Missing sky');
  const context = { scope: owner, app: { registry }, game } as ShardContext;
  Object.assign(game, { runtime: { world: { sky, game, registry } } });
  const geometry = new BoxGeometry(), material = new MeshStandardMaterial();
  const build = vi.fn(() => [{ geometry, material }]);
  const model = defineModel<Record<string, unknown>>({ id: 'fixture/cached', name: 'Cached', category: 'props', pipeline: 'code', file: 'fixture.json', defaults: {},
    build, colliders: () => [{ kind: 'ball', x: 0, y: 0, z: 0, radius: 1 }] });
  const row = parseWorldScenePlacement({ id: 'cached', model: 'fixture', draw: 'instanced', piece: { id: 'cached' },
    poses: [{ x: 3, y: 0, z: 4, yxz: { yaw: 0, scale: 1 } }] });
  const handle = new WorldScenePlacement(context, row, { model: () => model }, owner, new Map(), []), container = new Group();
  let steps: ReturnType<Scope['disposeSteps']> | null = null;
  try {
    // The other ring keeps the cached build live while this holder retires.
    await (layer === 'render' ? handle.attachColliders(36, keeper) : handle.attach(36, keeper, container));
    const pending = layer === 'render' ? handle.attach(36, holder, container) : handle.attachColliders(36, holder);
    ancestor.onDisposeSteps(function* barrier() { yield; });
    steps = ancestor.disposeSteps(); steps.next();
    expect(holder.disposed).toBe(false); expect(holder.disposing).toBe(true);
    await pending;
    if (layer === 'render') expect(container.children).toHaveLength(0);
    else expect(registry.get('cached.c36')).toBeUndefined();
    Array.from(steps);
    const returned = owner.child('returned ring');
    if (layer === 'render') { await handle.attach(36, returned, container); expect(container.children).toHaveLength(1); }
    else { await handle.attachColliders(36, returned); expect(registry.get('cached.c36')?.colliders).toHaveLength(1); }
    expect(build).toHaveBeenCalledOnce(); expect(keeper.disposed).toBe(false);
  } finally {
    if (steps === null) ancestor.dispose(); else Array.from(steps);
    keeper.dispose(); owner.dispose(); registry.retire(); geometry.dispose(); material.dispose();
  }
});
