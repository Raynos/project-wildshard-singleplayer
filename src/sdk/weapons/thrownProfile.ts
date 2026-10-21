import type { InferOutput } from 'valibot';
import type { ThrownWeaponProfileSchema } from '@wildshard/format/weaponProfiles';

// only *-legacy imports this; deleted with the legacy copies (SHARD-PLATFORM-NEXT N5)
export type ThrownProfile = Omit<InferOutput<typeof ThrownWeaponProfileSchema>, 'family'> & { id: `weapon.${string}` };
