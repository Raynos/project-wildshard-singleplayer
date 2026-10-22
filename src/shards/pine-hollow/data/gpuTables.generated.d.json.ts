/** Separate payload loaded only by the lazy KTX2 binding. */
type Gpu = Readonly<Record<'phone' | 'desktop', Readonly<Record<string, string>>>>;
declare const rows: { readonly shard: Gpu; readonly grid: Gpu };
export = rows;
