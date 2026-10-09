import { describe, expect, it, vi } from 'vitest';
import { Bone, BoxGeometry, MeshLambertMaterial, SkinnedMesh, Vector3 } from 'three';
import type { PersonKey } from '../../../src/shards/nalati-grasslands/campPeopleModels';
import type { NpcFigureRig as PeopleRig } from '../../../src/game/systems/npc/figureRig';
import { buildCampPeople } from '../../../src/shards/nalati-grasslands/campPeople';
import { fakeWorld } from '../../fake/world';

function people(): PeopleRig<PersonKey> {
  const bones = (): PeopleRig<PersonKey>['bones']['elder'] => ({ root: new Bone(), head: new Bone(), arm: new Bone(), neck: new Vector3(0, 1, 0), shoulder: new Vector3(-0.2, 1, 0) });
  return { mesh: new SkinnedMesh(new BoxGeometry(), new MeshLambertMaterial()),
    bones: { elder: bones(), herderGate: bones(), herderRail: bones(), child: bones(), cook: bones() } };
}

// the rig loader is passed in, not spied on a module (E422)
describe('Nalati people boot barrier (E357 R9)', () => {
  it.each([false, true])('ready resolves only after adoption or load failure (%s)', async (fail) => {
    let finish: (value: PeopleRig<PersonKey>) => void = () => { throw new Error('Not initialized'); };
    let failure: (reason: Error) => void = () => { throw new Error('Not initialized'); };
    const pending = new Promise<PeopleRig<PersonKey>>((resolve, reject) => { finish = resolve; failure = reject; });
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const built = buildCampPeople(fakeWorld().sky, () => 0, null, undefined, () => pending);
    let ready = false;
    const done = built.ready.then(() => { ready = true; return undefined; });
    await Promise.resolve(); expect(ready).toBe(false);
    const rig = people();
    if (fail) failure(new Error('People unavailable')); else finish(rig);
    await done;
    expect(built.group.children.includes(rig.mesh)).toBe(!fail);
    expect(built.group.children[0]?.visible).toBe(fail);
    expect(warning).toHaveBeenCalledTimes(fail ? 1 : 0);
  });
});
