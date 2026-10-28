// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import { FigureRows } from '../src/game/systems/npc/figureRows';
import { figureColliderRows } from '../src/sdk/bake/placement';
import trader from '../src/shards/driftwood-isle/data/traderFigure.json' with { type: 'json' };
import castaway from '../src/shards/driftwood-isle/data/castawayFigure.json' with { type: 'json' };

const fixtures = [trader, castaway,
  { ...trader, collider: { kind: 'capsule', y: 1.25, halfHeight: 0.75, radius: 0.25 } },
  { ...trader, collider: { kind: 'box', half: 0.25, top: 0, bottom: Number.MIN_VALUE } },
];

test.each(fixtures)('author contacts retain every native field, signed zero and wire order', source => {
  const before = structuredClone(source), actual = figureColliderRows(source), original = FigureRows.collidersFor(source);
  expect(actual).toEqual(original); expect(JSON.stringify(actual)).toBe(JSON.stringify(original)); expect(source).toEqual(before);
  if (actual[0] === undefined || original[0] === undefined) throw new Error('Missing contact control');
  Reflect.set(actual[0], 'x', 10);
  expect(figureColliderRows(source)).toEqual(original);
});

test('absent figure colliders retain empty contact ownership', () => {
  const { collider: _collider, ...source } = trader;
  expect(figureColliderRows(source)).toEqual(FigureRows.collidersFor(source)); expect(figureColliderRows(source)).toEqual([]);
});

test('full figure admission keeps native malformed and executable row refusals', () => {
  for (const source of [undefined, { ...trader, collider: { kind: 'box', half: Number.NaN, top: 1, bottom: 0 } },
    { ...trader, collider: { kind: 'box', half: 0.25, top: -0, bottom: 0 } },
    { ...trader, collider: { kind: 'capsule', y: 1, halfHeight: 1, radius: Number.POSITIVE_INFINITY } },
    { ...trader, unknown: true }, { ...trader, callback: () => undefined }, { ...trader, joints: [{ id: 'bad' }] }]) {
    let message: string | undefined;
    try { FigureRows.collidersFor(source); } catch (error) { if (!(error instanceof Error)) throw error; message = error.message; }
    if (message === undefined) throw new Error('Native negative control unexpectedly admitted');
    expect(() => figureColliderRows(source)).toThrow(message);
  }
});
