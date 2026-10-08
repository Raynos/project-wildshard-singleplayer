// oxlint-disable-next-line import/no-nodejs-modules -- The admission check reads the committed, content-addressed lift module.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ENTRY_WIDTH } from '../../../src/engine/core/config';
import { contentHash } from '../../../src/sdk/project';
import { validateShardfileAssets } from '../../../src/game/shardfile/validate';
import { socketLiftEntries, socketLiftRules } from '../../../src/game/shardfile/socketLift';
import { LIFT_MODULE } from '../../../src/shards/nine-dragon-stack/data/liftModule';
import { MOVERS } from '../../../src/shards/nine-dragon-stack/data/movers';
import { ND_MOVERS } from '../../../src/shards/nine-dragon-stack/runtime/movers';
import { LIFTS, liftBottom, liftTop } from '../../../src/shards/nine-dragon-stack/world/liftPlan';
import source from '../../../src/shards/nine-dragon-stack/shard.config';

// SHARD-PLATFORM SF8c / SF51 (G184): the legacy "north" lantern lift starts from the deck at z = −250, the format's south
// entry, so that entry is a socketLift: a static approach over the deck to the resting cage, a stationary road gate.
describe('Nine Dragon socketLift entry', () => {
  it('declares the south entry as a socketLift over the deck, without moving the lift; the rules accept it', () => {
    const lift = LIFTS[0]; if (lift === undefined) throw new Error('no lift');
    expect(source.entryways.map((row) => [row.edge, row.kind ?? 'ground', row.width])).toEqual([['north', 'ground', ENTRY_WIDTH], ['east', 'ground', ENTRY_WIDTH], ['south', 'socketLift', ENTRY_WIDTH], ['west', 'ground', ENTRY_WIDTH]]);
    const lifts = socketLiftEntries(source.entryways);
    expect(lifts.map((row) => [row.edge, row.lift.mover, row.lift.gate, row.lift.approach?.colliders])).toEqual([['south', 'nd.lift.n', 'nd.lift.n.road-gate', ['deck.south']]]);
    const b = liftBottom(lift), t = liftTop(lift);
    expect(lifts[0]?.lift.roadStop).toEqual([b.x, b.y, b.z]); expect(lifts[0]?.lift.topStop).toEqual([t.x, t.y, t.z]);
    expect(b.z).toBeLessThan(0); // the south deck: the lift never moved
    expect(socketLiftRules(lifts, source.movers, source)).toEqual([]);
    // the compiled movers are exactly the cage and its road gate on the one admitted module; the trusted runtime installs
    // those rows plus the cage's gates and shaft doors, each row once
    expect(source.movers.map((m) => m.id)).toEqual(['nd.lift.n', 'nd.lift.n.road-gate']);
    expect(new Set(source.movers.map((m) => m.module))).toEqual(new Set([LIFT_MODULE.hash]));
    expect(source.sim.scripts).toEqual([LIFT_MODULE.hash]);
    expect(ND_MOVERS.map((m) => m.id).sort()).toEqual(MOVERS.map((m) => m.id).sort());
    const module = Uint8Array.from(readFileSync(`src/shards/nine-dragon-stack/assets/${LIFT_MODULE.hash}`));
    expect(() => validateShardfileAssets(source, new Map([[LIFT_MODULE.hash, module]]), contentHash)).not.toThrow();
    // no deck, or a deck 1 cm proud of the road: refused
    const props = source.props; if (props === null) throw new Error('Nine Dragon declares its deck');
    expect(socketLiftRules(lifts, source.movers, { ...source, props: null })).toHaveLength(1);
    const proud = props.colliders.map((row) => (row.id !== 'deck.south' ? row : { ...row, shapes: row.shapes.map((shape) => (shape.kind === 'box' ? { ...shape, y: shape.y + 0.01 } : shape)) }));
    expect(socketLiftRules(lifts, source.movers, { ...source, props: { ...props, colliders: proud } })).toHaveLength(1);
  });
});
