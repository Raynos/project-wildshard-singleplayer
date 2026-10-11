import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

/** the declared movers (the moored boat, the rope bridge's chain) are runtime bodies: they place no quest spot */
const MOVERS = new Set(['src/shards/driftwood-isle/data/movers.ts']);

/**
 * Exact source inputs of Driftwood Isle's quest spots (runtime/spots.baked.json, read off the built page by
 * src/shards/driftwood-isle/generators/bake-driftwood-spots.mjs): the interactables table and the adventure that places it (quest/), the POI modules
 * whose anchors and floors it stands on (world/, data/), Wendell (npc/), the finale's reward spot, the shard's config and
 * manifest, the kit's own placement (engine Interactables) and the physics ground. A changed input refuses the bake until
 * it is re-read from the page (SF72).
 */
export function driftwoodSpotsInputs(root) {
  const paths = ['shard.config.ts', 'manifest.ts', 'runtime/ziplineLayout.ts', 'runtime/finalePresentation.ts'].map(path => `src/shards/driftwood-isle/${path}`);
  paths.push('src/shards/driftwood-isle/generators/bake-driftwood-spots.mjs', 'src/shards/driftwood-isle/generators/bake-driftwood-physics.mjs', 'src/shards/driftwood-isle/generators/driftwoodSpots.mjs', 'src/shards/driftwood-isle/loadout/rows.ts', 'src/shards/driftwood-isle/loot/presentation.ts', 'src/game/loot/ui/ShopPanel.ts', 'src/shards/driftwood-isle/weapons/IronSword.ts', 'src/engine/world/skyBackdrop.ts', 'src/engine/world/interact/Interactables.ts', 'src/engine/world/interact/prompts.ts', 'src/engine/world/interact/pickup.ts', 'src/engine/physics/terrain.ts');
  paths.push('src/shards/driftwood-isle/runtime/kit/kitParts.ts', 'src/shards/driftwood-isle/runtime/looks/bakedIsland.ts', 'src/shards/driftwood-isle/runtime/looks/boatLook.ts', 'src/shards/driftwood-isle/runtime/looks/cascade.ts', 'src/shards/driftwood-isle/runtime/looks/castawayLook.ts', 'src/shards/driftwood-isle/runtime/looks/coverGlsl.ts', 'src/shards/driftwood-isle/runtime/looks/coverGrid.ts', 'src/shards/driftwood-isle/runtime/looks/facetedDay.ts', 'src/shards/driftwood-isle/runtime/looks/facetedDayBackdrop.ts', 'src/shards/driftwood-isle/runtime/looks/facetedGround.ts', 'src/shards/driftwood-isle/runtime/looks/facetedOcean.ts', 'src/shards/driftwood-isle/runtime/looks/facetedSky.ts', 'src/shards/driftwood-isle/runtime/looks/fpArmsGlsl.ts', 'src/shards/driftwood-isle/runtime/looks/groundCoverLook.ts', 'src/shards/driftwood-isle/runtime/looks/groundLook.ts', 'src/shards/driftwood-isle/runtime/looks/gullFlock.ts', 'src/shards/driftwood-isle/runtime/looks/gullsGlsl.ts', 'src/shards/driftwood-isle/runtime/looks/instancedTiles.ts', 'src/shards/driftwood-isle/runtime/looks/islandLook.ts', 'src/shards/driftwood-isle/runtime/looks/oceanGlsl.ts', 'src/shards/driftwood-isle/runtime/looks/reefBed.ts', 'src/shards/driftwood-isle/runtime/looks/reefGlsl.ts', 'src/shards/driftwood-isle/runtime/looks/seabedLook.ts', 'src/shards/driftwood-isle/runtime/looks/skyGlsl.ts', 'src/shards/driftwood-isle/runtime/looks/smokeColumn.ts', 'src/shards/driftwood-isle/runtime/looks/streamedCover.ts', 'src/shards/driftwood-isle/runtime/looks/toonGlsl.ts', 'src/shards/driftwood-isle/runtime/looks/traderLook.ts', 'src/shards/driftwood-isle/runtime/looks/waterfallGlsl.ts', 'src/shards/driftwood-isle/runtime/props/mooringLines.ts', 'src/shards/driftwood-isle/runtime/viewmodel/toonArms.ts');
  paths.push('src/shards/driftwood-isle/runtime/combat/bossDefinition.ts', 'src/shards/driftwood-isle/runtime/models/slots.ts', 'src/shards/driftwood-isle/runtime/world/blenderArea.ts');
  const walk = (dir, accept) => {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path, accept);
      else if (accept(path)) paths.push(relative(root, join(root, path)));
    }
  };
  for (const dir of ['quest', 'world', 'data', 'npc']) walk(`src/shards/driftwood-isle/${dir}`, path => /\.(?:ts|json)$/u.test(path) && !MOVERS.has(path));
  return Object.fromEntries(paths.sort().map(path => [path, createHash('sha256').update(readFileSync(join(root, path))).digest('hex')]));
}
