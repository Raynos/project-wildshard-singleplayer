import { expect, test } from 'vitest';
import { type BufferGeometry, Group, Material, Mesh, MeshBasicMaterial, MeshStandardMaterial, type Object3D, Vector3 } from 'three';
import { LivingBuildings } from '../src/game/shardfile/livingBuildings';
import { SceneHandles } from '../src/game/shardfile/sceneHandles';
import { CABIN_LIFE } from '../src/shards/pine-hollow/generators/cabinLook';
import { CabinSceneRecorder } from '../src/shards/pine-hollow/generators/cabinScenes';
import { cabinSceneSources } from '../src/shards/pine-hollow/generators/cabinSceneSources.mjs';
import { installPortableMath } from '../src/commons/bake/portableMath';
import { hydrateWorldSceneWeld } from '../src/game/shardfile/worldSceneWeld';
import { Scope } from '../src/engine/app/scope';
import plumbing from '../src/shards/pine-hollow/data/plumbing.json' with { type: 'json' };
import { parsePlumbing } from '../src/format/plumbing';

function mesh3(node: Object3D): node is Object3D & { readonly geometry: BufferGeometry; readonly material: Material | Material[] } { return node instanceof Mesh; }

test('shipped living graphs hydrate their hierarchy and retain working doors', async () => {
  const restore = installPortableMath();
  try {
    for (const tier of ['phone', 'desktop'] as const) for (const shadow of [false, true]) for (const shared of [false, true]) {
      const source = await cabinSceneSources(tier), recorder = new CabinSceneRecorder(), captured = recorder.living(source, shadow, shared);
      const owner = new Scope('living-product'), frozen = new Group();
      const handles = new SceneHandles({ setupMaterial: () => undefined }), materials = new Map<string, Material>();
      handles.publish('cabins.root', frozen);
      for (const key of ['log', 'endGrain', 'chink', 'roof', 'beam', 'deck', 'door', 'stone', 'bark', 'iron', 'cloth', 'char', 'glass']) materials.set(`materials.timber.${key}`, new MeshStandardMaterial());
      for (const key of ['flame', 'ember', 'smoke']) materials.set(`materials.cabin.${key}`, new MeshBasicMaterial());
      materials.set('cabin.glow-map', new MeshStandardMaterial());
      for (const [kind, model] of [['pit', source.firePit], ['lantern', source.lantern]] as const) {
        let part = 0;
        model.scene.traverse(node => { if (mesh3(node) && node.material instanceof Material) materials.set(`materials.cabin.${kind}.${String(part++)}`, node.material); });
      }
      for (const [id, material] of materials) handles.publish(id, material);
      const geometries = new Map([...recorder.geometry].map(([id, shape], index) => [JSON.stringify([`cabin-shapes-${String(Math.floor(index / 128))}`, id]), shape]));
      try {
        hydrateWorldSceneWeld(captured.graph, handles, { geometry: geometries, materials, plumbing: parsePlumbing(plumbing), quality: { tier, overrides: { 'pine.cabinDetailDist': tier === 'phone' ? 28 : 55 } } }, owner);
        for (const row of captured.graph.nodes) {
          const node = handles.object(row.id);
          expect(node.parent).toBe(handles.object(row.parent));
          expect(node.name).toBe(row.name);
          if (row.matrixBits !== undefined) expect(node.matrix.elements).toEqual(Array.from(new Float64Array(Uint32Array.from(row.matrixBits).buffer)));
          if (row.kind === 'mesh') {
            if (!mesh3(node)) throw new Error('Missing living mesh');
            const geometry = geometries.get(JSON.stringify([row.geometry.library, row.geometry.model]));
            expect(geometry).toBeDefined();
            expect(Object.keys(node.geometry.attributes)).toEqual(Object.keys(geometry?.attributes ?? {}));
          }
        }
        const life = new LivingBuildings(handles, CABIN_LIFE); life.add(captured.life);
        const ordered = [...source.rows.buildings.filter(row => !row.hamlet), ...source.rows.buildings.filter(row => row.hamlet)];
        expect(captured.life.sites.map(row => ({ id: row.id, rooms: row.rooms, door: row.door }))).toEqual(ordered.map(row => ({ id: row.id, rooms: row.rooms, door: row.doorAt })));
        const doors = life.doorPieces(); expect(doors.length).toBeGreaterThan(0);
        expect(life.interactables).toHaveLength(doors.length);
        for (const door of doors) door.use();
        life.tick(0.3, 0.3, new Vector3(), 0.5);
        for (const door of doors) expect(Math.abs(door.pivot.rotation.y)).toBeGreaterThan(0);
      } finally {
        owner.dispose(); for (const material of materials.values()) material.dispose();
        for (const shape of source.geometry.values()) shape.dispose(); for (const shape of recorder.geometry.values()) shape.dispose();
      }
    }
  } finally { restore(); }
});
