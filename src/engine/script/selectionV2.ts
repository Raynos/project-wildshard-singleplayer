/** H13 policy boundary. The native owner lends Developer at construction and
 * chooses one implementation. Public entry never reads or loads a v2 artifact;
 * setting changes apply to the next owner entry, never a mid-call hot swap. */
import { parseScriptArtifactV2,type ScriptArtifactV2 } from '@wildshard/format/scriptAdmissionV2';

/** Null keeps the owner's current native/v0/v1 implementation. This function
 * never fetches bytes, instantiates Wasm or takes a renderer/save dependency.
 * The selected owner copies and verifies bytes, runs admitScriptV2 with the
 * selected revisions/lane and trusted IO size, then compiles that same copy;
 * only after admission may it call getters and ws_init. */
export function selectDeveloperScriptV2(rows: { readonly v2?: unknown },developer: boolean): ScriptArtifactV2 | null {
  if (!developer) return null;
  const candidate = rows.v2;
  return candidate === undefined ? null : parseScriptArtifactV2(candidate);
}
