import { strike } from '@wildshard/sdk/species';
import authored from '../data/strikes.json' with { type: 'json' };

/** The seven original authored strikes, admitted before native gameplay construction. */
export const STRIKES = { snap: strike(authored.snap), bite: strike(authored.bite), coconut: strike(authored.coconut),
  sailor: strike(authored.sailor), swing: strike(authored.swing), second: strike(authored.second), burst: strike(authored.burst) };
