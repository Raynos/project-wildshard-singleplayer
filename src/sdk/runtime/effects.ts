import { bindPlayerEffects as platformBindPlayerEffects } from '@wildshard/engine/combat/effects/EffectService';

/** Independent status-effect movement channels, separate from equipment and traversal multipliers. */
export type StatusMovement = Parameters<typeof platformBindPlayerEffects>[0]['movement'];
/** Scope-owned platform binding for status movement, periodic damage and death cleanup; installs only when called. */
export const bindPlayerEffects: typeof platformBindPlayerEffects = platformBindPlayerEffects;
