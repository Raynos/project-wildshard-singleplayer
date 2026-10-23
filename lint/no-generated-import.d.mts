import type {ESTree} from 'vite';

export function generatedImportContext(root:string,files:Iterable<string>,sources?:Iterable<string>):(file:string,specifier:string)=>boolean;
export function generatedOutputPaths(root:string):Set<string>;
export interface GeneratedImportVisitors {
  readonly ImportDeclaration:(node:ESTree.ImportDeclaration)=>void;
  readonly ExportNamedDeclaration:(node:ESTree.ExportNamedDeclaration)=>void;
  readonly ExportAllDeclaration:(node:ESTree.ExportAllDeclaration)=>void;
  readonly ImportExpression:(node:ESTree.ImportExpression)=>void;
  readonly TSImportType:(node:ESTree.TSImportType)=>void;
  readonly CallExpression:(node:ESTree.CallExpression)=>void;
}
export function generatedImportVisitors(check:(node:ESTree.Node,specifier:string)=>void):GeneratedImportVisitors;
interface GeneratedImportContext {
  readonly filename:string;
  readonly options:readonly {readonly count?:boolean}[];
  readonly report:(issue:{readonly node:ESTree.Node;readonly message:string})=>void;
}
export function noGeneratedImportRule(root:string,policyFile:string):{meta:object;create:(context:GeneratedImportContext)=>Partial<GeneratedImportVisitors>};
