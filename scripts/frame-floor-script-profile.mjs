/** Start Safari's existing sampling protocol on the driving Inspector, returning a bounded stop operation.
 * Proxy timestamps can be zero, so callers delimit the page window explicitly and never give this timing credit.
 * @param {import('./frame-floor-script-profile.mjs').ScriptProfilePort} inspector
 * @param {number} waitMs
 */
export async function startScriptProfile(inspector, waitMs = 10000) {
  /** @type {(value: unknown) => void} */
  let receive = () => undefined;
  const finished = new Promise(resolve => { receive = resolve; });
  const off = inspector.on('ScriptProfiler.trackingComplete', value => receive(value));
  try { await inspector.send('ScriptProfiler.startTracking', { includeSamples: true }); }
  catch (error) { off(); throw error; }
  return async () => {
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let timer;
    const deadline = new Promise((_resolve, reject) => { timer = setTimeout(() => reject(new Error('Safari sampling profile did not complete')), waitMs); });
    try { return await Promise.race([inspector.send('ScriptProfiler.stopTracking').then(() => finished), deadline]); }
    finally { clearTimeout(timer); off(); }
  };
}
