/** Generate validator, wire schemas and standalone types from the build-only registry. */
export function sectionSchemaTables(root:string,slug:string,options?:{plain?:boolean}):Promise<{tables:Readonly<Record<string,string>>;report:{path:string;sourceHash:string;schemas:number;bytes:number}}>;
export function writeSectionSchemaBridge(root:string,slug:string,options?:{check?:boolean;plain?:boolean}):Promise<{path:string;sourceHash:string;schemas:number;bytes:number}>;
