/** Stop only recorders, leaving destination streams live for later takes.
 * The consumer owns every returned URL until its binary handoff finishes. */
export function stopEraRecordings():Promise<{recs:{url:string;bytes:number;mime:string|undefined;rate:number;state:string}[];files:Record<string,unknown>[];loops:Record<string,unknown>[];dropped:string[]}>;
