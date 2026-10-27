import type { NalatiWeather } from './weatherProgram';
import type { PlatformDataSectionName } from '@wildshard/format/platformDataSections';
import { SCRIPT_V2_REVISIONS } from '@wildshard/format/scriptAdmissionV2';
import type { NalatiKokpar } from './kokparRows';
import admission from '../behaviour/admission.generated.json' with { type: 'json' };
import type { NalatiRidingPrograms } from './ridingRows.mjs';
import type { NalatiTitanPrograms } from './stormTitanRows.mjs';
import charge from '../data/eliteCharge.generated.json' with { type: 'json' };

const {compiled: _chargeFile,...chargeRows} = charge;
/** The already-admitted executable fields consumed by script-section composition. */
export interface NalatiScriptProjection {
  readonly artifact: { readonly hash: string; readonly pages: number; readonly ioBytes: number };
}
function projection(id: string, program: NalatiScriptProjection): Record<string, string | number> {
  return { id, module: `blobs/wasm/${program.artifact.hash}.wasm`, side: 'sim', abi: 2, lane: 'project',
    pages: program.artifact.pages, ioBytes: program.artifact.ioBytes,
    compilerRevision: SCRIPT_V2_REVISIONS.compiler, admissionRevision: SCRIPT_V2_REVISIONS.admission };
}
/** Complete sim admission, shared by emitted sections and the module-cap proof.
 * Inline ABI1 witnesses are data; only selected executable rows appear here. */
export function nalatiScriptSections(held: NalatiScriptProjection, kokpar: Pick<NalatiKokpar, 'program'>, ridingPrograms: Pick<NalatiRidingPrograms, 'approach'>, titanProgram: Pick<NalatiTitanPrograms, 'attack' | 'wind'>, weatherDecision: NalatiWeather['rows']): ReadonlyMap<PlatformDataSectionName, unknown> {
  const programs = [weatherDecision.script, kokpar.program.script];
  const legacy = programs.filter((row, index, all) => all.findIndex(entry => entry.module === row.module) === index);
  const sections: ReadonlyMap<PlatformDataSectionName, unknown> = new Map([
  ['actors/spawn-scripts', [chargeRows]],
  ['actors/return-scripts', [...legacy, projection('nalati.admission.projection',admission.v2), projection('nalati.held-weapons.projection', held),
    projection('nalati.titan.projection', titanProgram.attack.v2),projection('nalati.mounts.projection',ridingPrograms.approach.v2),projection('nalati.pasture.projection',titanProgram.wind.v2)]],
]);
  return structuredClone(sections);
}
