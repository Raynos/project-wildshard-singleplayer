import type { EffectDef } from '@wildshard/engine/combat/effects/types';
import { STARTER_EFFECT_ROWS } from './starter.generated';

/** Existing starter tuning; only the authored stun is applied by normal play, and importing installs no effects. */
export const STARTER_EFFECTS: readonly EffectDef[] = STARTER_EFFECT_ROWS;
