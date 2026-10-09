import { CARD_BASE64 } from '../data/card';
import { assetBytes } from '@wildshard/sdk/assets';

/** Browser/Node byte intake stays outside the JSON-only authored data folder. */
export const CARD_BYTES = assetBytes(CARD_BASE64);
