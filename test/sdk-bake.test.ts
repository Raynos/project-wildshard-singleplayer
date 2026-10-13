// oxlint-disable-next-line import/no-nodejs-modules -- The bake writes scene.json into a throwaway author project.
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Throwaway project location.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Throwaway project location.
import { join } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- The byte comparison includes binary GLB payloads.
import { Buffer } from 'node:buffer';
import { BoxGeometry, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Scene } from 'three';
import { expect, it } from 'vitest';
import { bake, BakedPiece, Scatter, WholeShape } from '../src/sdk/bake';
import { bakeKinds } from '../src/sdk/bake/kinds';
import { bakeProps } from '../src/sdk/bake/props';
import { BoxCollider } from '../src/sdk/physics';
import { encodeCanonicalJson } from '../src/sdk/immutable';
import { templateProps, templateScene } from '../src/shards/_template/generators/templatePropsSource';

const rough = (color: number) => new MeshStandardMaterial({ color, roughness: 1, metalness: 0 });

it('bakes a transformed WholeShape once, byte-identically to its direct whole-mesh source', () => {
  const scene = new Scene(), mesh = new Mesh(new BoxGeometry(2, 3, 4), new MeshStandardMaterial({ roughness: 0.4 }));
  mesh.name = 'whole-mesh'; mesh.position.set(1, 1.5, 2); mesh.castShadow = true;
  const shape = new WholeShape('whole-shape', mesh); shape.position.set(30, 0, -40); shape.rotation.y = 0.3; scene.add(shape);
  scene.updateMatrixWorld(true);
  const whole = [{ id: shape.name, mesh, transform: mesh.matrixWorld.clone() }];
  const direct = bakeProps({ static: new Scene(), whole });
  const viaScene = bake(scene, { slug: 'whole-test' }).props;
  const viaInputs = bake(new Scene(), { slug: 'whole-test' }, { props: { whole } }).props;
  for (const actual of [viaScene, viaInputs]) {
    if (actual === null) throw new Error('Whole mesh was omitted from bake');
    expect(actual.props).toEqual(direct.props); expect(actual.files).toEqual(direct.files);
    expect(actual.report).toEqual(direct.report);
    expect(actual.report).toHaveLength(1); expect(actual.report[0]?.triangles).toBe(12);
    expect(actual.report[0]?.draws).toBe(2); // one surface plus its declared shadow pass
    expect([...actual.assets.keys()]).toEqual([...direct.assets.keys()]);
    for (const [hash, bytes] of actual.assets) expect(Buffer.from(bytes)).toEqual(Buffer.from(direct.assets.get(hash) ?? []));
  }
});

/** A small camp: a hut and a ramp (static), crates (instanced scatter), posts (scatter), a rock piece and a collider. */
function camp(): { scene: Scene; piece: () => InstancedMesh } {
  const scene = new Scene();
  const hut = new Mesh(new BoxGeometry(4, 3, 4), rough(0xc9a355)); hut.name = 'camp.hut'; hut.position.set(40, 1.5, -12); scene.add(hut);
  const ramp = new Mesh(new BoxGeometry(2, 0.5, 6), rough(0x7a5634)); ramp.name = 'camp.ramp'; ramp.position.set(-70, 0.25, 90); ramp.rotation.y = 0.4; scene.add(ramp);
  const crates = new InstancedMesh(new BoxGeometry(0.8, 0.8, 0.8), rough(0x7a5634), 3); crates.name = 'camp.crates';
  [[2, 0.4, 1], [2.9, 0.4, 1.2], [130, 1.2, -40]].forEach(([x = 0, y = 0, z = 0], i) => { crates.setMatrixAt(i, new Matrix4().makeTranslation(x, y, z)); });
  scene.add(crates);
  scene.add(new Scatter('camp.posts', new Mesh(new BoxGeometry(0.2, 3, 0.2), rough(0x333333)), [new Matrix4().makeTranslation(10, 1.5, 10), new Matrix4().makeTranslation(-180, 1.5, 200)]));
  const piece = (): InstancedMesh => { const rocks = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ color: 0x886644, flatShading: true }), 2); rocks.setMatrixAt(0, new Matrix4().makeTranslation(5, 0, 5)); rocks.setMatrixAt(1, new Matrix4().makeTranslation(-5, 0, 7)); return rocks; };
  scene.add(new BakedPiece('camp.rocks', [['boulders', piece()]], [{ kind: 'box', x: 5, y: 0.5, z: 5, hx: 0.5, hy: 0.5, hz: 0.5 }], {}, { anchors: { y: 0 } }));
  const wall = new BoxCollider(4, 3, 0.3); wall.name = 'camp.wall'; wall.position.set(40, 1.5, -10); scene.add(wall);
  return { scene, piece };
}

