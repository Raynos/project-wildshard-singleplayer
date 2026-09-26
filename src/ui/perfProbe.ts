/**
 * The on-device perf probe (E142, the heavy GPU lane): where a real phone's frame goes, measured ON the phone.
 *
 * The desktop rulers (scripts/pine-hollow-gpu.mjs) time the WebGL frame on the M5 — 1.9 ms at the iPhone's own pixel
 * count, ~37× under Jake's 71 ms, while the A18's GPU is only ~7–9× narrower; the iOS Simulator runs the same frame's
 * JavaScript (Safari's JSC) in 3.8 ms. What the rest is (the GPU under thermal load, iOS compositing, WebKit's WebGL
 * path) can only be read on the device. This does it in ~60 s, from the fps pill's panel (developer mode: tap the pill ▸
 * RUN PROBE) or `?probe=1` (runs 15 s after the world is entered):
 *
 *   as played        the 30 fps cap as it is
 *   uncapped         no 30 fps cap: the frame's real cost (every row below is uncapped too)
 *   no HUD blur      every backdrop-filter off (the HUD glass, the touch discs)
 *   no HUD           the whole DOM HUD hidden (iOS compositing of the overlay)
 *   flat terrain     the ground's splat shader swapped for a flat-coloured lit material (the splat fetches + noise)
 *   no cards         the forest's needle cards hidden (the alpha-tested crown layers)
 *   no cover …       (E189, Driftwood) the ground cover hidden: all of it, its near set, its far set; `no terrain` the island's
 *                    terrain; `no viewmodel` the first-person hands and weapon. A row with nothing to hide on the shard is left out
 *                    (as are `flat terrain` / `no cards` off Pine Hollow).
 *   no shadows       the shadow map not redrawn
 *   no post          the scene straight to the canvas (no colour chain, bloom, god rays, SMAA)
 *   no scene         nothing drawn but the post chain (the floor: JS + post + compositing)
 *
 * Every row renders at the game's own fixed render scale (the phone's 2×): resolution is not a lever (E142, Jake:
 * dynamic resolution is "a complete bullshit hack") — the rows isolate real costs to cut at 2×.
 *
 * Per row: fps, the frame's p50 (ms between drawn frames), the main thread's p50 (input → the frame submitted: all the
 * JavaScript, three's draw submission included), and `wait` = frame − main thread (≈ the GPU / compositor the next frame
 * waited for). A row that drops `wait` a lot names the bottleneck. Nothing is saved: every switch is restored at the end.
 */
import * as THREE from 'three';
import type { Game } from '../core/Game';
import { frameProbe } from '../core/tier';

export interface ProbeRow { phase: string; fps: number; frameMs: number; jsMs: number; waitMs: number; frames: number }

const SETTLE_MS = 1800, MEASURE_MS = 4500;

interface Phase { name: string; set: (on: boolean) => void; /** false = nothing on this shard to switch: the row is left out */ applies?: () => boolean }

/** the scene's top-level objects named `name` (Driftwood's 'ground-cover', 'blender-island') */
function topNamed(scene: THREE.Object3D, name: string): THREE.Object3D[] { return scene.children.filter((o) => o.name === name); }

/** a row that hides `targets()` while it runs (E189: the Driftwood rows) */
function hideRow(name: string, targets: () => THREE.Object3D[]): Phase {
  const hidden: THREE.Object3D[] = [];
  return {
    name, applies: () => targets().length > 0,
    set: (on) => {
      if (on) { for (const o of targets()) { if (o.visible) { o.visible = false; hidden.push(o); } } }
      else { for (const o of hidden) o.visible = true; hidden.length = 0; }
    },
  };
}

/** the scene's visible meshes whose material's program key passes `key` (the terrain's 'terrain-splat*', the forest's 'needles*') */
function meshesByProgram(scene: THREE.Object3D, key: (k: string) => boolean): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  const isMesh = (o: THREE.Object3D): o is THREE.Mesh => (o as Partial<THREE.Mesh>).isMesh === true;
  scene.traverse((o) => {
    if (!isMesh(o)) return;
    const m: unknown = o.material;
    if (m instanceof THREE.Material && key(m.customProgramCacheKey())) out.push(o);
  });
  return out;
}

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
  const passes = composer.passes;
  const first = passes[0];
  // the terrain's stand-in: lit like the ground (PBR, rough), no splat fetches, no noise
  const plain = new THREE.MeshStandardMaterial({ color: 0x5a5040, roughness: 1, metalness: 0 });
  const swapped = new Map<THREE.Mesh, THREE.Mesh['material']>(), hiddenCards: THREE.Mesh[] = [];
  const phases: Phase[] = [
    { name: 'as played', set: () => undefined },
    { name: 'uncapped', set: () => undefined },
    { name: 'no HUD blur', set: (on) => { style.textContent = on ? '* { -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }' : ''; } },
    { name: 'no HUD', set: (on) => { if (hud) hud.style.visibility = on ? 'hidden' : ''; } },
    {
      name: 'flat terrain', applies: () => meshesByProgram(game.scene, (k) => k.startsWith('terrain-splat')).length > 0, set: (on) => {
        if (on) {
          for (const m of meshesByProgram(game.scene, (k) => k.startsWith('terrain-splat'))) { swapped.set(m, m.material); m.material = plain; }
        } else { for (const [m, mat] of swapped) m.material = mat; swapped.clear(); }
      },
    },
    {
      name: 'no cards', applies: () => meshesByProgram(game.scene, (k) => k.startsWith('needles')).length > 0, set: (on) => {
        if (on) { for (const m of meshesByProgram(game.scene, (k) => k.startsWith('needles'))) { if (m.visible) { m.visible = false; hiddenCards.push(m); } } }
        else { for (const m of hiddenCards) m.visible = true; hiddenCards.length = 0; }
      },
    },
    // E189 (Driftwood, the warm phone's grass frame): the ground cover, its near and far sets, the island's terrain, the viewmodel
    hideRow('no cover', () => topNamed(game.scene, 'ground-cover')),
    hideRow('no near cover', () => topNamed(game.scene, 'ground-cover').flatMap((g) => g.children.filter((o) => o.name.startsWith('ground-cover-') && !o.name.endsWith('-far') && !o.name.includes('driftwood')))),
    hideRow('no far cover', () => topNamed(game.scene, 'ground-cover').flatMap((g) => g.children.filter((o) => o.name.endsWith('-far')))),
    hideRow('no terrain', () => topNamed(game.scene, 'blender-island')),
    hideRow('no viewmodel', () => [...game.camera.children]),
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
    for (const [i, ph] of phases.filter((x) => x.applies?.() ?? true).entries()) {
      // row 0 as played; every other row uncapped
      frameProbe.uncapped = i !== 0;
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
    frameProbe.uncapped = false;
    style.remove();
    plain.dispose();
    running = false;
  }
  return rows;
}

/** the rows as fixed-width lines for the panel / console */
export function probeLines(rows: readonly ProbeRow[], header: string): string[] {
  const pad = (s: string, n: number) => s.padEnd(n).slice(0, n);
  return [header, `${pad('', 14)}  fps  frame   js  wait`, ...rows.map((x) => `${pad(x.phase, 14)} ${x.fps.toFixed(0).padStart(4)} ${x.frameMs.toFixed(1).padStart(6)} ${x.jsMs.toFixed(1).padStart(4)} ${x.waitMs.toFixed(1).padStart(5)}`)];
}
