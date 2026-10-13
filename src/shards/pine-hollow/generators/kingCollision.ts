import rows from '../data/kingCollisionRows.json' with { type: 'json' };
import physics from '../data/physicsRows.json' with { type: 'json' };

type Triple = [number, number, number];
const triple = (row: readonly number[] | undefined, what: string): Triple => {
  const [x, y, z] = row ?? [];
  if (row?.length !== 3 || x === undefined || y === undefined || z === undefined) throw new Error(`King collision: ${what} is not x, y, z`);
  return [x, y, z];
};

/** G350: the Antler King's collision table from authoring inputs only. The authored rows carry the four collision joints,
 * the rest pose and each attack clip's per-tick joint transforms; the sample clock (tick, phase) comes from the clip
 * duration, and the hit volumes from the King's physics rows: head, body and fore from its dims, the rib cage relative to
 * the rest chest. No rig, skeleton, engine or runtime code runs. */
export function pineKingCollision(): Record<string, unknown> {
  const king = physics.parked.find(row => row.kind === 'antler-king');
  if (king === undefined || !('dims' in king.spec)) throw new Error('King collision: missing the antler-king physics row');
  const { dims } = king.spec, chest = rows.rest.at.chest, ribs = triple(physics.kingHit.ribs, 'the rib cage');
  if (dims.fore === undefined) throw new Error('King collision: the antler-king dims lack the fore volume');
  const hz = rows.hz;
  return { version: 1, hz, joints: rows.joints, rest: rows.rest,
    volumes: { head: triple(dims.headAt, 'the head'), body: { at: triple(dims.bodyAt, 'the body'), pitch: dims.bodyPitch, halfLength: dims.bodyHalfLen },
      fore: { at: triple(dims.fore.at, 'the fore'), halfLength: dims.fore.halfLen },
      ribs: [ribs[0] - chest.x, ribs[1] - chest.y, ribs[2] - chest.z] },
    clips: rows.clips.map(({ name, duration, transforms }) => {
      if (transforms.length !== Math.ceil(duration * hz) + 1) throw new Error(`King collision: ${name} has the wrong sample count`);
      return { name, duration, frames: transforms.map((joints, tick) => ({ tick, phase: Math.min(tick / hz / duration, 1), transforms: joints })) };
    }) };
}
