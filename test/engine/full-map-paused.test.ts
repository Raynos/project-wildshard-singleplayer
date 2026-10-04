// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { app } from '../../src/engine/app/runtime';
import { installScopeEnvironment } from '../../src/engine/app/scopeEnvironment';
import { FullMap } from '../../src/engine/ui/Map';
import { Minimap } from '../../src/engine/ui/Minimap';

// E440: BAG ▸ MAP was a black frame on every shard. The menu pauses the app (Menu.open), a paused app runs no update phase
// (Game.runPhase, E357 F8), and the full map only drew when the play loop's update phase called it. It draws on its own
// frames while open now, from the last pose the play loop gave it.

const frames: ((time: number) => void)[] = [];
const drawn: { canvas: HTMLCanvasElement; source: unknown }[] = [];
/** a 2d context that accepts every call; drawImage is recorded with the canvas it drew on */
function context(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const image = (w: number, h: number): ImageData => ({ data: new Uint8ClampedArray(Math.max(1, w * h) * 4), width: w, height: h, colorSpace: 'srgb' });
  const surface: Record<string | symbol, unknown> = {
    canvas,
    drawImage: (source: unknown) => { drawn.push({ canvas, source }); },
    getImageData: (_x: number, _y: number, w: number, h: number) => image(w, h),
    createImageData: (w: number, h: number) => image(w, h),
    measureText: () => ({ width: 10 }),
    createRadialGradient: () => ({ addColorStop: () => undefined }),
    createLinearGradient: () => ({ addColorStop: () => undefined }),
    createPattern: () => null,
  };
  return new Proxy(surface, {
    get: (target, key) => (key in target ? target[key] : () => undefined),
    set: (target, key, value) => { target[key] = value; return true; },
  }) as CanvasRenderingContext2D;
}

const maps: Minimap[] = [], fullMaps: FullMap[] = [];
beforeEach(() => {
  frames.length = 0; drawn.length = 0;
  installScopeEnvironment({ targetKind: () => 'other', frame: (fn) => frames.push(fn), cancelFrame: () => undefined });
  const contexts = new WeakMap<HTMLCanvasElement, CanvasRenderingContext2D>();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function getContext(this: HTMLCanvasElement) {
    let ctx = contexts.get(this);
    if (!ctx) { ctx = context(this); contexts.set(this, ctx); }
    return ctx;
  } as HTMLCanvasElement['getContext']);
});
afterEach(() => {
  for (const full of fullMaps.splice(0)) full.scope.dispose();
  for (const map of maps.splice(0)) map.scope.dispose();
  document.body.replaceChildren(); vi.restoreAllMocks();
});

function step(): void { for (const fn of frames.splice(0)) fn(performance.now()); }

it('draws the ground on its own frames while open, with the app paused under the menu', () => {
  const map = new Minimap(), full = new FullMap(map); maps.push(map); fullMaps.push(full);
  document.body.append(full.root);
  full.update({ x: 10, z: -20 }, 0.5);  // the last frame of play before the menu opened
  app.setState('paused');               // what Menu.open does: no update phase runs from here on
  full.show();
  step();
  const onMap = drawn.filter((d) => d.canvas.parentElement === full.root);
  expect(onMap.map((d) => d.source)).toContain(map.layers.terrain);
  drawn.length = 0;
  step();                                // and every frame after, while it stays open
  expect(drawn.some((d) => d.canvas.parentElement === full.root)).toBe(true);
  full.hide();
  drawn.length = 0;
  step();
  expect(frames).toEqual([]);            // closed: no frame loop left behind
  expect(drawn).toEqual([]);
});
