import { expect, test } from 'vitest';
import { Vector3 } from 'three';
import { CableLayout } from '../src/engine/sim/cableTraversal';
import { ZiplineCable } from '../src/shards/driftwood-isle/generators/ziplineCable';
import spots from '../src/shards/driftwood-isle/data/spotsRows.json' with { type: 'json' };

// The zipline bank builds its geometry on a build-time copy of the engine's cable construction; the two never drift.
test('the build-time zipline cable matches the engine CableLayout exactly', () => {
  const at = (row: { x: number; y: number; z: number }): Vector3 => new Vector3(row.x, row.y, row.z);
  for (const spec of [{ top: at(spots.zipline.top), bottom: at(spots.zipline.bottom), sag: 1.6 },
    { top: new Vector3(0, 0, 0), bottom: new Vector3(13, -5, 3), sag: 1.6 }, { top: new Vector3(4, 20, -7), bottom: new Vector3(-30, 2, 41), sag: 2.4 }]) {
    const engine = new CableLayout(spec), build = new ZiplineCable(spec);
    expect([build.a, build.b, build.dir, build.flat].map(v => v.toArray())).toEqual([engine.a, engine.b, engine.dir, engine.flat].map(v => v.toArray()));
    expect([build.len, build.sag, build.deck]).toEqual([engine.len, engine.sag, engine.deck]);
    for (const s of [0, 0.6, engine.len / 3, engine.len / 2, engine.len]) expect(build.at(s, new Vector3()).toArray()).toEqual(engine.at(s, new Vector3()).toArray());
    const parkedEngine = new Vector3(), parkedBuild = new Vector3();
    expect(build.park(parkedBuild)).toBe(engine.park(parkedEngine));
    expect(parkedBuild.toArray()).toEqual(parkedEngine.toArray());
  }
});
