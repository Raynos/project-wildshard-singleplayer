import type { MarkdownTable,TextSection,Source,Media,Playtest,Plan } from './types.mjs';

export function tableCells(line:string):string[];
export function markdownTables(markdown:string):MarkdownTable[];
export function markdownSections(markdown:string):TextSection[];
export function parsePlaytest(markdown:string,source:Source,media:readonly Media[]):Playtest;
export function parsePlan(markdown:string,source:Source):Plan;
