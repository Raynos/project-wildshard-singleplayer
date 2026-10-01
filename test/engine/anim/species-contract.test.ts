import { describe, expect, it } from 'vitest';
import { Bone, Group } from 'three';
import { bindRig } from '../../../src/engine/anim/rig';
import { speciesDef, speciesKinds } from '../../../src/engine/entities/species/registry';
import { Rng } from '../../../src/engine/core/rng';
import { setLowPoly } from '../../../src/engine/entities/species/loft';
import { loadSpecies } from '../../species';

loadSpecies();
describe('procedural species contracts', () => {
  it.each(speciesKinds())('%s validates every authored variant without changing its bones', (kind) => {
    const def = speciesDef(kind);
    setLowPoly(true);
    try {
      for (const variant of [...def.variants, ...(def.spawnOnly ?? [])]) {
        const model = def.build(variant, new Rng(357)), root = new Group();
        for (const node of model.bones) { const bone = new Bone(); bone.name = node.name; bone.position.set(...node.pos); root.add(bone); }
        const before = root.children.map((node) => node.position.toArray());
        const rig = bindRig(root, [], def.rigContract, { skeleton: def.rigContract.skeleton, procedural: def.rigContract.clips });
        expect(rig.clips.size).toBe(0); expect(rig.sockets.has('body')).toBe(true); expect(rig.sockets.has('head')).toBe(true);
        expect(root.children.map((node) => node.position.toArray())).toEqual(before);
        for (const part of [...model.furParts, ...model.hardParts, ...model.eyeParts]) part.dispose();
      }
    } finally { setLowPoly(false); }
  });
});
