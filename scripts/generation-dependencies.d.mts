/** Verified source/installed-lock package identities. Unsupported installations
 * grant no narrower probe; full and phase identities still bind their layout. */
export function generationDependencies(root:string,expectedLock?:string):{
  identity:string;
  probe:(file:string)=>string|undefined;
  observedIdentity:()=>string;
  verify:()=>void;
};
