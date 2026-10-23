/** Local incremental root check arguments; CI retains a plain no-emit check. */
export function rootTypecheckArguments(environment?:{readonly CI?:string;readonly GITHUB_ACTIONS?:string}):string[];
