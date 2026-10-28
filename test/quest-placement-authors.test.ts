// oxlint-disable-next-line import/no-nodejs-modules -- Offline placement and admission must retain the native renderer guard.
import { execFileSync } from 'node:child_process';
import { expect, expectTypeOf, test } from 'vitest';
import { createQuestPlacements, type QuestPlace, type QuestPlaceAnchor, type QuestPlacementPorts, type Place } from '../src/engine/world/interact/types';
import { createAuthorQuestPlacements, type AuthorQuestPlace, type AuthorQuestAnchor, type AuthorQuestPlacementPorts } from '../src/sdk/bake/questPlacement';
import { completionCardRows } from '../src/sdk/quests';
import { clientPlanSection } from '../src/sdk/platformSections';
import { parseCompletion } from '../src/format/completion';
import { parseClientPlan } from '../src/format/clientPlan';
import { completionRows, placeSetRows, COMPLETE_CONTENT } from '../src/shards/driftwood-isle/generators/completion';
import { hashImmutableBytes } from '../src/sdk/immutable';
import original from './fixtures/quest-placement-author-original.json' with { type: 'json' };

test('complete authored placement ports retain native optional fields and generic frame identities', () => {
  expectTypeOf<AuthorQuestPlace>().toEqualTypeOf<QuestPlace>();
  expectTypeOf<AuthorQuestAnchor>().toEqualTypeOf<QuestPlaceAnchor>();
  expectTypeOf<AuthorQuestPlacementPorts>().toEqualTypeOf<QuestPlacementPorts>();
  expectTypeOf<ReturnType<typeof createAuthorQuestPlacements>>().toEqualTypeOf<ReturnType<typeof createQuestPlacements>>();
  expectTypeOf<typeof COMPLETE_CONTENT.extras[number]['at']>().toEqualTypeOf<Omit<QuestPlace, 'poi'> & Pick<Place, 'poi'>>();
  expectTypeOf<ReturnType<typeof completionCardRows>>().toEqualTypeOf<ReturnType<typeof parseCompletion>>();
  expectTypeOf<ReturnType<typeof clientPlanSection>>().toEqualTypeOf<ReturnType<typeof parseClientPlan>>();
});

test('frame arithmetic, dynamic floors, strict reach and anchor precedence retain native results', () => {
  let ground = -3, platform = 2, registered = 4;
  const model = { anchors: { landing: { x: 8, z: 9 }, fixed: { x: -2, y: 12, z: -7, yaw: 0.71 } } };
  const ports: AuthorQuestPlacementPorts = { terrain: () => ground, platforms: [() => undefined, () => platform],
    registry: { floorAt: () => registered }, registryReach: 2, frames: { grove: { x: 17.3, z: -7.91, rot: 0.73 } }, pois: { grove: model } };
  const native = createQuestPlacements(ports), owned = createAuthorQuestPlacements(ports);
  const rows: QuestPlace[] = [{ poi: 'world', x: 0, z: 0 }, { poi: 'grove', x: 1.3, z: -2.7, yaw: -0.17, dy: 0.25 },
    { poi: 'world', x: -0, z: 1, y: 13, dy: 7 }, { poi: 'grove', x: 2, z: 3, anchor: 'grove.landing', dy: 0.37 },
    { poi: 'grove', x: 2, z: 3, anchor: 'grove.fixed', dy: 15 }, { poi: 'grove', x: 2, z: 3, anchor: 'grove.absent' }];
  for (const values of [[-3, 2, 4], [-1, 2, 3.9], [7, 2, 6]]) {
    [ground = 0, platform = 0, registered = 0] = values;
    expect(owned.floorAt(2, 3)).toBe(native.floorAt(2, 3));
    for (const row of rows) expect(owned.place(row)).toEqual(native.place(row));
  }
  model.anchors.landing.x = 32;
  expect(owned.place(rows[3] ?? rows[0] ?? { poi: 'world', x: 0, z: 0 })).toEqual(native.place(rows[3] ?? { poi: 'world', x: 0, z: 0 }));
  const override = { x: 11, z: -12, yaw: 0.9 };
  native.setAnchor('grove.landing', override); owned.setAnchor('grove.landing', override); override.x = 99;
  const query = { poi: 'grove', x: 0, z: 0, anchor: 'grove.landing', dy: 100 };
  expect(owned.place(query)).toEqual(native.place(query)); expect(owned.place(query).x).toBe(11);
  expect(owned.anchors).toEqual(native.anchors); expect(owned.anchors).not.toBe(native.anchors);
});

