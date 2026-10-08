#!/usr/bin/env node
// E435 / G227: real authored world inventory, never a second procedural placement builder.
// node --experimental-transform-types --import ./scripts/bake-loader.mjs scripts/bake/nalati-capture.mjs --out=<summary.json>
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { installBakeEnvironment } from './environment.mjs';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const output = process.argv.slice(2).find(arg => arg.startsWith('--out='))?.slice('--out='.length);
if (!output) throw new Error('Nalati capture requires --out=<summary.json>');
const environment = installBakeEnvironment(root), owned = [];
const noop = () => undefined;
// The navmesh baker's non-drawing sky contract. Materials run their ordinary authored setup;
// no GPU render, texture rasterisation or replacement source model participates in this inventory.
const sky = new Proxy({ setupMaterial: noop, csm: { lights: [new THREE.DirectionalLight()], update: noop },
  hemi: new THREE.HemisphereLight(), sunDisc: new THREE.Mesh(new THREE.SphereGeometry(), new THREE.MeshBasicMaterial()),
  planet: new THREE.Group(), clouds: null, dayNight: null, viewCamera: new THREE.PerspectiveCamera(), sunDir: new THREE.Vector3(0, 1, 0) },
{ get: (target, key) => key in target ? target[key] : typeof key === 'string' && key.endsWith('Color') ? new THREE.Color(1, 1, 1) : typeof key === 'string' && key.endsWith('Dir') ? new THREE.Vector3(0, 1, 0) : undefined });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const arrayHash = values => hash(new Uint8Array(values.buffer, values.byteOffset, values.byteLength));
const arraySummary = values => ({ values: values.length, sha256: arrayHash(values) });
const meshSummary = mesh => ({ sourceMesh: mesh.sourceMesh, name: mesh.name, type: mesh.type, visible: mesh.visible, matrix: mesh.matrix, materials: mesh.materials,
  attributes: Object.fromEntries(Object.entries(mesh.attributes).map(([name, channel]) => [name, { itemSize: channel.itemSize, values: channel.values.length, sha256: arrayHash(channel.values) }])),
  indices: { count: mesh.indices.length, sha256: arrayHash(mesh.indices) },
  scatter: mesh.scatter === null ? null : { ...mesh.scatter, matrices: arraySummary(mesh.scatter.matrices), colours: arraySummary(mesh.scatter.colours),
    spheres: arraySummary(mesh.scatter.spheres), ranges: arraySummary(mesh.scatter.ranges) },
  instances: mesh.instances === null ? null : { count: mesh.instances.count, capacity: mesh.instances.capacity,
    matricesSha256: arrayHash(mesh.instances.matrices), coloursSha256: mesh.instances.colours === null ? null : arrayHash(mesh.instances.colours) } });

try {
  const [{ captureNalatiAuthoredWorld }, { nalatiGroundSource }, { awaitNalatiModelLoads }, { Terrain }] = await Promise.all([
    import('./nalatiCaptureInventory.ts'), import('./nalatiGroundSource.ts'),
    import('../../src/shards/nalati-grasslands/world/glbPaint.ts'), import('../../src/engine/world/Terrain.ts'),
  ]);
  const nativeTerrain = readFileSync(resolve(root, 'public/assets/baked/nalati-grasslands/terrain.bin'));
  const capture = await captureNalatiAuthoredWorld({ root, sky, element: environment.element, nativeTerrain,
    createTerrain: () => {
      const source = nalatiGroundSource(nativeTerrain), geometry = new THREE.BufferGeometry(), material = new THREE.MeshLambertMaterial();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(source.positions, 3));
      for (const [name, channel] of Object.entries(source.attributes)) geometry.setAttribute(name, new THREE.Float32BufferAttribute(channel.values, channel.itemSize));
      geometry.setIndex(new THREE.BufferAttribute(source.indices, 1));
      const terrain = new Terrain(); terrain.mesh = new THREE.Mesh(geometry, material); terrain.material = material; terrain.group.add(terrain.mesh);
      owned.push(geometry, material); return terrain;
    }, settleModels: () => awaitNalatiModelLoads(sky),
  });
  const { placements, roots, builds } = capture.inventory;
  const { pageScope } = await import('../../src/engine/app/resources.ts');
  const { app } = await import('../../src/engine/app/runtime.ts');
  pageScope.dispose();
  const summary = { version: 1, shard: 'nalati-grasslands', nativeTerrain: { bytes: nativeTerrain.length, sha256: hash(nativeTerrain) },
    scope: 'Authored pre-cull placement and settled drawnInto inventory; candidate classification is not a completed static world bake.',
    placements: placements.map(entry => { const { copies, ...row } = entry; return { ...row, copies: copies.length, copiesSha256: hash(JSON.stringify(copies)) }; }),
    roots: roots.map(entry => ({ ...entry, meshes: entry.meshes.map(meshSummary) })),
    builds: builds.map(entry => ({ ...entry, meshes: entry.meshes.map(meshSummary) })),
    cleanup: { page: pageScope.census, levelUnloaded: app.levelScope === null, physicsReleased: app.physics === null, renderReleased: app.render === null },
    physics: { colliders: capture.native.colliders.length, pieces: capture.native.counts },
    counts: { placementRows: placements.length, authoredCopies: placements.reduce((total, entry) => total + entry.copies.length, 0),
      roots: roots.length, meshes: roots.reduce((total, entry) => total + entry.meshes.length, 0), builds: builds.length,
      uniqueMeshes: new Set(roots.flatMap(entry => entry.meshes.map(mesh => mesh.sourceMesh))).size,
      mixedRoots: roots.filter(entry => entry.roles.length > 1).length, weldBuilds: builds.filter(entry => entry.kind === 'weld').length } };
  mkdirSync(dirname(resolve(output)), { recursive: true }); writeFileSync(resolve(output), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify({ output: resolve(output), ...summary.counts, colliders: summary.physics.colliders }));
} finally {
  // This executable owns the whole inert page. The reusable host unloads its level;
  // retire the page heartbeat too, so successful capture exits through normal cleanup.
  try {
    const { pageScope } = await import('../../src/engine/app/resources.ts');
    pageScope.dispose();
  } finally {
    try { for (const resource of owned) resource.dispose(); sky.sunDisc.geometry.dispose(); sky.sunDisc.material.dispose(); }
    finally { environment.dispose(); }
  }
}
