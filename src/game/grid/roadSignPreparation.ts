import type { Scope } from '@wildshard/engine/app/scope';
import type { ResidencyAllocator, ResidencyLease } from './allocator';
import { workSlice } from '@wildshard/engine/core/workSlice';
import type { RoadSign } from './roadLayout';
import { coverageTable } from './roadSolid';
import { roadSignPaintLayout, type RoadSignSource } from './roadSignPaint';

export interface RoadSignPreparation { readonly ready: Promise<void>; readonly get: RoadSignSource; readonly release: () => void }
/** One road bank's scoped coverage; exact original main-thread painting remains the fallback. */
export function startRoadSigns(parent: Scope, allocator: ResidencyAllocator, home: string, signs: readonly RoadSign[], phase: 'initial' | 'outer' = 'initial'): RoadSignPreparation | undefined {
  if (typeof Worker !== 'function' || typeof OffscreenCanvas !== 'function' || parent.disposed || parent.disposing) return undefined;
  const layout = roadSignPaintLayout(signs), rows = [...layout.lines.values()], signature = JSON.stringify(rows), count = layout.width * layout.height;
  if (rows.length > 2048 || count > 16 * 1024 * 1024 || signature.length > 131072) return undefined;
  // Canvas + RGBA readback + final RG8 + conversion lookup; duplicated job text is bounded too.
  const claim = { id: `product:grid:road-signs:${home}${phase === 'outer' ? ':outer' : ''}`, category: 'product' as const, owner: home,
    bytes: count * 10 + 131072 + signature.length * 4 + 1024, distance: 0, needed: true };
  const scope = parent.child(phase === 'outer' ? 'road-signs-outer' : 'road-signs'); let worker: Worker | undefined, plane: Uint8Array<ArrayBuffer> | undefined;
  let settled = false, complete: (() => void) | undefined, deadline: ReturnType<Scope['timeout']> | undefined, lease: ResidencyLease | null = null;
  const ready = new Promise<void>(resolve => { complete = resolve; }), listeners: (() => void)[] = [];
  const stop = (): void => { scope.cancelTimer(deadline); deadline = undefined; for (const forget of listeners.splice(0)) forget(); worker?.terminate(); worker = undefined; };
  const finish = (): void => { if (!settled) { settled = true; complete?.(); complete = undefined; } };
  scope.onDispose(() => { stop(); plane = undefined; lease?.release(); finish(); });
  const failed = (message: string): void => { console.warn(`[grid] worker signs use original painting: ${message}`); scope.dispose(); };
  // T10: the claim is admitted in steps. With room it is taken at once and the worker starts in this call, as before; when it
  // needs an eviction (a retained world's disposal, 114 ms in one frame of a Pine drive) the eviction runs one step at a time
  // under the frame's work slice first. Refused, the bank settles to the original painter, as before.
  const steps = allocator.reserveSteps(claim), slice = workSlice();
  const run = (): void => {
  try {
    worker = new Worker(new URL('roadSign.worker.ts', import.meta.url), { type: 'module', name: 'grid-road-signs' });
    listeners.push(scope.listen(worker, 'message', event => {
      const reply: unknown = event.data;
      if (typeof reply !== 'object' || reply === null) { failed('invalid reply'); return; }
      const pixels: unknown = Reflect.get(reply, 'pixels');
      if (!(pixels instanceof Uint8Array) || !(pixels.buffer instanceof ArrayBuffer) || pixels.length !== count * 2
        || Reflect.get(reply, 'width') !== layout.width || Reflect.get(reply, 'height') !== layout.height || plane !== undefined) { failed('unavailable or malformed plane'); return; }
      plane = new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.length); stop(); finish();
    }));
    listeners.push(scope.listen(worker, 'error', event => { event.preventDefault(); failed('worker failed'); }));
    listeners.push(scope.listen(worker, 'messageerror', () => { failed('transfer failed'); }));
    deadline = scope.timeout(30_000, () => { failed('worker deadline'); });
    const colours = { from: '#0d6b3c', to: '#e9ebe6', blueFromRed: 0.45, sentinel: { v: 1.5, colour: '#6f7378' } };
    worker.postMessage({ rows, red: coverageTable(colours, 0), green: coverageTable(colours, 1) }, { transfer: [] });
  } catch (error) { failed(error instanceof Error ? error.message : String(error)); }
  };
  const admit = async (): Promise<void> => {
    try {
      let step = steps.next();
      while (step.done !== true) {
        if (scope.disposed || scope.disposing) { steps.return(null); return; }
        if (slice.due()) await slice.yield();
        step = steps.next();
      }
      if (step.value === null) { scope.dispose(); return; }
      if (scope.disposed || scope.disposing) { step.value.release(); return; }
      lease = step.value; run();
    } catch (error) { failed(error instanceof Error ? error.message : String(error)); }
  };
  void admit();
  return { ready, get: current => settled && current.width === layout.width && current.height === layout.height
    && JSON.stringify([...current.lines.values()]) === signature ? plane : undefined, release: () => { scope.dispose(); } };
}
