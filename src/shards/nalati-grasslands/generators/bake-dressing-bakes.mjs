// The SDK byte driver owns confined file I/O; these recipes only select the original shipping bytes.
/** @param {(url:string)=>Uint8Array} readAsset */
export function dressingBytes(readAsset){return readAsset('/assets/nalati/baked/dressing.bin');}
