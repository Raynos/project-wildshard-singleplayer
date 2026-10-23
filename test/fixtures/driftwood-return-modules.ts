// oxlint-disable-next-line import/no-nodejs-modules -- Borrow the registered producer's actual original module.
import {readFileSync} from 'node:fs';
import {Scope} from '../../src/engine/app/scope';
import {ReturnProgram} from '../../src/game/population/returnProgram';
import {parseDecisionScripts} from '../../src/format/decisionScripts';
import {hashImmutableBytes} from '../../src/sdk/immutable';
import {RETURN_PROGRAM} from '../../src/shards/driftwood-isle/generators/returnProgram';

export const driftwoodReturnBytes=new Uint8Array(readFileSync('src/shards/driftwood-isle/behaviour/returns.generated.wasm'));
const hash=hashImmutableBytes(driftwoodReturnBytes),rows=parseDecisionScripts([RETURN_PROGRAM.script]);
if(rows.length!==1||RETURN_PROGRAM.script.module!==`blobs/wasm/${hash}.wasm`)throw new Error('Original return module differs');
const assets=new Map([[hash,driftwoodReturnBytes]]);
/** Reuse each fixture's actual native or entered owner and the same verified byte map. */
export function lendDriftwoodReturns(owner:Scope):Scope {ReturnProgram.lendModules(owner,assets,rows);return owner;}
