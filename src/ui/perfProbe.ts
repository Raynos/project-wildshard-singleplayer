/**
 * The on-device perf probe (E142, the heavy GPU lane): where a real phone's frame goes, measured ON the phone.
 *
 * The desktop rulers (scripts/pine-hollow-gpu.mjs) time the WebGL frame on the M5 — 1.9 ms at the iPhone's own pixel
 * count, ~37× under Jake's 71 ms, while the A18's GPU is only ~7–9× narrower; the iOS Simulator runs the same frame's
 * JavaScript (Safari's JSC) in 3.8 ms. What the rest is (the GPU under thermal load, iOS compositing, WebKit's WebGL
 * path) can only be read on the device. This does it in ~60 s, from the fps pill's panel (developer mode: tap the pill ▸
 * RUN PROBE) or `?probe=1` (runs 15 s after the world is entered):
 *
 *   as played        the cap and dynamic resolution as they are
 *   uncapped         no 30 fps cap, dynamic resolution off: the frame's real cost (every row below is uncapped too)
 *   no HUD blur      every backdrop-filter off (the HUD glass, the touch discs)
 *   no HUD           the whole DOM HUD hidden (iOS compositing of the overlay)
 *   scale 1.0        the canvas at pixel ratio 1 (fill-rate: GPU pixel work)
 *   no shadows       the shadow map not redrawn
 *   no post          the scene straight to the canvas (no colour chain, bloom, god rays, SMAA)
 *   no scene         nothing drawn but the post chain (the floor: JS + post + compositing)
 *
 * Per row: fps, the frame's p50 (ms between drawn frames), the main thread's p50 (input → the frame submitted: all the
 * JavaScript, three's draw submission included), and `wait` = frame − main thread (≈ the GPU / compositor the next frame
 * waited for). A row that drops `wait` a lot names the bottleneck. Nothing is saved: every switch is restored at the end.
 */
import type { Game } from '../core/Game';
import { overrideSetting } from './Settings';

export interface ProbeRow { phase: string; fps: number; frameMs: number; jsMs: number; waitMs: number; frames: number }

const SETTLE_MS = 1800, MEASURE_MS = 4500;

interface Phase { name: string; set: (on: boolean) => void }

/** p50 of the last `count` slots of a ring that ends (exclusive) at `end` */
function lastP50(ring: Float32Array, end: number, count: number): number {
  const n = Math.min(count, ring.length), v: number[] = [];
  for (let i = 1; i <= n; i++) v.push(ring[(end - i + ring.length * 2) % ring.length] ?? 0);
  v.sort((a, b) => a - b);
  return v[Math.floor(v.length / 2)] ?? 0;
}

let running = false;

/** run the probe; `progress` gets a line per step, the promise the rows */
export async function runPerfProbe(game: Game, progress: (line: string) => void): Promise<ProbeRow[]> {
  if (running) return [];
  running = true;
  const sleep = (ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); });
  const r = game.renderer, composer = game.composer, hud = document.getElementById('hud');
  const style = document.createElement('style');
  document.head.append(style);
  const ratio = r.getPixelRatio();
  const passes = composer.passes;
  const first = passes[0];
  const phases: Phase[] = [
    { name: 'as played', set: () => undefined },
    { name: 'uncapped', set: () => undefined },
    { name: 'no HUD blur', set: (on) => { style.textContent = on ? '* { -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }' : ''; } },
    { name: 'no HUD', set: (on) => { if (hud) hud.style.visibility = on ? 'hidden' : ''; } },
    { name: 'scale 1.0', set: (on) => { r.setPixelRatio(on ? 1 : ratio); game.resize(); } },
    { name: 'no shadows', set: (on) => { r.shadowMap.autoUpdate = !on; } },
    {
      name: 'no post', set: (on) => {
        for (const p of passes) if (p !== first) p.enabled = !on;
        if (first) first.renderToScreen = on;
      },
    },
    { name: 'no scene', set: (on) => { game.scene.visible = !on; } },
  ];
  const rows: ProbeRow[] = [];
  try {
    for (const [i, ph] of phases.entries()) {
      // row 0 as played; every other row uncapped, dynamic resolution held at the full scale
      overrideSetting('fps', i === 0 ? null : '60');
      overrideSetting('dynres', i === 0 ? null : 'off');
      ph.set(true);
      progress(`${i + 1}/${phases.length} ${ph.name}…`);
      await sleep(SETTLE_MS);
      const n0 = game.frameCount, t0 = performance.now();
      await sleep(MEASURE_MS);
      const frames = game.frameCount - n0, secs = (performance.now() - t0) / 1000;
      const frameMs = lastP50(game.frameMs, game.frameI, frames), jsMs = lastP50(game.workMs, game.frameI, frames);
      rows.push({ phase: ph.name, fps: frames / secs, frameMs, jsMs, waitMs: Math.max(0, frameMs - jsMs), frames });
      ph.set(false);
    }
  } finally {
    for (const ph of phases) ph.set(false);
    overrideSetting('fps', null); overrideSetting('dynres', null);
    style.remove();
    running = false;
  }
  return rows;
}

/** the rows as fixed-width lines for the panel / console */
export function probeLines(rows: readonly ProbeRow[], header: string): string[] {
  const pad = (s: string, n: number) => s.padEnd(n).slice(0, n);
  return [header, `${pad('', 12)}  fps  frame   js  wait`, ...rows.map((x) => `${pad(x.phase, 12)} ${x.fps.toFixed(0).padStart(4)} ${x.frameMs.toFixed(1).padStart(6)} ${x.jsMs.toFixed(1).padStart(4)} ${x.waitMs.toFixed(1).padStart(5)}`)];
}
