import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { admitSelectedNative } from '../selected-native-color-view/admission.mjs';
import { safeRead } from '../selected-native-view/admission.mjs';
/** Source identity only; numeric/schema/Rapier construction are separate checks. Never publishes. */
export function selectedMotionSource(root = resolve(import.meta.dirname, '../../../..')) {
  const selected = admitSelectedNative(root);
  const base = 'art/driftwood-isle/approved-conch';
  const here = `${base}/selected-complete-motion`;
  const pins = JSON.parse(safeRead(root, `${here}/source-pins.json`));
  for (const [path, sha] of Object.entries(pins)) {
    if (createHash('sha256').update(safeRead(root, `${base}/${path}`)).digest('hex') !== sha) throw new Error(`Selected motion input changed: ${path}`);
  }
  const recipe = JSON.parse(safeRead(root, `${here}/recipe.json`));
  const poses = JSON.parse(safeRead(root, `${here}/poses.json`));
  const metadata = structuredClone(selected.metadata);
  metadata.bodies[0].dims.rigidCorpse = recipe;
  return { metadata, payload: selected.payload, poses, recipe, buildAllowed: false, runtimeAcceptance: false, visualAcceptance: false };
}
