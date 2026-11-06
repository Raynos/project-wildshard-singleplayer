/** What a page's traversal prompts name on the wire: a server has no prompt row for these, so both sides spell the id from a row they each hold. */
export const carryPrompt = (mover: string, end: number): string => `${mover}.ride.${String(end)}`;
/** The view calls an elite's ground tells go by. */
export const ELITE_TELL = { lane: 'elite.tell.lane', ring: 'elite.tell.ring', cue: 'elite.cue', hit: 'elite.hit' } as const;
/** One slot of a thrown volley, as a script row. */
export const volleyRow = (owner: string, slot: number): string => `volley.${owner}.${String(slot)}`;
/** A socket lift's deck, by the call it takes. */
export const liftPrompt = (mover: string, action: 1 | 2 | 3): string => `${mover}.lift.${String(action)}`;
