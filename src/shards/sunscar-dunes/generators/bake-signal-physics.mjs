#!/usr/bin/env node
// DS1.5: build the real authored world and its finite native creature models in Node; never import a recorded physics bake.
// node --experimental-transform-types --import ./scripts/bake-loader.mjs src/shards/sunscar-dunes/generators/bake-signal-physics.mjs [--check]
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { byteWriter } from '../../../../scripts/bake-output.mjs';
import { installBakeEnvironment } from '../../../../scripts/bake/environment.mjs';
import { visitAuthoredWorld } from '../../../../scripts/bake/worldHost.mjs';
import { signalPhysicsInputs } from '../../../../scripts/signal-physics-inputs.mjs';
import authoredPlacements from '../data/physicsPlacements.generated.json' with { type: 'json' };

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
  const { default: manifest } = await at('src/shards/sunscar-dunes/manifest.ts');
  (await at('src/game/shard/list.ts')).installShards([manifest]);
  (await at('src/game/shard/registry.ts')).setActiveChunk(manifest.slug);
  const { SignalDunesPlugin } = await at('src/shards/sunscar-dunes/plugin.ts');
  const contexts = [];
  // Borrow the real native world hook once, retaining its owned context and built places only during capture.
  class CaptureSignal extends SignalDunesPlugin {
    /** @param {import('@wildshard/game/shard/context').ShardContext} ctx */
    async world(ctx) { await super.world(ctx); contexts.push({ ctx, places: this.places }); }
  }
  const captures = [];
  await visitAuthoredWorld({ ...manifest, load: () => Promise.resolve({ default: CaptureSignal }) },
  { root, sky, element: environment.element, tier: 'phone', practiceArena: true,
    createTerrain: () => ({ mesh: new THREE.Mesh(new THREE.PlaneGeometry(500, 500).rotateX(-Math.PI / 2)), punch: noop }),
    visit: async ({ scene, forest, registry }) => {
      const captured = contexts[0];
      if (captured === undefined || captured.places === null) throw new Error('Signal native world did not install its places');
      const { ctx, places } = captured;
      const { app } = await at('src/engine/app/runtime.ts');
      const scope = app.levelScope;
      if (scope === null) throw new Error('Signal capture requires the owned level scope');
      for (const [rowFile, row, lookFile, look] of [['data/species/duneRay', 'DUNE_RAY', 'species/duneRay', 'DUNE_RAY_LOOK'],
        ['data/species/skitterer', 'SKITTERER_DATA', 'species/skitterer', 'SAND_SKITTERER_LOOK'],
        ['data/species/strider', 'DUNE_STRIDER', 'species/strider', 'DUNE_STRIDER_LOOK'],
        ['species/matriarch', 'DUNE_MATRIARCH', 'species/matriarch', 'DUNE_MATRIARCH_LOOK']]) {
        const rows = await at(`src/shards/sunscar-dunes/${rowFile}.ts`), looks = await at(`src/shards/sunscar-dunes/${lookFile}.ts`);
        app.species.registerRow(rows[row], scope); app.species.registerLook(looks[look], scope);
      }
      const { duneMesh, duneRig } = await at('src/shards/sunscar-dunes/world/meshes.ts');
      const source = duneMesh('caravan-scout');
      if (source === null) throw new Error('Signal scout model is missing');
      scope.own(source);
      const body = duneRig('skitterer');
      if (body === null) throw new Error('Signal skitterer rig is missing');
      scope.own(body);
      const { SCOUT_NPC } = await at('src/shards/sunscar-dunes/quests/scout.ts');
      const { installPivotNpc } = await at('src/shards/sunscar-dunes/runtime/quest/pivotNpc.ts');
      const scout = installPivotNpc(ctx, SCOUT_NPC, { source,
        groundAt: (x, z) => manifest.ground.terrain?.heightAt(x, z) ?? 0,
        player: new THREE.Vector3(manifest.spawn.x, manifest.spawn.y, manifest.spawn.z), met: () => false,
        file: 'src/shards/sunscar-dunes/quests/scout.ts' });
      // The page's actual prompt constructor, row and live head anchor; no rendered presentation is needed.
      const { NpcTalk } = await at('src/engine/quest/view.ts');
      const { DialogueBox } = await at('src/engine/quest/view/ui.ts');
      const { npcDef } = await at('src/game/plugin/quests.ts');
      const { STRINGS } = await at('src/shards/sunscar-dunes/data/strings.ts');
      const talk = new NpcTalk({ npc: npcDef(SCOUT_NPC), at: scout.head, label: STRINGS.talkScout,
        speaker: scout.speaker, radius: SCOUT_NPC.talkRadius, flags: places.flags, dialogue: new DialogueBox(scope.child('bake.scout')) });
      const runtime = ctx.game.runtime;
      if (runtime === null) throw new Error('Signal native world lost its runtime');
      runtime.interactables.push(talk.prompt);
      const { AnimalManager } = await at('src/engine/entities/AnimalManager.ts');
      const animals = new AnimalManager(scene, sky, forest).build();
      const { SIGNAL_SPAWNS } = await at('src/shards/sunscar-dunes/data/spawns.ts');
      const actors = SIGNAL_SPAWNS.homes.map(row => {
        const animal = animals.spawn(row.kind, row.at[0], row.at[1], row.yaw, row.look, { entityId: row.id });
        return { id: row.id, kind: row.kind, spec: copy(animal.simSpec), seed: animal.seed, scale: animal.scale };
      });
      const bosses = SIGNAL_SPAWNS.bosses.map(row => {
        const animal = animals.spawn(row.kind, row.at[0], row.at[1], row.yaw, row.look, { entityId: row.id });
        return { id: row.id, kind: row.kind, spec: copy(animal.simSpec) };
      });
      // G320: these rest placements are compiled from authoring source, not read back from world constructors.
      const authored = new Map(authoredPlacements.map(row => [row.id, row]));
      const missing = new Set(authored.keys());
      const pieces = registry.pieceList().filter(piece => piece.colliders?.length > 0).map(piece => {
        const planned = authored.get(piece.id);
        if (planned !== undefined) { missing.delete(piece.id); return structuredClone(planned); }
        const row = { id: piece.id, name: piece.name, category: piece.category, file: piece.file,
          colliders: copy(piece.colliders), active: piece.active?.() ?? true,
          owner: piece.colliderOwner === undefined ? `piece:${piece.id}` : `string:${piece.colliderOwner}` };
        if (piece.surface !== undefined) row.surface = piece.surface;
        if (piece.colliderOwner !== undefined) row.colliderOwner = piece.colliderOwner;
        if (piece.follows !== undefined) {
          piece.follows.updateWorldMatrix(true, false);
          row.follows = { matrix: piece.follows.matrixWorld.toArray(), rotation: piece.followRotation !== false };
        }
        return row;
      });
      if (missing.size > 0) throw new Error(`Authored Signal placement has no native identity: ${[...missing].join(', ')}`);
      const spot = (id, p, radius) => ({ id, x: p.x, y: p.y, z: p.z, radius });
      const spots = { interact: [spot('logbook', places.logbook.position, places.logbook.radius), spot('well', places.well.spot.position, places.well.spot.radius),
        ...places.braziers.map((b, i) => spot(`brazier.${String(i)}`, b.spot.position, b.spot.radius)), spot('fire', places.fire.brazier.position, places.fire.brazier.radius)],
        crack: places.crackables.map((c, i) => spot(i === 0 ? 'well.crank' : `brazier.${String(i - 1)}`, c.at, c.radius)) };
      const registered = registry.pieceList();
      const ownerId = owner => {
        if (typeof owner === 'string') return `string:${owner}`;
        const piece = registered.find(p => p === owner);
        if (piece === undefined) throw new Error('Prompt sight owner is not an actual registered piece');
        return `piece:${piece.id}`;
      };
      const ids = new Map([[places.logbook, 'logbook'], [places.well.spot, 'well'], [places.fire.brazier, 'fire'], [talk.prompt, 'scout'],
        ...places.braziers.map((b, i) => [b.spot, `brazier.${String(i)}`])]);
      const promptRegistrations = runtime.interactables.map(prompt => {
        const sight = prompt.sight;
        const row = { id: ids.get(prompt) ?? null, position: { x: prompt.position.x, y: prompt.position.y, z: prompt.position.z },
          radius: prompt.radius, sight: { slack: sight?.slack ?? 0.5 } };
        if (prompt.weak !== undefined) row.weak = prompt.weak;
        if (sight?.body !== undefined && sight.body !== null) row.sight.body = ownerId(sight.body);
        return row;
      });
      if (actors.length !== 13 || pieces.length === 0 || bosses.length !== 1 || promptRegistrations.length !== 7) throw new Error('Invalid native Signal Node capture');
      captures.push({ actors, pieces, spots, promptRegistrations, bosses });
    },
  });
  const captured = captures[0];
  if (captured === undefined) throw new Error('Signal authored capture did not complete');
  const inputs = signalPhysicsInputs(root), digest = createHash('sha256').update(JSON.stringify(inputs)).digest('hex');
  const result = { version: 1, revision: digest.slice(0, 40), build: `node-${digest}`, profile: 'Node / phone / no renderer',
    notice: 'DO NOT EDIT: regenerate with generators/bake-signal-physics.mjs. revision identifies the recipe inputs.', inputs, ...captured };
  const writer = byteWriter(process.argv.includes('--check'), 'bake-signal-physics');
  writer.put(resolve(root, 'src/shards/sunscar-dunes/runtime/physics.baked.json'), `${JSON.stringify(result)}\n`);
  writer.finish();
  console.log(`bake-signal-physics: ${String(captured.actors.length)} native actors, ${String(captured.pieces.length)} collider pieces, Node canonical`);
} finally {
  try { (await at('src/engine/app/resources.ts')).pageScope.dispose(); }
  finally { environment.dispose(); }
}
