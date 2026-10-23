import { ActorProjectionV2 } from '../../src/game/population/actorProjectionV2';
import { actorProjection } from '../../src/shards/nalati-grasslands/generators/actorProjection';
import { parse } from 'valibot';
import { CreatureGuestSchema } from '../../src/format/speciesBookRows';
import generated from '../../src/shards/nalati-grasslands/data/species.generated.json' with {type:'json'};
export const projection=new ActorProjectionV2('balbal',actorProjection(parse(CreatureGuestSchema,generated.presentation.guest)));
export const BALBAL_SPECIES=projection.binding;
export function program():ReturnType<ActorProjectionV2['program']>{return projection.program();}
