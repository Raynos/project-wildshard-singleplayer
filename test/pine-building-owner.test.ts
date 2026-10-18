import { expect, test } from 'vitest';
import { BoxGeometry, type BufferGeometry, Group, Material, Mesh, MeshBasicMaterial, MeshStandardMaterial, type Object3D, PointLight, Vector3 } from 'three';
import * as v from 'valibot';
import { BakedBuildingAssembly } from '../src/game/shardfile/buildingAssembly';
import { LivingBuildings } from '../src/game/shardfile/livingBuildings';
import { SceneHandles } from '../src/game/shardfile/sceneHandles';
import { BakedBuildingLookSchema, type BakedBuildingRecord } from '../src/format/buildings';
import buildingLook from '../src/shards/pine-hollow/data/buildingLook.json' with { type: 'json' };
import { CABIN_LIFE } from '../src/shards/pine-hollow/generators/cabinLook';
import { CabinSceneRecorder } from '../src/shards/pine-hollow/generators/cabinScenes';
import { cabinSceneSources } from '../src/shards/pine-hollow/generators/cabinSceneSources.mjs';
import { installPortableMath } from '../src/commons/bake/portableMath';
import { hydrateWorldSceneWeld } from '../src/game/shardfile/worldSceneWeld';
import { Scope } from '../src/engine/app/scope';
import plumbing from '../src/shards/pine-hollow/data/plumbing.json' with { type: 'json' };
import { parsePlumbing } from '../src/format/plumbing';

function mesh3(node: Object3D): node is Object3D & { readonly geometry: BufferGeometry; readonly material: Material | Material[] } { return node instanceof Mesh; }

test('eight living graphs preserve native hierarchy, arrays, materials and door life', async () => {
  const restore = installPortableMath();
  try {
    for (const tier of ['phone', 'desktop'] as const) for (const shadow of [false, true]) for (const shared of [false, true]) {
      const source = await cabinSceneSources(tier), recorder = new CabinSceneRecorder(), captured = recorder.living(source, shadow, shared);
      const resources = new SceneHandles({ setupMaterial: () => undefined }), owner = new Scope('living-oracle');
      const native = new Group(), materials = new Map<string, Material>();
      const parts = Object.fromEntries(['log', 'endGrain', 'chink', 'roof', 'beam', 'deck', 'door', 'stone', 'bark', 'iron', 'cloth', 'char', 'glass'].map(key => {
        const id = `materials.timber.${key}`, material = new MeshStandardMaterial();
        resources.publish(id, material); materials.set(id, material); return [key, id];
      }));
      const particles = Object.fromEntries(['flame', 'ember', 'smoke'].map(key => {
        const id = `materials.cabin.${key}`, material = new MeshBasicMaterial();
        resources.publish(id, material); materials.set(id, material); return [key, id];
      }));
      const glow = new MeshBasicMaterial({ color: 0xff7a1a, transparent: true, blending: 2, depthWrite: false, fog: false });
      resources.publish('glow', glow); materials.set('cabin.glow-map', new MeshStandardMaterial());
      resources.publish('pit', source.firePit.scene); resources.publish('lantern', source.lantern.scene);
      for (const [kind, model] of [['pit', source.firePit], ['lantern', source.lantern]] as const) {
        let part = 0;
        model.scene.traverse(node => { if (mesh3(node) && node.material instanceof Material) materials.set(`materials.cabin.${kind}.${String(part++)}`, node.material); });
      }
      const geometry = Object.fromEntries([...source.geometry].map(([ordinal, shape]) => {
        const id = `shape.${String(ordinal)}`; resources.publish(id, shape); return [String(ordinal), id];
      }));
      const life = new LivingBuildings(resources, CABIN_LIFE);
      const detail = tier === 'phone' ? 28 : 55;
      const ordered = [...source.rows.buildings.filter(row => !row.hamlet), ...source.rows.buildings.filter(row => row.hamlet)];
      for (const record of ordered) {
        const assembly = new BakedBuildingAssembly(resources, { id: record.id, record, geometry, materials: { parts, particles: { flame: particles['flame'] ?? '', ember: particles['ember'] ?? '', smoke: particles['smoke'] ?? '' }, glass: parts['glass'] ?? '', glow: 'glow' },
          models: { firePit: 'pit', lantern: 'lantern' }, role: record.hamlet ? 'member' : 'standalone', look: v.parse(BakedBuildingLookSchema, buildingLook),
          tier: { detailDist: detail, detailShadows: shadow, sharedLights: shared }, bakedStatic: true });
        if (record.hamlet) assembly.root.name = record.id;
        native.add(assembly.root); life.add(assembly.lifeRows);
      }
      native.updateMatrixWorld(true);
      const frozen = new Group(), handles = new SceneHandles({ setupMaterial: () => undefined }); handles.publish('cabins.root', frozen);
      for (const [id, material] of materials) handles.publish(id, material);
      const geometries = new Map([...recorder.geometry].map(([id, shape], index) => [JSON.stringify([`cabin-shapes-${String(Math.floor(index / 128))}`, id]), shape]));
      try {
        hydrateWorldSceneWeld(captured.graph, handles, { geometry: geometries, materials, plumbing: parsePlumbing(plumbing), quality: { tier, overrides: { 'pine.cabinDetailDist': detail } } }, owner);
        frozen.updateMatrixWorld(true);
        const snapshot = (root: Object3D) => {
          const nodes: unknown[] = [], materialIds = new Map<Material, number>();
          root.traverse(node => {
            const draw = mesh3(node) ? node : undefined;
            const material = draw?.material;
            if (Array.isArray(material)) throw new Error('Unexpected living material array');
            if (material !== undefined && !materialIds.has(material)) materialIds.set(material, materialIds.size);
            nodes.push({ type: node.type, name: node.name, matrix: node.matrix.elements, position: node.position.toArray(), quaternion: node.quaternion.toArray(), scale: node.scale.toArray(),
              cast: node.castShadow, receive: node.receiveShadow, order: node.renderOrder, visible: node.visible, layers: node.layers.mask,
              ...(draw === undefined ? {} : { material: material === undefined ? null : materialIds.get(material),
                attributes: Object.fromEntries(Object.entries(draw.geometry.attributes).map(([key, attribute]) => [key, Array.from({ length: attribute.count * attribute.itemSize }, (_, index) => attribute.getComponent(Math.floor(index / attribute.itemSize), index % attribute.itemSize))])),
                index: draw.geometry.index === null ? null : Array.from(draw.geometry.index.array) }),
              ...(node instanceof PointLight ? { light: [node.color.getHex(), node.intensity, node.distance, node.decay] } : {}) });
          }); return nodes;
        };
        expect(snapshot(frozen), `${tier}/${String(shadow)}/${String(shared)}`).toEqual(snapshot(native));
        const restored = new LivingBuildings(handles, CABIN_LIFE); restored.add(captured.life);
        expect(restored.interactables.map(row => ({ at: row.position.toArray(), reach: row.radius, label: row.label }))).toEqual(life.interactables.map(row => ({ at: row.position.toArray(), reach: row.radius, label: row.label })));
        for (const door of life.doorPieces()) door.use(); for (const door of restored.doorPieces()) door.use();
        life.tick(0.3, 0.3, new Vector3(), 0.5); restored.tick(0.3, 0.3, new Vector3(), 0.5);
        expect(restored.doorPieces().map(row => row.pivot.rotation.y)).toEqual(life.doorPieces().map(row => row.pivot.rotation.y));
        expect(captured.life.sites.map(row => ({ id: row.id, rooms: row.rooms, door: row.door }))).toEqual(ordered.map(row => ({ id: row.id, rooms: row.rooms, door: row.doorAt })));
      } finally {
        owner.dispose(); glow.dispose(); for (const material of materials.values()) material.dispose();
        native.traverse(node => { if (mesh3(node)) node.geometry.dispose(); });
        for (const shape of source.geometry.values()) shape.dispose(); for (const shape of recorder.geometry.values()) shape.dispose();
      }
    }
  } finally { restore(); }
});

