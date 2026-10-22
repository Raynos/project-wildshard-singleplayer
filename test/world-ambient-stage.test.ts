import { expect, test, vi } from 'vitest';
import { BufferAttribute, BufferGeometry, Group, MeshBasicMaterial } from 'three';
import * as v from 'valibot';
import { Scope } from '../src/engine/app/scope';
import type { ModelContext } from '../src/engine/models/model';
import { createOwnedGeometry } from '../src/engine/models/ownedGeometry';
import { setTerrainHeight } from '../src/engine/world/terrainHeight';
import { WorldAssemblySchema } from '../src/format/worldAssembly';
import { WorldAssembly, type WorldAssemblyPorts } from '../src/game/shardfile/worldAssembly';
import { entryOwner } from '../src/game/shardfile/entryOwners';
import { SceneHandles } from '../src/game/shardfile/sceneHandles';
import { lendLooks } from '../src/game/shardfile/lentLooks';
import { createAmbientFlock } from '../src/game/ambient/ambientFlock';
import type { FixedDraws } from '../src/game/models/fixedDraws';
import { legacyDouble } from './fake/FakeGame';
import { GULL_FLOCK } from '../src/shards/driftwood-isle/generators/gullsLook';
import { WORLD_GULL_PERCHES } from '../src/shards/driftwood-isle/generators/staticWorld';
import { GULL_GRAPH_LOOK } from '../src/shards/driftwood-isle/generators/gullGraphLook';
import { WORLD_STAGES } from '../src/shards/driftwood-isle/generators/worldAssembly';

const row = { kind: 'ambient-flock', id: 'driftwood.gulls', label: 'Gulls', rows: GULL_FLOCK,
  draw: { slot: 'gull', look: GULL_GRAPH_LOOK, castShadow: true }, perches: WORLD_GULL_PERCHES };
const stages = { stages: [row] };
function fixture(lent = true) {
  setTerrainHeight(() => 0);
  const parent = new Scope('cell'), scope = parent.child('construction'), root = new Group(), geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3));
  const source = createOwnedGeometry('unused'); source.adopt(geometry);
  const copy = vi.spyOn(source, 'copy'), material = new MeshBasicMaterial({ color: 0x445566, transparent: true });
  const clone = vi.spyOn(material, 'clone'), handle = vi.fn((slot: string) => { if (slot !== 'gull') throw new Error('Missing slot'); return source; });
  const draws: FixedDraws = { ready: true, handle, load: vi.fn(() => Promise.resolve()) };
  if (lent) lendLooks(scope, { materials: new Map([[GULL_GRAPH_LOOK, material]]), setParam: () => undefined, setTexture: () => undefined, bindMeshMap: () => material });
  const slices: string[] = [], ports: WorldAssemblyPorts = { scope, scenes: new SceneHandles(), context: legacyDouble<ModelContext>({}), registry: null, draws,
    entry: { root, tier: 'phone' }, slice: label => { slices.push(label); return Promise.resolve(); } };
  const close = (): void => { parent.dispose(); geometry.dispose(); material.dispose(); };
  return { parent, scope, root, geometry, source, copy, material, clone, draws, ports, slices, close };
}

