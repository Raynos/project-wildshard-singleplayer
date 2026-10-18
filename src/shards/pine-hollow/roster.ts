import { registerPackedGeometrySource } from '@wildshard/sdk/models/geometrySources';
import { resourceScope } from '@wildshard/engine/app/resources';
import { HeldEquipment } from '@wildshard/game/plugin/heldEquipment';
/**
 * Pine Hollow's live models (E306 / E315 M5, `ShardManifest.roster`): every creature the Hollow can spawn — its fauna's deer,
 * boars, elk and bears on the species rigs wearing the generated hulls, the Antler King (before he comes out at night too),
 * the ravens, the owl, the woodpecker and the hares — the hamlet's people and the gear its player holds. Listed in the
 * Model Explorer at boot (src/engine/models/roster.ts); the Hollow keeps spawning, drawing and animating every copy as before.
 *
 * `pipeline`: a generated mesh on a code rig lists its generator(s) first, then 'code'; a GLB posed in a shader (the
 * birds) is its generator alone.
 */
import { live, type RosterEntry } from '@wildshard/engine/models/live';
import { swimHands } from '@wildshard/engine/models/swimHands';
import { loadFirstPartyProduct } from '@wildshard/game/shardfile/runtimeProduct';
import { antlerKing } from './runtime/models/antlerKing';
import { PosedDraw } from '@wildshard/sdk/looks/posedInstances';
import { FigureCatalogue } from '@wildshard/sdk/npc/figures';
import { heldGear } from '@wildshard/game/models/heldGear';
import { HeldFinishes } from '@wildshard/game/loadout/finishes';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';

export const PINE_FIGURES = new FigureCatalogue('pine-hollow', 'people/catalogue.json');

/** the small wildlife's copies (src/shards/pine-hollow/life/index.ts, one instanced draw): N_RAVEN 4 at the kills + N_GUIDE 3
 *  breadcrumb ravens, the owl, the woodpecker, N_HARE 5 hares */


function roster(wildlife: readonly RosterEntry[], gear: readonly RosterEntry[]): readonly RosterEntry[] {

  return [
    // the boss (src/shards/pine-hollow/combat/antlerKing.ts): at night in the King's clearing; parked out of the herd list by day
    live(antlerKing, { planned: 1 }),
    // the birds and the hares (src/shards/pine-hollow/life/index.ts)
    ...wildlife,
    // the people (src/shards/pine-hollow/quest/index.ts): one each, the generated person skinned on its code rig
    ...(['ranger', 'miller', 'trader'] as const).map(id => live(PINE_FIGURES.model(id), { copies: 1 })),
    // the gear its player holds (the crossbow and its bolts, the lever-action, the Warden's longbow and its arrows, the
    // skinning knife) and the gloved hands in the pond and the creek (E348)
    ...gear,
    live(swimHands, { copies: 1 }),
  ];
}

/** Admit the knife recipe before the Explorer can synchronously build its card. */
export async function preparedRoster(product?: ShardProduct): Promise<readonly RosterEntry[]> {
  const source = product ?? await loadFirstPartyProduct('pine-hollow');
  const scope = resourceScope().child('held-finish-roster');
  const pack = source.section('held/finishes').source;
  if (pack === undefined) throw new Error('Held finishes require their declared geometry source');
  registerPackedGeometrySource(scope, 'held-finishes', { ...pack, label: 'held finishes' });
  await Promise.all([PINE_FIGURES.prepare(), HeldFinishes.prepare(source, scope, 'held-finishes'), HeldEquipment.prepare(source)]);
  return roster((await PosedDraw.library(source, 'look/wildlife-draw.json')).models, heldGear(source.section('held/gear')));
}
