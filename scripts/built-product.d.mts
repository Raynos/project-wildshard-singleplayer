/** Shared closed-runtime admission; reading never invokes a build. */
export function runtimeCopyIssues(root:string,project:string):{file:string;message:string}[];
/** Builder and read-only lookup use identical copy/map/output flags. */
export function productFlags(root:string,output:string|undefined,map:{image:string;tilesHash:string}|undefined,copy:boolean):string[];
/** Exact normalized recipe namespace used by sealed product input receipts. */
export function productRecipe(root:string,name:string,flags:string[],toolchain:string,cacheRoot:string):{normalized:string[];recipe:string[];receipts:string};
/** Read an exact-SHA CI product or a matching sealed local product, retaining cache lifetime pins. Never generates or builds. */
export function readBuiltShardfile(root:string,name:string,options?:{cacheRoot?:string;env?:NodeJS.ProcessEnv}):string;
