import moversModule from '../behaviour/movers.generated.json' with { type: 'json' };
import entryProof from '../data/entryProof.generated.json' with { type: 'json' };
import heldDecals from '../data/heldDecals.generated.json' with { type: 'json' };
import { nineOutput as emitNineOutput, type NineOutput } from './productOutput';

/** Retained CLI adapter until its remaining readers become source calls. */
export function nineOutput(movers?: { readonly hash: string; readonly bytes: Uint8Array }): NineOutput {
  return emitNineOutput(movers ?? { hash: moversModule.compiled.hash, source: moversModule.compiled.source }, { entryProof, heldDecals });
}
/** The CLI retains its existing output authority throughout the partial conversion. */
export const output = nineOutput();
