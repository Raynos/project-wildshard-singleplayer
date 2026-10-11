#!/usr/bin/env node
// DS1.5: build the real authored world and its finite native creature models in Node; never import a recorded physics bake.
// node --experimental-transform-types --import ./scripts/bake-loader.mjs src/shards/far-reach/generators/bake-sky-physics.mjs [--check]
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { byteWriter } from '../../../../scripts/bake-output.mjs';
import { installBakeEnvironment } from '../../../../scripts/bake/environment.mjs';
import { visitAuthoredWorld } from '../../../../scripts/bake/worldHost.mjs';
import { skyPhysicsInputs } from '../../../../scripts/sky-physics-inputs.mjs';
import authoredPlacements from '../data/physicsPlacements.generated.json' with { type: 'json' };
import authoredBridges from '../data/bridgePhysics.generated.json' with { type: 'json' };

const root = resolve(import.meta.dirname, '../../../..');
const at = path => import(pathToFileURL(resolve(root, path)).href);
const environment = installBakeEnvironment(root);
const noop = () => undefined;
const copy = value => JSON.parse(JSON.stringify(value, (_key, item) => ArrayBuffer.isView(item) ? Array.from(item) : item));
try {
  const THREE = await import('three');
  const sky = new Proxy({ setupMaterial: noop, csm: { lights: [new THREE.DirectionalLight()], update: noop },
    hemi: new THREE.HemisphereLight(), sunDisc: new THREE.Mesh(new THREE.SphereGeometry(), new THREE.MeshBasicMaterial()),
    planet: new THREE.Group(), clouds: null, dayNight: null, viewCamera: new THREE.PerspectiveCamera(), sunDir: new THREE.Vector3(0, 1, 0) },
  { get: (target, key) => key in target ? target[key] : typeof key === 'string' && key.endsWith('Color')
    ? new THREE.Color(1, 1, 1) : typeof key === 'string' && key.endsWith('Dir') ? new THREE.Vector3(0, 1, 0) : undefined });
  (await at('src/engine/core/tier.ts')).initializeTier('phone');
  const { default: manifest } = await at('src/shards/far-reach/manifest.ts');
  (await at('src/game/shard/list.ts')).installShards([manifest]);
  (await at('src/game/shard/registry.ts')).setActiveChunk(manifest.slug);
  const captures = [];
  await visitAuthoredWorld(manifest, { root, sky, element: environment.element, tier: 'phone', practiceArena: true,
    createTerrain: () => ({ mesh: new THREE.Mesh(new THREE.PlaneGeometry(500, 500).rotateX(-Math.PI / 2)), punch: noop }),
    visit: async ({ scene, forest, registry }) => {
      const { app } = await at('src/engine/app/runtime.ts');
      const scope = app.levelScope;
      if (scope === null) throw new Error('Sky capture requires the owned level scope');
      // Exactly the native kit's four species/look registrations. Only presentation callbacks remain inert: no AI tick runs.
      for (const [file, row, look] of [['driftRay', 'DRIFT_RAY', 'DRIFT_RAY_LOOK'], ['skyGoat', 'SKY_GOAT', 'SKY_GOAT_LOOK'],
        ['galeWisp', 'GALE_WISP', 'GALE_WISP_LOOK'], ['stormRoc', 'STORM_ROC', 'STORM_ROC_LOOK']]) {
        const module = await at(`src/shards/far-reach/species/${file}.ts`);
        app.species.registerRow(module[row], scope); app.species.registerLook(module[look], scope);
      }
      const { skyBody } = await at('src/shards/far-reach/species/bodies.ts');
      // Refuse the browser's visual fallback: these admitted GLB rigs are the physical dimensions' source.
      for (const name of ['drift-ray', 'sky-goat', 'storm-roc']) {
        const body = skyBody(name);
        if (body === null) throw new Error(`Missing native Sky rig ${name}`);
        for (const geometry of [...body.furParts, ...body.hardParts, ...body.eyeParts]) geometry.dispose();
      }
      const { AnimalManager } = await at('src/engine/entities/AnimalManager.ts');
      const animals = new AnimalManager(scene, sky, forest).build();
      const { SKY_SPAWNS } = await at('src/shards/far-reach/data/spawns.ts');
      // The native play phase spawns rays, roost rays, wisps, then the Roc. The first fixed-post phase adds five goats.
      // Use the actual manager's spawn rolls/adoption, retaining all six draws per body in the shipping order.
      const roster = [...SKY_SPAWNS.actors.filter(row => row.kind !== 'skyGoat'), ...SKY_SPAWNS.bosses,
        ...SKY_SPAWNS.actors.filter(row => row.kind === 'skyGoat')];
      const actors = roster.map(row => {
        const animal = animals.spawn(row.kind, row.at[0], row.at[1], row.yaw, row.look, { entityId: row.id });
        return { id: row.id, spec: copy(animal.simSpec), seed: animal.seed, scale: animal.scale };
      });
      // G320: these rest placements are compiled from authoring source, not read back from world constructors.
      const authored = new Map([...authoredPlacements, ...authoredBridges].map(row => [row.id, row]));
      const missing = new Set(authored.keys());
      const pieces = registry.pieceList().filter(piece => piece.colliders?.length > 0).map(piece => {
        // Piece.mode is the actual registry's board law, independent of a renderer/player instance.
        const planned = authored.get(piece.id);
        if (planned !== undefined) { missing.delete(piece.id); return structuredClone(planned); }
        const row = { id: piece.id, name: piece.name, category: piece.category, file: piece.file,
          colliders: copy(piece.colliders), active: piece.mode === 'board' ? false : piece.active?.() ?? true };
        if (piece.mode !== undefined) row.mode = piece.mode;
        if (piece.surface !== undefined) row.surface = piece.surface;
        if (piece.colliderOwner !== undefined) row.colliderOwner = piece.colliderOwner;
        if (piece.follows !== undefined) {
          piece.follows.updateWorldMatrix(true, false);
          row.follows = { matrix: piece.follows.matrixWorld.toArray(), rotation: piece.followRotation !== false };
        }
        return row;
      });
      if (missing.size > 0) throw new Error(`Authored Sky placement has no native identity: ${[...missing].join(', ')}`);
      if (actors.length !== 13 || pieces.length === 0 || new Set(pieces.map(piece => piece.id)).size !== pieces.length) {
        throw new Error('Invalid native Sky Node capture');
      }
      captures.push({ actors, pieces });
    },
  });
  const captured = captures[0];
  if (captured === undefined) throw new Error('Sky authored capture did not complete');
  const inputs = skyPhysicsInputs(root), digest = createHash('sha256').update(JSON.stringify(inputs)).digest('hex');
  const result = { version: 1, revision: digest.slice(0, 40), build: `node-${digest}`, profile: 'Node / phone / no renderer',
    notice: 'DO NOT EDIT: regenerate with generators/bake-sky-physics.mjs. revision identifies the recipe inputs.', inputs, ...captured };
  const writer = byteWriter(process.argv.includes('--check'), 'bake-sky-physics');
  writer.put(resolve(root, 'src/shards/far-reach/runtime/physics.baked.json'), `${JSON.stringify(result)}\n`);
  writer.finish();
  console.log(`bake-sky-physics: ${String(captured.actors.length)} native actors, ${String(captured.pieces.length)} collider pieces, Node canonical`);
} finally {
  try { (await at('src/engine/app/resources.ts')).pageScope.dispose(); }
  finally { environment.dispose(); }
}
