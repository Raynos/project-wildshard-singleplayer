import { strike } from '@wildshard/sdk/species';
import { strikeFromData } from '@wildshard/engine/ai/strikeRows';
import { RAM_DATA, DIVE_DATA, BURST_DATA } from '../data/strikes';

/** Admit the native goat charge with its original motion and contact law. */
export const RAM = strikeFromData(strike(RAM_DATA));
/** Admit the native ray's world-space dive. */
export const DIVE = strikeFromData(strike(DIVE_DATA));
/** Admit the native wisp's world-space burst. */
export const BURST = strikeFromData(strike(BURST_DATA));
