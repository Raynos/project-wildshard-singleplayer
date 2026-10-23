/** Refuse actual byte objects before serialization obscures their type. */
export function assertJsonRows(value:unknown,path?:string):void;
/** The producer's exact-path binary JSON policy, applied before publication. */
export function jsonOutputGuard(directory?:string):(file:string,bytes:Uint8Array|string)=>void;
