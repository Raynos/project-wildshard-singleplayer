import type { PlatformDataSectionName } from '@wildshard/format/platformDataSections';
import { SCRIPT_V2_REVISIONS } from '@wildshard/format/scriptAdmissionV2';
import heldWeapons from '../data/heldWeapons.generated.json' with { type: 'json' };
import weatherDecision from '../behaviour/weather.generated.json' with { type: 'json' };
import kokpar from '../data/kokpar.generated.json' with { type: 'json' };
import admission from '../behaviour/admission.generated.json' with { type: 'json' };
import pasture from '../behaviour/pasture.generated.json' with { type: 'json' };
import ridingPrograms from '../behaviour/riding.generated.json' with { type: 'json' };
import titanProgram from '../behaviour/titan.generated.json' with { type: 'json' };
import charge from '../data/eliteCharge.generated.json' with { type: 'json' };

const programs = [weatherDecision.script, kokpar.program.script, admission.script, pasture.script,
  titanProgram.fire.script, titanProgram.wind.script];
const legacy = programs.filter((row, index, all) => all.findIndex(entry => entry.module === row.module) === index);
function projection(id: string, program: typeof heldWeapons.program.v2): Record<string, string | number> {
  return { id, module: `blobs/wasm/${program.artifact.hash}.wasm`, side: 'sim', abi: 2, lane: 'project',
    pages: program.artifact.pages, ioBytes: program.artifact.ioBytes,
    compilerRevision: SCRIPT_V2_REVISIONS.compiler, admissionRevision: SCRIPT_V2_REVISIONS.admission };
}
/** Complete sim admission, shared by emitted sections and the module-cap proof.
 * Inline ABI1 witnesses are data; only selected executable rows appear here. */
export const NALATI_SCRIPT_SECTIONS: ReadonlyMap<PlatformDataSectionName, unknown> = new Map([
  ['actors/spawn-scripts', [{ ...charge, bytes: '' }]],
  ['actors/return-scripts', [...legacy, projection('nalati.held-weapons.projection', heldWeapons.program.v2),
    projection('nalati.titan.projection', titanProgram.attack.v2),projection('nalati.mounts.projection',ridingPrograms.approach.v2)]],
]);
