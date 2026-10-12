import { expect, it } from 'vitest';
import { aerialHeroPlan } from '../scripts/main-menu-aerial-poses';

it('aims fifteen real poses at the central roundabout and its four adjacent cells', () => {
  const plan = aerialHeroPlan();
  expect(plan.junction).toBe('cross.0.0');
  expect(new Set(plan.surrounding)).toEqual(new Set(['driftwood-isle', 'pine-hollow', 'nalati-grasslands', 'template-2']));
  expect(plan.poses).toHaveLength(15);
  expect(new Set(plan.poses.map(p => p.id)).size).toBe(15);
  for (const pose of plan.poses) {
    expect(pose.eye.y).toBeGreaterThanOrEqual(30);
    expect(pose.eye.y).toBeLessThanOrEqual(150);
    expect(Math.hypot(pose.target.x - 277.5, pose.target.z - 277.5)).toBeLessThan(21);
  }
  for (const pose of plan.poses.slice(0, 6)) {
    expect(pose.downDegrees).toBeGreaterThanOrEqual(45 - 1e-10);
    expect(pose.downDegrees).toBeLessThanOrEqual(70 + 1e-10);
  }
});

it('keeps the requested corner, midpoint and centre homes while sweeping the aim', () => {
  const plan = aerialHeroPlan();
  for (const [group, coordinate] of [['E2', 305], ['M', 430], ['T', 555]] as const) {
    const rows = plan.poses.filter(p => p.id.startsWith(`${group}-`));
    expect(rows.map(p => p.id)).toEqual([`${group}-a`, `${group}-b`, `${group}-c`]);
    for (const row of rows) expect([row.eye.x, row.eye.z]).toEqual([coordinate, coordinate]);
    expect(new Set(rows.map(p => p.eye.y)).size).toBe(3);
  }
});
