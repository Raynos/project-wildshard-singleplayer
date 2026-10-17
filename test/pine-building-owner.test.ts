import { expect, test } from 'vitest';
import { BoxGeometry, Group, MeshBasicMaterial, MeshStandardMaterial, Vector3 } from 'three';
import { BakedBuildingAssembly, type BakedBuildingRecord } from '../src/shards/pine-hollow/runtime/props/bakedBuilding';
import { BuildingLife } from '../src/shards/pine-hollow/runtime/props/buildingLife';
import { CABIN_BUILD } from '../src/shards/pine-hollow/runtime/props/cabinBuild';
import { CABIN_LIFE } from '../src/shards/pine-hollow/generators/cabinLook';

test('building life keeps its door while the assembly owns static collision', () => {
  const material = new MeshStandardMaterial(), glow = new MeshBasicMaterial(), shapes: BoxGeometry[] = [];
  const solid = { kind: 'box' as const, x: 0, y: 1, z: 0, hx: 1, hy: 1, hz: 1 };
  const record: BakedBuildingRecord<string, string> = {
    at: [0, 0, 0], rot: 0, parts: [], glass: [],
    nodes: [{ t: 'door', pivot: [0, 0, 0], leaf: 0, iron: 1, batten: 2, id: 'door', collider: 0, top: 2, use: [0, 1, 0], slab: solid }],
    colliders: [{ x: 0, z: 0, hw: 1, hd: 1, rot: 0, yBottom: 0, yTop: 2 }],
    solids: [{ d: solid, prop: false }], floors: [{ x: 0, z: 0, rot: 0, hw: 2, hd: 2, y: 1 }],
    rooms: [], doorAt: [0, 0], firePit: null,
  };
  const materials = Object.fromEntries(['door', 'iron', 'beam'].map(key => [key, material]));
  const make = (row: BakedBuildingRecord<string, string>, owner: BuildingLife) => new BakedBuildingAssembly({
    owner, record: row, geometries: { geometry: () => { const geometry = new BoxGeometry(); shapes.push(geometry); return geometry; } },
    mats: { parts: materials, particles: {}, glass: material, glow }, sky: { setupMaterial: () => undefined },
    models: { firePit: new Group(), lantern: new Group() },
    role: 'standalone', look: CABIN_BUILD, tier: { detailDist: 10, detailShadows: false, sharedLights: true },
  });
  try {
    const life = new BuildingLife(CABIN_LIFE), made = make(record, life), doors = life.doorPieces(), door = doors[0];
    if (door === undefined) throw new Error('Missing live door');
    expect(doors).toHaveLength(1);
    expect(made.weldBuild().colliders).toEqual([solid]);
    expect(door.colliders).toEqual([solid]);
    expect(made.floors).toEqual(record.floors);
    const prompt = life.interactables[0];
    if (prompt === undefined) throw new Error('Missing door prompt');
    const heard: { label: string; opening: boolean }[] = [];
    life.onDoor((view, opening) => { heard.push({ label: view.label, opening }); });
    prompt.onInteract();
    expect(heard).toEqual([{ label: CABIN_BUILD.door.close, opening: true }]);
    expect(door.swinging()).toBe(true);
    const eye = new Vector3();
    life.tick(0.3, 0.3, eye, 0);
    expect(door.pivot.rotation.y).toBeCloseTo(-0.925, 12);
    prompt.onInteract();
    expect(prompt.label).toBe(CABIN_BUILD.door.open);
    expect(door.swinging()).toBe(true);
    life.tick(0.15, 0.45, eye, 0);
    expect(door.pivot.rotation.y).toBeCloseTo(-0.23125, 12);
    life.tick(0.15, 0.6, eye, 0);
    expect(door.swinging()).toBe(false);
    expect(door.pivot.rotation.y).toBeCloseTo(0, 12);
    expect(heard).toEqual([
      { label: CABIN_BUILD.door.close, opening: true },
      { label: CABIN_BUILD.door.open, opening: false },
    ]);
    prompt.onInteract();
    life.tick(1, 1.6, eye, 0);
    expect(door.swinging()).toBe(false);
    expect(door.pivot.rotation.y).toBeLessThan(0);
    expect(prompt.label).toBe(CABIN_BUILD.door.close);
    expect(() => make({ ...record, colliders: [] }, new BuildingLife(CABIN_LIFE))).toThrow('no box 0');
  } finally {
    for (const geometry of shapes) geometry.dispose();
    material.dispose(); glow.dispose();
  }
});
