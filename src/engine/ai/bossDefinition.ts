/** An authored encounter can opt out of introductions, seals, checkpoints and runtime rewards. */
export interface BossDef {
  id: string; name: string; title?: string;
  arena: { at: string; r: number }; wake: { flag: string };
  intro: null; seal: boolean; checkpoint: boolean; bar: 'boss';
  phases: readonly { at: number; strikes: readonly string[]; name?: string; caption?: string }[];
  reward: null; persist: { deadFlag: string }; capExempt: boolean;
}
