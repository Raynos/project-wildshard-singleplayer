import { Vector3 } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { EliteBrain, type EliteActor } from '../../src/engine/ai/EliteBrain';

class Encounter extends EliteBrain<EliteActor> {
  readonly contacts: [number, number][] = [];
  readonly cleared = vi.fn();
  override spawn(): void { this.animal = { alive: true, position: new Vector3(5, 0, 0), lookTarget: new Vector3(), lookWeight: 0, setMotion: vi.fn((): void => undefined) }; }
  override despawn(): void { this.clearTells(); this.animal = null; }
  protected override fight(_actor: EliteActor, dt: number, t: number): void { this.contacts.push([dt, t]); }
  protected override clearTells(): void { this.cleared(); }
}
const make = (): Encounter => new Encounter({ id: 'test', awareR: 60, leashR: 110, lair: { x: 0, z: 0, r: 20 } },
  { player: { position: new Vector3(0, 0, 2) }, random: () => 0.5 });

describe('render-independent elite lifecycle', () => {
  it('ticks engaged fights with actual dt and gives leashing priority', () => {
    const e = make(); e.spawn(); e.tick(0.17, 2, true, false); expect(e.contacts).toEqual([[0.17, 2]]);
    e.tick(0.06, 2.06, true, true); expect(e.contacts).toHaveLength(1); expect(e.cleared).toHaveBeenCalledOnce();
    expect(e.animal?.setMotion).toHaveBeenCalledWith(-Math.PI / 2, 4, 2.5);
    expect(e.animal?.lookWeight).toBe(0);
  });
  it('keeps phase2/reset and retirement presentation separate from the clock', () => {
    const e = make(); e.spawn(); e.enterPhase2(); expect(e.phase2).toBe(true);
    e.reset(); expect(e.phase2).toBe(false); expect(e.brainState).toBe('home');
    e.despawn(); e.tick(1 / 60, 0, true, false); expect(e.contacts).toHaveLength(0); expect(e.cleared).toHaveBeenCalledTimes(3);
  });
  it('retains the idle lair roll and nearby look response', () => {
    const e = make(); e.spawn(); e.tick(0.1, 0.1, false, false);
    expect(e.animal?.setMotion).toHaveBeenCalledWith(expect.closeTo(-Math.PI / 2, 8), 0, 1.5);
    expect(e.animal?.lookTarget).toEqual(new Vector3(0, 0, 2)); expect(e.animal?.lookWeight).toBe(0.8);
    e.tick(7, 7.1, false, false); expect(e.animal?.setMotion).toHaveBeenLastCalledWith(expect.closeTo(-Math.PI / 2, 8), 1.1, 1.5);
  });
});
