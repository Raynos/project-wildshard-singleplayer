/** A quest page's barred door (G565): a living building's door borrowed by its page, barred until its flags open it. */
import * as v from 'valibot';
import { QuestPageDoorSchema } from '@wildshard/format/questPageFacets';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import type { ShardContext } from '../plugin/context';
import { forestPage } from '../shardfile/forestPage';
import { QuestFlagGates } from './flagGates';

/**
 * Borrow the forest page's declared door (its prompt and use, for the door page's owners) and bar it with the page's flag
 * gates on the door's registered piece. A build without that door (its building not drawn on this tier) has no door: null.
 */
export function installPageDoor(ctx: ShardContext, input: unknown): { readonly prompt: Interactable; readonly use: () => void } | null {
  const rows = v.parse(QuestPageDoorSchema, input), life = forestPage(ctx.scope, rows.forest).cabins.life;
  const pieces = life.doorPieces(), index = pieces.findIndex(piece => piece.id === rows.door);
  const piece = pieces[index], prompt = life.interactables[index];
  if (piece === undefined || prompt === undefined) return null;
  if (rows.gates.gates.some(gate => gate.target.kind !== 'piece' || gate.target.piece !== piece.id)) throw new Error('Page door gates bar its own registered piece');
  new QuestFlagGates(ctx, rows.gates);
  return { prompt, use: piece.use };
}
