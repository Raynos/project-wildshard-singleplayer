import { beginCaptureTrace } from './capture-trace.mjs';

/** Read a composited Playwright screenshot without requesting another game draw.
 * The detached analysis canvas never enters the document or changes the renderer.
 * @param {number[]} bytes */
export async function screenshotPixels(bytes) {
  const bitmap = await createImageBitmap(new Blob([Uint8Array.from(bytes)], { type: 'image/png' }));
  try {
    const canvas = document.createElement('canvas');
    canvas.width = Math.min(192, bitmap.width);
    canvas.height = Math.max(1, Math.round(bitmap.height * canvas.width / bitmap.width));
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('Missing screenshot analysis context');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let pixels = 0, dark = 0;
    for (let at = 0; at < data.length; at += 16) {
      pixels++;
      if (Math.max(data[at] ?? 0, data[at + 1] ?? 0, data[at + 2] ?? 0) < 16) dark++;
    }
    return { width: bitmap.width, height: bitmap.height, pixels, darkShare: dark / pixels };
  } finally { bitmap.close(); }
}

/** @param {{width:number,height:number,pixels:number,darkShare:number}} sample */
export function frameFailure(sample) {
  if (![sample.width, sample.height, sample.pixels].every(value => Number.isSafeInteger(value) && value > 0) ||
    !Number.isFinite(sample.darkShare) || sample.darkShare < 0 || sample.darkShare > 1) return 'invalid screenshot sample';
  return sample.darkShare >= .9 ? 'frame is at least 90% near-black' : null;
}

/** @param {import('playwright').Page} page @param {string} label @param {number} deadline
 * @param {(import('./black-frame.mjs').BootFrameSample)[]} frames */
export async function captureBootFrame(page, label, deadline, frames) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new Error(`Boot deadline: ${label} screenshot`);
  const stopTrace = await beginCaptureTrace(page, label);
  const started = performance.now();
  console.log(`boot-capture ${JSON.stringify({ label, stage: 'screenshot-roundtrip', state: 'start', ms: 0 })}`);
  let state = 'refused';
  const captureDeadline = Math.min(deadline, Date.now() + 10000);
  const bytes = await (async () => { try {
    // Wait for the browser compositor's next frame, without requesting a game draw.
    // This shares the original capture allowance; a stalled rAF cannot extend it.
    const frameStarted = performance.now();
    let frameTimer;
    try {
      await Promise.race([
        page.evaluate(() => new Promise(resolve => { requestAnimationFrame(() => resolve(true)); })),
        new Promise((_resolve, reject) => {
          frameTimer = setTimeout(() => reject(new Error(`Boot deadline: ${label} compositor frame`)),
            Math.max(0, captureDeadline - Date.now()));
        }),
      ]);
      console.log(`boot-capture ${JSON.stringify({ label, stage: 'compositor-frame', state: 'complete', ms: performance.now() - frameStarted })}`);
    } finally { clearTimeout(frameTimer); }
    const available = captureDeadline - Date.now();
    if (available <= 0) throw new Error(`Boot deadline: ${label} screenshot`);
    const captured = await page.screenshot({ type: 'png', timeout: available });
    state = 'complete'; return captured;
  } finally {
    console.log(`boot-capture ${JSON.stringify({ label, stage: 'screenshot-roundtrip', state, ms: performance.now() - started })}`);
    await stopTrace();
  } })();
  const sample = { label, ...await page.evaluate(screenshotPixels, Array.from(bytes)) };
  frames.push(sample);
  const failure = frameFailure(sample);
  if (failure !== null) throw new Error(`${label}: ${failure} (${JSON.stringify(sample)})`);
}
