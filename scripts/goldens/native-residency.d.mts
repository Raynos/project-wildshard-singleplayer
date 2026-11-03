export function goldenRefinementBinding(base:string,source:{build:string;sha:string}):Promise<{
  initializerExport:string;classExport:string;sha:string;build:string;chunk:string;chunkSHA256:string;
}>;
export function refinementExports(source:string):{initializerExport:string;classExport:string};
export function observeRefinement<T extends readonly unknown[]>(proto:{add:(...args:T)=>Promise<boolean>}):{
  jobs:{id:T[0];at:T[1];state:string;error?:string}[];
};
export function heldGoldenResidency():Promise<unknown>;
