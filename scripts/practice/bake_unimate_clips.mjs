/** E336: retarget recorded UniMate rotations onto original dummy bind frames. No mesh/weight edits.
 * node scripts/practice/bake_unimate_clips.mjs <generated.json> <motion.glb> <provenance.json>
 */
import { Document, NodeIO } from '@gltf-transform/core';
import { Quaternion } from 'three';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const [input, output, report] = process.argv.slice(2);
if (!input || !output || !report) throw new Error('Usage: bake_unimate_clips.mjs <generated.json> <motion.glb> <provenance.json>');
const generated = JSON.parse(readFileSync(input, 'utf8'));
if (generated.clips.length !== 18) throw new Error('Expected all six clips on each of the three rigs');
const doc = new Document(), buffer = doc.createBuffer(), scene = doc.createScene('Dummy motion');
const rest = generated.rigs.wood.rest.joints;
const nodes = rest.map((r) => doc.createNode(r.name).setTranslation(r.position).setRotation(r.quaternion).setScale(r.scale));
rest.forEach((r, i) => { if (r.parent < 0) scene.addChild(nodes[i]); else nodes[r.parent].addChild(nodes[i]); });
const limits = { Pelvis: 2, Spine: 5, Chest: 5, Neck: 7, Head: 7, LeftShoulder: 5, RightShoulder: 5,
  LeftUpperArm: 15, RightUpperArm: 15, LeftForeArm: 12, RightForeArm: 12, LeftHand: 7, RightHand: 7 };
