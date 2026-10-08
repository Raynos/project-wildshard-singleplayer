import * as v from 'valibot';
import { expect, it } from 'vitest';
import { PropsSchema } from '../src/game/shardfile/props';

const box = { kind: 'box', x: 0, y: -0.25, z: 242.5, hx: 4, hy: 0.25, hz: 7.5 };
const parse = (shape: object) => v.parse(PropsSchema, { version: 1, family: 'pbr', tiles: [], panels: [], models: [], far: null, textures: [],
  colliders: [{ id: 'deck', panel: null, initialActive: true, shapes: [shape] }] });
it('admits exact eight-by-fifteen road decks at all four boundaries, using actual corner extents', () => {
  for (const shape of [box, { ...box, z: -242.5 }, { ...box, x: 242.5, z: 0, hx: 7.5, hz: 4 }, { ...box, x: -242.5, z: 0, hx: 7.5, hz: 4 }]) expect(() => parse(shape)).not.toThrow();
});
it('refuses genuine cell overflow and rotates the actual deck rather than its circumscribed circle', () => {
  expect(() => parse({ ...box, z: 242.501 })).toThrow('collider within cell');
  expect(() => parse({ ...box, yaw: Math.PI / 4 })).toThrow('collider within cell');
  expect(() => parse({ ...box, x: 242.5, z: 0, yaw: Math.PI / 2 })).not.toThrow();
});
it('checks pitch and roll against vertical and horizontal cell bounds as well', () => {
  const rot = { x: Math.sin(Math.PI / 8), y: 0, z: 0, w: Math.cos(Math.PI / 8) };
  expect(() => parse({ ...box, x: 0, y: 249, z: 0, rot })).toThrow('collider within cell');
  expect(() => parse({ ...box, x: 0, y: 0, z: 0, rot })).not.toThrow();
});
