/** Core numeric script ABI v0. Compiler/instrumenter revisions are part of this contract. */
export const SCRIPT_ABI = Object.freeze({ version: 0, assemblyscript: '0.28.20', binaryen: '132.0.0', maxBytes: 262144, memoryPages: 64, maxFunctions: 512, maxGlobals: 128, maxLocals: 1024, callDepth: 64 });
/** Required export signatures; parameter types followed by the numeric result, or zero for void. */
export const SCRIPT_EXPORTS: Readonly<Record<string, readonly number[]>> = Object.freeze({
  abi_version: [0x7f], __start: [], init: [0x7f, 0x7f, 0], in_ptr: [0x7f], in_cap: [0x7f], out_ptr: [0x7f], out_cap: [0x7f], out_count: [0x7f], on_tick: [],
});
/** Import signatures: parameter types followed by a single result, or zero for void. */
export const SCRIPT_IMPORTS: Readonly<Record<string, readonly number[]>> = Object.freeze({
  enter: [0], leave: [0], fuel: [0x7f, 0], abort: [0x7f, 0x7f, 0x7f, 0x7f, 0], query: [0x7f, 0x7f, 0x7f, 0x7f],
});
