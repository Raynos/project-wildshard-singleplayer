import { expect, it } from 'vitest';
import { Group, type Object3D } from 'three';
import { bindWorldSceneParts, createWorldScene } from '../src/game/plugin/ui';
import { MILL_SCENE } from '../src/shards/far-reach/data/millScene.generated';
import { SKY_ROUTE_FRAMES } from '../src/shards/far-reach/data/routeScene.generated';

it('keeps mill parts borrowed under a native spinning hub', () => {
  const objects = new Map<string, Object3D | null>([...MILL_SCENE.parts, 'model.tower', 'model.foot'].map(name => {
    const part = new Group(); part.name = name; return [name, part];
  }));
  const made = createWorldScene(MILL_SCENE.recipe, { objects, geometry: () => null, model: () => null, baked: () => ({ root: new Group(), colliders: [] }) });
  const bound = bindWorldSceneParts(made, { hub: 'group', hubAt: 'vector' }, MILL_SCENE.bindings);
  expect(made.root.children.map(part => part.name)).toEqual(['shaft', 'model.tower', 'model.foot', '']);
  expect(bound.hub.children).toEqual(MILL_SCENE.parts.slice(1).map(name => objects.get(name)));
  expect(bound.hubAt.toArray()).toEqual(bound.hub.position.toArray());
  bound.hub.rotation.z = 0.25;
  expect(objects.get('frame')?.parent).toBe(bound.hub);
  expect(objects.get('shaft')?.parent).toBe(made.root);
  made.dispose();
});

it('keeps the native hub available when optional baked parts fail to load', () => {
  const objects = new Map([...MILL_SCENE.parts, 'model.tower', 'model.foot'].map(name => [name, null]));
  const made = createWorldScene(MILL_SCENE.recipe, { objects, geometry: () => null, model: () => null, baked: () => ({ root: new Group(), colliders: [] }) });
  const bound = bindWorldSceneParts(made, { hub: 'group', hubAt: 'vector' }, MILL_SCENE.bindings);
  expect(made.root.children).toEqual([bound.hub]);
  expect(bound.hub.children).toHaveLength(0);
  made.dispose();
});

it('borrows the fallen deck while copying interaction anchor values', () => {
  const deck = new Group();
  const made = createWorldScene(SKY_ROUTE_FRAMES.recipe, { objects: new Map([['fallen-deck', deck]]),
    geometry: () => null, model: () => null, baked: () => ({ root: new Group(), colliders: [] }) });
  const parts = bindWorldSceneParts(made, { fallen: 'group', winchAt: 'vector', notesAt: 'vector' }, SKY_ROUTE_FRAMES.bindings);
  expect(deck.parent).toBe(parts.fallen);
  expect(parts.fallen).toBe(made.root);
  parts.winchAt.y += 1;
  expect(parts.winchAt.y).toBe(SKY_ROUTE_FRAMES.bindings.winchAt.value[1] + 1);
  expect(parts.notesAt.toArray()).toEqual(SKY_ROUTE_FRAMES.bindings.notesAt.value);
  made.dispose();
});
