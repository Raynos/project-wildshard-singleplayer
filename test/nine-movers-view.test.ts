// oxlint-disable-next-line import/no-nodejs-modules -- compile the shipped module source as its bake does
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { Object3D, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { parse } from 'valibot';
import { Scope } from '../src/engine/app/scope';
import { viewProgram } from '../src/engine/script/viewProgram';
import { ViewProgramSchema } from '../src/format/viewProgram';
import { compileScriptV2 } from '../src/sdk/bake/compileScriptV2';
import plan from '../src/shards/nine-dragon-stack/data/layoutPlan.json' with { type: 'json' };
import dressing from '../src/shards/nine-dragon-stack/data/worldDressing.json' with { type: 'json' };
import { MOVER_REST, MOVER_STAGES, nineMoversView } from '../src/shards/nine-dragon-stack/generators/moversView';

const UP = new Vector3(0, 1, 0), { MOVERS } = dressing, datum = plan.Y0;

/** The movers' original closed forms on the page clock (the decorative channel programs they replace). */
function original(t: number): { x: number; y: number; z: number; yaw: number }[] {
  const train = MOVERS.train, g = MOVERS.gondola, x0 = plan.WELL.x0, x1 = plan.WELL.x1;
  const run = t * train.speed, gx = x0 + g.margin + (x1 - x0 - g.margin * 2) * (0.5 + 0.5 * Math.sin(t * g.rate + g.phase));
  return [{ x: train.x + (run % train.length), y: datum + train.y, z: train.z, yaw: 0 },
    { x: gx, y: datum - 16 + (gx - x0) / (x1 - x0) * g.rise, z: -12, yaw: 0 },
    ...MOVERS.drones.map(path => { const angle = t * path.rate + path.phase;
      return { x: path.x + Math.cos(angle) * path.r, y: datum + path.y + Math.sin(t * path.bobRate + path.phase) * path.bob, z: path.z + Math.sin(angle) * path.r, yaw: -angle }; })];
}

test('Nine\'s movers view module poses the train, the gondola and the drones on their original paths', async () => {
  const module = await compileScriptV2(readFileSync('src/shards/nine-dragon-stack/behaviour/movers.as', 'utf8'), { lane: 'view', ioBytes: 4096 });
  const rows = parse(ViewProgramSchema, nineMoversView()), scope = new Scope('nine-movers');
  const bodies = new Map(MOVER_STAGES.map(id => [id, new Object3D()] as const));
  const object = (id: string): Object3D => { const body = bodies.get(id); if (body === undefined) throw new Error(id); return body; };
  const program = viewProgram(module, rows, { scope, player: { position: new Vector3(), velocity: new Vector3(), yaw: 0 }, camera: new PerspectiveCamera(),
    values: () => null, floor: () => null, slots: () => null, object, look: () => undefined });
  if (program === null) throw new Error('Expected the movers program');
  // entered at a later page time, then a parked gap of ten minutes: the movers stand where the page clock puts them
  const dt = 1 / 30, check = (t: number): void => {
    for (const [i, pose] of original(t).entries()) {
      const body = object(MOVER_STAGES[i] ?? '');
      expect(body.position.x).toBeCloseTo(pose.x, 2); expect(body.position.y).toBeCloseTo(pose.y, 2); expect(body.position.z).toBeCloseTo(pose.z, 2);
      expect(body.quaternion.angleTo(new Quaternion().setFromAxisAngle(UP, pose.yaw))).toBeLessThan(1e-3);
    }
  };
  let t = 1234.5;
  try {
    program.frame(dt, t); check(t);
    for (let frame = 1; frame <= 300; frame++) { t += dt; program.frame(dt, t); if (frame % 100 === 0) check(t); }
    t += 600; program.frame(dt, t); check(t);
  } finally { scope.dispose(); }
  for (const [i, pose] of original(0).entries()) expect(MOVER_REST[i]).toMatchObject({ x: expect.closeTo(pose.x, 4) as number, y: expect.closeTo(pose.y, 4) as number, z: expect.closeTo(pose.z, 4) as number, yaw: expect.closeTo(pose.yaw, 6) as number });
});
