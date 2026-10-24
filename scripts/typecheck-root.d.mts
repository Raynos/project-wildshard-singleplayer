/** Local incremental test-project arguments; CI keeps a cold no-emit check. Build layers first. */
export function rootTypecheckArguments(environment?:{readonly CI?:string;readonly GITHUB_ACTIONS?:string}):string[];
