import moversModule from '../behaviour/movers.generated.json' with { type: 'json' };
import entryProof from '../data/entryProof.generated.json' with { type: 'json' };
import heldDecals from '../data/heldDecals.generated.json' with { type: 'json' };
import * as v from 'valibot';
import { GraphArmsSchema } from '@wildshard/format/graphArmsRows';
import { SCRIPT_V2_REVISIONS } from '@wildshard/format/scriptAdmissionV2';
import { namedJsonSchema } from '@wildshard/sdk/formatJsonSchema';
import type { NamedBlob } from '@wildshard/sdk/blobs';
import bursts from '../data/burstFields.json' with { type: 'json' };
import { nineOutput as emitNineOutput, type NineOutput } from './productOutput';

const burstSchema = v.strictObject({ name: v.string(), shape: v.picklist(['flake', 'streak']), count: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(24)), life: v.pipe(v.number(), v.minValue(0.001), v.maxValue(1)) });
const effectRows = v.parse(v.strictObject({ muzzle: burstSchema, bite: burstSchema, dock: burstSchema, sparks: burstSchema }), bursts);

/** Retained CLI adapter until its remaining readers become source calls. */
export function nineOutput(movers?: { readonly hash: string; readonly bytes: Uint8Array }, decals?: readonly NamedBlob[]): NineOutput {
  return emitNineOutput(movers ?? { hash: moversModule.compiled.hash, source: moversModule.compiled.source }, { entryProof, decals: decals === undefined ? { sources: heldDecals } : { blobs: decals }, bursts: effectRows, graphArmsSchema: namedJsonSchema(GraphArmsSchema), scriptRevisions: SCRIPT_V2_REVISIONS });
}
/** The CLI retains its existing output authority throughout the partial conversion. */
export const output = nineOutput();
