// oxlint-disable-next-line import/no-nodejs-modules -- Inspect the isolated registered author job.
import process from 'node:process';
import { BufferGeometry, Material, Mesh } from 'three';
import { expect, it } from 'vitest';
import { auditAuthoringInputs, isAuthoringInput } from '../scripts/authoring-inputs.mjs';
import { discoverGeneration } from '../scripts/generate.mjs';
import { signalTowerPhysicsPlacements } from '../src/shards/sunscar-dunes/generators/towerColliders';
import { signalHeightAt } from '../src/shards/sunscar-dunes/generators/landscape';
import { TOWER } from '../src/shards/sunscar-dunes/data/layout';
import { buildTowerFrame } from '../src/shards/sunscar-dunes/generators/tower';
import native from '../src/shards/sunscar-dunes/runtime/physics.baked.json' with { type: 'json' };

it('compiles all forty native tower boxes with exact persisted order, ownership and contact tags', () => {
  const rows = signalTowerPhysicsPlacements(), tower = native.pieces.find(piece => piece.id === 'sunscar.tower');
  if (tower === undefined) throw new Error('Missing native tower');
  expect(rows).toHaveLength(1);
  expect(rows[0]?.colliders).toHaveLength(40);
  expect(JSON.stringify(rows)).toBe(JSON.stringify([tower]));
});

it('preserves every shipping stair headroom branch and collider arithmetic across independent terrain seeds', () => {
  for (const seed of [5363, 357, 0, 0xffffffff]) {
    const groundAt = signalHeightAt(seed), frame = buildTowerFrame(groundAt(TOWER.x, TOWER.z), groundAt);
    try {
      expect(JSON.stringify(signalTowerPhysicsPlacements(seed)[0]?.colliders)).toBe(JSON.stringify(frame.colliders));
    } finally {
      frame.root.traverse(node => {
        if (!(node instanceof Mesh)) return;
        const geometry: unknown = node.geometry, material: unknown = node.material;
        if (geometry instanceof BufferGeometry) geometry.dispose();
        const materials: unknown[] = Array.isArray(material) ? material : [material];
        for (const item of materials) if (item instanceof Material) item.dispose();
      });
    }
  }
});

it('does not share mutable shapes between independent cold runs', () => {
  const rows = signalTowerPhysicsPlacements(), bytes = JSON.stringify(rows), box = rows[0]?.colliders[0];
  if (box === undefined) throw new Error('Missing leg');
  box.hy = 999;
  expect(JSON.stringify(signalTowerPhysicsPlacements())).toBe(bytes);
});

it('pins a complete source-only component without captured tower JSON, runtime seeds or a removal claim', () => {
  const root = process.cwd(), job = discoverGeneration(root).jobs.find(row => row.id === 'signal-tower-colliders');
  if (job === undefined) throw new Error('Missing tower collider job');
  const audits = [job.entry, 'src/sdk/bake/source-loader.mjs'].map(entry => auditAuthoringInputs(root, 'sunscar-dunes', entry));
  expect(audits.flatMap(audit => audit.issues)).toEqual([]);
  const inputs = [...new Set([...audits.flatMap(audit => audit.files), 'src/sdk/bake/json.mjs', 'src/sdk/package.json', 'src/format/package.json', 'package.json', 'pnpm-lock.yaml'])].sort();
  expect(job.inputRoots).toEqual(inputs);
  expect(job.inputRoots.filter(file => !isAuthoringInput(file, 'sunscar-dunes') && !['package.json', 'pnpm-lock.yaml'].includes(file))).toEqual([]);
  expect(job.inputRoots).not.toContain('src/shards/sunscar-dunes/data/tower.json');
  expect(job.seedOutputs).toEqual([]);
  expect(job.outputs).toEqual(['src/shards/sunscar-dunes/data/towerPhysics.generated.json']);
  expect(job.outputs).not.toContain('src/shards/sunscar-dunes/runtime/physics.baked.json');
});
