// The bake page of scripts/bake-coats.mjs for Pine Hollow (SF87, G320): bundled on its own and run on a page that serves
// only public/, it loads Pine's rigged hulls (data/hulls.ts and their committed rig GLBs), registers the kit species and Pine's
// own species rows whose variants the coats paint (game/systems/species/install.ts, species/rows.ts) and paints every coat that repaints its hull with the game's
// own coat painter (game/systems/looks/riggedHulls.ts coatSources). No game, no level, no shard runtime or legacy code.
import { app } from '../../../engine/app/runtime';
import { Scope } from '../../../engine/app/scope';
import { hasSpecies } from '../../../engine/entities/species/registry';
import { installKitSpecies } from '../../../game/systems/species/install';
import { riggedHulls } from '../runtime/looks/riggedHulls';
import { PINE_HULLS, type RiggedHullsRow } from '../data/creatureHulls';
import { pineCoatUrl, pineCreatureRigUrl } from '../species/rigs';
import { PINE_BEAR_LOOK, PINE_BOAR_LOOK, pineElkLook } from '../species/looks';
import { PINE_SPECIES, pineElk } from '../species/rows';

/**
 * The row without the hulls of species only Pine's runtime registers (the Antler King), each checked to wear its own
 * coat (its coat's source is its own variant), so leaving it out drops no baked coat. A runtime-only species whose coat
 * repaints its hull would need a species row outside runtime/ first: that throws.
 */
function bakeableRow(row: RiggedHullsRow): RiggedHullsRow {
  const hulls = Object.fromEntries(Object.entries(row.hulls).filter(([kv, hull]) => {
    const [kind = '', variant = ''] = kv.split(':');
    if (hasSpecies(kind)) return true;
    const source = Object.entries(row.coats).find(([name]) => name === hull)?.[1].source;
    if (source?.[0] === kind && source[1] === variant) return false;
    throw new Error(`coat bake: ${kv} repaints hull ${hull}, but species ${kind} is registered only by runtime code`);
  }));
  return { ...row, hulls };
}

/** Paint Pine's coats for one tier: each as a lossless PNG data URL keyed by its KTX2 table name. */
export async function bakePineCoats(tier: 'phone' | 'desktop'): Promise<{ url: string; png: string }[]> {
  installKitSpecies();
  // Pine's own species rows and looks (its boar's and elk's night thralls: their tint and traits), registered as the
  // shard's level context does; the Antler King's look and row are runtime-only and wear their own coat (bakeableRow)
  const scope = new Scope('pine-coat-bake');
  app.levelScope = scope;   // the rows resolve for the active level; this page's only "level" is the bake
  for (const row of [...PINE_SPECIES, pineElk()]) app.species.registerRow(row, scope);
  for (const look of [PINE_BOAR_LOOK, PINE_BEAR_LOOK, pineElkLook()]) app.species.registerLook(look, scope);
  const family = riggedHulls(bakeableRow(PINE_HULLS), { rig: (hull) => pineCreatureRigUrl(hull, tier), coat: (hull, kind, variant) => pineCoatUrl(hull, kind, variant, tier) });
  await family.preload();
  return family.coatSources();
}

Object.assign(window, { bakePineCoats });
