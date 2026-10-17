import { expect, test } from 'vitest';
import { BoxGeometry, Group, MeshBasicMaterial, MeshStandardMaterial, Vector3 } from 'three';
import * as v from 'valibot';
import { BakedBuildingAssembly } from '../src/game/shardfile/buildingAssembly';
import { LivingBuildings } from '../src/game/shardfile/livingBuildings';
import { SceneResources } from '../src/game/shardfile/sceneResources';
import { BakedBuildingLookSchema, type BakedBuildingRecord } from '../src/format/buildings';
import buildingLook from '../src/shards/pine-hollow/data/buildingLook.json' with { type: 'json' };
import { CABIN_LIFE } from '../src/shards/pine-hollow/generators/cabinLook';

test('building life keeps its door while the assembly owns static collision', () => {
  const material = new MeshStandardMaterial(), glow = new MeshBasicMaterial(), shape = new BoxGeometry();
  const resources = new SceneResources({ setupMaterial: () => undefined });
  resources.publish('shape', shape); resources.publish('wood', material); resources.publish('glow', glow);
  resources.publish('pit', new Group()); resources.publish('lantern', new Group());
  const solid = { kind: 'box' as const, x: 0, y: 1, z: 0, hx: 1, hy: 1, hz: 1 };
  const record: BakedBuildingRecord<string, string> = {
    at: [0, 0, 0], rot: 0, parts: [], glass: [],
    nodes: [{ t: 'door', pivot: [0, 0, 0], leaf: 0, iron: 1, batten: 2, id: 'door', collider: 0, top: 2, use: [0, 1, 0], slab: solid }],
    colliders: [{ x: 0, z: 0, hw: 1, hd: 1, rot: 0, yBottom: 0, yTop: 2 }],
    solids: [{ d: solid, prop: false }], floors: [{ x: 0, z: 0, rot: 0, hw: 2, hd: 2, y: 1 }],
    rooms: [], doorAt: [0, 0], firePit: null,
  };
  const look = v.parse(BakedBuildingLookSchema, buildingLook);
  const make = (row: BakedBuildingRecord<string, string>) => new BakedBuildingAssembly(resources, { id: 'test', record: row,
    geometry: { 0: 'shape', 1: 'shape', 2: 'shape' },
    materials: { parts: { door: 'wood', iron: 'wood', beam: 'wood' }, particles: {}, glass: 'wood', glow: 'glow' },
    models: { firePit: 'pit', lantern: 'lantern' }, role: 'standalone', look,
    tier: { detailDist: 10, detailShadows: false, sharedLights: true },
  });
  const made = make(record), life = new LivingBuildings(resources, CABIN_LIFE);
  try {
    life.add(made.lifeRows);
    const doors = life.doorPieces(), door = doors[0], prompt = life.interactables[0];
    if (door === undefined || prompt === undefined) throw new Error('Missing live door');
    expect(doors).toHaveLength(1);
    expect(made.weldBuild().colliders).toEqual([solid]);
    expect(door.colliders).toEqual([solid]);
    expect(made.floors).toEqual(record.floors);
    const heard: { label: string; opening: boolean }[] = [];
    life.doorChanges.addEventListener('door', () => { const change = life.doorChanges.current; if (change !== null) heard.push({ label: prompt.label, opening: change.opening }); });
    prompt.onInteract();
    expect(heard).toEqual([{ label: look.door.close, opening: true }]);
    expect(door.swinging()).toBe(true);
    const eye = new Vector3();
    life.tick(0.3, 0.3, eye, 0);
    expect(door.pivot.rotation.y).toBeCloseTo(-0.925, 12);
    door.use();
    expect(prompt.label).toBe(look.door.open);
    life.tick(0.15, 0.45, eye, 0);
    expect(door.pivot.rotation.y).toBeCloseTo(-0.23125, 12);
    life.tick(0.15, 0.6, eye, 0);
    expect(door.swinging()).toBe(false);
    expect(door.pivot.rotation.y).toBeCloseTo(0, 12);
    expect(heard).toEqual([{ label: look.door.close, opening: true }, { label: look.door.open, opening: false }]);
    expect(() => make({ ...record, colliders: [] })).toThrow('no box 0');
  } finally {
    made.root.traverse(node => { if ('geometry' in node && node.geometry instanceof BoxGeometry) node.geometry.dispose(); });
    shape.dispose(); material.dispose(); glow.dispose();
  }
});
