import * as v from 'valibot';

const finite = v.pipe(v.number(), v.finite());
const Saved = v.strictObject({ version: v.literal(1),
  lines: v.pipe(v.array(v.pipe(v.string(), v.maxLength(8192))), v.maxLength(128)),
  index: v.pipe(finite, v.integer(), v.minValue(0)), shown: v.pipe(finite, v.minValue(0)), open: v.boolean(),
});
export type DialogueSaved = v.InferOutput<typeof Saved>;
export type DialogueAdvance = 'inactive' | 'typing' | 'line' | 'finished';

/** The dialogue panel's type-out and advance law, without UI, input or a completion callback. */
export class DialogueClock {
  private lines: readonly string[] = [];
  private i = 0;
  private shown = 0;
  private active = false;
  get isOpen(): boolean { return this.active; }
  get index(): number { return this.i; }
  get count(): number { return this.lines.length; }
  get line(): string { return this.lines[this.i] ?? ''; }
  get text(): string { return this.line.slice(0, Math.floor(this.shown)); }

  /** Empty dialogue completes immediately without replacing an already open panel. */
  open(lines: readonly string[]): boolean {
    if (lines.length === 0) return false;
    this.lines = lines; this.i = 0; this.shown = 0; this.active = true;
    return true;
  }
  advance(): DialogueAdvance {
    if (!this.active) return 'inactive';
    const cur = this.line;
    if (this.shown < cur.length) { this.shown = cur.length; return 'typing'; }
    this.i++; this.shown = 0;
    if (this.i >= this.lines.length) { this.active = false; return 'finished'; }
    return 'line';
  }
  close(): void { this.active = false; }
  /** Returns whether the panel previously still had typing to render, including a zero-delta frame. */
  update(dt: number, cps = 60): boolean {
    if (!this.active || this.shown >= this.line.length) return false;
    this.shown = Math.min(this.line.length, this.shown + dt * cps);
    return true;
  }
  snapshot(): DialogueSaved { return v.parse(Saved, { version: 1, lines: this.lines, index: this.i, shown: this.shown, open: this.active }); }
  prepareRestore(value: unknown): () => void {
    const saved = v.parse(Saved, value), line = saved.lines[saved.index] ?? '';
    if (saved.index > saved.lines.length || (saved.open && saved.index >= saved.lines.length) || saved.shown > line.length) {
      throw new RangeError('Invalid dialogue continuation');
    }
    return () => { this.lines = saved.lines; this.i = saved.index; this.shown = saved.shown; this.active = saved.open; };
  }
  restore(value: unknown): void { this.prepareRestore(value)(); }
}
