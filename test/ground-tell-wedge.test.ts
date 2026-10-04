import { expect, it } from 'vitest';
import { Scene, ShaderMaterial } from 'three';
import { GroundTell } from '#game';
import { setTerrainHeight } from '#engine';
import { heightAt as fieldHeight } from '#engine-internal/world/Heightfield';

it('drapes the legacy balbal sector byte-for-byte and updates its fill uniforms', () => {
  // the terrain the wedge drapes over, through the engine's placement-height port (no module mock, E422)
  setTerrainHeight((x, z) => x * .2 + z * .1);
  const fill = { value: 0 }, alpha = { value: 0 }, material = new ShaderMaterial();
  const scene = new Scene(), cone = .8;
  const tell = new GroundTell(scene, 'wedge', 0, { cone, material, fill, alpha });
  const local = new Float32Array(8 * 15 * 2), expected = new Float32Array(8 * 15 * 3);
  for (let r = 0; r <= 7; r++) for (let s = 0; s <= 14; s++) {
    const a = (s / 14 - .5) * 2 * cone, i = r * 15 + s;
    local[i * 2] = Math.sin(a) * r / 7; local[i * 2 + 1] = Math.cos(a) * r / 7;
  }
  for (const yaw of [0, .73, -2.4]) {
    tell.wedge(3, -2, yaw, 4.5, .7, 1.4);
    for (let i = 0; i < local.length / 2; i++) {
      const lx = (local[i * 2] ?? 0) * 4.5, lz = (local[i * 2 + 1] ?? 0) * 4.5;
      const wx = 3 + lx * Math.cos(yaw) + lz * Math.sin(yaw), wz = -2 - lx * Math.sin(yaw) + lz * Math.cos(yaw);
      expected[i * 3] = wx; expected[i * 3 + 1] = wx * .2 + wz * .1 + .06; expected[i * 3 + 2] = wz;
    }
    expect(tell.mesh.geometry.getAttribute('position').array).toEqual(expected);
  }
  expect(scene.children).toContain(tell.mesh); expect(tell.mesh.renderOrder).toBe(9);
  expect(tell.mesh.geometry.index?.count).toBe(7 * 14 * 6);
  expect(fill.value).toBe(.7); expect(alpha.value).toBe(1.4);
  tell.hide(); expect(tell.mesh.visible).toBe(false);
  tell.mesh.geometry.dispose(); material.dispose();
  setTerrainHeight((x, z) => fieldHeight(x, z)); // back to the configured field (the port the engine installs)
});
