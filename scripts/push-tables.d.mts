export function pushTables(root:string):Promise<void>;
export function sectionTables(root:string,slug:string):Promise<void>;
export function manifestTypeTables(root:string,folder:string,manifest:unknown,outputs:ReadonlySet<string>):void;
