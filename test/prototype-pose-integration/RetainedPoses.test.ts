// oxlint-disable-next-line import/no-nodejs-modules -- Evaluate pinned retained skeleton/payload sources without browser or build.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { Vector3 } from 'three';
import { app } from '../../src/engine/app/runtime';
import { Scope } from '../../src/engine/app/scope';
import { AnimalFactory, DEFAULT_CREATURE_RENDER } from '../../src/engine/entities/AnimalFactory';
import type { AnimalRigContext } from '../../src/engine/entities/animalRig';
import { NO_FUR } from '../../src/engine/entities/species/rigs';
import { numericCreaturePose } from '../../src/game/plugin/channelPrograms';
import { packedCreatureBodies } from '../../src/game/plugin/geometry';
import { hashImmutableBytes } from '../../src/sdk/immutable';
import { prototypeCombat, prototypeMetadata } from '../../practice/prototype-nine/products/author';
import { PROTOTYPE_PRODUCTS, type PrototypeId } from '../../practice/prototype-nine/products/catalogue';
import { prototypePose } from '../../practice/prototype-nine/products/pose';
import { fakeWorld } from '../fake/world';

const intended: Record<PrototypeId, { gait: string[]; tell: string[]; secondary: string[] }> = {
  bellback: { gait: ['leg0', 'leg1', 'leg2', 'leg3'], tell: ['head', 'bell', 'clapper'], secondary: [] },
  pitcher: { gait: [], tell: ['head', 'leftHead', 'rightHead', 'headLid', 'leftHeadLid', 'rightHeadLid'], secondary: [] },
  medusa: { gait: [], tell: ['head', 'bell'], secondary: Array.from({ length: 8 }, (_, ribbon) =>
    Array.from({ length: 3 }, (_jointEntry, joint) => `ribbon${ribbon}_${joint}`)).flat() },
  keelmaw: { gait: ['FL_shoulder', 'FL_carpus', 'FL_fetlock', 'FR_shoulder', 'FR_carpus', 'FR_fetlock',
    'BL_hip', 'BL_stifle', 'BL_hock', 'BR_hip', 'BR_stifle', 'BR_hock'], tell: ['head', 'jaw'], secondary: ['tail1', 'tail2', 'tail3'] },
  iguana: { gait: ['legFL', 'legBL', 'legFR', 'legBR'], tell: ['head', 'jaw', 'bloom0', 'bloom1', 'bloom2', 'bloom3', 'bloom4', 'bloom5', 'bloom6'],
    secondary: ['tail0', 'tail1', 'tail2', 'tail3'] },
};

