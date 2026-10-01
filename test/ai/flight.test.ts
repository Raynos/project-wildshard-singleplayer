import { describe, expect, it, vi } from 'vitest';
import { FlightMotion } from '#engine/ai/flight';
import { creature } from '../fake/creature';

describe('species flight body', () => {
  it('tracks rolling ground with five samples per second and smooths between samples', () => {
    let ground = 10;
    const sample = vi.fn(() => ground), body = new FlightMotion({ altitude: 5, climbRate: 20, diveRate: 40 });
    const position = { x: 0, y: 15, z: 0 };
    for (let i = 0; i < 60; i++) body.step(1 / 60, position, true, sample);
    expect(sample.mock.calls.length).toBeGreaterThanOrEqual(4);
    expect(sample.mock.calls.length).toBeLessThanOrEqual(5);
    expect(position.y).toBe(15);
    ground = 20;
    for (let i = 0; i < 13; i++) body.step(1 / 60, position, true, sample);
    expect(position.y).toBeGreaterThan(15);
    expect(position.y).toBeLessThan(25);
    for (let i = 0; i < 120; i++) body.step(1 / 60, position, true, sample);
    expect(position.y).toBeCloseTo(25, 3);
  });
  it('uses world altitude without floor queries and clamps climb/dive speed', () => {
    const sample = vi.fn(() => 100), body = new FlightMotion({ altitude: 30, above: 'world', climbRate: 4, diveRate: 8 });
    const position = { x: 0, y: 10, z: 0 };
    body.step(0.5, position, true, sample); expect(position.y).toBe(12); expect(sample).not.toHaveBeenCalled();
    body.target(0); body.step(0.5, position, true, sample); expect(position.y).toBe(8);
  });
  it.each([undefined, -201, Number.NaN])('falls back to world altitude over a missing or distant floor (%s)', (floor) => {
    const body = new FlightMotion({ altitude: 10, climbRate: 10, diveRate: 20 }), position = { x: 0, y: 0, z: 0 };
    body.step(1, position, true, () => floor); expect(position.y).toBe(10);
  });
  it('drops a dead flyer onto the floor without tunnelling through it', () => {
    const body = new FlightMotion({ altitude: 20, above: 'world', climbRate: 4, diveRate: 8 }), position = { x: 0, y: 10, z: 0 };
    body.step(1, position, false, () => 5); expect(position.y).toBe(5);
    body.step(1, position, false, () => 5); expect(position.y).toBe(5);
  });
  it('rejects invalid flight data and steering targets', () => {
    expect(() => new FlightMotion({ altitude: Number.NaN, climbRate: 4, diveRate: 8 })).toThrow();
    expect(() => new FlightMotion({ altitude: 10, climbRate: 0, diveRate: 8 })).toThrow();
    const body = new FlightMotion({ altitude: 10, climbRate: 4, diveRate: 8 });
    expect(() => body.target(Infinity)).toThrow();
  });
  it('the Animal body moves a flyer horizontally and vertically without its ground motor', () => {
    const { animal, ctx } = creature('crab', 'small', {}, { altitude: 20, above: 'world', climbRate: 4, diveRate: 8 });
    expect(animal.position.y).toBe(20);
    ctx.flight.steer(animal, 0, 5, 30);
    for (let i = 0; i < 60; i++) animal.update(1 / 60, i / 60, false);
    expect(animal.position.y).toBeCloseTo(24);
    expect(animal.position.z).toBeGreaterThan(3);
    expect(() => creature('crab', 'small').animal.fly(0, 1, 10)).toThrow('declare flight');
  });
});
