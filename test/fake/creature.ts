import * as THREE from 'three';
import { Animal } from '#engine/entities/Animal';
import { AnimalFactory } from '#engine/entities/AnimalFactory';
import { speciesDef, type ThinkCtx, type EnemyWorld } from '#engine/entities/species/registry';
import { Rng } from '#engine/core/rng';
import { fakeWorld } from './world';

/** Actual legacy brain, attack clock and body; flat arena decisions are isolated from steering/terrain. */
export function creature(kind: string, variant: string, world: EnemyWorld = {}): ReturnType<typeof fakeWorld> & {
  animal: Animal; ctx: ThinkCtx; hits: { frame: number; damage: number }[]; sounds: string[];
  starts: { frame: number; duration: number }[]; states: string[]; readonly frame: number; advance: (n: number) => void;
} {
  const f = fakeWorld(), factory = new AnimalFactory(f.sky, { style: 'toon', render: { lowPoly: true, waitForModels: false, furRim: false, tintRange: 0.3, oneMaterial: true } });
  const model = factory.model(kind, variant), animal = new Animal(factory.instantiate(model, 0.5), model, 0.5);
  animal.place(0, 0, 0);
  const hits: { frame: number; damage: number }[] = [], sounds: string[] = [], states: string[] = [];
  const starts: { frame: number; duration: number }[] = [];
  let frame = 0, acc = 0;
  animal.onAttack = (_a, duration) => { starts.push({ frame, duration }); };
  const ctx: ThinkCtx = {
    dt: 0.1, t: 0, player: new THREE.Vector3(0, 0, 1), playerSpeed: 0, rng: new Rng(357), calm: false,
    herd: null, world, hurt: (damage) => { hits.push({ frame, damage }); }, sound: (s) => { sounds.push(s); },
    heightAt: () => 0, waterLevel: () => 0,
    steer: (a, yaw, speed, turn) => { a.setMotion(yaw, speed, turn); },
    pathYaw: (a, x, z) => Math.atan2(x - a.position.x, z - a.position.z), confine: () => undefined,
    reach: () => true, claim: () => true, mayAttack: () => true,
  };
  const def = speciesDef(kind), think = def.think;
  if (think === undefined) throw new Error(`${kind} is not a self-thinking species`);
  f.game.onFixed('step', (dt) => {
    frame++; acc += dt;
    if (acc >= 0.1) {
      acc -= 0.1; ctx.t = frame / 60; think(animal, ctx);
      if (states.at(-1) !== animal.state) states.push(animal.state);
    }
    def.act?.(animal, { ...ctx, dt, t: frame / 60 });
    animal.update(dt, frame / 60, true);
  }, 'creature', true);
  return { ...f, animal, ctx, hits, sounds, starts, states, get frame(): number { return frame; },
    advance(n: number): void { for (let i = 0; i < n; i++) f.game.advance(1 / 60); if (f.game.dead) throw new Error('creature fixture faulted'); },
  };
}