// Factory-built retained skeletons and actual numeric animator; no renderer or quality/native admission claim.
for (const row of PROTOTYPE_PRODUCTS) {
  test(`${row.id} evaluates declared motion on its retained rig without losing bind translations`, async () => {
    const owner = new Scope(`prototype-pose-${row.id}`), previousLevel = app.levelScope, world = fakeWorld();
    const metadata = prototypeMetadata(row.id, readFileSync(row.metadataPath)), payload = readFileSync(row.payloadPath);
    expect(hashImmutableBytes(payload)).toBe(row.payloadSha256);
    const body = metadata.bodies[0]; if (body === undefined) throw new Error('Missing pinned body');
    const bodies = packedCreatureBodies(metadata, undefined, () => Promise.resolve(payload));
    await bodies.preload();
    const { species } = prototypeCombat(row.id), names = body.bones.map(bone => bone.name);
    const declaration = prototypePose(row.id, names, body.dims.bodyY), animate = numericCreaturePose(declaration);
    const expected = intended[row.id], affected = ['body', ...expected.gait, ...expected.tell, ...expected.secondary];
    const targets = declaration.programs.flatMap(program => program.numeric?.outputs.map(output => output.target) ?? []);
    expect([...targets].sort()).toEqual(affected.map(name => `joint.${name.replaceAll('_', '.')}`).sort());
    expect(new Set(targets).size).toBe(targets.length);
    for (const name of affected) expect(names).toContain(name);
    app.levelScope = owner;
    try {
      app.species.registerRow(species, owner);
      app.species.registerLook({ id: `test.pose.${row.id}`, species: species.id, kind: species.kind,
        rigContract: { skeleton: `test.${row.id}`, clips: [], sockets: ['body', 'head'] },
        fur: NO_FUR, rig: 'custom', animate, build: variant => bodies.copy(row.kind, variant.id) }, owner);
      const factory = owner.run(() => new AnimalFactory(world.sky, { style: 'toon', kinds: [row.kind],
        render: { ...DEFAULT_CREATURE_RENDER, lowPoly: true, waitForModels: false, furRim: false, oneMaterial: true } }));
      const model = owner.run(() => factory.model(row.kind, row.variant));
      const rig = owner.run(() => factory.instantiate(model, .5));
      try {
        const bind = new Map(Object.entries(rig.bones).map(([name, bone]) => [name, bone.position.clone()]));
        const position = new Vector3(), memory: Record<string, number> = {};
        const context: AnimalRigContext = { bones: rig.bones, dims: model.dims, dt: 1 / 60, t: 0, seed: 7001, scale: row.scale,
          speed: 0, strafe: 0, phase: 0, state: 'idle', alive: true, deathT: -1, flinch: 0, brace: 0,
          attack: -1, lookTarget: new Vector3(), lookWeight: 0, position, yaw: 0, mem: memory,
          animal: { mem: memory, position, yOffset: 0 } };
        const sample = (time: number, speed: number, phase: number, attack: number) => {
          context.t = time; context.speed = speed; context.phase = phase; context.attack = attack;
          context.state = attack < 0 ? 'idle' : 'attack';
          animate(context); rig.mesh.updateMatrixWorld(true);
          for (const [name, bone] of Object.entries(rig.bones)) {
            const original = bind.get(name); if (original === undefined) throw new Error('Missing original bind joint');
            expect([...bone.position, bone.rotation.x, bone.rotation.y, bone.rotation.z,
              ...bone.scale, ...bone.matrixWorld.elements].every(Number.isFinite)).toBe(true);
            expect(bone.position.x).toBe(original.x); expect(bone.position.z).toBe(original.z);
            expect(bone.position.y).toBe(name === 'body' ? model.dims.bodyY : original.y);
            expect(bone.scale.toArray()).toEqual([1, 1, 1]);
            expect(bone.rotation.y).toBe(0); expect(bone.rotation.z).toBe(0);
            if (!affected.includes(name)) expect(bone.rotation.x).toBe(0);
          }
          expect(memory).toEqual({}); expect(position.toArray()).toEqual([0, 0, 0]); expect(context.animal.yOffset).toBe(0);
          return Object.fromEntries(Object.entries(rig.bones).map(([name, bone]) => [name, bone.rotation.x]));
        };
        const angle = (sampled: Record<string, number>, name: string): number => {
          const value = sampled[name]; if (value === undefined) throw new Error(`Missing sampled ${name}`); return value;
        };
        const idle0 = sample(0, 0, 0, -1), idle1 = sample(.7, 0, 0, -1);
        for (const name of [...expected.tell, ...expected.secondary])
          expect(Math.abs(angle(idle1, name) - angle(idle0, name))).toBeGreaterThan(.0001);
        const walkA = sample(.7, 1, .25, -1), walkB = sample(.7, 1, .75, -1);
        for (const name of expected.gait) expect(Math.abs(angle(walkA, name) - angle(walkB, name))).toBeCloseTo(.24, 8);
        const tellA = sample(.7, 0, 0, .25), tellB = sample(.7, 0, 0, .75);
        for (const name of expected.tell) expect(angle(tellA, name) - angle(tellB, name)).toBeCloseTo(-.48, 8);
        for (const name of expected.gait) expect(angle(tellA, name)).toBe(0);
        // Return to idle must clear the attack contribution; no accumulating transforms.
        expect(sample(.7, 0, 0, -1)).toEqual(idle1);
      } finally {
        rig.mesh.skeleton.dispose();
        for (const material of Array.isArray(rig.mesh.material) ? rig.mesh.material : [rig.mesh.material]) material.dispose();
        model.geometry.dispose();
        for (const material of new Set([model.fur, model.hard, model.eye, ...model.shells])) material.dispose();
      }
    } finally { owner.dispose(); world.game.playerScope.dispose(); app.levelScope = previousLevel; }
  });
}
