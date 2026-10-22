import { Box3, Matrix4, Mesh, Vector3, Vector4, type BufferAttribute, type BufferGeometry, type InterleavedBufferAttribute, type SkinnedMesh } from 'three';

type Attribute = BufferAttribute | InterleavedBufferAttribute;
interface Scan { readonly parts: readonly { readonly index: number; readonly centre: Vector3; readonly extent: Vector3 }[]; readonly minSum: number; readonly maxSum: number }
interface Scanned { readonly inputs: readonly Attribute[]; readonly versions: readonly number[]; readonly bones: number; readonly bind: readonly number[]; readonly scan: Scan | null }
/** One scan per geometry, uploaded attribute versions, bone count and bind matrix: a herd's skinned copies share their
 *  geometry and bind pose, so the vertex walk runs once rather than once per copy (Pine's afterKit, G590). */
const scans = new WeakMap<BufferGeometry, Scanned[]>();
const version = (attribute: Attribute): number => 'isInterleavedBufferAttribute' in attribute ? attribute.data.version : attribute.version;

function scanSkin(mesh: SkinnedMesh, position: Attribute, indices: Attribute, weights: Attribute): Scan | null {
  const boxes = mesh.skeleton.bones.map(() => new Box3()), point = new Vector3();
  let minSum = Infinity, maxSum = 0;
  for (let i = 0; i < position.count; i++) {
    let sum = 0;
    for (let j = 0; j < 4; j++) {
      const weight = weights.getComponent(i, j), index = indices.getComponent(i, j);
      if (!Number.isFinite(weight) || weight < 0) return null;
      sum += weight; if (weight === 0) continue;
      const box = boxes[index]; if (box === undefined) return null;
      box.expandByPoint(point.fromBufferAttribute(position, i).applyMatrix4(mesh.bindMatrix));
    }
    minSum = Math.min(minSum, sum); maxSum = Math.max(maxSum, sum);
  }
  return { minSum, maxSum, parts: boxes.flatMap((box, index) => box.isEmpty() ? [] : [{ index, centre: box.getCenter(new Vector3()), extent: box.getSize(new Vector3()).multiplyScalar(0.5) }]) };
}

/** A conservative mesh-local envelope of the uploaded linear skin. Geometry and
 * bind inputs are scanned once (shared by every mesh on the same uploaded inputs and bind); each changed pose
 * transforms one box per bone. Signed weights and morph targets use the exact uploaded-vertex fallback. */
export function skinEnvelope(mesh: SkinnedMesh): (() => Box3) | null {
  const geometry = mesh.geometry;
  if ((geometry.morphAttributes.position?.length ?? 0) > 0) return null;
  if (!geometry.hasAttribute('skinIndex') || !geometry.hasAttribute('skinWeight')) return null;
  const position = geometry.getAttribute('position'), indices = geometry.getAttribute('skinIndex'), weights = geometry.getAttribute('skinWeight');
  const inputs = [position, indices, weights], versions = inputs.map(version), bones = mesh.skeleton.bones.length, bind = mesh.bindMatrix.elements;
  let held = scans.get(geometry); if (held === undefined) { held = []; scans.set(geometry, held); }
  let found = held.find(row => row.bones === bones && row.inputs.every((input, i) => input === inputs[i] && row.versions[i] === versions[i])
    && row.bind.every((value, i) => value === bind[i]));
  if (found === undefined) {
    found = { inputs, versions, bones, bind: [...bind], scan: scanSkin(mesh, position, indices, weights) };
    held.push(found); if (held.length > 8) held.shift();
  }
  const scan = found.scan;
  if (scan === null) return null;
  const { parts, minSum, maxSum } = scan, point = new Vector3();
  const result = new Box3(), bone = new Matrix4(), pose = new Matrix4();
  return () => {
    const uploaded = mesh.skeleton.boneMatrices;
    if (uploaded === null) throw new Error('Cell skin has no live bone matrices');
    result.makeEmpty();
    for (const part of parts) {
      bone.fromArray(uploaded, part.index * 16); pose.multiplyMatrices(mesh.bindMatrixInverse, bone);
      const m = pose.elements, c = part.centre, e = part.extent;
      const x = m[0] * c.x + m[4] * c.y + m[8] * c.z + m[12], y = m[1] * c.x + m[5] * c.y + m[9] * c.z + m[13], z = m[2] * c.x + m[6] * c.y + m[10] * c.z + m[14];
      const rx = Math.abs(m[0]) * e.x + Math.abs(m[4]) * e.y + Math.abs(m[8]) * e.z;
      const ry = Math.abs(m[1]) * e.x + Math.abs(m[5]) * e.y + Math.abs(m[9]) * e.z;
      const rz = Math.abs(m[2]) * e.x + Math.abs(m[6]) * e.y + Math.abs(m[10]) * e.z;
      result.min.x = Math.min(result.min.x, x - rx); result.max.x = Math.max(result.max.x, x + rx);
      result.min.y = Math.min(result.min.y, y - ry); result.max.y = Math.max(result.max.y, y + ry);
      result.min.z = Math.min(result.min.z, z - rz); result.max.z = Math.max(result.max.z, z + rz);
    }
    if (result.isEmpty()) result.setFromCenterAndSize(point.set(0, 0, 0), point);
    for (const axis of ['x', 'y', 'z'] as const) {
      const low = result.min[axis], high = result.max[axis];
      result.min[axis] = Math.min(low * minSum, low * maxSum, high * minSum, high * maxSum);
      result.max[axis] = Math.max(low * minSum, low * maxSum, high * minSum, high * maxSum);
    }
    return result;
  };
}

/** Exact mesh-local fallback using the same float matrices and homogeneous
 * weighting as the GPU, even if a callback changes a bone after its upload. */
export function uploadedSkinBounds(mesh: SkinnedMesh, result: Box3): Box3 {
  const matrices = mesh.skeleton.boneMatrices;
  if (matrices === null) throw new Error('Cell skin has no live bone matrices');
  const indices = mesh.geometry.getAttribute('skinIndex'), weights = mesh.geometry.getAttribute('skinWeight');
  const position = new Vector3(), input = new Vector4(), sum = new Vector4(), transformed = new Vector4(), bone = new Matrix4();
  result.makeEmpty();
  for (let i = 0; i < mesh.geometry.getAttribute('position').count; i++) {
    Mesh.prototype.getVertexPosition.call(mesh, i, position);
    input.set(position.x, position.y, position.z, 1).applyMatrix4(mesh.bindMatrix); sum.set(0, 0, 0, 0);
    for (let j = 0; j < 4; j++) { const weight = weights.getComponent(i, j); if (weight !== 0) sum.addScaledVector(transformed.copy(input).applyMatrix4(bone.fromArray(matrices, indices.getComponent(i, j) * 16)), weight); }
    sum.applyMatrix4(mesh.bindMatrixInverse); result.expandByPoint(position.set(sum.x, sum.y, sum.z));
  }
  return result;
}
