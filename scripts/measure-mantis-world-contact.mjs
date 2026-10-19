/** Read-only analysis of exact native rigid vertices and captured mesh/bone transforms.
 * Ground plane is an explicit input. Counts describe geometry contact, not collision acceptance. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Matrix4, Quaternion, Vector3 } from 'three';

const tracePath = process.argv.at(2), outputPath = process.argv.at(3), groundInput = process.argv.at(4) ?? '900';
if (tracePath === undefined || outputPath === undefined) throw new Error('Supply trace.json output.json [groundY]');
const groundY = Number(groundInput); if (!Number.isFinite(groundY)) throw new Error('Finite ground required');
const nativePath = 'art/driftwood-isle/lowpoly-mantis/runtime-admission/v7-rigid1/mantis-v7-native.json';
const nativeBytes = readFileSync(nativePath), traceBytes = readFileSync(tracePath);
const native = JSON.parse(nativeBytes), trace = JSON.parse(traceBytes);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
if (hash(nativeBytes) !== '6c47dd59acdc01993b84f70adf39a1c3f050088e6bbd781409514f85fda75bb0') throw new Error('Native source pin mismatch');
const inverseBind = new Map(native.bones.map(bone => [bone.name, new Matrix4().makeTranslation(...bone.pos).invert()]));
const point = new Vector3(), scale = new Vector3(1, 1, 1), quaternion = new Quaternion(), translation = new Vector3();
const frames = trace.map(row => {
  const world = new Matrix4().fromArray(row.world), posed = new Map(), transforms = new Map();
  for (const bone of native.bones) {
    const values = row.bones[bone.name]; if (!Array.isArray(values) || values.length !== 7 || !values.every(Number.isFinite)) throw new Error('Invalid captured bone');
    translation.fromArray(values); quaternion.fromArray(values, 3);
    const local = new Matrix4().compose(translation, quaternion, scale);
    if (bone.parent !== null) { const parent = posed.get(bone.parent); if (parent === undefined) throw new Error('Missing posed parent'); local.premultiply(parent); }
    posed.set(bone.name, local);
    const bind = inverseBind.get(bone.name); if (bind === undefined) throw new Error('Missing bind');
    transforms.set(bone.name, world.clone().multiply(local).multiply(bind));
  }
  let minHeight = Infinity, below = 0, near = 0; const parts = [];
  for (const part of native.parts) {
    const transform = transforms.get(part.name); if (transform === undefined) throw new Error('Missing rigid skin matrix');
    let partMin = Infinity, partBelow = 0, partNear = 0;
    for (let i = 0; i < part.positions.length; i += 3) {
      point.fromArray(part.positions, i).applyMatrix4(transform); const height = point.y - groundY;
      if (!Number.isFinite(height)) throw new Error('Nonfinite world vertex');
      partMin = Math.min(partMin, height); if (height < -.005) partBelow++; if (Math.abs(height) <= .02) partNear++;
    }
    parts.push({ name: part.name, minHeight: partMin, below: partBelow, near: partNear });
    minHeight = Math.min(minHeight, partMin); below += partBelow; near += partNear;
  }
  return { frame: row.frame, gameTime: row.gameTime, wallTime: row.wallTime, stage: row.stage, alive: row.alive, hp: row.hp, minHeight, below, near, parts };
});
writeFileSync(outputPath, `${JSON.stringify({ schema: 'wildshard.mantis.world-vertex-contact.v1', nativeSha256: hash(nativeBytes), traceSha256: hash(traceBytes), groundY,
  method: 'Exact V7 rigid weights: meshWorld * posedBoneHierarchy * inverseBindTranslation * originalVertex. Includes captured ragdoll root transform. near=abs(height)<=.02; below=height<-.005. No collision or planted-contact acceptance.',
  summary: { frames: frames.length, minimum: Math.min(...frames.map(row => row.minHeight)), framesBelow: frames.filter(row => row.below > 0).length }, frames }, null, 2)}\n`);
