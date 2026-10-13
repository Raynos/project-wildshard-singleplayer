import { BoxGeometry, Group, InstancedMesh, Mesh, MeshBasicMaterial, Object3D, Texture } from 'three';
import { expect, it } from 'vitest';
import { Scope } from '../../src/engine/app/scope';
import { installScopeEnvironment, scopeEnvironment } from '../../src/engine/app/scopeEnvironment';
import { installBrowserScopeEnvironment } from '../../src/engine/app/view/scopeEnvironment';
import { ownPrimitives as skyReleased } from '../../src/shards/far-reach-legacy/world/resources';
import { ownPrimitives as signalReleased } from '../../src/shards/sunscar-dunes-legacy/world/resources';

function outcome(adopt: (root: Object3D, scope: Scope) => void) {
  const scope = new Scope('tree'), parent = new Group(), root = new Group(), nested = new Group();
  parent.add(root); root.add(nested);
  const geometry = new BoxGeometry(), extraGeometry = new BoxGeometry(), texture = new Texture();
  const material = new MeshBasicMaterial({ map: texture }), second = new MeshBasicMaterial();
  const ordinary = new Mesh(geometry, [material, second]), copies = new InstancedMesh(geometry, material, 2);
  class PretendMesh extends Object3D {
    readonly isMesh = true;
    readonly geometry = extraGeometry;
    readonly material = second;
  }
  nested.add(ordinary, copies, new PretendMesh());
  const disposal: string[] = [];
  geometry.addEventListener('dispose', () => { disposal.push('geometry'); });
  extraGeometry.addEventListener('dispose', () => { disposal.push('extra geometry'); });
  material.addEventListener('dispose', () => { disposal.push('material'); });
  second.addEventListener('dispose', () => { disposal.push('second'); });
  texture.addEventListener('dispose', () => { disposal.push('texture'); });
  copies.addEventListener('dispose', () => { disposal.push('instances'); });
  root.addEventListener('removed', () => { disposal.push('detached'); });
  adopt(root, scope); adopt(root, scope); // repeated registration keeps buffer ownership exact once
  const census = scope.census;
  scope.dispose(); scope.dispose();
  const result = { census, disposal: [...disposal], empty: scope.census, detached: parent.children.length === 0 };
  texture.dispose(); extraGeometry.dispose(); copies.dispose();
  return result;
}

it('keeps both released buffer/material/instance ownership policies and disposal order exactly', () => {
  const previous = scopeEnvironment(); installBrowserScopeEnvironment({ Mesh, InstancedMesh });
  try {
    const signal = outcome((root, scope) => { scope.ownPrimitives(root); });
    const sky = outcome((root, scope) => { scope.ownPrimitives(root, { instances: true }); });
    expect(signal).toStrictEqual(outcome(signalReleased));
    expect(sky).toStrictEqual(outcome(skyReleased));
    expect(signal.census).toMatchObject({ geometries: 1, materials: 2, textures: 0, meshes: 0, disposers: 2 });
    expect(sky.census).toMatchObject({ geometries: 1, materials: 2, textures: 0, meshes: 1, disposers: 2 });
    expect(signal.disposal).toStrictEqual(['detached', 'second', 'material', 'geometry']);
    expect(sky.disposal).toStrictEqual(['detached', 'instances', 'second', 'material', 'geometry']);
    expect(signal.detached && sky.detached).toBe(true);
    expect(Object.values(sky.empty).every(value => value === 0)).toBe(true);
  } finally { installScopeEnvironment(previous); }
});

it('refuses presentation ownership in a pure host before registering resources or detachment', () => {
  const previous = scopeEnvironment(), scope = new Scope('native'), parent = new Group(), root = new Group();
  parent.add(root);
  installScopeEnvironment({ targetKind: () => 'other', frame: () => 0, cancelFrame: () => undefined });
  try {
    expect(() => { scope.ownPrimitives(root); }).toThrow('requires the presentation host');
    expect(Object.values(scope.census).every(value => value === 0)).toBe(true);
    scope.dispose(); expect(parent.children).toStrictEqual([root]);
  } finally { installScopeEnvironment(previous); }
});

it('keeps the pre-entry browser adapter free of primitive ownership until rendering is installed', () => {
  const previous = scopeEnvironment(), scope = new Scope('pre-entry'), root = new Group();
  installBrowserScopeEnvironment();
  try {
    expect(scopeEnvironment().primitives).toBeUndefined();
    expect(() => { scope.ownPrimitives(root); }).toThrow('requires the presentation host');
    expect(Object.values(scope.census).every(value => value === 0)).toBe(true);
    installBrowserScopeEnvironment({ Mesh, InstancedMesh });
    expect(() => { scope.ownPrimitives(root); }).not.toThrow();
  } finally { scope.dispose(); installScopeEnvironment(previous); }
});
