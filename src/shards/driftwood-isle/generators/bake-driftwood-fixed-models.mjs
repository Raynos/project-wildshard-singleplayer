// Retained file-publishing adapter. The defining producer owns every byte.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { DRIFTWOOD_FIXED_INPUTS, driftwoodFixedBytes } from './fixedProgram.ts';

const root = new URL('../../../../', import.meta.url), project = new URL('../', import.meta.url);
const inputs = new Map(DRIFTWOOD_FIXED_INPUTS.map(name => [name, new Uint8Array(readFileSync(new URL(`public${name}`, root)))]));
const files = await driftwoodFixedBytes(inputs), check = process.argv.includes('--check');
const retired = new Set(['data/chimeSlots.json', 'data/trophySlots.json', 'data/coverLook.json', 'data/bridgeBake.json', 'data/piers.generated.json', 'data/trailsideBake.json']);
for (const [name, bytes] of files) {
  if (name.startsWith('owned/') || retired.has(name)) continue;
  const destination = name.startsWith('baked/') ? new URL(`public/assets/driftwood-isle/${name}`, root) : new URL(name, project);
  if (!process.argv.includes('--force-write') && existsSync(destination) && readFileSync(destination).equals(Buffer.from(bytes))) continue;
  if (check) { console.error(`bake-fixed-models: STALE ${destination.pathname}`); process.exitCode = 1; }
  else { mkdirSync(new URL('.', destination), { recursive: true }); writeFileSync(destination, bytes); }
}
console.info(`Driftwood fixed producer: ${files.size} owned files`);
