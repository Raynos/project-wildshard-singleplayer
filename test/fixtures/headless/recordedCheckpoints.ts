import type { HeadlessCommand } from '../../../src/sdk/tickProtocol';
import type { HeadlessTapeSegment } from '../../../src/sdk/headlessTape';

interface Mark { id: string; tick: number; flags: string[] }
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void } {
  let accept: (value: T) => void = () => { throw new Error('Deferred owner not installed'); };
  let refuse: (error: unknown) => void = () => { throw new Error('Deferred owner not installed'); };
  const promise = new Promise<T>((resolve, reject) => { accept = resolve; refuse = reject; });
  return { promise, resolve: accept, reject: refuse };
}
type Publication = { kind: 'parts'; segments: HeadlessTapeSegment[]; gate: ReturnType<typeof deferred<void>> }
  | { kind: 'done' } | { kind: 'error'; error: unknown };

/** Bridge a real native recorder's existing checkpoint fences to one streamed
 * replay. The recorder pauses only at its own marks, and resumes after the
 * previous part has been offered to the replay owner. No commands are invented. */
export function recordedCheckpoints(run: (tick: (commands: HeadlessCommand[]) => void, mark: (id: string) => Promise<void>) => Promise<void>,
  step: (commands: readonly HeadlessCommand[]) => void, flags: () => readonly string[]): {
    parts: AsyncGenerator<HeadlessTapeSegment, void, void>; marks: readonly Mark[]; ticks: () => number; stop: () => Promise<void>;
  } {
  const marks: Mark[] = [];
  let frames: HeadlessCommand[][] = [], ticks = 0, start = 0, stopped = false;
  let pending = deferred<Publication>(), gate: ReturnType<typeof deferred<void>> | undefined;
  const recording = (async () => {
    try {
      await run(commands => {
        if (stopped) throw new Error('Native recording owner ended');
        if (ticks >= 60_000) throw new Error('Story exceeds the admitted tape allowance');
        frames.push(structuredClone(commands)); ticks++; step(commands);
      }, async id => {
        const segments: HeadlessTapeSegment[] = [], captured = frames; frames = [];
        marks.push({ id, tick: ticks, flags: [...flags()] });
        let offset = 0;
        while (ticks - start > 18_000) {
          segments.push({ id: `walk-${start}`, ticks: 18_000, commands: [], frames: captured.slice(offset, offset + 18_000) });
          start += 18_000; offset += 18_000;
        }
        segments.push({ id, ticks: ticks - start, commands: [], frames: captured.slice(offset) }); start = ticks;
        const waiting = deferred<void>(); gate = waiting;
        pending.resolve({ kind: 'parts', segments, gate: waiting });
        try { await waiting.promise; } finally { if (gate === waiting) gate = undefined; }
      });
      pending.resolve({ kind: 'done' });
    } catch (error) { pending.resolve({ kind: 'error', error }); }
  })();
  const stop = async (): Promise<void> => { stopped = true; gate?.reject(new Error('Native recording owner ended')); await recording; };
  async function* parts(): AsyncGenerator<HeadlessTapeSegment, void, void> {
    try {
      for (;;) {
        const next = await pending.promise; pending = deferred<Publication>();
        if (next.kind === 'done') return;
        if (next.kind === 'error') throw next.error;
        for (const segment of next.segments) yield segment;
        next.gate.resolve(undefined);
      }
    } finally { await stop(); }
  }
  return { parts: parts(), marks, ticks: () => ticks, stop };
}