test('building life keeps its door while the assembly owns static collision', () => {
  const material = new MeshStandardMaterial(), glow = new MeshBasicMaterial(), shape = new BoxGeometry();
  const resources = new SceneHandles({ setupMaterial: () => undefined });
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
  const make = (row: BakedBuildingRecord<string, string>, bakedStatic = false) => new BakedBuildingAssembly(resources, { id: 'test', record: row,
    geometry: { 0: 'shape', 1: 'shape', 2: 'shape' },
    materials: { parts: { door: 'wood', iron: 'wood', beam: 'wood' }, particles: {}, glass: 'wood', glow: 'glow' },
    models: { firePit: 'pit', lantern: 'lantern' }, role: 'standalone', look,
    tier: { detailDist: 10, detailShadows: false, sharedLights: true },
    bakedStatic, ...(bakedStatic ? { publish: 'frozen-building' } : {}),
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
    const frozen = make({ ...record, parts: [['unloaded-static-surface', 999]], glass: [998] }, true);
    expect(resources.object('frozen-building.root')).toBe(frozen.root);
    expect(frozen.weldParts()).toEqual([]);
    const frozenLife = new LivingBuildings(resources, CABIN_LIFE); frozenLife.add(frozen.lifeRows);
    const frozenDoor = frozenLife.doorPieces()[0]; if (frozenDoor === undefined) throw new Error('Missing frozen building door');
    frozenDoor.use(); frozenLife.tick(0.3, 0.3, eye, 0);
    expect(frozenDoor.pivot.rotation.y).toBeCloseTo(-0.925, 12);
    frozen.root.traverse(node => { if ('geometry' in node && node.geometry instanceof BoxGeometry) node.geometry.dispose(); });
  } finally {
    made.root.traverse(node => { if ('geometry' in node && node.geometry instanceof BoxGeometry) node.geometry.dispose(); });
    shape.dispose(); material.dispose(); glow.dispose();
  }
});
