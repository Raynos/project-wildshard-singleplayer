/** Exact gameplay comparison; only top-level revision/build/input provenance is excluded. */
export function captureOutcome(text:string):string;
/** Verify a pinned preview before and after capture. */
export function capturePreview(spec:{url:string;revision:string}):Promise<{url:string;revision:string;build:string;browserDigest:string}>;

/** Exact Chromium executable SHA for every browser-backed job. */
export function generationBrowserDigest():string;
