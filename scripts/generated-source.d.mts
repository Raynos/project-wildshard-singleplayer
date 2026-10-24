export const GENERATED_SOURCE_POLICY:'lint/generated-source-debt.json';
export interface GeneratedSourcePolicy {schema:'generated-source/1';source:string;files:string[]}
export function generatedSourcePolicy(value:unknown):GeneratedSourcePolicy;
export function generatedSourceIncreases(before:GeneratedSourcePolicy,after:GeneratedSourcePolicy):string[];
export function checkGeneratedSourceRevision(root:string,revision:string,previous:string,changed:readonly string[]):string[];
export function generatedSourceFiles(root:string):string[];
export function checkGeneratedSourceTree(root:string):string[];
