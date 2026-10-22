import ecology from '../data/ecology.generated.json' with {type:'json'};
import cover from '../data/cover.generated.json' with {type:'json'};
import { parseExplorerCatalogue } from '@wildshard/format/explorerCatalogue';
import PEOPLE from '../data/peopleVariants.json' with {type:'json'};
import { peopleRows } from './peopleRows.mjs';
import mountedSpecimen from '../data/mountedSpecimen.json' with {type:'json'};
import gear from '../data/gear.generated.json' with {type:'json'};

/** the camp's five, each its own merged atlas (the live camp draws them as one) */
const campAtlases = Object.fromEntries(PEOPLE.map(person => {
  const atlas = peopleRows.figures[person.id]?.atlas;
  if (atlas === undefined) throw new Error(`Missing camp figure atlas ${person.id}`);
  return [person.id, { label: person.label, ...atlas }];
}));

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
    // the camp's flock (ecology.wildlife: one instanced draw), its painted sheep in the cover book
    {kind:'specimen',books:{phone:'models/cover-phone.json',desktop:'models/cover-desktop.json'},model:'sheep',copies:ecology.wildlife.flocks.reduce((n,f)=>n+f.count,0),drawnAs:'instanced'},
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
    {kind:'cloud',id:'nalati-grasslands/storm-titan',name:'Jel Ata, the Storm Titan',json:'models/cloud-specimen.json',file:'src/shards/nalati-grasslands/generators/explorerCatalogue.ts',category:'creatures',pipeline:'code',copies:1,drawnAs:'instanced'},
    ...(['butterfly','raptor']as const).map(model=>({kind:'specimen',books:{phone:'models/cover-phone.json',desktop:'models/cover-desktop.json'},model,drawnAs:'instanced',tierCopies:model==='raptor'?{phone:cover.raptors,desktop:cover.raptors}:cover.butterflies})),
    {kind:'specimen',books:{phone:'models/cover-phone.json',desktop:'models/cover-desktop.json'},model:'reins',copies:1},
    {kind:'kit-figure',id:'nalati-grasslands/camp-people',name:'Camp people',file:'src/shards/nalati-grasslands/generators/explorerCatalogue.ts',category:'people',
      pipeline:['hunyuan','code'],surface:'flesh',copies:PEOPLE.length,drawnAs:'skinned',atlases:campAtlases},
    // the mounted shepherd: his seated figure on the saddled camp horse's body bone, as the raid seats him (the horse is the
    // Hunyuan3D-2 saddled hull on the horse's rig, the code horse until it loads; he is code)
    {kind:'mounted',specimen:mountedSpecimen,copies:1,drawnAs:'skinned'},
    // the gloved hands in the river (E348)
    {kind:'engine',model:'swim-hands',copies:1},
    // the gear its player holds (bow and its arrows · sabre · spear and its javelins, the Golden Bow and the Naizagai once
    // won, the AR-15): the product's gear book
    ...gear.catalogue.map(row=>{const card={kind:'specimen',books:{phone:'models/gear-book.json',desktop:'models/gear-book.json'},model:row.key,copies:row.copies};
      return row.drawnAs==='instanced'?Object.assign(card,{drawnAs:'instanced'}):card;}),
  ]
});
