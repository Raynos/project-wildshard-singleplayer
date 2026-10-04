import { Euler, Quaternion, type SkinnedMesh } from 'three';
import { validateSkinLayers, type SkinPoseLayer } from './skinLayers';

/** Compile layer buffers once; cached base poses prevent AnimationMixer's constant-track optimisation accumulating deltas. */
export function skinPoseLayers(mesh: SkinnedMesh, layers: readonly SkinPoseLayer[]): { restore: () => void; apply: (time: number) => void } {
  validateSkinLayers(layers, mesh.skeleton.bones.map((bone) => bone.name));
  const bones = mesh.skeleton.bones, base = bones.map((bone) => ({ p: bone.position.clone(), q: bone.quaternion.clone(), s: bone.scale.clone() }));
  const compiled = layers.map((layer) => ({ ...layer, tracks: layer.tracks.map((t) => {
    const bone = bones.find((b) => b.name === t.bone); if (bone === undefined) throw new Error('Missing skin layer bone');
    return { ...t, bone, values: Float32Array.from(t.values) };
  }) }));
  const a = new Quaternion(), b = new Quaternion(), c = new Quaternion(), d = new Quaternion(), euler = new Euler();
  return {
    restore: () => { bones.forEach((bone, i) => { const pose = base[i]; if (pose !== undefined) { bone.position.copy(pose.p); bone.quaternion.copy(pose.q); bone.scale.copy(pose.s); } }); },
    apply: (time) => {
      if (!Number.isFinite(time) || time < 0) throw new Error('Invalid skin layer clock');
      bones.forEach((bone, i) => { const pose = base[i]; if (pose !== undefined) { pose.p.copy(bone.position); pose.q.copy(bone.quaternion); pose.s.copy(bone.scale); } });
      for (const layer of compiled) {
        const t = time % layer.period, times = layer.times; let lo = 0, hi = times.length - 1;
        while (hi - lo > 1) { const mid = (lo + hi) >> 1; if ((times[mid] ?? 0) > t) hi = mid; else lo = mid; }
        const blend = (t - (times[lo] ?? 0)) / ((times[hi] ?? layer.period) - (times[lo] ?? 0));
        const phase = (time % layer.phasePeriod) / layer.phasePeriod * layer.phaseSteps, p = Math.floor(phase), fraction = phase - p, stride = layer.phaseSteps + 1;
        for (const track of layer.tracks) {
          const values = track.values, bone = track.bone;
          if (track.property === 'quaternion') {
            a.fromArray(values, (lo * stride + p) * 4); b.fromArray(values, (hi * stride + p) * 4); a.slerp(b, blend);
            if (layer.phaseSteps > 0) { c.fromArray(values, (lo * stride + p + 1) * 4); d.fromArray(values, (hi * stride + p + 1) * 4); c.slerp(d, blend); a.slerp(c, fraction); }
            bone.quaternion.multiply(a).normalize();
          } else {
            const value = (values[lo] ?? 0) + ((values[hi] ?? 0) - (values[lo] ?? 0)) * blend;
            if (track.property === 'rotation') { euler.setFromQuaternion(bone.quaternion, track.order); euler[track.axis] += value; bone.quaternion.setFromEuler(euler); }
            else bone[track.property][track.axis] += value;
          }
        }
      }
    },
  };
}
