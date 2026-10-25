import { loadingShardName } from './catalogue.mjs';

/** Keep post-controls polls independent of the frozen loading/resource bank.
 * Injected into Safari: dependencies must stay inside the function.
 * @template {{errors: readonly string[]}} T
 * @template U
 * @param {boolean} details @param {T | null} accuracy @param {() => U} measures
 * @returns {{accuracy: T | null; measures: U} | {errors: readonly string[]}} */
export function compiledPollDetails(details, accuracy, measures) {
  return details ? { accuracy, measures: measures() } : { errors: accuracy?.errors ?? [] };
}

/** Sample the compiled card's actual controls, then eight seconds of rAF gaps.
 * Loading gaps before the first ready frame are excluded; a frame straddling
 * the window end keeps its full duration rather than hiding a long freeze.
 * @param {import('./sim-shard.mjs').CompiledFrameWindow} state
 * @param {number} at @param {boolean} ready */
export function sampleCompiledFrame(state, at, ready) {
  if (!Number.isFinite(at) || at < 0 || state.last !== null && at < state.last) throw new Error('Invalid compiled frame clock');
  if (state.complete) return;
  if (state.controlsAt === null) {
    if (ready) { state.controlsAt = at; state.last = at; }
    return;
  }
  if (state.last === null) throw new Error('Missing compiled frame start');
  const gap = at - state.last;
  if (gap > 0) {
    state.frames++;
    if (gap > state.worst) { state.worst = gap; state.worstAt = at - state.controlsAt; }
  }
  state.last = at; state.complete = at - state.controlsAt >= 8000;
}

/** Keep the controls timestamp fixed while the post-controls sample drains.
 * @param {import('./sim-shard.mjs').CompiledFrameWindow | null | undefined} state
 * @param {number} origin @param {number} tap */
export function compiledFrameMetrics(state, origin, tap) {
  if (state === null || state === undefined || !state.complete || state.controlsAt === null || state.last === null || state.frames === 0 || !Number.isFinite(origin) || !Number.isFinite(tap)) throw new Error('Incomplete compiled frame window');
  return { controlsMs: Math.round(origin + state.controlsAt - tap), controlsObservationIntervalMs: 500,
    worstFrameAfterControlsMs: state.worst, worstFrameAfterControlsAtMs: state.worstAt,
    postControlsFrames: state.frames, postControlsWindowMs: 8000, postControlsObservedMs: state.last - state.controlsAt };
}

/** Qualify every completed compiled visit; a median must not hide one miss.
 * Exit 1 is incomplete/refused evidence; exit 2 is a measured frame miss.
 * @param {readonly {error?: string; worstFrameAfterControlsMs?: number}[]} rows
 * @returns {import('./sim-shard.mjs').CompiledEntryQualification} */
export function compiledEntryQualification(rows) {
  let worst = null;
  for (const row of rows) {
    const frame = row.worstFrameAfterControlsMs;
    if (row.error !== undefined || typeof frame !== 'number' || !Number.isFinite(frame) || frame < 0) {
      return { frameLimitMs: 100, complete: false, passed: false, worstFrameAfterControlsMs: null, exitCode: 1 };
    }
    worst = Math.max(worst ?? 0, frame);
  }
  if (worst === null) return { frameLimitMs: 100, complete: false, passed: false, worstFrameAfterControlsMs: null, exitCode: 1 };
  const passed = worst <= 100;
  return { frameLimitMs: 100, complete: true, passed, worstFrameAfterControlsMs: worst, exitCode: passed ? 0 : 2 };
}

/** A saved-pose update skips descent; require actual unpaused gameplay rather than an invented reveal. */
export function recoveredGridControls(sample) {
  return sample?.bootEntry?.reason === 'reload' && sample.bootEntry.saved === true
    && sample.bootEntry.continuing === true && sample.bootEntry.grid === true
    && sample.world?.entered === true && sample.world.paused === false && sample.world.frameGate === true
    && sample.loaderVisible === false && sample.title === false && sample.error === null
    && Number.isFinite(sample.origin) && Number.isFinite(sample.at);
}

/** Exact compiled route fence; the similarly named legacy route is not evidence. */
export function requireCompiledEntry(href, shard, accuracy) {
  loadingShardName(shard);
  if (new URL(href).searchParams.get('chunk') !== shard || accuracy?.final?.path !== 'shardfile') throw new Error('Expected exact compiled shard entry');
  if (!Number.isFinite(accuracy.readyAt) || !(accuracy.readyAt > 0) || accuracy.errors.length > 0) throw new Error('Compiled entry did not finish cleanly');
}

