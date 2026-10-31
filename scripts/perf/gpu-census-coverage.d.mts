export interface GraphCoverageRow {alias:string;samples:number;coveredPixels:number;saturatedPixels:number;fragmentShaderHashes?:string[]}
export interface GraphCoverage {width:number;height:number;method:string;rows:GraphCoverageRow[]}
/** Native-order depth-passing samples; final-output diagnostic, not shader invocations. */
export function graphCoverage():GraphCoverage;
