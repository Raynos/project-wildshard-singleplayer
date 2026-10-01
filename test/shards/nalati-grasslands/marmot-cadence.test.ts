import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { Rng } from '#engine/core/rng';
import { Marmots } from '../../../src/shards/nalati-grasslands/creatures/marmots';
import { fakeWorld } from '../../fake/world';

describe('Nalati colony pause (E357 J2 / P6)', () => {
  it('pauses far colony rolls and resumes nearby without replaying elapsed time', () => {
    const marmots = new Marmots(fakeWorld().sky, 357).build([{ x: 0, z: 0 }]);
    const pose = Array.from(marmots.mesh.instanceMatrix.array), draws = vi.spyOn(Rng.prototype, 'next');
    try {
      const far = new THREE.Vector3(1000, 0, 1000);
      for (let frame = 0; frame < 180; frame++) marmots.update(1 / 30, far, 0, false);
      expect(draws).not.toHaveBeenCalled();
      expect(Array.from(marmots.mesh.instanceMatrix.array)).toEqual(pose);
      const near = new THREE.Vector3(70, 0, 0);
      marmots.update(1 / 30, near, 0, false);
      expect(draws).not.toHaveBeenCalled();
      for (let frame = 0; frame < 180; frame++) marmots.update(1 / 30, near, 0, false);
      expect(draws).toHaveBeenCalled();
      expect(Array.from(marmots.mesh.instanceMatrix.array)).not.toEqual(pose);
    } finally { draws.mockRestore(); marmots.mesh.geometry.dispose(); }
  });
});
