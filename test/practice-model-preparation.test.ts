import { afterEach, expect, test, vi } from 'vitest';
import { Bone } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { dummyFigure, dummyStandIn } from '../src/engine/models/trainingDummy';

afterEach(() => { vi.restoreAllMocks(); });

test('the room keeps an immediate procedural stand-in without reading model assets', () => {
  const read = vi.spyOn(GLTFLoader.prototype, 'loadAsync');
  const standIn = dummyStandIn('wood');
  expect(standIn.rig).toBe('procedural');
  expect(standIn.root.children.length).toBeGreaterThan(0);
  expect(read).not.toHaveBeenCalled();
});

test('async preparation loads the rig and retains the procedural failure fallback', async () => {
  const file = await new GLTFLoader().parseAsync(JSON.stringify({ asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [] }], nodes: [] }), '');
  for (const name of ['Torso', 'Head', 'LeftArm', 'RightArm']) {
    const bone = new Bone(); bone.name = name; file.scene.add(bone);
  }
  const read = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValueOnce(file);
  const model = await dummyFigure('straw-cloth', 'fixture');
  expect(model.rig).toBe('five-bone');
  expect(model.root).not.toBe(file.scene);
  expect(read).toHaveBeenCalledWith('/assets/practice/dummies/straw-cloth.glb');
  const error = new Error('model unavailable'), warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  read.mockRejectedValueOnce(error);
  const fallback = await dummyFigure('wood-steel', 'fixture');
  expect(fallback.rig).toBe('procedural');
  expect(fallback.root.children.length).toBeGreaterThan(0);
  expect(warning).toHaveBeenCalledWith('[practice] fixture: wood-steel mesh unavailable; using procedural fallback', error);
});
