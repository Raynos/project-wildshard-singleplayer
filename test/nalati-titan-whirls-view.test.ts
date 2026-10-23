import { expect, test } from 'vitest';
import { BoxGeometry, InstancedMesh, Matrix4, MeshBasicMaterial, Object3D, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import { viewProgram } from '../src/engine/script/viewProgram';
import { ARENA_VIEW, arenaFunnel } from '../src/format/arenaView';
import { compileScriptV2 } from '../src/sdk/bake/compileScriptV2';
import { nalatiTitanWhirlsView } from '../src/shards/nalati-grasslands/generators/titanWhirlsView';
import { TITAN_WHIRLS } from '../src/shards/nalati-grasslands/generators/stormTitanFight';
import source from '../src/shards/nalati-grasslands/behaviour/titanWhirlsView.as?raw';

// Nalati zero R6: the Storm Titan's whirlwinds' drawing moved from game/boss/arenaFire.ts (ArenaWhirlsView.update) to a
// view module at the fight's whirl slot. The fight keeps each whirlwind's ease, gate, law and ground; the reference is
// the original drawing: a shown funnel on the ground less the sink, turning at the spin while it shows, breathing, and
// its debris spiral packed after the previous shown whirlwind's; a hidden whirlwind draws nothing.
test('the whirl module draws the funnels and their debris as the original update did', async () => {
  const rows = nalatiTitanWhirlsView(), whirls = ARENA_VIEW.whirls, d = TITAN_WHIRLS.debris;
  const module = await compileScriptV2(source, { lane: 'view', ioBytes: rows.budget.ioBytes });
  const funnels = TITAN_WHIRLS.laws.map(() => new Object3D()), debris = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), TITAN_WHIRLS.laws.length * d.count);
  debris.count = 0;
  const drawn = [{ k: .6, shown: 1, x: 10, y: 3, z: -4 }, { k: .01, shown: 0, x: 0, y: 0, z: 0 }, { k: 1, shown: 1, x: -20, y: 1.5, z: 30 }];
  const scope = new Scope('titan-whirls');
  const program = viewProgram(module, rows, { scope, player: { position: new Vector3(), velocity: new Vector3(), yaw: 0 }, camera: new PerspectiveCamera(),
    values: id => id === whirls.values ? name => {
      const m = /^(k|shown|x|y|z)(\d)$/u.exec(name), row = drawn[Number(m?.[2] ?? -1)], key = m?.[1];
      return row === undefined || (key !== 'k' && key !== 'shown' && key !== 'x' && key !== 'y' && key !== 'z') ? Number.NaN : row[key];
    } : null,
    floor: () => null, slots: () => null, look: () => undefined,
    object: id => { const i = funnels.findIndex((_, k) => arenaFunnel(k) === id), funnel = funnels[i]; if (funnel === undefined) throw new Error(`No funnel ${id}`); return funnel; },
    draw: id => { if (id !== whirls.draws.debris) throw new Error(`No draw ${id}`); return debris; } });
  if (program === null) throw new Error('Missing whirl program');
  const axis = new Vector3().fromArray(d.axis).normalize(), spins = [0, 0, 0];
  try {
    for (const [frame, t] of [[0, .4], [1, .45], [2, .5]] as const) {
      expect(program.frame(.05, t)).toBe(true);
      let n = 0;
      for (const [i, row] of drawn.entries()) {
        const funnel = funnels[i]; if (funnel === undefined) throw new Error('Missing funnel');
        if (row.shown !== 1) { expect(funnel.matrixAutoUpdate).toBe(true); continue; }
        spins[i] = (spins[i] ?? 0) + .05 * TITAN_WHIRLS.spin;
        expect(funnel.position.x).toBeCloseTo(row.x, 4); expect(funnel.position.y).toBeCloseTo(row.y - TITAN_WHIRLS.sink, 4); expect(funnel.position.z).toBeCloseTo(row.z, 4);
        expect(funnel.quaternion.angleTo(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), spins[i] ?? 0))).toBeLessThan(1e-3);
        expect(funnel.scale.x).toBeCloseTo(row.k, 4); expect(funnel.scale.y).toBeCloseTo(row.k * (1 + (TITAN_WHIRLS.breathe[0] ?? 0) * Math.sin(t * (TITAN_WHIRLS.breathe[1] ?? 0) + i)), 4);
        for (let k = 0; k < d.count; k++) {
          const u = ((k / d.count) + t * d.climb + i * 0.13) % 1, a = t * d.turn + k * d.step, r = (d.radius[0] ?? 0) + u * (d.radius[1] ?? 0);
          const want = new Matrix4().compose(new Vector3(row.x + Math.cos(a) * r, row.y + u * d.height, row.z + Math.sin(a) * r),
            new Quaternion().setFromAxisAngle(axis, t * d.roll + k), new Vector3().setScalar(row.k * ((d.scale[0] ?? 0) + (k % (d.scale[2] ?? 1)) * (d.scale[1] ?? 0))));
          const got = new Matrix4().fromArray(debris.instanceMatrix.array, n * 16);
          for (let e = 0; e < 16; e++) expect(got.elements[e]).toBeCloseTo(want.elements[e] ?? 0, 3);
          n++;
        }
      }
      expect(debris.count).toBe(n);
      expect(frame).toBeGreaterThanOrEqual(0);
    }
  } finally { scope.dispose(); }
});
