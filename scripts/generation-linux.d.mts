/** Exact hash observations; null represents absent or unobserved evidence, never a zero-size output. */
export interface GenerationAuditOutput {file:string;expectedHash:string|null;generatedHash:string|null;rawExact:boolean|null;equivalent:boolean|null;comparison:'raw'|'capture-provenance'|'recorded-inputs'}
/** One producer's strict result; different/unavailable outputs stay committed. */
export interface GenerationAuditJob {id:string;entry:string;status:'darwin-only'|'matched'|'different'|'unavailable';error:string|null;key:string|null;hit:boolean|null;elapsedMs:number|null;outputs:GenerationAuditOutput[]}
/** Host-labelled portability evidence, never an activation or output-removal instruction. */
export interface GenerationAudit {schema:'generation-portability/1';pin:string;platform:string;arch:string;node:string;jobs:GenerationAuditJob[];bitExactOutputs:string[];differentOutputs:string[];unavailableOutputs:string[];undeclared:string[]}
/** Compare through the strict cache runner; a mismatch is reported without weakening its refusal. */
export function compareGeneration(root:string,options:{pin:string;cacheDir?:string;forceCompare?:boolean;catalogPath?:string;onUpdate?:(report:GenerationAudit)=>void}):Promise<GenerationAudit>;
