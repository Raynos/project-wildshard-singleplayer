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
