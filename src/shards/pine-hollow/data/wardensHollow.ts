/** Existing durable quest and lantern identities shared by live owners. */
export const QUEST_DONE = 'quest:warden-done';
/** the lanterns' flags (index.ts raises them at the waystone prompts; PineLandmarks.setLit follows them) */
export const LANTERN_FLAGS = ['lit:pond', 'lit:ridge', 'lit:den'] as const;
export type LanternId = 'pond' | 'ridge' | 'den';
