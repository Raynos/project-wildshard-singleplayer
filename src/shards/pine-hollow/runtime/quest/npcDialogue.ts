import * as v from 'valibot';
import { DialogueClock } from '@wildshard/engine/quest/dialogueClock';
import { lineFor, type DialogueEntry, type NpcDef } from '@wildshard/engine/quest/core';

const Saved = v.strictObject({ version: v.literal(1), npc: v.string(),
  entry: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0))), clock: v.unknown(),
});
export interface DialogueFlags { readonly has: (flag: string) => boolean; readonly set: (flag: string) => void }

/** Renderer-free NPC dialogue: the panel's clock, authored line selection, and flags committed only on completion. */
export class NpcDialogue {
  readonly clock = new DialogueClock();
  private entry: DialogueEntry | null = null;
  private readonly npc: NpcDef;
  private readonly flags: DialogueFlags;
  constructor(npc: NpcDef, flags: DialogueFlags) { this.npc = npc; this.flags = flags; }

  open(): boolean {
    if (this.clock.isOpen) { this.advance(); return this.clock.isOpen; }
    const entry = lineFor(this.npc, this.flags);
    if (entry === null) return false;
    this.entry = entry;
    if (!this.clock.open(entry.lines)) this.finish();
    return this.clock.isOpen;
  }
  advance(): void { if (this.clock.advance() === 'finished') this.finish(); }
  update(dt: number): void { this.clock.update(dt); }
  cancel(): void { this.clock.close(); this.entry = null; }
  private finish(): void {
    const entry = this.entry; this.entry = null;
    for (const flag of entry?.sets ?? []) this.flags.set(flag);
  }
  snapshot(): { version: 1; npc: string; entry: number | null; clock: ReturnType<DialogueClock['snapshot']> } {
    return { version: 1, npc: this.npc.id, entry: this.entry === null ? null : this.npc.dialogue.indexOf(this.entry), clock: this.clock.snapshot() };
  }
  prepareRestore(value: unknown): () => void {
    const saved = v.parse(Saved, value), clock = new DialogueClock(); clock.restore(saved.clock);
    const entry = saved.entry === null ? null : this.npc.dialogue[saved.entry];
    const state = clock.snapshot();
    if (saved.npc !== this.npc.id || entry === undefined || (entry !== null) !== clock.isOpen
      || (entry !== null && (entry.lines.length !== state.lines.length || entry.lines.some((line, i) => line !== state.lines[i])))) {
      throw new RangeError('Incompatible NPC dialogue continuation');
    }
    const commit = this.clock.prepareRestore(state);
    return () => { commit(); this.entry = entry; };
  }
  restore(value: unknown): void { this.prepareRestore(value)(); }
}
