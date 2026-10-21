export function sourceInputs(root:string,files:readonly string[]):string[];
export function sourceWalker(root:string,runtimeOnly?:boolean):(files:readonly string[])=>string[];
export function liveTests(root:string,tests:readonly string[],products:Record<string,string[]>):string[];
