/** Original I12 product phone wire report, using served Brotli quality 3. */
export interface PhoneWireRow { name: string; bytes: number; raw: number; ceiling: number | undefined }
export function phoneWireKey(name: string): string;
export function servedBytes(bytes: Uint8Array): number;
export function phoneWireReport(root: string, names: readonly string[], products?: string): Promise<{ rows: PhoneWireRow[]; errors: string[] }>;
