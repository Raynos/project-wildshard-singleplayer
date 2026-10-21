import type { GenericSchema } from 'valibot';

export interface GridRuntimeBinding {schema:'grid-runtime-keys/1';source:string;runtime:string;products:Record<string,string>}
export const GridRuntimeBindingSchema:GenericSchema<unknown,GridRuntimeBinding>;
export function gridRuntimeKey(root:string,revision:string):string|undefined;
export function gridRuntimeBinding(root:string,revision:string,products:string):GridRuntimeBinding;
