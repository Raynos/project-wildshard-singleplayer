import { HELD_ARMS } from './heldArms';
import { parseExplorerCatalogue } from '@wildshard/format/explorerCatalogue';

/** Ordered references retain the original native specimen order. */
export const EXPLORER_CATALOGUE = parseExplorerCatalogue({
  "version": 1,
  "entries": [
    {
      "kind": "species",
      "species": "boar",
      "id": "shared/boar",
      "file": "src/game/models/creatures.ts",
      "pipeline": "code",
      "spawnOnly": true
    },
    {
      "kind": "species",
      "species": "bear",
      "id": "shared/bear",
      "file": "src/game/models/creatures.ts",
      "pipeline": "code"
    },
    {
      "kind": "species",
      "species": "crab",
      "id": "driftwood-isle/reef-crab",
      "file": "src/shards/driftwood-isle/runtime/models/creatures.ts",
      "pipeline": "code"
    },
    {
      "kind": "species",
      "species": "monkey",
      "id": "driftwood-isle/coconut-monkey",
      "file": "src/shards/driftwood-isle/runtime/models/creatures.ts",
      "pipeline": "code"
    },
    {
      "kind": "species",
      "species": "sailor",
      "id": "driftwood-isle/drowned-sailor",
      "file": "src/shards/driftwood-isle/runtime/models/creatures.ts",
      "pipeline": "code"
    },
    {
      "kind": "species",
      "species": "captain",
      "id": "driftwood-isle/drowned-captain",
      "file": "src/shards/driftwood-isle/runtime/models/creatures.ts",
      "pipeline": [
        "hunyuan",
        "code"
      ]
    }
    ,{kind:'library',library:'native',model:'driftwood-isle/gull'},
    {kind:'library',library:'native',model:'driftwood-isle/castaway'},
    ...HELD_ARMS.weapons.map(weapon => ({kind:'held',item:weapon.item})),
  ]
});
