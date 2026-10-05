import * as v from 'valibot';

const natural = v.pipe(v.number(), v.finite(), v.integer(), v.minValue(0));
const duration = v.pipe(v.number(), v.finite(), v.minValue(0));
const continuation = v.strictObject({ runId: v.string(), elapsed: duration, index: natural, cycles: natural,
  stepSpent: duration, holdSpent: v.nullable(duration), lastResidents: v.array(v.string()), entered: v.boolean(),
  events: v.array(v.record(v.string(), v.unknown())) });
/** Only a witnessed planned exit may continue a route across documents; a tab kill is a failed run. */
export function resumeSoakDocument(input: unknown, runId: string, waypoints: number, planned: boolean): v.InferOutput<typeof continuation> {
  const value = v.parse(continuation, input);
  if (!planned || value.runId !== runId || value.index >= waypoints || value.elapsed >= 1800) throw new Error('Unexpected soak document replacement');
  return value;
}

/** Boot windows are loading evidence, reported separately from active-play frame cadence. */
export class SoakDocuments {
  private document: string | null = null;
  private bootAt: number | null = null;
  readonly boots: { document: string; start: number; end: number; seconds: number }[] = [];
  constructor(private readonly reloads: boolean) {}
  observe(document: string, now: number): boolean {
    if (this.document === document) return false;
    if (this.document !== null && !this.reloads) throw new Error('Document changed during the continuous soak');
    this.document = document; this.bootAt = now; return true;
  }
  ready(now: number): void {
    if (this.document === null || this.bootAt === null) throw new Error('No observed soak boot');
    if (now < this.bootAt) throw new Error('Soak boot clock moved backwards');
    this.boots.push({ document: this.document, start: this.bootAt, end: now, seconds: now - this.bootAt });
    this.bootAt = null;
  }
}
