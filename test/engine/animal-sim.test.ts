import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { AnimalSim, type AnimalSimSpec } from '../../src/engine/entities/AnimalSim';

const spec: AnimalSimSpec = {
  kind: 'fixture', label: 'Fixture', variant: 'plain', rarity: 'common', hp: 100, aggressive: false,
  dims: { bodyY: 0.6, bodyHalfLen: 0.5, bodyRadius: 0.3, headRadius: 0.2, legLen: 0.6, feet: [], halfWidth: 0.3 },
  mods: { speed: 1, chargeDist: 1, damageTaken: 1, chargeDamage: 25, relentless: false },
};
function creature(id = 'fixture:1'): AnimalSim {
  return new AnimalSim(spec, 42, 1, id, { heightAt: () => 0, random: () => 0.5 });
}
describe('creature simulation without a rig or active app', () => {
  it('steers and advances its committed attack on the supplied step clock', () => {
    const a = creature(); a.place(0, 0, 0); a.setMotion(Math.PI / 2, 2); a.startAttack(1); a.attackTurnCap = 0.5;
    a.step(0.1);
    expect(a.yaw).toBeCloseTo(0.05); expect(a.speed).toBeCloseTo(0.7); expect(a.attackPhase).toBeCloseTo(0.1);
    expect(a.position.x).toBeCloseTo(Math.sin(0.05) * 0.07);
    expect(a.position.z).toBeCloseTo(Math.cos(0.05) * 0.07);
  });
  it('retains impulses, interrupts an attack on stagger and stops after death', () => {
    const a = creature(); a.place(0, 0, 0); a.startAttack(1); a.impulse(new Vector3(2, 4, 0)); a.step(0.1);
    expect(a.position.x).toBeCloseTo(0.2); expect(a.position.y).toBe(0);
    a.stagger(new Vector3(0, 0, 1), 1); expect(a.attackPhase).toBe(-1); expect(a.stunned).toBe(true);
    a.step(0.25); expect(a.position.z).toBeCloseTo(1.5);
    expect(a.applyFinalDamage(100, new Vector3(), new Vector3(0, 0, 1))).toBe(true);
    const at = a.position.clone(); a.step(1);
    expect(a.position.equals(at)).toBe(true); expect(a.hasImpulse).toBe(false); expect(a.state).toBe('dead');
  });
  it('routes geometric perception and health through a unique stable actor', () => {
    const a = creature('spawn:7'), b = creature('spawn:8'); a.place(2, 3, Math.PI / 2);
    expect(a.combatActor()).toBe(a.combatActor()); expect(a.combatActor().id).not.toBe(b.combatActor().id);
    expect(a.headWorld(new Vector3()).toArray()).toEqual([2.5, 0.6, 3]);
    a.combatActor().attributes.health = 70; expect(a.hp).toBe(70);
    a.step(0.25); a.applyFinalDamage(10, new Vector3(), new Vector3()); expect(a.lastHitT).toBe(250);
    expect(a.damageFor(false, 0)).toBe(36); expect(a.damageFor(true, 0)).toBe(90);
  });
});
