import { object, parse } from 'valibot';
import { CreatureGuestSchema } from '../../src/format/speciesBookRows';
import { hashImmutableBytes } from '../../src/sdk/immutable';
import { TREE_SET } from '../../src/shards/nalati-grasslands/generators/treeSet';
import { nalatiMountedFigure } from '../../src/shards/nalati-grasslands/generators/mountedFigure';
import { nalatiRidingSession } from '../../src/shards/nalati-grasslands/generators/clientRiding';
import { actorProjection } from '../../src/shards/nalati-grasslands/generators/actorProjection';
import { originalSpeciesJson } from './nalati-original-species';
import { NALATI_RIDING_PROGRAMS } from './nalati-riding';
import paint from './nalati-poi-paint-original.json' with { type: 'json' };

/** Original immutable guest metadata admitted through the complete native projection. */
export function nalatiActorAuthorRows(): ReturnType<typeof actorProjection> {
  const species = parse(object({ presentation: object({ guest: CreatureGuestSchema }) }), originalSpeciesJson('species.json'));
  return actorProjection(species.presentation.guest);
}

/** Complete source rows on original immutable POI, guest and compiled riding inputs. */
export function nalatiRowAuthorObservation() {
  return Object.entries({ tree: TREE_SET, mounted: nalatiMountedFigure(paint),
    riding: nalatiRidingSession(NALATI_RIDING_PROGRAMS), actor: nalatiActorAuthorRows() }).map(([name, value]) => {
      const bytes = new TextEncoder().encode(JSON.stringify(value));
      return { name, bytes: bytes.length, hash: hashImmutableBytes(bytes) };
    });
}
