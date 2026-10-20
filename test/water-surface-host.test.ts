import { expect, test } from 'vitest';
import { DataTexture, DataUtils, MeshStandardMaterial, PlaneGeometry, type Texture } from 'three';
import { WaterSurface } from '../src/game/systems/looks/waterSurface';
import type { GraphLiteral } from '../src/format/materialGraph';
import { OCEAN_SURFACE } from '../src/shards/driftwood-isle/generators/oceanLook';
import waterRows from '../src/shards/pine-hollow/data/waterLook.json' with { type: 'json' };

const { surfaces: WATER_SURFACES } = waterRows;

test('Driftwood ocean binds its floor, foam and dry sockets; Pine draws its plain surface rows', () => {
  for (const row of [OCEAN_SURFACE, ...Object.values(WATER_SURFACES)]) {
    const params = new Map<string, GraphLiteral>(), textures = new Map<string, Texture>();
    const geometry = new PlaneGeometry(2, 2), material = new MeshStandardMaterial();
    const surface = new WaterSurface(row, { material, param: (name, value) => { params.set(name, value); },
      texture: (name, value) => { textures.set(name, value); } });
    if (surface.row.floor === undefined) {
      surface.draw(geometry);
      expect(textures.size).toBe(0);
      expect(() => surface.foamAround([])).toThrow('no floor');
    } else {
      const floor = new Uint16Array(surface.row.floor.res ** 2).fill(DataUtils.toHalfFloat(-2));
      surface.draw(geometry, { level: 1, floor, dry: [{ minX: -2, minZ: -3, maxX: 2, maxZ: 3 }] });
      expect(params.get('dry0')).toEqual([-2, -3, 2, 3]);
      expect(params.get('dry1')).toEqual([...OCEAN_SURFACE.dry.none]);
      const texture = textures.get('tSea');
      expect(texture).toBeInstanceOf(DataTexture);
      if (!(texture instanceof DataTexture)) throw new Error('Missing water floor');
      expect(texture.image.width).toBe(OCEAN_SURFACE.floor.res);
      surface.foamAround([{ x: 0, z: 0, hw: 2, hd: 2, rot: 0, yBottom: -2, yTop: 2 }]);
      const data = texture.image.data;
      if (data === null) throw new Error('Missing floor pixels');
      expect(data[0]).toBe(floor[0]);
      expect(Array.from(data).some((value, index) => index % 2 === 1 && value > 0)).toBe(true);
      expect(() => surface.draw(geometry, { floor: new Uint16Array(1) })).toThrow('baked floor');
      texture.dispose();
    }
    expect(surface.mesh.geometry).toBe(geometry);
    expect(surface.mesh.material).toBe(material);
    expect(surface.mesh.name).toBe(row.name);
    expect(surface.mesh.renderOrder).toBe(row.renderOrder);
    geometry.dispose(); material.dispose();
  }
});
