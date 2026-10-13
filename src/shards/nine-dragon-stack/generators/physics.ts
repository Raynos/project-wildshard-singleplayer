import rows from '../data/physicsRows.json' with { type: 'json' };
import { ninePhysicsPlacements } from './physicsPlacements';

/** G350-ND: Nine's physics product from authoring inputs only: the floor, front, portal and guard recipes, and the authored
 * rows no recipe computes yet (the placed models' colliders, the Well's crossings, the practice arena, the registry order
 * of every piece and the Fei Zhua's dragon hooks). No world, model, registry or runtime code runs. */
export function ninePhysics(): Record<string, unknown> {
  const pieces = new Map<string, unknown>([...ninePhysicsPlacements(), ...rows.pieces].map(piece => [piece.id, piece]));
  const ordered = rows.order.map(id => {
    const piece = pieces.get(id);
    if (piece === undefined) throw new Error(`Nine physics: no piece row for ${id}`);
    return piece;
  });
  if (ordered.length !== pieces.size) throw new Error('Nine physics: a piece row is missing from the authored order');
  return { version: 1, profile: 'authored rows', notice: 'DO NOT EDIT: regenerate with generators/physics.ts (nine-physics).', pieces: ordered, hooks: rows.hooks };
}
