/** Resolve digest-pinned raw inputs through the shared generation cache; no source file is mutated. */
export function externalGenerationInputs(sources:{path:string;url:string;sha256:string}[],cacheDir?:string):Promise<{path:string;file:string}[]>;
/** Exact encoder binary and version-output identities for generated image/tool keys. */
export function generationTools(commands:string[][]):Record<string,string>;
