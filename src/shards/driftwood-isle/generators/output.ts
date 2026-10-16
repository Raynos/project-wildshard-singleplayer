import { emitNamedBlobs, nameBlob } from '@wildshard/sdk/blobs';
import { encodeCanonicalJson } from '@wildshard/sdk/immutable';
import { enemyPlacements } from './enemyPlacement';
import { emitDefinedSections, type EmittedSections } from '@wildshard/sdk/sections';
import { DRIFTWOOD_OUTPUT } from '../data/output';
import { DRIFTWOOD_CLIENT_SECTIONS } from '../data/clientSections';
import { RUNTIME_MIRRORS } from '../data/runtimeMirrors';

/** One sorted custom inventory from the asset registry and the client rows; a name both declare refuses. */
function joined(a: EmittedSections, b: EmittedSections): EmittedSections {
  const names = new Set(a.sections.map(row => row.name));
  for (const row of b.sections) if (names.has(row.name)) throw new Error(`Duplicate custom section: ${row.name}`);
  const order = (x: string, y: string): number => x < y ? -1 : x > y ? 1 : 0;
  return { sections: [...a.sections, ...b.sections].sort((x, y) => order(x.name, y.name)), files: new Map([...a.files, ...b.files].sort(([x], [y]) => order(x, y))) };
}

/** CLI-only: runtime config imports cannot reach section emission or Node services. */
const placements = emitNamedBlobs([nameBlob('sim/enemy-placement.json', 'json', new TextEncoder().encode(encodeCanonicalJson(enemyPlacements())))]);
export const output = { ...DRIFTWOOD_OUTPUT, namedFiles: placements.files, assets: placements.assets, custom: joined(DRIFTWOOD_OUTPUT.custom, emitDefinedSections(DRIFTWOOD_CLIENT_SECTIONS)) };
/** Strict output copies prove the same constants the source mirror fixture checks. */
export const mirrors = [...RUNTIME_MIRRORS];