test('ambient construction preserves the original seeded flock, draw buffers, material clone and original root', async () => {
  const f = fixture();
  const original = createAmbientFlock(GULL_FLOCK, { name: GULL_GRAPH_LOOK, geometry: f.source.copy(), material: f.material.clone(), castShadow: true }, WORLD_GULL_PERCHES);
  f.copy.mockClear(); f.clone.mockClear();
  try {
    await WorldAssembly.admit(stages, f.ports).next('driftwood.gulls');
    const draw = entryOwner(f.scope, 'ambient-draw', 'driftwood.gulls');
    expect(entryOwner(f.scope, 'object', 'driftwood.gulls')).toBe(draw.group); expect(entryOwner(f.scope, 'ambient', 'driftwood.gulls')).toBe(draw.flock);
    expect(draw.group.parent).toBe(f.root); expect(f.root.children).toEqual([draw.group]);
    expect(draw.mesh.name).toBe(original.mesh.name); expect(draw.mesh.castShadow).toBe(original.mesh.castShadow); expect(draw.mesh.receiveShadow).toBe(original.mesh.receiveShadow);
    expect(draw.mesh.material).not.toBe(f.material); expect(draw.mesh.material).toBeInstanceOf(MeshBasicMaterial);
    if (!(draw.mesh.material instanceof MeshBasicMaterial) || !(original.mesh.material instanceof MeshBasicMaterial)) throw new Error('Missing material');
    expect(draw.mesh.material.color.toArray()).toEqual(original.mesh.material.color.toArray()); expect(draw.mesh.material.transparent).toBe(original.mesh.material.transparent);
    expect(f.copy).toHaveBeenCalledTimes(1); expect(f.clone).toHaveBeenCalledTimes(1); expect(f.draws.load).not.toHaveBeenCalled(); expect(f.slices).toEqual(['Gulls']);
    expect(draw.flock.birds).toEqual(original.flock.birds);
    const player = { x: 0, y: 1.7, z: -205 };
    for (let step = 0; step < 240; step++) {
      if (step === 20) expect(draw.guide(player, 120, 75)).toBe(original.guide(player, 120, 75));
      draw.update(1 / 60, player); original.update(1 / 60, player);
      expect(draw.flock.birds).toEqual(original.flock.birds); expect(draw.flock.calls).toEqual(original.flock.calls);
      expect(draw.mesh.instanceMatrix.array).toEqual(original.mesh.instanceMatrix.array);
      expect(draw.mesh.geometry.getAttribute('aAnim').array).toEqual(original.mesh.geometry.getAttribute('aAnim').array);
    }
    const entered = f.scope.child('entered'), disposal = vi.spyOn(draw.mesh.material, 'dispose');
    WorldAssembly.lend(stages, f.scope, entered);
    for (const kind of ['object', 'ambient-draw', 'ambient'] as const) expect(entryOwner(entered, kind, 'driftwood.gulls')).toBe(entryOwner(f.scope, kind, 'driftwood.gulls'));
    entered.dispose(); expect(disposal).not.toHaveBeenCalled(); expect(draw.group.parent).toBe(f.root); disposal.mockRestore();
    const next = f.scope.child('next'); WorldAssembly.lend(stages, f.scope, next); expect(entryOwner(next, 'ambient-draw', 'driftwood.gulls')).toBe(draw);
    draw.mesh.geometry.dispose(); draw.mesh.material.dispose();
  } finally { original.mesh.geometry.dispose(); if (original.mesh.material instanceof MeshBasicMaterial) original.mesh.material.dispose(); f.close(); }
});

test('missing original draw, loaded intake, graph or root refuses before copying or cloning', async () => {
  for (const missing of ['draws', 'ready', 'slot', 'look', 'root'] as const) {
    const f = fixture(missing !== 'look');
    try {
      let ports = f.ports;
      if (missing === 'draws') { const { draws: _draws, ...rest } = ports; ports = rest; }
      if (missing === 'ready') ports = { ...ports, draws: { ...f.draws, ready: false } };
      if (missing === 'slot') ports = { ...ports, draws: { ...f.draws, handle: () => { throw new Error('Missing slot'); } } };
      if (missing === 'root') { const { entry: _entry, ...rest } = ports; ports = rest; }
      await expect(WorldAssembly.admit(stages, ports).next('driftwood.gulls')).rejects.toThrow();
      expect(f.copy).not.toHaveBeenCalled(); expect(f.clone).not.toHaveBeenCalled(); expect(f.root.children).toHaveLength(0);
      expect(() => entryOwner(f.scope, 'ambient-draw', 'driftwood.gulls')).toThrow();
    } finally { f.close(); }
  }
});

test('retired or retiring construction admits no ambient allocation and a sliced retirement publishes no entered loans', async () => {
  const f = fixture();
  try {
    f.parent.onDispose(() => undefined); const steps = f.parent.disposeSteps(); steps.next();
    await expect(WorldAssembly.admit(stages, f.ports).next('driftwood.gulls')).rejects.toThrow('owner left');
    expect(f.copy).not.toHaveBeenCalled(); expect(f.clone).not.toHaveBeenCalled();
    for (let step = steps.next(); step.done !== true; step = steps.next()) { /* drain */ }
  } finally { f.close(); }
  const g = fixture(), entered = g.scope.child('entered');
  try {
    const assembly = WorldAssembly.admit(stages, { ...g.ports, slice: () => { g.scope.dispose(); return Promise.resolve(); } });
    await expect(assembly.next('driftwood.gulls')).rejects.toThrow('owner left');
    expect(() => WorldAssembly.lend(stages, g.scope, entered)).toThrow();
  } finally { g.close(); }
});

test('the production stage retains the exact original perch and flock rows at the old Gulls step', () => {
  const admitted = v.parse(WorldAssemblySchema, WORLD_STAGES), at = admitted.stages.findIndex(stage => stage.kind === 'ambient-flock');
  expect(admitted.stages[at - 1]?.id).toBe('bushes'); expect(admitted.stages[at + 1]?.id).toBe('trail');
  expect(admitted.stages[at]).toEqual(v.parse(WorldAssemblySchema, stages).stages[0]);
  expect(() => v.parse(WorldAssemblySchema, { stages: [{ ...row, run: 'gulls' }] })).toThrow();
  expect(() => v.parse(WorldAssemblySchema, { stages: [{ ...row, perches: [{ x: Number.NaN, y: 0, z: 0 }] }] })).toThrow();
});
