// Deterministic static encounter data and geometry; all live fight/pose owners are retained.
import { fileURLToPath } from 'node:url';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';
import * as fight from './stormTitanFight.ts';
import { titanGeometry } from './stormTitanGeometry.ts';

const writer = byteWriter(process.argv.includes('--check'), 'nalati-storm-titan');
writer.put(fileURLToPath(new URL('../data/stormTitanFight.generated.json', import.meta.url)), jsonBytes(fight));
writer.put(fileURLToPath(new URL('../data/stormTitanGeometry.generated.json', import.meta.url)), jsonBytes(titanGeometry(), 0));
writer.finish();
