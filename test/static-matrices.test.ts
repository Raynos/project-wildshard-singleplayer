import { Group } from 'three';
import { expect, test, vi } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { holdStaticMatrices } from '../src/engine/render/staticMatrices';

test('static pieces stop auto updates and a late mover recovers at the thirtieth check', () => {
  const root = new Group(), child = new Group(), alreadyStatic = new Group(), scope = new Scope('matrices');
  root.name = 'root'; child.name = 'late mover'; alreadyStatic.matrixAutoUpdate = false;
  root.add(child, alreadyStatic);
  const checks: (() => void)[] = [], report = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  try {
    holdStaticMatrices(root, scope, check => { checks.push(check); });
    const check = checks[0]; if (check === undefined) throw new Error('missing mover check');
    expect(root.matrixAutoUpdate).toBe(false); expect(child.matrixAutoUpdate).toBe(false);
    for (let i = 0; i < 120; i++) check();
    child.position.x = 12;
    for (let i = 0; i < 29; i++) check();
    expect(child.matrixAutoUpdate).toBe(false); expect(report).not.toHaveBeenCalled();
    check();
    expect(child.matrixAutoUpdate).toBe(true); expect(child.matrix.elements[12]).toBe(12);
    expect(report).toHaveBeenCalledExactlyOnceWith('[staticMatrices] moved, back on auto update: root/late mover');
    scope.dispose();
    expect(root.matrixAutoUpdate).toBe(true); expect(alreadyStatic.matrixAutoUpdate).toBe(false);
  } finally { scope.dispose(); report.mockRestore(); }
});

test('an initial mover recovers on its first step and a disposed owner registers no check', () => {
  const root = new Group(), scope = new Scope('initial mover'), checks: (() => void)[] = [];
  const report = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  try {
    holdStaticMatrices(root, scope, check => { checks.push(check); }, { subtree: false });
    root.scale.x = 2; checks[0]?.();
    expect(root.matrixAutoUpdate).toBe(true); expect(root.matrix.elements[0]).toBe(2);
    scope.dispose();
    const closed = new Group(); holdStaticMatrices(closed, scope, check => { checks.push(check); });
    expect(checks).toHaveLength(1); expect(closed.matrixAutoUpdate).toBe(true);
  } finally { scope.dispose(); report.mockRestore(); }
});

// a wholly held subtree leaves the walk: walked again on a parent move or a stale root, and for good on an attach,
// a detach or a held node that moves
test('a held subtree skips the walk until its parent moves, its structure changes or a node moves', () => {
  const parent = new Group(), root = new Group(), child = new Group(), scope = new Scope('walk skip'), checks: (() => void)[] = [];
  parent.add(root); root.add(child); child.position.set(1, 2, 3);
  const report = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  let visits = 0; const visit = child.updateMatrixWorld.bind(child); child.updateMatrixWorld = (force?: boolean): void => { visits++; visit(force); };
  try {
    holdStaticMatrices(root, scope, check => { checks.push(check); });
    parent.updateMatrixWorld(true); const first = visits;
    parent.updateMatrixWorld(true); parent.updateMatrixWorld(true);
    expect(visits).toBe(first);
    parent.position.x = 5; parent.updateMatrixWorld(true);
    expect(visits).toBe(first + 1); expect(child.matrixWorld.elements[12]).toBe(6);
    parent.updateMatrixWorld(true); expect(visits).toBe(first + 1);
    root.matrixWorldNeedsUpdate = true; parent.updateMatrixWorld(true); expect(visits).toBe(first + 2);
    root.add(new Group()); parent.updateMatrixWorld(true); parent.updateMatrixWorld(true);
    expect(visits).toBe(first + 4);
  } finally { scope.dispose(); report.mockRestore(); }
  const other = new Group(), mover = new Group(), outer = new Group(), owner = new Scope('mover'), moverChecks: (() => void)[] = [];
  outer.add(other); other.add(mover);
  const quiet = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  try {
    holdStaticMatrices(other, owner, check => { moverChecks.push(check); });
    outer.updateMatrixWorld(true);
    mover.position.y = 4; moverChecks[0]?.();
    outer.updateMatrixWorld(true);
    expect(mover.matrixWorld.elements[13]).toBe(4);
  } finally { owner.dispose(); quiet.mockRestore(); }
  expect(Object.hasOwn(root, 'updateMatrixWorld')).toBe(false);
});
