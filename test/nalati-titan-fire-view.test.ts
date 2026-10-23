import { expect, test } from 'vitest';
import { BoxGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import { viewProgram } from '../src/engine/script/viewProgram';
import { ARENA_BURNT_PER_FRAME, ARENA_VIEW } from '../src/format/arenaView';
import { compileScriptV2 } from '../src/sdk/bake/compileScriptV2';
import { nalatiTitanFireView } from '../src/shards/nalati-grasslands/generators/titanFireView';
import { TITAN_FIRE_FIELD } from '../src/shards/nalati-grasslands/generators/stormTitanFight';
import fireView from '../src/shards/nalati-grasslands/data/arenaFire.json' with { type: 'json' };
import source from '../src/shards/nalati-grasslands/behaviour/titanFireView.as?raw';

// Nalati zero R6: the Storm Titan's grass fire moved from game/boss/arenaFire.ts (ArenaFireView) to a view module at the
// fight's fire slot. The flames are deterministic and must match the original drawField: per burning cell (in cell
// order) its scattered position on the ground less the sink, its size from the downwind front and the heat ramp, its turn
// about up and its aInst heat, front and seed. The smoke and the scorch use the module's own cosmetic draws (similar, not
// identical: G415), so they are checked for their counts, bounds and ranges.
const instanced = (copies: number): InstancedMesh => {
  const geometry = new BoxGeometry(); geometry.setAttribute('aInst', new InstancedBufferAttribute(new Float32Array(copies * 3), 3));
  const mesh = new InstancedMesh(geometry, new MeshBasicMaterial(), copies); mesh.count = 0; return mesh;
};

test('the fire module draws the original flames, rolls smoke, appends scorch and clears on a reset', async () => {
  const rows = nalatiTitanFireView(), fire = ARENA_VIEW.fire, field = TITAN_FIRE_FIELD, cells = field.width * field.depth, look = fireView.cells;
  expect(fireView.flameCount).toBe(420); expect(Math.max(...fireView.smokeCount)).toBe(200);
  const module = await compileScriptV2(source, { lane: 'view', ioBytes: rows.budget.ioBytes, maximumPages: rows.budget.pages });
  const modes = new Float32Array(cells).fill(field.states.idle), lifetimes = new Float32Array(cells), ground = new Float32Array(cells), burnt = new Float32Array(1 + ARENA_BURNT_PER_FRAME);
  for (let c = 0; c < cells; c++) ground[c] = 2 + (c % field.width) * .05;
  const values: Record<string, number> = { on: 1, clear: 0, windX: 1, windZ: 0, windSpeed: 6, smokeCap: 90, smokeRate: fireView.cells.smoke[0] ?? 0, scorchCap: cells };
  const flames = instanced(fireView.flameCount), smoke = instanced(90), scorch = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), cells); scorch.count = 0;
  const draws = new Map([[fire.draws.flames, flames], [fire.draws.smoke, smoke], [fire.draws.scorch, scorch]]);
  const arrays = new Map<string, ArrayLike<number>>([[fire.arrays.modes, modes], [fire.arrays.lifetimes, lifetimes], [fire.arrays.ground, ground], [fire.arrays.burnt, burnt]]);
  const scope = new Scope('titan-fire');
  const program = viewProgram(module, rows, { scope, player: { position: new Vector3(), velocity: new Vector3(), yaw: 0 }, camera: new PerspectiveCamera(),
    values: id => id === fire.values ? name => values[name] ?? Number.NaN : null, floor: () => null, slots: () => null,
    object: () => { throw new Error('The fire lends no objects'); }, look: () => undefined,
    array: id => { const array = arrays.get(id); if (array === undefined) throw new Error(`No array ${id}`); return () => array; },
    draw: id => { const draw = draws.get(id); if (draw === undefined) throw new Error(`No draw ${id}`); return draw; } });
  if (program === null) throw new Error('Missing fire program');
  // three burning cells in a row along x (wind +x): the last one's downwind neighbour is idle, the others' are burning
  const row = 10, burning = [row * field.width + 5, row * field.width + 6, row * field.width + 7];
  for (const [k, c] of burning.entries()) { modes[c] = field.states.active; lifetimes[c] = [6.5, 4, 1.5][k] ?? 0; }
  try {
    for (let frame = 0; frame < 30; frame++) expect(program.frame(1 / 30, frame / 30)).toBe(true);
    expect(flames.count).toBe(burning.length);
    for (const [k, c] of burning.entries()) {
      const left = lifetimes[c] ?? 0, x = field.x + (c % field.width + .5) * field.cell, z = field.z + (Math.floor(c / field.width) + .5) * field.cell;
      const heat = Math.min(1, (look.burn - left) / .9) * Math.min(1, left / 2.2), front = k === burning.length - 1 ? 1 : 0;
      const size = look.size * ((fireView.front[0] ?? 0) + (fireView.front[1] ?? 0) * front) * ((fireView.heat[0] ?? 0) + (fireView.heat[1] ?? 0) * heat);
      const want = new Matrix4().compose(new Vector3(x + Math.sin(c * 3.1) * look.scatter, (ground[c] ?? 0) - look.sink, z + Math.cos(c * 2.3) * look.scatter),
        new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), c * .7), new Vector3(size * fireView.flameWidth, size, size * fireView.flameWidth));
      const got = new Matrix4().fromArray(flames.instanceMatrix.array, k * 16);
      for (let e = 0; e < 16; e++) expect(got.elements[e]).toBeCloseTo(want.elements[e] ?? 0, 3);
      const aInst = flames.geometry.getAttribute('aInst');
      expect(aInst.getX(k)).toBeCloseTo(heat, 5); expect(aInst.getY(k)).toBe(front); expect(aInst.getZ(k)).toBeCloseTo((c * .618) % 1, 5);
    }
    // smoke rolled off the burning cells: some puffs, every one bounded and growing downwind
    expect(smoke.count).toBeGreaterThan(0); expect(smoke.count).toBeLessThanOrEqual(90);
    // two cells burn out: their scorch is appended as a changed range
    burnt.set([2, burning[0] ?? 0, burning[1] ?? 0]); program.frame(1 / 30, 1);
    expect(scorch.count).toBe(2);
    burnt.set([1, burning[2] ?? 0]); program.frame(1 / 30, 1 + 1 / 30);
    expect(scorch.count).toBe(3);
    const third = new Matrix4().fromArray(scorch.instanceMatrix.array, 2 * 16), at = new Vector3().setFromMatrixPosition(third);
    const cx = field.x + ((burning[2] ?? 0) % field.width + .5) * field.cell;
    expect(Math.abs(at.x - cx)).toBeLessThanOrEqual(look.scorch.jitter / 2 + 1e-4);
    // the fire out: no flames, the smoke keeps rising; a reset takes the smoke and the scorch
    burnt[0] = 0; values['on'] = 0; program.frame(1 / 30, 2);
    expect(flames.count).toBe(0); expect(scorch.count).toBe(3);
    values['clear'] = 1; program.frame(1 / 30, 2 + 1 / 30);
    expect(smoke.count).toBe(0); expect(scorch.count).toBe(0); expect(program.frozen).toBe(false);
  } finally { scope.dispose(); }
});
