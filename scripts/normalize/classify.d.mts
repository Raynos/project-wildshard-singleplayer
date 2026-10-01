export interface ClassifiedRow { from: string; f6: string | null; final: string | null; row: string; rule: string }
export interface Finding { kind: string; file?: string; rule?: string; destination?: string }
export function classify(map: { files: ClassifiedRow[] }, root?: string): Finding[];
