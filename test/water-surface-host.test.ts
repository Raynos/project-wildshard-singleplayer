import { expect, test } from 'vitest';
import { BufferAttribute, DataTexture, DataUtils, MeshStandardMaterial, PlaneGeometry, type Texture } from 'three';
import { WaterSurface } from '../src/game/systems/looks/waterSurface';
import { PineWaterSurface } from '../src/shards/pine-hollow/world/poolSurface';
import type { GraphLiteral } from '../src/format/materialGraph';
import { OCEAN_SURFACE } from '../src/shards/driftwood-isle/generators/oceanLook';
import waterRows from '../src/shards/pine-hollow/data/waterLook.json' with { type: 'json' };

const { surfaces: WATER_SURFACES } = waterRows;

test('Driftwood ocean binds its floor, foam and dry sockets; Pine draws its plain surface rows', () => {
  for (const row of [OCEAN_SURFACE, WATER_SURFACES.creek, WATER_SURFACES.trickle, WATER_SURFACES.puddle]) {
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

test('a lowered basin keeps its wet bed, reversible travel and instant saved state', () => {
  const geometry = new PlaneGeometry(2, 2), material = new MeshStandardMaterial();
  geometry.setAttribute('depth', new BufferAttribute(new Float32Array(4), 1));
  const row = { look: 'quarry-water', name: 'quarry-basin', renderOrder: 3,
    transition: { full: 2, lowered: 0, seconds: 4, exponent: 2, depth: 'depth', film: -.3, lift: .1, bank: -.5, reveal: [.25, .75] } };
  const surface = new PineWaterSurface(row, { material });
  try {
    expect(() => surface.draw(geometry)).toThrow('matching bed');
    expect(() => surface.draw(geometry, { ground: [0] })).toThrow('matching bed');
    surface.draw(geometry, { ground: [-1, 1, 2.2, 3] });
    surface.setLowered(true); surface.update(2);
    expect(surface.level).toBe(.5); expect(surface.reveal).toBe(.5);
    const position = geometry.getAttribute('position'), depth = geometry.getAttribute('depth');
    expect(position.getY(0)).toBe(.5); expect(depth.getX(0)).toBe(1.5);
    expect(position.getY(1)).toBeCloseTo(1.1); expect(depth.getX(1)).toBeCloseTo(-.3);
    surface.setLowered(false); surface.update(1); expect(surface.level).toBe(1.125);
    surface.setLowered(true, true); expect(surface.level).toBe(0); expect(surface.reveal).toBe(1);
    surface.update(10); expect(surface.level).toBe(0);
    surface.setLowered(false, true); expect(surface.level).toBe(2); expect(surface.reveal).toBe(0);
    expect(position.getY(2)).toBeCloseTo(2.3); expect(depth.getX(2)).toBeCloseTo(-.2);
    expect(position.getY(3)).toBe(2); expect(depth.getX(3)).toBe(-1);
  } finally { geometry.dispose(); material.dispose(); }
});
