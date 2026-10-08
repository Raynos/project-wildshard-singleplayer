import { describe, expect, it } from 'vitest';
import { PLAZA, STREET } from '../../../src/shards/nine-dragon-stack/layout';
import { fragmentColliders } from '../../../src/shards/nine-dragon-stack/world/colliders';

// SHARD-PLATFORM playtest round 1 (the Nine Dragon "grey void"): the shopfronts' pillars and counters stand 0.6 m proud
// of their front's line (world/facades.ts `shopfronts`), so a front collider on the line let the player, and the camera,
// walk into a pillar's flat face. Each shopfront-bearing front now collides from 0.6 m proud of its line.
interface Box { kind: 'box'; x: number; z: number; hx: number; hz: number }
const boxes = (): Box[] => fragmentColliders().fronts.flatMap((c) => (c.kind === 'box' ? [c] : []));
const face = (b: Box, side: 'x0' | 'x1' | 'z0' | 'z1'): number => (side === 'x0' ? b.x - b.hx : side === 'x1' ? b.x + b.hx : side === 'z0' ? b.z - b.hz : b.z + b.hz);

describe('Nine Dragon front colliders clear the shopfronts', () => {
  it('stand 0.6 m proud of each shopfront line round the square and along the street', () => {
    const faces = boxes().map((b) => ({ x0: face(b, 'x0'), x1: face(b, 'x1'), z0: face(b, 'z0'), z1: face(b, 'z1') }));
    const has = (pick: (f: (typeof faces)[number]) => number, at: number): boolean => faces.some((f) => Math.abs(pick(f) - at) < 1e-9);
    expect(has((f) => f.x0, PLAZA.x1)).toBe(true); // the square's east side (line PLAZA.x1 + 0.6)
    expect(has((f) => f.z1, PLAZA.z0)).toBe(true); // its north side right of the gate (line PLAZA.z0 - 0.6)
    expect(has((f) => f.z0, PLAZA.z1)).toBe(true); // its south side behind the spawn (line PLAZA.z1 + 0.6)
    expect(has((f) => f.x1, STREET.x0 + 0.6)).toBe(true); // the street's west side
    expect(has((f) => f.x0, STREET.x1 - 0.6)).toBe(true); // the street's east side
  });
});
