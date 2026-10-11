// oxlint-disable-next-line import/no-nodejs-modules -- Synth fixtures own their temporary author folders.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Every fixture gets a separate disposable author project.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Inspect only fixture-owned output paths.
import { join, resolve } from 'node:path';
import { Group, Mesh, BoxGeometry, MeshStandardMaterial } from 'three';
import { expect, it } from 'vitest';
import { synthProject, synthScene } from '../src/sdk/synth';
import { runCli } from '../src/sdk/cli';
import { templateProps } from '../src/shards/_template/generators/templatePropsSource';

it('Template 1 produces identical inspectable scene bytes in two independent generator runs', () => {
  const root = mkdtempSync(join(tmpdir(), 'template-scene-synth-'));
  const first = templateProps(20), second = templateProps(20);
  try {
    const a = synthScene(first.source.static, root, 'template-1'), before = readFileSync(a.path);
    const b = synthScene(second.source.static, root, 'template-1');
    expect(b.hash).toBe(a.hash); expect(readFileSync(b.path)).toEqual(before);
    expect(readFileSync(join(root, '.wildshard/cache/template-1', a.hash, 'scene.json'))).toEqual(before);
    expect(a.scene.nodes.length).toBeGreaterThan(20);
    expect(before.toString()).not.toContain('uuid');
  } finally { first.dispose(); second.dispose(); rmSync(root, { recursive: true, force: true }); }
});

it('wildshard synth executes real three.js author objects without drawing or writing a product', async () => {
  const root = mkdtempSync(join(tmpdir(), 'scene-synth-cli-'));
  try {
    symlinkSync(resolve('node_modules'), join(root, 'node_modules'));
    writeFileSync(join(root, 'shard.config.ts'), `import { Scene, Mesh, BoxGeometry, MeshStandardMaterial } from 'three';\nexport const identity = { slug: 'scene-pilot' };\nexport const scene = new Scene();\nconst floor = new Mesh(new BoxGeometry(8, 1, 12), new MeshStandardMaterial({color: 0x8899aa}));\nfloor.name = 'floor'; scene.add(floor);`);
    await runCli(['synth', root]);
    const a = await synthProject(root), b = await synthProject(root);
    expect(a.hash).toBe(b.hash); expect(a.scene.nodes.find(node => node.name === 'floor')?.geometry).toBe(0);
    expect(readFileSync(a.path, 'utf8')).toBe(`${JSON.stringify(JSON.parse(readFileSync(a.path, 'utf8')))}\n`);
    await expect(runCli(['synth', root, 'unexpected'])).rejects.toThrow('usage');
    writeFileSync(join(root, 'shard.config.ts'), "export const identity = { slug: 'scene-pilot' }; export const scene = {}; ");
    await expect(synthProject(root)).rejects.toThrow('real three.js scene');
    expect((synthScene(new Group(), root, 'scene-pilot')).scene.nodes).toHaveLength(1);
    mkdirSync(join(root, 'runtime')); writeFileSync(join(root, 'runtime/scene.ts'), "export const scene = {};");
    writeFileSync(join(root, 'shard.config.ts'), "export { scene } from './runtime/scene'; export const identity = { slug: 'scene-pilot' };");
    await expect(synthProject(root)).rejects.toThrow('outside authoring folders');
    writeFileSync(join(root, 'shard.config.ts'), "import '@wildshard/game/plugin/context'; export const identity = { slug: 'scene-pilot' };");
    await expect(synthProject(root)).rejects.toThrow('trusted runtime');
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 20_000);

it('refuses corrupt immutable bytes and cache/source symlinks before writing outside the project', async () => {
  const root = mkdtempSync(join(tmpdir(), 'scene-synth-refusal-'));
  const project = join(root, 'project'); mkdirSync(project);
  try {
    const scene = new Group(); scene.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial()));
    const result = synthScene(scene, project, 'pilot');
    const immutable = join(project, '.wildshard/cache/pilot', result.hash, 'scene.json');
    writeFileSync(immutable, 'corrupt');
    expect(() => synthScene(scene, project, 'pilot')).toThrow('content hash');
    expect(() => synthScene(scene, project, '../outside')).toThrow('slug');
    const other = join(root, 'other'); mkdirSync(other); symlinkSync(other, join(project, '.wildshard/cache/escaped'));
    expect(() => synthScene(scene, project, 'escaped')).toThrow('outside project');
    writeFileSync(join(root, 'outside.ts'), 'throw new Error("must not execute")');
    symlinkSync(join(root, 'outside.ts'), join(project, 'shard.config.ts'));
    await expect(synthProject(project)).rejects.toThrow('outside project');
  } finally { rmSync(root, { recursive: true, force: true }); }
});


it('synth preserves SDK declaration constructors in the authored module graph', async () => {
  const root = mkdtempSync(join(tmpdir(), 'scene-synth-declarations-'));
  try {
    symlinkSync(resolve('node_modules'), join(root, 'node_modules'));
    writeFileSync(join(root, 'shard.config.ts'), `import { Scene, Vector3 } from 'three';
import { Entry } from '@wildshard/sdk/entries';
import { PlayerStart, Spawn } from '@wildshard/sdk/spawns';
import { BoxCollider } from '@wildshard/sdk/physics';
import { Zipline } from '@wildshard/sdk/modes';
export const identity = { slug: 'declaration-pilot' };
export const scene = new Scene();
const goat = new Spawn('goat'); goat.name = 'goat-1';
const collider = new BoxCollider(2, 1, 3); collider.name = 'floor';
scene.add(...Entry.midpoints(), new PlayerStart(), goat, collider, new Zipline(new Vector3(0, 10, 0), new Vector3(0, 0, 20)));`);
    const a = await synthProject(root), b = await synthProject(root);
    expect(b.hash).toBe(a.hash);
    expect(a.scene.entries).toHaveLength(4);
    expect(a.scene.playerStart).not.toBeNull();
    expect(a.scene.spawns).toHaveLength(1);
    expect(a.scene.colliders).toHaveLength(1);
    expect(a.scene.modes?.traverse).toHaveLength(1);
    expect(a.scene.nodes.filter(node => node.declaration !== undefined)).toHaveLength(8);
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 20_000);
