import { Group, Scene, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { readScene, type SceneDescription } from '../src/sdk/scene';
import { restoreSceneGraph } from '../src/sdk/sceneGraph';
import { encodeCanonicalJson } from '../src/sdk/immutable';
import { Zipline, Updraft, Mount, Grapple } from '../src/sdk/modes';

it('collects all mode categories in graph order with exact parent-transformed endpoints and round-trip bytes', () => {
  const scene = new Scene(), group = new Group(); group.position.set(10, 0, -20); group.rotation.y = Math.PI / 2; group.scale.setScalar(2);
  const cable = new Zipline(new Vector3(0, 5, 0), new Vector3(8, 0, 0), { gravity: 9 }); cable.name = 'cable';
  const wind = new Updraft(new Vector3(), new Vector3(0, 8, 10), { width: 3, lift: 5 }); wind.name = 'wind';
  const mount = new Mount({ walk: 1, trot: 2, canter: 3, gallop: 4 }); mount.name = 'horse';
  const grapple = new Grapple({ maxRange: 20 }); grapple.name = 'hook';
  group.add(wind, cable); scene.add(group, mount, grapple);
  const data = readScene(scene);
  expect(data.modes).toStrictEqual({ traverse: [wind.toModeData(), cable.toModeData()], ride: [mount.toModeData()], grapple: [grapple.toModeData()] });
  expect(data.modes?.traverse[0]).toMatchObject({ from: { x: 10, y: 0, z: -20 }, to: { x: 30, y: 16, z: -19.999999999999996 }, width: 3 });
  // oxlint-disable-next-line unicorn/prefer-structured-clone -- The gate crosses actual scene.json transport.
  const persisted = JSON.parse(JSON.stringify(data)) as SceneDescription;
  expect(encodeCanonicalJson(readScene(restoreSceneGraph(persisted)))).toBe(encodeCanonicalJson(data));
});

it('omits absent categories and the whole section for ordinary graphs, without manufacturing any grant', () => {
  const scene = new Scene(); scene.add(new Group()); expect(readScene(scene)).not.toHaveProperty('modes');
  const ride = new Mount({ walk: 1, trot: 2, canter: 3, gallop: 4 }); scene.add(ride);
  expect(readScene(scene).modes).toStrictEqual({ ride: [ride.toModeData()], traverse: [] });
});

it('refuses duplicate wire identities even when the graph assigns different node ids', () => {
  const scene = new Scene(); scene.add(new Grapple(), new Grapple());
  expect(() => readScene(scene)).toThrow('unique grapple identities');
  scene.clear(); scene.add(new Zipline(new Vector3(1, 0, 0), new Vector3()), new Zipline(new Vector3(2, 0, 0), new Vector3()));
  expect(() => readScene(scene)).toThrow('unique traverse identities');
});

it('refuses invalid or out-of-cell transformed endpoints and more than the admitted category cap', () => {
  const scene = new Scene(), group = new Group(), cable = new Zipline(new Vector3(1, 0, 0), new Vector3());
  group.position.x = 251; group.add(cable); scene.add(group); expect(() => readScene(scene)).toThrow();
  scene.clear(); const wind = new Updraft(); scene.add(wind); expect(() => readScene(scene)).toThrow('horizontal run');
  scene.clear();
  for (let i = 0; i < 65; i++) { const grapple = new Grapple(); grapple.name = `hook.${i}`; scene.add(grapple); }
  expect(() => readScene(scene)).toThrow();
});
