import type {OutputIndex} from '@wildshard/format/outputIndex';

/** P3 inventory verified against its actual output bytes and the verbatim source copy. */
export function outputRuntime(root:string,slug:string,products?:string):{index:OutputIndex;runtime:string[];customSectionBytes:number;customSections:{name:string;bytes:number}[];sections:{name:string;value:unknown}[];indexPath:string};

/** Hash/size-verified sections for data-selected G294 users, even before runtime closure. */
export function outputSections(root:string,slug:string,products?:string):{index:OutputIndex;sections:{name:string;value:unknown}[];customSections:{name:string;bytes:number}[];customSectionBytes:number};
