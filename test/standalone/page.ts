import { installBrowserSaveEnvironment } from '../../src/engine/client/saves/view/storage';
import { framesBetween } from '../../src/engine/server/net/tiers';
import { saveEnvironment } from '../../src/engine/shared/saves/environment';
import { NET_BUTTONS } from '../../src/engine/shared/input/netButtons';
import { ANIMAL_CLASS } from '../../src/engine/shared/net/netSchemas';
import type { StandaloneShell, startStandalone } from '../../src/sdk/standalone/shell';

// P1-E5.2: the test page scripts/standalone-smoke.mjs drives. It never ships: it is the first real client of the standalone
// shell, so the proof runs in a real Web Worker on real MessagePorts while the shipped client stays exactly as it is. It
// imports the shell as a page would: by URL from the folder of the build its document names, never from source.

/** What one proof run measured in the page. */
export interface ProofReport {
  readonly tick: number; readonly ticksPerSecond: number; readonly frames: number; readonly framesPerSecond: number; readonly dropped: number;
  readonly creatures: number; readonly worstError: number; readonly step: number; readonly probes: number; readonly matched: number;
  readonly downBytesPerSecond: number; readonly upBytesPerSecond: number; readonly bytesPerFrame: number; readonly tickMs: number;
  readonly crossOriginIsolated: boolean; readonly positionMoved: number;
}
/** What the smoke script calls. */
export interface StandaloneProof {
  boot: (slug: string) => Promise<{ tick: number; restored: boolean }>;
  /** A stale tab reaches a server of `build`: resolves with why the connection closed, if the page is still here. */
  refused: (slug: string, build: string) => Promise<string | null>;
  play: (seconds: number) => Promise<ProofReport>;
  save: () => Promise<{ tick: number; ok: boolean }>;
  stored: (slug: string) => number;
}
declare global { interface Window { standaloneProof: StandaloneProof; __WS_BUILD_ID__: string } }

const SAVE_PREFIX = 'wildshard.';
let shell: StandaloneShell | null = null;
const live = (): StandaloneShell => { if (shell === null) throw new Error('Not booted'); return shell; };
const wait = (ms: number): Promise<void> => new Promise(resolve => { setTimeout(resolve, ms); });

/** Compare the server's exact creature state with the frame of the same tick, as a view half would read it. */
async function probe(): Promise<{ error: number; rows: number; tickMs: number } | null> {
  const { client } = live(), truth = await live().probe();
  for (let tries = 0; tries < 50 && client.frame(truth.tick) === null; tries++) await wait(2);
  const frame = client.frame(truth.tick);
  if (frame === null) return null;
  let error = 0, rows = 0;
  const owner = client.owner(frame);
  for (const row of truth.rows) {
    const handle = [...client.entities.values()].find(entity => entity.id === row.id)?.handle, fields = handle === undefined ? null : client.fields(frame, handle);
    if (fields === null || owner === null) continue;
    // P1-E5.2c: a far row is sent on a slower tier, so only a row on the every-frame tier is this frame's tick. A metre of margin.
    const away = Math.hypot(row.x - Number(owner['px']), row.y - Number(owner['py']), row.z - Number(owner['pz'])) + 1;
    if (framesBetween(away * away) !== 1) continue;
    error = Math.max(error, Math.abs(Number(fields['x']) - row.x), Math.abs(Number(fields['y']) - row.y), Math.abs(Number(fields['z']) - row.z));
    rows++;
  }
  return { error, rows, tickMs: truth.tickMs };
}

async function play(seconds: number): Promise<ProofReport> {
  const { client, transport } = live(), ownerPosition = (): number[] => { const owner = client.latest === null ? null : client.owner(client.latest); return [Number(owner?.['px']), Number(owner?.['pz'])]; };
  const startTick = client.latest?.tick ?? 0, startedAt = performance.now(), down = transport.stats.recvBytes, up = transport.stats.sentBytes;
  const [startX = 0, startZ = 0] = ownerPosition();
  let frames = 0, steps = 0, worstError = 0, probes = 0, matched = 0, tickMs = 0, running = true;
  const off = client.onFrame(() => { frames++; });
  const frame = (now: number): void => {
    if (!running) return;
    // one command per 60 Hz step this animation frame covers, then one bundle (J40)
    const due = Math.floor((now - startedAt) / (1000 / 60));
    for (; steps < due; steps++) client.command({ viewTick: 0, steer: { keyX: 0, keyY: 1, stickX: 0, stickY: 0 }, yaw: steps / 240, pitch: 0, buttons: NET_BUTTONS.sprint });
    client.flush();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  const until = startedAt + seconds * 1000;
  while (performance.now() < until) {
    await wait(250);
    const sample = await probe();
    if (sample === null) continue;
    probes++; matched += sample.rows; worstError = Math.max(worstError, sample.error); tickMs = Math.max(tickMs, sample.tickMs);
  }
  running = false; off();
  const elapsed = (performance.now() - startedAt) / 1000, tick = client.latest?.tick ?? 0, [endX = 0, endZ = 0] = ownerPosition();
  return { tick, ticksPerSecond: (tick - startTick) / elapsed, frames, framesPerSecond: frames / elapsed, dropped: client.dropped, creatures: client.entities.size, worstError,
    step: ANIMAL_CLASS.row[0]?.step ?? 0, probes, matched, downBytesPerSecond: (transport.stats.recvBytes - down) / elapsed, upBytesPerSecond: (transport.stats.sentBytes - up) / elapsed,
    bytesPerFrame: frames === 0 ? 0 : (transport.stats.recvBytes - down) / frames, tickMs, crossOriginIsolated: globalThis.crossOriginIsolated, positionMoved: Math.hypot(endX - startX, endZ - startZ) };
}

/** A session of the shell in `/b/<from>/`, as a page of this document's build. */
async function start(slug: string, from: string): Promise<StandaloneShell> {
  const storage = saveEnvironment().storage('global');
  if (storage === null) throw new Error('No page storage');
  await import(/* @vite-ignore */ `/b/${from}/standalone/identity.js`);
  const environment = await import(/* @vite-ignore */ `/b/${from}/standalone/storage.js`) as { installBrowserSaveEnvironment: typeof installBrowserSaveEnvironment };
  environment.installBrowserSaveEnvironment();
  const shellModule = await import(/* @vite-ignore */ `/b/${from}/standalone/shell.js`) as { startStandalone: typeof startStandalone };
  return shellModule.startStandalone({ slug, base: `/shards/${slug}/`, build: window.__WS_BUILD_ID__, savePrefix: SAVE_PREFIX, storage });
}

installBrowserSaveEnvironment();
window.standaloneProof = {
  boot: async slug => {
    shell = await start(slug, window.__WS_BUILD_ID__);
    const booted = await shell.booted;
    shell.ready();
    while (shell.client.latest === null) await wait(5);
    return booted;
  },
  refused: async (slug, build) => {
    live().dispose();
    const stale = await start(slug, build);
    shell = stale;
    stale.transport.onClose(reason => { sessionStorage.setItem('proof.closed', reason); });
    await stale.booted;
    stale.ready();
    while (stale.client.closed === null) await wait(5);
    return stale.client.closed;
  },
  play,
  save: () => live().save(),
  stored: slug => saveEnvironment().storage('global')?.getItem(`${SAVE_PREFIX}standalone-${slug}`)?.length ?? 0,
};