test('all native coordinate, frame, floor and anchor bounds still refuse', () => {
  for (const factory of [createQuestPlacements, createAuthorQuestPlacements]) {
    expect(() => factory({ terrain: () => 0, registryReach: 0 })).toThrow('registry reach');
    expect(() => factory({ terrain: () => 0, platforms: Array.from({ length: 4097 }, () => () => 0) })).toThrow('Too many quest floors');
    expect(() => factory({ terrain: () => 0, frames: { constructor: { x: 0, z: 0, rot: 0 } } })).toThrow('anchor path');
    const compiler = factory({ terrain: () => 0 });
    expect(() => compiler.place({ poi: 'absent', x: 0, z: 0 })).toThrow('Missing quest frame');
    expect(() => compiler.place({ poi: 'world', x: 1_000_001, z: 0 })).toThrow('coordinate');
    expect(() => compiler.place({ poi: 'world', x: 0, z: 0, anchor: 'root.__proto__' })).toThrow('anchor path');
    expect(() => compiler.setAnchor('bad', { x: Number.NaN, z: 0 })).toThrow('coordinate');
    for (let i = 0; i < 4096; i++) compiler.setAnchor(`entry${i}`, { x: i, z: 0 });
    compiler.setAnchor('entry0', { x: 1, z: 2 });
    expect(() => compiler.setAnchor('extra', { x: 0, z: 0 })).toThrow('Too many quest anchors');
  }
});

test('every original completion, place-set and authored content byte is retained', () => {
  const completion = completionRows(), sets = placeSetRows();
  const bytes = new TextEncoder().encode(JSON.stringify({ completion, sets, content: COMPLETE_CONTENT }));
  expect({ bytes: bytes.byteLength, hash: hashImmutableBytes(bytes) }).toEqual(original);
  expect(completionCardRows(completion)).toEqual(parseCompletion(completion));
  const plan = clientPlanSection({ version: 1, features: [{ kind: 'world.sets', rows: sets }] });
  expect(plan).toEqual(parseClientPlan({ version: 1, features: [{ kind: 'world.sets', rows: sets }] }));
  expect(Object.isFrozen(plan)).toBe(true); expect(Object.isFrozen(plan.features)).toBe(true);
  expect(() => clientPlanSection({ version: 1, features: [{ kind: 'invented' }] })).toThrow();
  expect(() => completionCardRows({ ...completion, stats: [{ label: 'bad', value: { kind: 'group', group: 'missing', total: 1 } }] })).toThrow();
});

test('the actual quest compiler executes beneath the unchanged native renderer guard', () => {
  const source = `import {createAuthorQuestPlacements} from './src/sdk/bake/questPlacement.ts';
    const compile=createAuthorQuestPlacements({terrain:()=>3,frames:{meadow:{x:10,z:20,rot:0}}});
    console.log(JSON.stringify(compile.place({poi:'meadow',x:2,z:4,dy:0.5})));`;
  const result = execFileSync(process.execPath, ['--experimental-transform-types', '--import', './scripts/sim-node-loader.mjs', '--input-type=module', '-e', source], { encoding: 'utf8', timeout: 30_000 });
  expect(JSON.parse(result)).toEqual({ x: 12, z: 24, y: 3.5, yaw: 0 });
});
