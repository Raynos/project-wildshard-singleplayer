import type { TitleManifest } from '../src/game/shard/titleList';

export function titleCatalogueSource(rows: readonly TitleManifest[]): string;
export function readTitleCatalogue(): Promise<string>;

export interface SelectionModule { readonly slug:string; readonly file:string; readonly placement?:{readonly grid:readonly [number,number];readonly size:readonly [number,number,number];readonly instance:string} }
export function selectionModules(root:string): SelectionModule[];
export function selectionCatalogueSource(rows:readonly SelectionModule[],identities?:Readonly<Record<string,string>>):string;
