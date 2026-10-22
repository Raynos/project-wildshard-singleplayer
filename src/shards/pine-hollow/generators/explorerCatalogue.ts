import { parseExplorerCatalogue } from '@wildshard/format/explorerCatalogue';
import { ANTLER_KING_CARD } from './kingCard';

/** Ordered references retain the original native specimen order. */
export const EXPLORER_CATALOGUE = parseExplorerCatalogue({
  "version": 1,
  "entries": [
    {
      "kind": "species",
      "species": "deer",
      "id": "shared/deer",
      "file": "src/game/models/creatures.ts",
      "pipeline": [
        "trellis",
        "hunyuan",
        "code"
      ]
    },
    {
      "kind": "species",
      "species": "boar",
      "id": "shared/boar",
      "file": "src/game/models/creatures.ts",
      "pipeline": [
        "hunyuan",
        "code"
      ],
      "spawnOnly": true
    },
    {
      "kind": "species",
      "species": "bear",
      "id": "shared/bear",
      "file": "src/game/models/creatures.ts",
      "pipeline": [
        "hunyuan",
        "code"
      ]
    },
    {
      "kind": "species",
      "species": "elk",
      "id": "pine-hollow/elk",
      "file": "src/shards/pine-hollow/models/creatures.ts",
      "pipeline": [
        "hunyuan",
        "code"
      ],
      "spawnOnly": true
    }
    ,{kind:'socket-creature',rows:ANTLER_KING_CARD,planned:1},
    {"kind":"posed","file":"look/wildlife-draw.json","source":"product"},
    ...['ranger', 'miller', 'trader'].map(figure => ({ kind: 'figure', file: 'people/catalogue.json', figure, copies: 1 })),
    { kind: 'equipment' }, { kind: 'engine', model: 'swim-hands', copies: 1 }
  ]
});
