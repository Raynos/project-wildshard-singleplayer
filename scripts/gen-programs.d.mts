export interface GenerationPlan { products:string[];folders:string[];legacy:string[];scoped:boolean }
export function hasProjectGenerator(source:string):boolean;
export function generationPlan(root:string,requested?:string):GenerationPlan;
export function prepareProgramInputs(root:string,plan:GenerationPlan,concurrency:number):Promise<void>;
export function buildPrograms(root:string,plan:GenerationPlan,reuse?:boolean):Promise<number>;
