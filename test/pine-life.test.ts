import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BEAT, RAVEN_CARCASS, beatEnvelope, carcassMayGo, nearestUnvisited, ravenCount, ravenDelay } from '../src/pinehollow/life/lifeMath';
import { trunkSpine } from '../src/pinehollow/life/trunks';

describe('Pine Hollow life (PH-M5 / F2)', () => {
  const places = [
    { id: 'pond', x: 0, z: 100, r: 20 },
    { id: 'ridge', x: 0, z: -60, r: 15 },
    { id: 'den', x: 300, z: 0, r: 12 },
    { id: 'gate', x: 0, z: 10, r: 25 },
  ];
  it('the breadcrumbs head for the nearest place not yet seen, never one you stand in, never past reach', () => {
    expect(nearestUnvisited(places, () => false, 0, 0)?.id).toBe('ridge'); // gate: you are inside it
    expect(nearestUnvisited(places, (id) => id === 'ridge', 0, 0)?.id).toBe('pond');
    expect(nearestUnvisited(places, (id) => id !== 'den', 0, 0)?.id).toBe('den');
    expect(nearestUnvisited(places, (id) => id !== 'den', 0, 0, 40, 200)).toBeNull();
    expect(nearestUnvisited(places, () => true, 0, 0)).toBeNull();
  });
  it('the ravens come inside the minute, 2 or 3, only to the hunt', () => {
    for (const u of [-1, 0, 0.5, 1, 2]) { expect(ravenDelay(u)).toBeGreaterThanOrEqual(18); expect(ravenDelay(u)).toBeLessThanOrEqual(60); }
    expect(ravenCount('deer')).toBe(2); expect(ravenCount('bear')).toBe(3);
    expect(RAVEN_CARCASS.has('antler-king')).toBe(false); expect(RAVEN_CARCASS.has('elk')).toBe(true);
  });
  it('a harvested carcass stays until the ravens have been, or a while', () => {
    expect(carcassMayGo('waiting', 10)).toBe(false);
    expect(carcassMayGo('feeding', 100)).toBe(false);
    expect(carcassMayGo('gone', 1)).toBe(true);
    expect(carcassMayGo('overhead', 241)).toBe(true);
  });
  it('the skinning beat kneels, holds, rises inside ~1.5 s, the cuts inside the hold', () => {
    expect(BEAT.len).toBeCloseTo(1.5, 5);
    expect(beatEnvelope(0)).toBe(0); expect(beatEnvelope(BEAT.len)).toBe(0);
    for (const c of BEAT.cuts) expect(beatEnvelope(c)).toBe(1);
    expect(beatEnvelope(BEAT.kneelIn / 2)).toBeGreaterThan(0); expect(beatEnvelope(BEAT.kneelIn / 2)).toBeLessThan(1);
  });
  it('the trunk spine follows a leaning trunk and stops at its top', () => {
    // a 10 m trunk, radius 0.4, leaning 1 m over its height toward +x
    const g = new THREE.CylinderGeometry(0.4, 0.4, 10, 12, 20).translate(0, 5, 0);
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++) pos.setX(i, pos.getX(i) + pos.getY(i) * 0.1);
    const spine = trunkSpine(g);
    const at = (y: number) => spine.find((k) => Math.abs(k.y - y) < 0.01);
    expect(at(5)?.cx).toBeCloseTo(0.5, 1);
    expect(at(5)?.r).toBeCloseTo(0.4, 1);
    expect(spine[spine.length - 1]?.y ?? 0).toBeGreaterThan(9);
    expect(spine[spine.length - 1]?.y ?? 99).toBeLessThan(10);
  });
});
