import input from '../behaviour/returns.generated.json' with { type: 'json' };

const {compiled,...program}=input;
/** Generated v1 recipe is data; the registered producer owns compilation. */
export const RETURN_PROGRAM = program;
/** Keep the original binary in the critical product closure and memory admission. */
export const RETURN_WASM = {name:'behaviour/driftwood.returns.wasm',kind:'wasm' as const,source:compiled.source,
  options:{critical:true,script:{abi:1 as const,pages:program.script.pages}}};
