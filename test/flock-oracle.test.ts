// oxlint-disable-next-line import/no-nodejs-modules -- Identify the actual shipping source captured by this oracle.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Read immutable test captures for provenance checks.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { captureFlock } from './fixtures/flock-oracle/capture';
import { ShippingFlock, type OraclePorts } from './fixtures/flock-oracle/flock';
import source from './fixtures/flock-oracle/source.json';

function replay(): { digest: string; sounds: object[]; tramples: number; wool: number[] } {
  const sounds: object[] = [], hash = createHash('sha256');
  let tramples = 0;
  const ports: OraclePorts = { heightAt: (x, z) => Math.sin(x * 0.05) + Math.cos(z * 0.03),
    normalAt: () => [0, 1, 0], wetAt: (x, z) => x > 22 && z > 0, playerCrouched: false,
    grassHeightAt: () => 0.9, trample: () => { tramples++; }, centre: () => undefined };
  const flock = new ShippingFlock(ports, { x: 0, z: 0, count: 20, seed: 357 });
  flock.onSound = (name, x, z) => { sounds.push({ name, x, z }); };
  flock.initialize();
  const player = new Vector3(40, 0, 0), wolf = { alive: true, position: new Vector3(500, 0, 0) };
  for (let tick = 0; tick < 10000; tick++) {
    player.set(tick >= 4000 && tick < 4500 ? 300 : Math.sin(tick * 0.003) * 30, 0, 40);
    wolf.position.x = tick >= 2000 && tick < 2400 ? flock.cx + 5 : 500;
    if (tick === 6000) flock.kill(4);
    flock.update(1 / 60, tick / 60, player, tick < 5000 ? 0 : 6, [wolf]);
    hash.update(JSON.stringify(flock.state()));
  }
  return { digest: hash.digest('hex'), sounds, tramples, wool: flock.wool };
}

describe('shipping flock oracle capture', () => {
  it('preserves the complete shipping source and mechanically extracts its executable policy spans', () => {
    const raw = readFileSync('test/fixtures/flock-oracle/shipping.txt', 'utf8');
    expect(createHash('sha256').update(raw).digest('hex')).toBe(source.sha256);
    expect(readFileSync('test/fixtures/flock-oracle/flock.ts', 'utf8')).toBe(captureFlock(raw));
  });
  it('executes 10,000 deterministic shipping ticks including panic, pause, return and death', () => {
    const first = replay();
    expect(replay()).toEqual(first);
    expect(first.sounds.length).toBeGreaterThan(10);
    expect(first.tramples).toBeGreaterThan(0);
    expect(first.wool.length).toBe(20);
  });
});
