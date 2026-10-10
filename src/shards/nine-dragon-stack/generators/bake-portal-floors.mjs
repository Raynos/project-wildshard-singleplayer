// Retained Node producer for Nine's floor rows. Run through the strip-only source resolver declared in generation-jobs.json.
import { mkdirSync, writeFileSync } from 'node:fs';
import { portalFloorRows } from './portalFloors.ts';

const output = new URL('../data/portalFloors.generated.json', import.meta.url);
mkdirSync(new URL('../data/', import.meta.url), { recursive: true });
writeFileSync(output, `${JSON.stringify(portalFloorRows())}\n`);
