import type {Page} from 'playwright';
/** Serve original immutable JPEG buffers until disposal; no data-URL copies. */
export function jpegImageRoutes(page:Pick<Page,'route'|'unroute'>,images:readonly Uint8Array[]):Promise<{urls:string[];dispose:()=>Promise<void>}>;
