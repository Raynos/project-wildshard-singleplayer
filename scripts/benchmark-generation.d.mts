/** Only full landed revision pins and bounded concurrency are accepted. */
export function generationBenchmarkOptions(args:string[]):{revision:string;parallel:string};
/** Report both normal-command wall times; a failed run stops the pair. */
export function measureGenerationPair(run:()=>void,now?:()=>number,report?:(row:{phase:string;seconds:number;success:boolean})=>void):void;
