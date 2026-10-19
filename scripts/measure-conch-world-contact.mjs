/** Independent exact four-weight LBS reconstruction from rendered transforms.
 * Verifies captured vertices/indices/weights against the canonical packed payload.
 * Geometry proximity is not collision, visual, animation or planted-foot acceptance. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { Matrix4, Vector3 } from 'three';
import { prepareConchFrame } from './conch-native-frame.mjs';

const directory = process.argv.at(2), output = process.argv.at(3);
if (directory === undefined || output === undefined) throw new Error('Supply observer-directory output.json');
const hash = b => createHash('sha256').update(b).digest('hex');
const traceBytes = readFileSync(`${directory}/render-trace.json`), geometryBytes = readFileSync(`${directory}/runtime-geometry.json`);
const trace = JSON.parse(traceBytes), runtimeGeometry = JSON.parse(geometryBytes);
const canonical = prepareConchFrame(process.cwd()), bytes = inflateSync(canonical.payload), defs = canonical.metadata.bodies[0];
// The renderer merges all hard parts into one draw geometry, preserving source order.
const geometry = runtimeGeometry.length === 1 ? (() => {
  let offset = 0;
  const merged = runtimeGeometry[0];
  const parts = defs.hard.map((part, i) => {
    const count = part.row.count, start = offset; offset += count;
    return { ...merged, name: defs.bones[i].name, runtimeIndex: 0,
      positions: merged.positions.slice(start * 3, offset * 3), indices: merged.indices.slice(start * 4, offset * 4),
      weights: merged.weights.slice(start * 4, offset * 4) };
  });
  if (offset * 3 !== merged.positions.length) throw new Error('Merged vertex count mismatch');
  return parts;
})() : runtimeGeometry.map((mesh, runtimeIndex) => ({ ...mesh, runtimeIndex }));
if (geometry.length !== defs.hard.length) throw new Error('Canonical mesh count mismatch');
let vertices = 0, blendedVertices = 0;
for (const [i, mesh] of geometry.entries()) {
  const part = defs.hard[i];
  if (JSON.stringify(mesh.bones) !== JSON.stringify(defs.bones.map(b => b.name))) throw new Error('Skeleton order mismatch');
  for (const [attribute, key] of [['position', 'positions'], ['skinIndex', 'indices'], ['skinWeight', 'weights']]) {
    const slot = part.row.attrs.findIndex(row => row[0] === attribute), attr = part.row.attrs[slot];
    if (mesh[key].length !== part.row.count * attr[2]) throw new Error(`Wrong ${attribute} length`);
    const size = attr[1] === 'u16' ? 2 : 4;
    for (let j = 0; j < mesh[key].length; j++) {
      const at = part.offsets[slot] + j * size;
      const expected = size === 2 ? bytes.readUInt16LE(at) : bytes.readFloatLE(at);
      if (mesh[key][j] !== expected) throw new Error(`Canonical ${attribute} mismatch mesh ${i} value ${j}`);
    }
  }
  vertices += part.row.count;
  for (let j = 0; j < part.row.count; j++) {
    const w = mesh.weights.slice(j * 4, j * 4 + 4);
    if (Math.abs(w.reduce((a, b) => a + b, 0) - 1) > 1e-6) throw new Error('Unnormalized weights');
    if (w.filter(value => value > 0).length > 1) blendedVertices++;
  }
}
const point = new Vector3(), weighted = new Vector3(), original = new Vector3();
const frames = trace.map(row => {
  if (Object.keys(row.bones).length !== 15 || row.meshes.length !== runtimeGeometry.length) throw new Error('Incomplete rendered transforms');
  const parts = geometry.map((mesh, i) => {
    const frame = row.meshes[mesh.runtimeIndex], bind = new Matrix4().fromArray(mesh.bind);
    const outputTransform = new Matrix4().fromArray(frame.world).multiply(new Matrix4().fromArray(frame.bindInverse));
    const skin = frame.boneWorld.map((matrix, bone) => new Matrix4().fromArray(matrix).multiply(new Matrix4().fromArray(mesh.inverses[bone])));
    let minimum = Infinity, maximum = -Infinity, below = 0, near = 0, minimumVertex = null;
    for (let j = 0; j < mesh.positions.length / 3; j++) {
      original.fromArray(mesh.positions, j * 3).applyMatrix4(bind); point.set(0, 0, 0);
      for (let slot = 0; slot < 4; slot++) {
        const at = j * 4 + slot, weight = mesh.weights[at];
        if (weight === 0) continue;
        weighted.copy(original).applyMatrix4(skin[mesh.indices[at]]); point.addScaledVector(weighted, weight);
      }
      point.applyMatrix4(outputTransform);
      const height = point.y - 900;
      if (!Number.isFinite(height)) throw new Error('Nonfinite reconstruction');
      if (height < minimum) { minimum = height; minimumVertex = { index: j, world: point.toArray(), weights: mesh.weights.slice(j * 4, j * 4 + 4), bones: mesh.indices.slice(j * 4, j * 4 + 4).map(index => mesh.bones[index]) }; }
      maximum = Math.max(maximum, height); if (height < -.005) below++; if (Math.abs(height) <= .02) near++;
    }
    return { part: i, name: mesh.name, minimum, maximum, below, near, minimumVertex };
  });
  return { frame: row.frame, gameTime: row.gameTime, wallTime: row.wallTime, phase: row.phase, stage: row.stage, strike: row.strike,
    alive: row.alive, deathT: row.deathT, hp: row.hp, playerHp: row.playerHp,
    minimum: Math.min(...parts.map(p => p.minimum)), below: parts.reduce((sum, p) => sum + p.below, 0), near: parts.reduce((sum, p) => sum + p.near, 0), parts };
});
const summarize = rows => ({ frames: rows.length, minimum: rows.length > 0 ? Math.min(...rows.map(r => r.minimum)) : null,
  maximumMinimum: rows.length > 0 ? Math.max(...rows.map(r => r.minimum)) : null, framesBelow: rows.filter(r => r.below > 0).length,
  framesWithoutNearContact: rows.filter(r => r.near === 0).length });
writeFileSync(output, `${JSON.stringify({ schema: 'wildshard.conch.exact-weighted-world-contact.v1',
  traceSha256: hash(traceBytes), geometrySha256: hash(geometryBytes), canonicalPayloadSha256: hash(canonical.payload), canonicalGeometryExact: true,
  groundY: 900, vertices, blendedVertices, method: 'meshWorld * bindInverse * sum(weight * boneWorld * inverseBind * bind * canonicalVertex), all four weights; captured transforms for each actual rendered frame. Canonical payload regenerated from pinned original with T(0,0,.05) Ry(pi).',
  thresholds: { below: -.005, nearAbsolute: .02 }, summary: summarize(frames), living: summarize(frames.filter(r => r.alive)),
  settledCorpse: summarize(frames.filter(r => !r.alive && r.deathT >= 1)),
  phases: Object.fromEntries([...new Set(frames.map(r => r.phase))].map(phase => [phase, summarize(frames.filter(r => r.phase === phase))])),
  acceptance: { visual: false, animation: false, collider: false, plantedContact: false }, frames }, null, 2)}\n`);
