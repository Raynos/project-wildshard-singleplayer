import ecology from '../data/ecology.generated.json' with {type:'json'};
import cover from '../data/cover.generated.json' with {type:'json'};
import { parseExplorerCatalogue } from '@wildshard/format/explorerCatalogue';

/** Ordered references retain the original native specimen order. */
export const EXPLORER_CATALOGUE = parseExplorerCatalogue({
  "version": 1,
  "entries": [
    {
      "kind": "species",
      "species": "horse",
      "id": "nalati-grasslands/horse",
      "file": "src/shards/nalati-grasslands/models/creatures.ts",
      "pipeline": [
        "hunyuan",
        "code"
      ],
      "name": "Steppe horse"
    },
    {
      "kind": "species",
      "species": "wolf",
      "id": "nalati-grasslands/wolf",
      "file": "src/shards/nalati-grasslands/models/creatures.ts",
      "pipeline": [
        "trellis",
        "code"
      ]
    },
    {
      "kind": "species",
      "species": "sheepdog",
      "id": "nalati-grasslands/sheepdog",
      "file": "src/shards/nalati-grasslands/models/creatures.ts",
      "pipeline": [
        "hunyuan",
        "code"
      ]
    },
    {
      "kind": "library",
      "library": "native",
      "model": "nalati-grasslands/sheep"
    },
    {
      "kind":"specimen","books":{"phone":"models/cover-phone.json","desktop":"models/cover-desktop.json"},"model":"marmot","copies":(ecology.wildlife.marmots?.sites??0)*4,"drawnAs":"instanced"
    },
    {
      "kind": "species",
      "species": "leopard",
      "id": "nalati-grasslands/aqbars",
      "file": "src/shards/nalati-grasslands/models/creatures.ts",
      "pipeline": [
        "trellis",
        "code"
      ],
      "name": "Aqbars the Pale"
    },
    {
      "kind": "species",
      "species": "kokbori",
      "id": "nalati-grasslands/kokbori",
      "file": "src/shards/nalati-grasslands/models/creatures.ts",
      "pipeline": [
        "trellis",
        "code"
      ],
      "name": "Kokbori, Mother of the Pack"
    },
    {
      "kind": "species",
      "species": "eagle",
      "id": "nalati-grasslands/qyran",
      "file": "src/shards/nalati-grasslands/models/creatures.ts",
      "pipeline": [
        "trellis",
        "code"
      ],
      "name": "Qyran the Storm-Wing"
    },
    {
      "kind": "species",
      "species": "argymaq",
      "id": "nalati-grasslands/argymaq",
      "file": "src/shards/nalati-grasslands/models/creatures.ts",
      "pipeline": [
        "hunyuan",
        "code"
      ],
      "name": "Argymaq the Unbroken"
    },
    {
      "kind": "species",
      "species": "ghost-rider",
      "id": "nalati-grasslands/ghost-rider",
      "file": "src/shards/nalati-grasslands/models/creatures.ts",
      "pipeline": [
        "hunyuan",
        "code"
      ],
      "planned": 3
    },
    {
      "kind": "species",
      "species": "balbal",
      "id": "nalati-grasslands/balbal-warrior",
      "file": "src/shards/nalati-grasslands/models/creatures.ts",
      "pipeline": "code",
      "name": "Balbal warrior",
      "planned": 5,
      "surface": "stone"
    },
    {
      "kind": "species",
      "species": "golden-king",
      "id": "nalati-grasslands/golden-king",
      "file": "src/shards/nalati-grasslands/models/creatures.ts",
      "pipeline": [
        "hunyuan",
        "code"
      ]
    },
    {kind:'library',library:'native',model:'nalati-grasslands/storm-titan'},
    ...(['butterfly','raptor']as const).map(model=>({kind:'specimen',books:{phone:'models/cover-phone.json',desktop:'models/cover-desktop.json'},model,drawnAs:'instanced',tierCopies:model==='raptor'?{phone:cover.raptors,desktop:cover.raptors}:cover.butterflies})),
    {kind:'specimen',books:{phone:'models/cover-phone.json',desktop:'models/cover-desktop.json'},model:'reins',copies:1},
  ]
});
