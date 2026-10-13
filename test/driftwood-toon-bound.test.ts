// oxlint-disable-next-line import/no-nodejs-modules -- Compare the actual shipped material callbacks in an isolated VM.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Execute only the two bounded material callback bodies with fixture ports.
import { runInNewContext } from 'node:vm';
import ts from '@typescript/typescript6';
import { BoxGeometry, Mesh, MeshStandardMaterial } from 'three';
import { expect, it } from 'vitest';

it('preserves every toon and swim material assignment, geometry byte and pose', () => {
  const text = readFileSync('src/shards/driftwood-isle/runtime/viewmodel/toonArms.ts', 'utf8');
  const tree = ts.createSourceFile('toonArms.ts', text, ts.ScriptTarget.Latest, true);
  let dress = '', swim = '';
  const visit = (node: ts.Node): void => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === 'dress') dress = node.getText(tree);
    if (ts.isPropertyAssignment(node) && node.name.getText(tree) === 'setup' && ts.isArrowFunction(node.initializer) && ts.isBlock(node.initializer.body)) swim = node.initializer.body.getText(tree);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  if (dress === '' || swim === '') throw new Error('Missing actual toon callbacks');
  const materials = { arms: new MeshStandardMaterial(), wood: new MeshStandardMaterial(), iron: new MeshStandardMaterial() };
  const fixture = (): Mesh[] => ['arms', 'sword_wood', 'sword_iron'].map((name, i) => {
    const mesh = new Mesh(new BoxGeometry()); mesh.name = name;
    mesh.position.set(i + 1, i - 2, i * 3); mesh.rotation.set(i * 0.1, i * 0.2, i * 0.3); mesh.updateMatrixWorld();
    return mesh;
  });
  const pose = (meshes: Mesh[]): unknown => meshes.map(mesh => ({ matrix: [...mesh.matrixWorld.elements], positions: [...mesh.geometry.getAttribute('position').array] }));
  for (const swimming of [false, true]) {
    const actual = fixture(), original = fixture(), before = pose(actual);
    const rig = { meshes: () => actual };
    const source = swimming ? `function apply(sky) ${swim}\napply.call({swimMaterial:()=>m.arms}, sky);` : `${dress}\ndress(rig,m);`;
    const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    runInNewContext(js, { rig, m: materials, sky: {}, water: {} }, { timeout: 1000 });
    // Original callbacks: same source operations over all meshes, before the explicit finite bound.
    for (const mesh of original) {
      mesh.material = swimming ? materials.arms : mesh.name === 'sword_iron' ? materials.iron : mesh.name === 'sword_wood' ? materials.wood : materials.arms;
      mesh.castShadow = false; mesh.receiveShadow = true;
    }
    expect(pose(actual)).toEqual(before);
    expect(pose(actual)).toEqual(pose(original));
    expect(actual.map(mesh => [mesh.material, mesh.castShadow, mesh.receiveShadow])).toEqual(original.map(mesh => [mesh.material, mesh.castShadow, mesh.receiveShadow]));
    const extra = new Mesh(new BoxGeometry());
    expect(() => { runInNewContext(js, { rig: { meshes: () => [...actual, extra] }, m: materials, sky: {}, water: {} }, { timeout: 1000 }); }).toThrow('Unexpected Driftwood arm mesh count');
    extra.geometry.dispose();
    actual.forEach(mesh => mesh.geometry.dispose()); original.forEach(mesh => mesh.geometry.dispose());
  }
  Object.values(materials).forEach(material => material.dispose());
});
