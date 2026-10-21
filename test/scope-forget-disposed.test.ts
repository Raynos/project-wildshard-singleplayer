import { expect, test, vi } from 'vitest';
import { BufferGeometry, MeshBasicMaterial } from 'three';
import { Scope } from '../src/engine/app/scope';
import { rebindGeometry } from '../src/engine/app/cachedAssets';
import { ownSceneResource } from '../src/engine/app/sceneOwnership';

test('O18 a scope forgets a resource disposed by anyone else, and never disposes it twice', () => {
  const page = new Scope('page'), material = new MeshBasicMaterial(), dispose = vi.spyOn(material, 'dispose');
  page.own(material);
  expect(page.owns(material)).toBe(true);
  material.dispose();
  expect(page.owns(material)).toBe(false);
  expect(page.census.materials).toBe(0);
  page.dispose();
  expect(dispose).toHaveBeenCalledTimes(1);
});

test('O18 a binding-only rebind keeps the geometry owned', () => {
  const scope = new Scope('cell'), geometry = new BufferGeometry(), dispose = vi.spyOn(geometry, 'dispose');
  scope.own(geometry);
  rebindGeometry(geometry);
  expect(scope.owns(geometry)).toBe(true);
  scope.dispose();
  expect(dispose).toHaveBeenCalledTimes(2);
});

test('O18 a live owner owns a disposed resource again when it is used again', () => {
  const cell = new Scope('cell'), geometry = new BufferGeometry(), dispose = vi.spyOn(geometry, 'dispose');
  ownSceneResource(geometry, cell);
  geometry.dispose();
  expect(cell.owns(geometry)).toBe(false);
  ownSceneResource(geometry, cell);
  expect(cell.owns(geometry)).toBe(true);
  cell.dispose();
  expect(dispose).toHaveBeenCalledTimes(2);
});
