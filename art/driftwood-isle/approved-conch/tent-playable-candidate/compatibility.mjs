/** Source-only audit. This deliberately cannot authorize or run a build. */
import { inflateSync } from 'node:zlib';
import { isDeepStrictEqual } from 'node:util';
import { resolve } from 'node:path';
import { admitSelectedNative } from '../selected-native-color-view/admission.mjs';
import { safeRead } from '../selected-native-view/admission.mjs';
import { admitConchReadable } from '../../../../scripts/conch-readable-admission.mjs';
export const ROOT = resolve(import.meta.dirname, '../../../..');
const BASE = 'art/driftwood-isle/approved-conch';
/** Read all four skin influences, not a joint-name-only compatibility guess. */
export function ownership(metadata, packed) {
  const raw = inflateSync(packed);
  if (raw.length !== metadata.bytes) throw new Error('Native payload size mismatch');
  const body = metadata.bodies[0], counts = Object.fromEntries(body.bones.map(b => [b.name, 0]));
  let vertices = 0, blended = 0;
  for (const part of body.hard) {
    const attrs = part.row.attrs, si = attrs.findIndex(a => a[0] === 'skinIndex'), sw = attrs.findIndex(a => a[0] === 'skinWeight');
    if (si < 0 || sw < 0 || attrs[si][1] !== 'u16' || attrs[sw][1] !== 'f32' || attrs[si][2] !== 4 || attrs[sw][2] !== 4) throw new Error('Unsupported exact skin layout');
    for (let vertex = 0; vertex < part.row.count; vertex++) {
      let total = 0, active = 0;
      for (let lane = 0; lane < 4; lane++) {
        const index = raw.readUInt16LE(part.offsets[si] + (vertex * 4 + lane) * 2);
        const weight = raw.readFloatLE(part.offsets[sw] + (vertex * 4 + lane) * 4);
        if (!Number.isFinite(weight) || weight < 0 || index >= body.bones.length) throw new Error('Invalid skin influence');
        total += weight;
        if (weight > 0) { active++; counts[body.bones[index].name]++; }
      }
      if (Math.abs(total - 1) > 1e-6) throw new Error('Unnormalized native skin');
      if (active > 1) blended++;
      vertices++;
    }
  }
  return { vertices, blended, positiveInfluenceVertices: counts };
}
export function compareBodies(selected, public4) {
  const a = selected.bodies[0], b = public4.bodies[0];
  const skeletonNamesAndParentsEqual = isDeepStrictEqual(a.bones.map(({name,parent})=>({name,parent})),b.bones.map(({name,parent})=>({name,parent})));
  const bindDifferences = a.bones.flatMap((bone,i) => isDeepStrictEqual(bone,b.bones[i]) ? [] : [{name:bone.name,selected:bone,public4:b.bones[i]}]);
  const dimensionDifferences = [...new Set([...Object.keys(a.dims),...Object.keys(b.dims)])].sort().flatMap(key=>isDeepStrictEqual(a.dims[key],b.dims[key]) ? [] : [{key,selected:a.dims[key],public4:b.dims[key]}]);
  return { skeletonNamesAndParentsEqual, bindDifferences, dimensionDifferences,
    directPoseTransferAllowed:skeletonNamesAndParentsEqual && bindDifferences.length === 0 && dimensionDifferences.length === 0 };
}
export function inspectSource(root = ROOT) {
  const selected = admitSelectedNative(root), public4 = admitConchReadable(root);
  const pose = JSON.parse(safeRead(root,`${BASE}/selected-native-view/poses.json`));
  const targets = new Set(selected.metadata.bodies[0].bones.map(b=>`joint.${b.name}`));
  if (pose.programs.length !== 45 || pose.scalars.length !== 0 || pose.programs.some(p=>p.reads.length !== 0 || p.nodes.length !== 1 || p.nodes[0].op !== 'constant' || p.nodes[0].value !== 0 || p.numeric.outputs.some(o=>!targets.has(o.target)))) throw new Error('Selected rest contract changed');
  return { schema:'wildshard.conch.tent-playable.source-audit.v1',
    selectedNativeAdmitted:true, public4SourceAdmitted:true,
    selectedBodyFile:selected.metadata.file, public4BodyFile:public4.metadata.file,
    selectedOwnership:ownership(selected.metadata,selected.payload), public4Ownership:ownership(public4.metadata,public4.payload),
    ...compareBodies(selected.metadata,public4.metadata),
    selectedPose:{programs:45,constantZero:true,hasDeathResponse:false,hasGaitResponse:false,hasAttackResponse:false},
    buildAllowed:false, runtimeAcceptance:false, animationAcceptance:false, colliderAcceptance:false };
}
export function requireCompatibleTransfer(report) {
  if (report.directPoseTransferAllowed !== true || report.selectedPose?.constantZero !== false)
    throw new Error('BLOCKED: selected bind/dimensions and constant-rest pose require candidate-native adaptation');
}
