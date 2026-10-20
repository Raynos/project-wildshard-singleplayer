// Prove the declared portal routes against the exact grid collision bake.
// Only the bounded result joins the product; motors and proof loops stay here.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadRapier } from '@wildshard/engine/physics/rapier';
import { Physics } from '@wildshard/engine/physics/Physics';
import { addBakedPieces } from '@wildshard/game/plugin/simulation';
import { proveEntryways } from '@wildshard/game/bake/entryways';
import { emptyShardfile } from '@wildshard/sdk/author';
import entries from '../data/portalEntries.generated.json' with { type: 'json' };
import floors from '../data/portalFloors.generated.json' with { type: 'json' };
import { headlessConstants } from './headless.ts';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';

const base = emptyShardfile({slug:'nine-dragon-stack',name:'Nine Dragon Stack',author:'Wildshard',revision:1,seed:0x9d2a});
const source = {...base,entryways:entries,props:{...base.props,colliders:floors}};
const binary = new URL('rapier_wasm3d_bg.wasm', import.meta.resolve('@dimforge/rapier3d-simd'));
const rapier = await loadRapier(readFileSync(binary));
const physics = new Physics(rapier);
let proof;
try {
  addBakedPieces(physics, headlessConstants.pieces);
  physics.step();
  proof = proveEntryways(source, new Map(), { world: () => ({ physics, fixedStep: () => { /* Static portal routes have no moving owner. */ }, dispose: () => { /* The outer bake owns this one physics world. */ } }) });
} finally { physics.dispose(); }
const writer = byteWriter(process.argv.includes('--check'), 'nine-entry-proof');
writer.put(fileURLToPath(new URL('../data/entryProof.generated.json', import.meta.url)), jsonBytes(proof));
writer.finish();
