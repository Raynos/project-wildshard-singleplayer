import type {OutputIndex} from '@wildshard/format/outputIndex';
import type {Shardfile} from '@wildshard/format/shardSchema';

/** P3 inventory verified against its actual output bytes and the verbatim source copy. */
export function outputRuntime(root:string,slug:string,products?:string):{index:OutputIndex;runtime:string[];customSectionBytes:number;customSections:{name:string;bytes:number}[];sections:{name:string;value:unknown}[];indexPath:string};

/** Hash/size-verified sections for data-selected G294 users, even before runtime closure. */
export function outputSections(root:string,slug:string,products?:string):{index:OutputIndex;sections:{name:string;value:unknown}[];customSections:{name:string;bytes:number}[];customSectionBytes:number};

/** Report-scoped reader for an immutable output tree; create afresh for each report. */
export interface OutputReader {
  sections:(slug:string)=>ReturnType<typeof outputSections>;
  runtime:(slug:string)=>ReturnType<typeof outputRuntime>;
  source:(slug:string)=>Shardfile;
}
export function createOutputReader(root:string,products?:string):OutputReader;
