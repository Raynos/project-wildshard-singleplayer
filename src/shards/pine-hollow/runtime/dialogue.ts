import * as v from 'valibot';
import { NpcDialogue, type DialogueFlags } from '@wildshard/game/quest/dialogue';
import type { NpcDef } from '@wildshard/engine/quest/core';
import { RANGER } from '../quest/wardensHollow';

const KEY_DELAY = 0.15;
const Saved = v.strictObject({ dialogue: v.unknown(), elapsed: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(KEY_DELAY)) });
interface Point { readonly x: number; readonly y: number; readonly z: number }

/** An authored Pine NPC's renderer-free reading session (Hale by default). Use is the page's keyboard action; a back action or walking off cancels. */
export class PineDialogue {
  private readonly dialogue: NpcDialogue;
  private elapsed = 0;
  private readonly at: Point;
  private readonly radius: number;
  private readonly npc: NpcDef;
  constructor(flags: DialogueFlags, at: Point, radius: number, npc: NpcDef = RANGER) {
    this.npc = npc; this.dialogue = new NpcDialogue(npc, flags); this.at = at; this.radius = radius;
  }
  get active(): boolean { return this.dialogue.clock.isOpen; }
  use(): void {
    if (this.active) { if (this.elapsed >= KEY_DELAY) this.dialogue.advance(); }
    else { this.elapsed = 0; this.dialogue.open(); }
  }
  dismiss(): void { this.dialogue.cancel(); this.elapsed = 0; }
  step(dt: number, feet: Point): void {
    if (!this.active) return;
    // NpcTalk uses feet distance to the head, independently of the eye-based prompt pick.
    const x = feet.x - this.at.x, y = feet.y - this.at.y, z = feet.z - this.at.z;
    if (Math.sqrt(x * x + y * y + z * z) > this.radius + 2.5) { this.dismiss(); return; }
    this.elapsed = Math.min(KEY_DELAY, this.elapsed + dt); this.dialogue.update(dt);
  }
  snapshot(): { dialogue: ReturnType<NpcDialogue['snapshot']>; elapsed: number } | null {
    return this.active ? { dialogue: this.dialogue.snapshot(), elapsed: this.elapsed } : null;
  }
  prepareRestore(value: unknown): () => void {
    if (value === null) return () => { this.dismiss(); };
    const saved = v.parse(Saved, value), candidate = new NpcDialogue(this.npc, { has: () => false, set: () => undefined });
    candidate.restore(saved.dialogue);
    if (!candidate.clock.isOpen) throw new RangeError('A saved Pine dialogue must still be open');
    const commit = this.dialogue.prepareRestore(saved.dialogue);
    return () => { commit(); this.elapsed = saved.elapsed; };
  }
}
