// oxlint-disable-next-line unicorn/prefer-export-from -- E434 forbids re-export barrels.
import program from '../behaviour/returns.generated.json' with { type: 'json' };
import { nameBlob } from '@wildshard/sdk/blobs';

/** Generated v1 recipe is data; the registered producer owns compilation. */
export const RETURN_PROGRAM = program;
/** Keep the module in the critical product closure and memory admission. */
export const RETURN_WASM = nameBlob('behaviour/driftwood.returns.wasm', 'wasm',
  Uint8Array.from(atob(program.bytes), character => character.codePointAt(0) ?? 0),
  { critical: true, script: { abi: 1, pages: 1 } });
