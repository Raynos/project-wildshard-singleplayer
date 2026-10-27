import { readFileSync, writeFileSync } from 'node:fs';

// GR6: the Qara Batyr charge compiles in the build (chargeProgram.ts); the night roster programme stays here.
// Night roster policy shares the existing ABI v1 return catalogue.
const { nightProgram } = await import('./nightProgram.mjs');
const night = `${JSON.stringify(await nightProgram())}\n`;
const nightPath = new URL('../data/night.generated.json', import.meta.url);
if (process.argv.includes('--check')) { if (readFileSync(nightPath, 'utf8') !== night) throw new Error('Night program is stale'); }
else writeFileSync(nightPath, night);