/** Report observed counters without smoothing missing samples or denominator growth. */
export function downloadEvidence(samples) {
  let previous, admission = false, changes = 0, drops = 0, maximumError = 0, measured = 0;
  for (const sample of samples) {
    // Painted rows use the bare key; live subphase updates use the prefix.
    // Module preparation precedes product admission and is not step two.
    if (sample.step === 'admission' || sample.step?.startsWith('admission.') && sample.step !== 'admission.modules') admission = true;
    const total = Number(sample.declaredBytes), pending = Number(sample.pendingBytes), shown = Number(sample.downloadPercent);
    if ([sample.declaredBytes, sample.pendingBytes, sample.downloadPercent].some(value => value === undefined || value.trim() === '')
      || ![total, pending, shown].every(Number.isFinite) || total <= 0 || pending < 0 || pending > total || shown < 0 || shown > 100) continue;
    if (previous !== undefined) {
      if (admission && total !== previous.total) changes++;
      if (shown < previous.shown) drops++;
    }
    maximumError = Math.max(maximumError, Math.abs(shown - 100 * (total - pending) / total));
    previous = { total, shown }; measured++;
  }
  return { measuredFrames: measured, missingFrames: samples.length - measured, denominatorChangesAfterAdmission: changes,
    downloadDrops: drops, maxPercentError: measured === 0 ? null : maximumError, finalDeclaredBytes: previous?.total ?? null };
}

/** Read the existing visible samples; this adds no page observer or timer.
 * Step starts are first OBSERVED samples, not interpolated stage boundaries.
 * The displayed clock is rounded to tenths, so its percentage is diagnostic.
 * @param {readonly import('./sim-shard.mjs').StepSample[]} samples */
export function stepEvidence(samples) {
  /** @param {string | undefined} text */
  const clockMs = text => typeof text === 'string' && /^\d+:\d{2}\.\d$/u.test(text)
    ? text.split(':').reduce((minutes, value) => minutes * 60 + Number(value), 0) * 1000 : null;
  const finalClock = clockMs(samples.at(-1)?.clock);
  let previousNumber = 0, previousTotal = null, totalChanges = 0, numberRegressions = 0, numberedFrames = 0, lastSetupBeforeFade = null;
  const starts = [];
  for (const sample of samples) {
    const setup = typeof sample.setup === 'string' && /^(?:100|\d{1,2})$/u.test(sample.setup) ? Number(sample.setup) : null;
    if (sample.fading === false && setup !== null) lastSetupBeforeFade = setup;
    const step = /^step (\d+) \/ (\d+) ·/u.exec(sample.detail ?? '');
    if (step === null) continue;
    const number = Number(step[1]), total = Number(step[2]);
    if (!Number.isSafeInteger(number) || !Number.isSafeInteger(total) || number < 1 || number > total) continue;
    numberedFrames++;
    if (previousTotal !== null && total !== previousTotal) totalChanges++;
    if (number < previousNumber) numberRegressions++;
    if (number !== previousNumber) {
      const elapsed = clockMs(sample.clock);
      const elapsedPercent = elapsed !== null && finalClock !== null && finalClock > 0 ? 100 * elapsed / finalClock : null;
      starts.push({ number, total, setup, elapsedPercent,
        errorPoints: setup !== null && elapsedPercent !== null ? Math.abs(setup - elapsedPercent) : null });
    }
    previousNumber = number; previousTotal = total;
  }
  return { numberedFrames, totalSteps: previousTotal, totalChanges, numberRegressions, observedStarts: starts, lastSetupBeforeFade };
}

/** Never compare expected content (including cache hits) to compressed network
 * traffic. Retain both independent units and any missing decode evidence. */
export function transportEvidence(receipts) {
  const unknown = receipts.filter(row => !Number.isSafeInteger(row.decodedBodyBytes) || row.decodedBodyBytes < 0);
  return { wireBodyBytes: receipts.reduce((sum, row) => sum + row.bodyBytes, 0),
    networkContentBytes: unknown.length > 0 ? null : receipts.reduce((sum, row) => sum + row.decodedBodyBytes, 0),
    unknownContentResponses: unknown.length, responses: receipts.length,
    expectedUnit: 'file content before HTTP compression; includes cache hits',
    observedUnit: 'HTTP response bodies; excludes cache hits and headers' };
}


/** Wait for this exact candidate to become waiting; observing state never retries an install. */
export function waitForWaitingWorker(registration, timeoutMs = 120000) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000) return Promise.reject(new Error('Invalid worker state deadline'));
  if (registration.waiting !== null) return Promise.resolve(registration.waiting);
  const candidate = registration.installing;
  if (candidate === null) return Promise.reject(new Error('No new worker installing or waiting'));
  return new Promise((resolve, reject) => {
    /** @type {{poll?: ReturnType<typeof setInterval>; deadline?: ReturnType<typeof setTimeout>}} */
    const timers = {};
    /** @param {Error} [error] */
    const finish = (error) => {
      clearInterval(timers.poll); clearTimeout(timers.deadline);
      if (error !== undefined) reject(error); else resolve(candidate);
    };
    const check = () => {
      if (registration.waiting === candidate) finish();
      else if (registration.waiting !== null || (registration.installing !== null && registration.installing !== candidate)) finish(new Error('Upgrade worker candidate changed'));
      else if (candidate.state === 'redundant' || candidate.state === 'activated') finish(new Error(`Upgrade worker became ${candidate.state}`));
    };
    timers.poll = setInterval(check, 25);
    timers.deadline = setTimeout(() => { finish(new Error('Upgrade worker did not become waiting before deadline')); }, timeoutMs);
    check();
  });
}
