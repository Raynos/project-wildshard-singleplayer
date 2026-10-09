import { describe, expect, it } from 'vitest';
import { SpeciesService, type SpeciesLook } from '../../src/engine/entities/species/look';
import { registeredSpecies, registerSpecies } from '../../src/engine/entities/species/registry';
import { AnimalFactory, DEFAULT_CREATURE_RENDER } from '../../src/engine/entities/AnimalFactory';
import { Scope } from '../../src/engine/app/scope';
import { app } from '../../src/engine/app/runtime';
import { BOAR } from '../../src/game/systems/species/boar';
import { fakeWorld } from '../fake/world';

const look = (): SpeciesLook => ({ ...registeredSpecies('boar'), id: 'test.look.ray', species: 'test.ray', kind: 'boar', variants: {}, rig: 'custom', preload: () => Promise.resolve() });

describe('required creature rig bones', () => {
  it.each(['body', 'head'])('rejects a missing %s declaration at scoped registration without registering it', (missing) => {
    const scope = new Scope('rig-test'), service = new SpeciesService(() => scope), value = look();
    try {
      expect(() => service.registerLook({ ...value, rigContract: { ...value.rigContract, sockets: value.rigContract.sockets.filter((name) => name !== missing) } }, scope)).toThrow(`species 'test.ray (boar)': rig missing required bone '${missing}'`);
      expect(service.look('boar')).toBeUndefined();
      service.registerLook(value, scope);
      expect(service.look('boar')).toBe(value);
    } finally { scope.dispose(); }
  });

  it('validates the legacy registration counterpart before replacing the species', () => {
    const base = registeredSpecies('boar');
    expect(() => registerSpecies({ ...base, rigContract: { ...base.rigContract, sockets: ['body'] } })).toThrow("species 'boar': rig missing required bone 'head'");
    expect(registeredSpecies('boar')).toBe(base);
  });

  it('rejects an actual built skeleton that falsely declares its missing head', async () => {
    const world = fakeWorld(), scope = new Scope('built-rig-test'), previous = app.levelScope, value = look();
    app.levelScope = scope;
    try {
      app.species.registerRow({ ...BOAR, id: 'test.ray' }, scope);
      app.species.registerLook({ ...value, build: () => ({
        bones: [{ name: 'body', parent: null, pos: [0, 1, 0] }], furParts: [], hardParts: [], eyeParts: [],
        dims: { bodyY: 1, bodyHalfLen: 1, bodyRadius: 1, headRadius: 1, legLen: 1, feet: [], halfWidth: 1 },
      }) }, scope);
      const factory = new AnimalFactory(world.sky, { style: 'pbr', render: DEFAULT_CREATURE_RENDER });
      await factory.ready;
      expect(() => factory.model('boar')).toThrow("species 'boar': rig missing required bone 'head'");
    } finally { app.levelScope = previous; scope.dispose(); }
  });
});