const wxyz = (q) => new Quaternion(q[1], q[2], q[3], q[0]).normalize();
const identity = new Quaternion(), rows = [];
for (const clip of generated.clips) {
  const rig = generated.rigs[clip.variant], localRest = rig.rest.joints;
  // Canonicalization applies one global facing rotation. Undo it before using the original parent frame.
  const facing = new Quaternion().fromArray(localRest.find((r) => r.name === 'Root').worldQuaternion)
    .multiply(wxyz(rig.canonicalGlobalQuaternions[0]).invert());
  const invFacing = facing.clone().invert();
  const animation = doc.createAnimation(`${clip.variant}:${clip.clip}`);
  let peak = 0;
  const times = doc.createAccessor().setType('SCALAR').setArray(Float32Array.from({ length: 61 }, (_, i) => i / 30)).setBuffer(buffer);
  for (const [name, degrees] of Object.entries(limits)) {
    const index = rig.names.indexOf(name), original = localRest.find((r) => r.name === name);
    const parent = original.parent < 0 ? null : localRest[original.parent];
    const frame = parent ? new Quaternion().fromArray(parent.worldQuaternion) : identity.clone();
    const invFrame = frame.clone().invert(), restQ = new Quaternion().fromArray(original.quaternion);
    let series = clip.deltaQuaternionsWXYZ.map((frameQ) => wxyz(frameQ[index]));
    // Denoise candidate motion in quaternion space before capping travel; retain the actual generated trajectory.
    for (let pass = 0; pass < 2; pass++) {
      series = series.map((center, f) => {
        const sum = [0, 0, 0, 0], kernel = [1, 4, 6, 4, 1];
        for (let k = -2; k <= 2; k++) {
          const q = series[Math.min(series.length - 1, Math.max(0, f + k))];
          const weight = kernel[k + 2] * (center.dot(q) < 0 ? -1 : 1);
          const a = q.toArray(); for (let j = 0; j < 4; j++) sum[j] += a[j] * weight;
        }
        return new Quaternion().fromArray(sum).normalize();
      });
    }
    const initial = series[0].clone().invert();
    const values = [], cap = degrees * Math.PI / 180;
    // Keep head reactions above the chest; arbitrary generated follow-through must not fold the waist.
    const mask = clip.clip === 'head-hit' ? (['Pelvis', 'Spine', 'Chest'].includes(name) ? 0 : /Arm|Shoulder|Hand/.test(name) ? 0.2 : 1)
      : clip.clip === 'heavy-hit' ? 0.7 : ['hit-left', 'hit-right'].includes(clip.clip) ? 0.8 : 1;
    let previous = restQ.clone();
    for (let f = 0; f <= 60; f++) {
      const t = f / 60;
      const envelope = clip.clip === 'idle' ? 0.28 * Math.sin(Math.PI * t) ** 2 : Math.sin(Math.PI * t) ** 0.75;
      const delta = f === 60 ? identity.clone() : series[f].clone().multiply(initial);
      delta.premultiply(facing).multiply(invFacing);
      const angle = identity.angleTo(delta);
      delta.slerp(identity, 1 - mask * envelope * Math.min(1, cap / Math.max(1e-8, angle)));
      const q = invFrame.clone().multiply(delta).multiply(frame).multiply(restQ).normalize();
      if (previous.dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
      q.toArray(values, f * 4); previous = q;
    }
    let poses = Array.from({ length: 61 }, (_, f) => new Quaternion().fromArray(values, f * 4));
    for (let pass = 0; pass < 3; pass++) {
      poses = poses.map((center, f) => {
        if (f === 0 || f === 60) return restQ.clone();
        const sum = [0, 0, 0, 0], kernel = [1, 4, 6, 4, 1];
        for (let k = -2; k <= 2; k++) {
          const q = poses[Math.min(60, Math.max(0, f + k))];
          const a = q.toArray(), weight = kernel[k + 2] * (center.dot(q) < 0 ? -1 : 1);
          for (let j = 0; j < 4; j++) sum[j] += a[j] * weight;
        }
        return new Quaternion().fromArray(sum).normalize();
      });
    }
    let maxStep = 0;
    for (let f = 1; f < poses.length; f++) maxStep = Math.max(maxStep, poses[f - 1].angleTo(poses[f]));
    // Bound residual high-frequency motion after nonlinear angle caps. Damage impulse timing remains in the springs.
    const temporalGain = Math.min(1, (4 * Math.PI / 180) / Math.max(maxStep, 1e-8));
    poses.forEach((q, f) => {
      const filtered = restQ.clone().slerp(q, temporalGain).normalize();
      peak = Math.max(peak, filtered.angleTo(restQ)); filtered.toArray(values, f * 4);
    });
    const rotations = doc.createAccessor().setType('VEC4').setArray(new Float32Array(values)).setBuffer(buffer);
    const sampler = doc.createAnimationSampler().setInput(times).setOutput(rotations).setInterpolation('LINEAR');
    animation.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(nodes[rest.findIndex((r) => r.name === name)])
      .setTargetPath('rotation').setSampler(sampler));
  }
  rows.push({ variant: clip.variant, clip: clip.clip, prompt: clip.prompt, inferenceSeconds: clip.seconds, peakLocalDegrees: Number((peak * 180 / Math.PI).toFixed(3)) });
}
await new NodeIO().write(output, doc);
writeFileSync(report, `${JSON.stringify({ model: 'Linzhan/UniMate/unimate_uniml3d_f60_v2',
  codeRevision: '5d6aabedd947297b5ba6706d8e9113e68c0c3e4f', seed: generated.seed, device: generated.device,
  sampling: 'EMA, CFG 3, Heun2 32 steps, objaverse statistics, 60 frames / 30 Hz',
  rawSHA256: createHash('sha256').update(readFileSync(input)).digest('hex'),
  constraints: 'Original geometry/binds preserved. Skin weights repaired separately by repair_dummy_weights.mjs (Gaussian radius 0.065m). Root/legs fixed. Original parent frame retargeting. Quaternion temporal smoothing before/after caps, ≤4 degrees per 30Hz step; head torso mask, lateral 80%, heavy 70%; rest-to-rest envelope; idle 28%.',
  clips: rows }, null, 2)  }\n`);
console.log(output, rows);
