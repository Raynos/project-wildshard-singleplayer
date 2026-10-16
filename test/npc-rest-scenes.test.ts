import { BoxGeometry, Group, Mesh, MeshBasicMaterial, ShaderMaterial } from 'three';
import { expect, test } from 'vitest';
import { bindWorldSceneParts, createClientScene } from '../src/game/plugin/ui';
import { CASTAWAY_BINDINGS, CASTAWAY_PARTS, CASTAWAY_SCENE, TRADER_BINDINGS, TRADER_PARTS, TRADER_SCENE } from '../src/shards/driftwood-isle/data/npcScenes';

test('trader rows retain borrowed graph material, native pivots and ordered hierarchy', () => {
  const root = new Group(), geometry = new BoxGeometry(), material = new ShaderMaterial();
  let disposed = false; material.addEventListener('dispose', () => { disposed = true; });
  const made = createClientScene(TRADER_SCENE, { geometry: () => geometry,
    materials: new Map([['coat', material]]) });
  const parts = bindWorldSceneParts(made, TRADER_PARTS, TRADER_BINDINGS);
  root.add(...made.root.children); expect(root.children).toEqual([parts.figure]);
  expect(parts.figure.children).toEqual([parts.body, parts.head, parts.upper]);
  expect(parts.upper.children).toEqual([parts.fore]);
  expect(parts.head.position.toArray()).toEqual([0, 1.48, .01]);
  expect(parts.fore.position.toArray()).toEqual([-.03, -.27, .02]);
  expect(parts.body.castShadow && parts.body.receiveShadow).toBe(true);
  for (const node of [parts.body, parts.head, parts.upper, parts.fore]) {
    if (!(node instanceof Mesh)) throw new Error('Required NPC mesh missing');
    expect(node.material).toBe(material); expect(node.geometry).toBe(geometry);
  }
  made.dispose(); expect(disposed).toBe(false);
  geometry.dispose(); material.dispose();
});

test('castaway rows retain entry placement and the native flame/smoke objects outside the turning figure', () => {
  const root = new Group(), smoke = new Group(), geometry = new BoxGeometry(), material = new ShaderMaterial();
  const flames = new Mesh(geometry, new MeshBasicMaterial());
  root.position.set(3, 4, 5); root.rotation.y = .7; flames.position.set(1, .08, 2);
  const made = createClientScene(CASTAWAY_SCENE, { geometry: () => geometry,
    objects: new Map<string, unknown>([['flames', flames], ['smoke', smoke]]), materials: new Map([['coat', material]]) });
  const parts = bindWorldSceneParts(made, CASTAWAY_PARTS, CASTAWAY_BINDINGS);
  root.add(...made.root.children);
  expect(root.children).toEqual([parts.figure, parts.camp, flames, smoke]);
  expect(parts.figure.children).toEqual([parts.body, parts.head, parts.arm]);
  expect(root.position.toArray()).toEqual([3, 4, 5]); expect(root.rotation.y).toBe(.7);
  expect(flames.position.toArray()).toEqual([1, .08, 2]);
  expect(parts.arm.position.toArray()).toEqual([-.21, 1.4, 0]);
  expect(parts.camp.castShadow && parts.camp.receiveShadow).toBe(true);
  made.dispose(); geometry.dispose(); material.dispose(); flames.material.dispose();
});

test('plain scenes refuse collider bindings without actual baked metadata and missing geometry still refuses', () => {
  const made = createClientScene({ version: 1, root: 'root', materials: [], nodes: [{ id: 'root', kind: 'group' }] }, { geometry: () => null });
  expect(() => bindWorldSceneParts(made, { gate: 'colliders' }, { gate: { kind: 'colliders', part: 'gate' } })).toThrow('Missing world scene binding: gate');
  expect(() => createClientScene(TRADER_SCENE, { geometry: () => undefined, objects: new Map([['root', new Group()]]) })).toThrow('Private geometry port differs');
  made.dispose();
});
