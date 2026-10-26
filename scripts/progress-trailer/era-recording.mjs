/** Stop the current take without closing destination streams reused by later takes.
 * Only owned object URLs and recorder metadata cross the page boundary.
 * @returns {Promise<{recs:{url:string,bytes:number,mime:string|undefined,rate:number,state:string}[],files:Record<string,unknown>[],loops:Record<string,unknown>[],dropped:string[]}>} */
export async function stopEraRecordings() {
  const target = /** @type {Window & {__eraRecs?:{rec:MediaRecorder,chunks:Blob[],mime:string|undefined,rate:number,state:string}[],__eraLog?:Record<string,unknown>[],__eraLoops?:(Record<string,unknown>&{ended?:boolean})[],__eraDropped?:string[]}} */ (window);
  const recordings = target.__eraRecs, files = target.__eraLog, loops = target.__eraLoops, dropped = target.__eraDropped;
  if (recordings === undefined || files === undefined || loops === undefined || dropped === undefined) throw new Error('Missing era recorders');
  /** @type {string[]} */ const urls = [];
  const stopped = await Promise.allSettled(recordings.map(async recording => {
    if (recording.rec.state === 'inactive') throw new Error('Era recorder is inactive');
    await new Promise(resolve => { recording.rec.onstop = () => { resolve(undefined); }; recording.rec.stop(); });
    const blob = new Blob(recording.chunks, recording.mime === undefined ? {} : { type: recording.mime });
    recording.chunks.length = 0;
    const url = URL.createObjectURL(blob); urls.push(url);
    return { url, bytes: blob.size, mime: recording.mime, rate: recording.rate, state: recording.state };
  }));
  target.__eraRecs = [];
  const refused = stopped.find(result => result.status === 'rejected');
  if (refused !== undefined) {
    for (const url of urls) URL.revokeObjectURL(url);
    throw new Error('Era recorder stop refused', { cause: refused.reason });
  }
  return { recs: stopped.flatMap(result => result.status === 'fulfilled' ? [result.value] : []),
    files: files.slice(), loops: loops.filter(row => !row.ended), dropped: [...new Set(dropped)] };
}
