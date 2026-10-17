// Pre-admission identities and boot policy, generated from authored sources.
import { writeFileSync } from 'node:fs';
import { PINE_BOOT_FILES, PINE_BOOT_SOURCES } from './bootFiles.ts';
import { FINISH_CARDS } from './finishCards.ts';
import { WILDLIFE_LOOK } from './wildlifeLook.ts';
import people from '../data/questNpcs.generated.json' with { type: 'json' };

export const bootMetadata = () => ({ recipes: PINE_BOOT_FILES, sources: PINE_BOOT_SOURCES });
export const explorerMetadata = () => ({ cards: FINISH_CARDS, wildlifeLook: WILDLIFE_LOOK, names: Object.fromEntries(people.rows.map(row => [row.npc.id, row.npc.name])) });
if (import.meta.main) {
  writeFileSync(new URL('../data/bootMetadata.generated.json', import.meta.url), `${JSON.stringify(bootMetadata())}\n`);
  writeFileSync(new URL('../data/explorerMetadata.generated.json', import.meta.url), `${JSON.stringify(explorerMetadata())}\n`);
}
