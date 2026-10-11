#!/usr/bin/env node
// DS1.5: Node is the canonical physics producer. Execute the native authored recipes, including the engine practice
// room, without drawing. Independent Node runs are the canonical byte oracle.
// node --experimental-transform-types --import ./scripts/bake-loader.mjs src/shards/nine-dragon-stack/generators/bake-nine-physics.mjs [--check]
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { byteWriter } from '../../../../scripts/bake-output.mjs';
import { installBakeEnvironment } from '../../../../scripts/bake/environment.mjs';
import { visitAuthoredWorld } from '../../../../scripts/bake/worldHost.mjs';
import { ninePhysicsInputs } from '../../../../scripts/nine-physics-inputs.mjs';

const root = resolve(import.meta.dirname, '../../../..');
const environment = installBakeEnvironment(root);
const at = path => import(pathToFileURL(resolve(root, path)).href);
const noop = () => undefined;
try {
  const THREE = await import('three');
  const sky = new Proxy({ setupMaterial: noop, csm: { lights: [new THREE.DirectionalLight()], update: noop },
    hemi: new THREE.HemisphereLight(), sunDisc: new THREE.Mesh(new THREE.SphereGeometry(), new THREE.MeshBasicMaterial()),
    planet: new THREE.Group(), clouds: null, dayNight: null, viewCamera: new THREE.PerspectiveCamera(), sunDir: new THREE.Vector3(0, 1, 0) },
  { get: (target, key) => key in target ? target[key] : typeof key === 'string' && key.endsWith('Color')
    ? new THREE.Color(1, 1, 1) : typeof key === 'string' && key.endsWith('Dir') ? new THREE.Vector3(0, 1, 0) : undefined });
  (await at('src/engine/core/tier.ts')).initializeTier('phone');
  const { default: manifest } = await at('src/shards/nine-dragon-stack/manifest.ts');
  // A cold generation export has no generated application-wide discovery list. Install only the actual bake owner.
  (await at('src/game/shard/list.ts')).installShards([manifest]);
  (await at('src/game/shard/registry.ts')).setActiveChunk(manifest.slug);
  const { ndRuntime } = await at('src/shards/nine-dragon-stack/runtime/state.ts');
  const copy = value => JSON.parse(JSON.stringify(value, (_key, item) => ArrayBuffer.isView(item) ? Array.from(item) : item));
  const captures = [];
  await visitAuthoredWorld(manifest, { root, sky, element: environment.element, tier: 'phone', practiceArena: true,
    createTerrain: () => ({ mesh: new THREE.Mesh(new THREE.PlaneGeometry(500, 500).rotateX(-Math.PI / 2)), punch: noop }),
    visit: ({ registry }) => {
      const pieces = registry.pieceList().filter(piece => piece.colliders?.length > 0).map(piece => {
        const row = { id: piece.id, name: piece.name, category: piece.category, file: piece.file,
          colliders: copy(piece.colliders), active: piece.active?.() ?? true };
        if (piece.surface !== undefined) row.surface = piece.surface;
        if (piece.colliderOwner !== undefined) row.colliderOwner = piece.colliderOwner;
        if (piece.follows !== undefined) {
          piece.follows.updateWorldMatrix(true, false);
          row.follows = { matrix: piece.follows.matrixWorld.toArray(), rotation: piece.followRotation !== false };
        }
        return row;
      });
      const hooks = copy(ndRuntime().world.ctx.hooks);
      if (pieces.length === 0 || hooks.length === 0 || new Set(pieces.map(piece => piece.id)).size !== pieces.length) {
        throw new Error('Invalid native Nine Node capture');
      }
      captures.push({ pieces, hooks });
    },
  });
  const captured = captures[0];
  if (captured === undefined) throw new Error('Nine authored capture did not complete');
  const inputs = ninePhysicsInputs(root);
  // Recipe identity is content-addressed, not a checkout revision or wall clock: two fresh Node runs write identical bytes.
  const digest = createHash('sha256').update(JSON.stringify(inputs)).digest('hex');
  const result = { version: 1, revision: digest.slice(0, 40), build: `node-${digest}`, profile: 'Node / phone / no renderer',
    notice: 'DO NOT EDIT: regenerate with generators/bake-nine-physics.mjs. revision identifies the recipe inputs.', inputs, ...captured };
  const writer = byteWriter(process.argv.includes('--check'), 'bake-nine-physics');
  writer.put(resolve(root, 'src/shards/nine-dragon-stack/runtime/physics.baked.json'), `${JSON.stringify(result)}\n`);
  writer.finish();
  console.log(`bake-nine-physics: ${String(captured.pieces.length)} collider pieces, ${String(captured.hooks.length)} hooks, Node canonical`);
} finally {
  try { (await at('src/engine/app/resources.ts')).pageScope.dispose(); }
  finally { environment.dispose(); }
}
