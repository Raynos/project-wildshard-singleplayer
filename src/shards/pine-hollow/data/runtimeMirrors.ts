import { defineMirror } from '@wildshard/sdk/runtimeMirrors';
import { ANTLER_KING_FIGHT } from './kingFight';
import { KING_FX_LOOKS } from './kingFxLook';
import { KINGS_CLEARING } from './layout';
import lookMaterials from './lookMaterials.generated.json' with { type: 'json' };
import { WILDLIFE_LOOK } from './wildlifeLook';

/** Every value runtime/const.ts copies, next to its source (P2a spec §2.3); a drift refuses. */
export const RUNTIME_MIRRORS = [
  defineMirror('KINGS_CLEARING', KINGS_CLEARING),
  defineMirror('KING_ARENA_FOG', ANTLER_KING_FIGHT.arena.fog),
  defineMirror('KING_FX_LOOKS', KING_FX_LOOKS),
  defineMirror('PINE_RUNTIME_GRAPHS', lookMaterials.runtime),
  defineMirror('WILDLIFE_LOOK', WILDLIFE_LOOK),
];
