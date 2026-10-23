import { app } from '../../src/engine/app/runtime';
// oxlint-disable-next-line import/no-nodejs-modules -- validate generated guest rows without inferring the complete JSON type
import { readFileSync } from 'node:fs';
import { ActorProjectionV2 } from '../../src/game/population/actorProjectionV2';
import { actorProjection } from '../../src/shards/nalati-grasslands/generators/actorProjection';
import { object, parse } from 'valibot';
import { CreatureGuestSchema } from '../../src/format/speciesBookRows';

const generated=parse(object({presentation:object({guest:CreatureGuestSchema})}),JSON.parse(readFileSync('src/shards/nalati-grasslands/data/species.generated.json','utf8')));
export const projection=new ActorProjectionV2('balbal',actorProjection(parse(CreatureGuestSchema,generated.presentation.guest)),app);
export const BALBAL_SPECIES=projection.binding;
export function program():ReturnType<ActorProjectionV2['program']>{return projection.program();}
