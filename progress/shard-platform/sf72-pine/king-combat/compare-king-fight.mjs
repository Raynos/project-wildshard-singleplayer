import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Matrix4, Vector3 } from 'three';
import * as v from 'valibot';
import { readKingRig } from '../../../../src/shards/pine-hollow/generators/bake-pine-king-collision.mjs';
import { advanceKingPose, newPose } from '../../../../src/shards/pine-hollow/combat/kingRig.ts';
import { KingCollision } from '../../../../src/shards/pine-hollow/runtime/kingCollision.ts';
import { readKingCollisionBake } from '../../../../src/shards/pine-hollow/runtime/kingCollisionBake.ts';

const finite = v.pipe(v.number(), v.finite()), xyz = v.object({ x: finite, y: finite, z: finite });
const triple = v.tuple([finite, finite, finite]), segment = v.tuple([triple, triple]);
const Input = v.object({ dt: finite, t: finite, scale: finite, speed: finite, deathT: finite, flinch: finite,
  brace: finite, attack: finite, lookWeight: finite, yaw: finite, lookTarget: xyz, position: xyz,
  mem: v.record(v.string(), finite) });
const Trace = v.object({ version: v.object({ build: v.string() }), actualFight: v.literal(true), samplePoint: v.string(),
  modes: v.array(v.string()), frames: v.array(v.object({ sequence: finite, phase: finite, mode: v.string(),
    input: Input, world: v.pipe(v.array(finite), v.length(16)), head: triple, body: segment, fore: segment, ribs: triple })) });
const source = process.argv[2], output = process.argv[3];
if (!source || !output) throw new Error('Expected trace and result path');
const trace = v.parse(Trace, JSON.parse(readFileSync(source, 'utf8')));
const root = fileURLToPath(new URL('../../../../', import.meta.url)), { rest } = readKingRig(root), pose = newPose(), world = new Matrix4();
const bake = readKingCollisionBake(JSON.parse(readFileSync(new URL('../../../../src/shards/pine-hollow/runtime/kingCollision.baked.json', import.meta.url), 'utf8')));
const collision = new KingCollision(bake.joints, bake.volumes), a = new Vector3(), b = new Vector3();
const epsilon = 1e-10, max = { head: 0, body: 0, fore: 0, ribs: 0 }, failures = [];
for (const frame of trace.frames) {
  collision.pose(advanceKingPose(frame.input, rest, pose), world.fromArray(frame.world));
  const head = collision.head(a).distanceTo(b.fromArray(frame.head));
  collision.body(a, b);
  const body = Math.max(a.distanceTo(new Vector3(...frame.body[0])), b.distanceTo(new Vector3(...frame.body[1])));
  collision.fore(a, b);
  const fore = Math.max(a.distanceTo(new Vector3(...frame.fore[0])), b.distanceTo(new Vector3(...frame.fore[1])));
  const ribs = collision.ribs(a).distanceTo(b.fromArray(frame.ribs));
  for (const [key, value] of Object.entries({ head, body, fore, ribs })) {
    max[key] = Math.max(max[key], value);
    if (value > epsilon && failures.length < 8) failures.push({ sequence: frame.sequence, phase: frame.phase, mode: frame.mode, key, value });
  }
}
const result = { build: trace.version.build, actualFight: true, samples: trace.frames.length, modes: trace.modes,
  samplePoint: trace.samplePoint, epsilonMetres: epsilon, maxErrorMetres: max,
  pass: Object.values(max).every(value => value <= epsilon), firstFailures: failures,
  limitation: 'Render-time old live volumes only; pre-render hit-delivery matrix-cache timing is not covered and FK queries remain unactivated.' };
writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
if (!result.pass) process.exitCode = 1;
