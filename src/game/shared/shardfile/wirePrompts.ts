/** What a page's traversal prompts name on the wire: a server has no prompt row for these, so both sides spell the id from a row they each hold. */
export const carryPrompt = (mover: string, end: number): string => `${mover}.ride.${String(end)}`;
/** A socket lift's deck, by the call it takes. */
export const liftPrompt = (mover: string, action: 1 | 2 | 3): string => `${mover}.lift.${String(action)}`;
