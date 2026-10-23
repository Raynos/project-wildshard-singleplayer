/** Proof-only, after controls: size existing cached copies without fetching.
 * Presence here never proves a cache hit during boot. This function is injected
 * into Safari, so keep its bounds and dependencies inside the function. */
export async function cachedBodyEvidence(input) {
  const limits = { urls: 1024, caches: 16, bodyBytes: 8 * 1024 * 1024, totalBytes: 64 * 1024 * 1024, milliseconds: 5000 };
  if (!Array.isArray(input) || input.length > limits.urls) throw new Error('Invalid cache evidence URL bank');
  const urls = [];
  for (const value of input) {
    if (typeof value !== 'string') throw new Error('Invalid cache evidence URL');
    const url = new URL(value, location.href);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== location.origin
      || url.username !== '' || url.password !== '' || url.hash !== '') throw new Error('Foreign cache evidence URL');
    if (!urls.includes(url.href)) urls.push(url.href);
  }
  const started = performance.now(), files = [], missing = [], failures = [];
  let readBytes = 0, limited = null;
  const result = () => ({ unit: 'decoded cached response bodies', source: 'post-control cached copies; not cache-hit evidence',
    requested: urls.length, files, missing, failures, readBytes, limited, limits });
  if (typeof caches === 'undefined') { limited = 'CacheStorage unavailable'; return result(); }
  const bounded = async work => {
    let timer;
    try {
      return await Promise.race([work, new Promise((_resolve, reject) => {
        timer = setTimeout(() => { reject(new Error('Cache evidence time limit')); }, Math.max(0, limits.milliseconds - (performance.now() - started)));
      })]);
    } finally { clearTimeout(timer); }
  };
  let names;
  try { names = await bounded(caches.keys()); }
  catch { limited = 'time or cache enumeration failure'; return result(); }
  if (names.length > limits.caches) { limited = 'cache count'; return result(); }
  // A concurrent cache removal must not make open() create a replacement cache.
  // CacheStorage.match searches existing stores and does not create or write one.
  for (const url of urls) {
    if (performance.now() - started >= limits.milliseconds) { limited = 'time'; break; }
    if (readBytes >= limits.totalBytes) { limited = 'total bytes'; break; }
    let reader;
    try {
      const response = await bounded(caches.match(url));
      if (response === undefined) { missing.push(url); continue; }
      if (response.type === 'opaque' || response.body === null) { failures.push({ url, reason: 'unreadable body' }); continue; }
      reader = response.body.getReader();
      let bytes = 0, complete = false;
      while (true) {
        if (performance.now() - started >= limits.milliseconds) { limited = 'time'; break; }
        const chunk = await bounded(reader.read());
        if (chunk.done) { complete = true; break; }
        bytes += chunk.value.byteLength; readBytes += chunk.value.byteLength;
        if (bytes > limits.bodyBytes) { failures.push({ url, reason: 'body bytes' }); break; }
        if (readBytes > limits.totalBytes) { limited = 'total bytes'; break; }
      }
      if (complete) files.push({ url, bytes });
    } catch (error) {
      failures.push({ url, reason: String(error) });
      if (performance.now() - started >= limits.milliseconds) limited = 'time';
    } finally { if (reader !== undefined) { void reader.cancel().catch(() => { /* Cancellation cannot block evidence cleanup. */ }); reader.releaseLock(); } }
    if (limited !== null) break;
  }
  return result();
}
