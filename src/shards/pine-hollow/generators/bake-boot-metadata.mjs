// Pre-admission identities and boot policy, generated from authored sources.
import { readFileSync, writeFileSync } from 'node:fs';
import { parseBakedTerrain } from '@wildshard/format/bakedTerrainBytes';
import { bakedSamplers } from '@wildshard/format/bakedTerrainSampling';
import { PINE_TERRAIN } from '../data/terrainBindings.ts';
import { PINE_BOOT_FILES, PINE_BOOT_SOURCES } from './bootFiles.ts';
import { FINISH_CARDS } from './finishCards.ts';
import { WILDLIFE_LOOK } from './wildlifeLook.ts';
import people from '../data/questNpcs.generated.json' with { type: 'json' };

export const bootMetadata = () => ({ recipes: PINE_BOOT_FILES, sources: PINE_BOOT_SOURCES });
export const explorerMetadata = () => ({ cards: FINISH_CARDS, wildlifeLook: WILDLIFE_LOOK, names: Object.fromEntries(people.rows.map(row => [row.npc.id, row.npc.name])) });
/** Diagnostic eyes retain the shipping lattice's height and original angles. */
export function capturePoses() {
  const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
  const grid = parseBakedTerrain(readFileSync(new URL('../../../../public/assets/baked/pine-hollow/terrain.bin', import.meta.url)), PINE_TERRAIN);
  if (grid === null) throw new Error('Capture poses require the authored Pine terrain');
  const { heightAt } = bakedSamplers(grid);
  return Object.fromEntries(manifest.captureProbes.map(probe => [probe.name, {
    probe, eye:[probe.x, heightAt(probe.x, probe.z) + 1.68, probe.z],
    yaw:-probe.yaw * 180 / Math.PI, pitch:probe.pitch * 180 / Math.PI, mockup:'', frame:probe.name,
  }]));
}
if (import.meta.main) {
  writeFileSync(new URL('../data/boot-poses.generated.json', import.meta.url), `${JSON.stringify(capturePoses())}\n`);
  writeFileSync(new URL('../data/bootMetadata.generated.json', import.meta.url), `${JSON.stringify(bootMetadata())}\n`);
  writeFileSync(new URL('../data/explorerMetadata.generated.json', import.meta.url), `${JSON.stringify(explorerMetadata())}\n`);
}
