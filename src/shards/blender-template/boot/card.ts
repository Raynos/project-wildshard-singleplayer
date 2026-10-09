import { CARD_BASE64 } from '../data/card';

/** Browser/Node byte intake stays outside the JSON-only authored data folder. */
export const CARD_BYTES = Uint8Array.from(atob(CARD_BASE64), character => character.codePointAt(0) ?? 0);