it('bakes a fixture scene into terrain + merged prop tiles, scatter instances, a kinds piece, colliders and scene.json', () => {
  const project = realpathSync(mkdtempSync(join(tmpdir(), 'sdk-bake-')));
  try {
    const { scene, piece } = camp();
    const out = bake(scene, { slug: 'ember-camp', name: 'Ember Camp' }, { project, terrain: { heightAt: () => 0, colourAt: () => [0.5, 0.4, 0.3] } });
    // every terrain tile, with the props merged onto the tiles they touch, in the product's canonical order
    expect(out.shardfile.tiles).toHaveLength(80);
    expect(out.shardfile.tiles.map((t) => [t.lod, t.x, t.z])).toEqual([...out.shardfile.tiles].sort((a, b) => a.lod - b.lod || a.x - b.x || a.z - b.z).map((t) => [t.lod, t.x, t.z]));
    expect(out.props?.props.tiles.length).toBeGreaterThan(0);
    expect(out.shardfile.terrain?.tiles).toHaveLength(80);
    expect(out.shardfile.critical).toHaveLength(1);
    for (const file of out.shardfile.files) expect(out.assets.has(file.hash), file.hash).toBe(true);
    // the piece is exactly the kinds baker's bytes and rows
    const direct = bakeKinds('camp.rocks', [['boulders', piece()]], [{ kind: 'box', x: 5, y: 0.5, z: 5, hx: 0.5, hy: 0.5, hz: 0.5 }]);
    expect(out.pieces).toHaveLength(1);
    expect(Buffer.from(out.pieces[0]?.glb ?? []).equals(Buffer.from(direct.glb))).toBe(true);
    expect(out.pieces[0]?.kinds).toEqual(direct.kinds);
    expect(out.pieces[0]?.rows).toEqual({ anchors: { y: 0 } });
    expect(out.colliders.pieces).toEqual([{ piece: 'camp.rocks', colliders: direct.colliders }]);
    expect(out.colliders.scene.map((c) => c.id)).toEqual(['camp.wall']);
    // scene.json: every node, the scatter's instances, written where synth writes it, stable across runs
    expect(out.scenePath).toBe(join(project, '.wildshard/cache/ember-camp/scene.json'));
    const json: unknown = JSON.parse(readFileSync(out.scenePath ?? '', 'utf8'));
    expect(json).toEqual(out.scene);
    expect(out.scene.nodes.find((n) => n.id === 'camp.posts')?.instances).toHaveLength(2);
    expect(out.scene.nodes.find((n) => n.id === 'camp.crates')?.instances).toHaveLength(3);
    expect(bake(camp().scene, { slug: 'ember-camp' }, { project, terrain: { heightAt: () => 0, colourAt: () => [0.5, 0.4, 0.3] } }).sceneHash).toBe(out.sceneHash);
  } finally { rmSync(project, { recursive: true, force: true }); }
});

it('refuses an unnamed slug, a moved scatter and duplicate pieces', () => {
  expect(() => bake(new Scene(), { slug: 'Bad Slug' })).toThrow(/slug/u);
  const moved = new Scene(), scatter = new Scatter('s', new Mesh(new BoxGeometry(), rough(1)), [new Matrix4()]); scatter.position.x = 1; moved.add(scatter);
  expect(() => bake(moved, { slug: 'x' })).toThrow(/world origin/u);
  const twice = new Scene(); twice.add(new BakedPiece('p', [], []), new BakedPiece('p', [], []));
  expect(() => bake(twice, { slug: 'x' })).toThrow(/unique name/u);
});

it('bakes the template scene to the exact bytes the props baker gave its source (the template is a real user)', () => {
  const scene = templateScene(20), source = templateProps(20);
  try {
    const viaScene = bake(scene.scene, { slug: 'template' }, { props: scene.props }).props, direct = bakeProps(source.source);
    expect(viaScene).not.toBeNull();
    const rows = (p: typeof direct) => encodeCanonicalJson({ props: p.props, tiles: p.tiles, files: p.files, library: p.library, far: p.far, report: p.report });
    if (viaScene !== null) expect(rows(viaScene)).toBe(rows(direct));
    expect(rows(direct)).toBe(readFileSync('src/shards/_template/data/props.json', 'utf8'));
  } finally { scene.dispose(); source.dispose(); }
});
