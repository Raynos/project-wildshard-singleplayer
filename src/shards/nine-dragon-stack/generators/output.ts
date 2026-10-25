import moversModule from '../behaviour/movers.generated.json' with { type: 'json' };
import entryProof from '../data/entryProof.generated.json' with { type: 'json' };
import heldDecals from '../data/heldDecals.generated.json' with { type: 'json' };
import { SCRIPT_V2_REVISIONS } from '@wildshard/format/scriptAdmissionV2';
import type { NamedBlob } from '@wildshard/sdk/blobs';
import bursts from '../data/burstFields.json' with { type: 'json' };
import { nineOutput as emitNineOutput, type NineOutput } from './productOutput';
import { parseBurstFields } from './sections';
import { heldViewSchema } from './heldView';

const effectRows = parseBurstFields(bursts);

/** Retained CLI adapter until its remaining readers become source calls. */
export function nineOutput(movers?: { readonly hash: string; readonly bytes: Uint8Array }, decals?: readonly NamedBlob[]): NineOutput {
  return emitNineOutput(movers ?? { hash: moversModule.compiled.hash, source: moversModule.compiled.source }, { entryProof, decals: decals === undefined ? { sources: heldDecals } : { blobs: decals }, bursts: effectRows, graphArmsSchema: heldViewSchema(), scriptRevisions: SCRIPT_V2_REVISIONS });
}
/** The CLI retains its existing output authority throughout the partial conversion. */
export const output = nineOutput();
