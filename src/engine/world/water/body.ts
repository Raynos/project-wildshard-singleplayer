import type { Scope } from '../../app/scope';
import { insideWaterExtent, waveHeight } from '../waves';
import type { WaterView } from './view';

/**
 * A body of water a level registers with the engine (01 §6, §17; 08 §6.1 step 4): the sea (S4.1), a still basin (a
 * pond, a river channel) and running water (a creek) (X5). Swimming, wading and the camera's water line ask
 * `app.world.water`; each body's mesh stays its builder's.
 */
export interface WaterBody {
  /** `sea` for an open-water level's ocean (the one generic readers ask for), else a level-chosen id */
  readonly id: string;
  /** the rest surface height, metres */
  readonly level: number;
  /** the surface height at (x, z) now, swell included */
  readonly surfaceAt: (x: number, z: number) => number;
  /** whether the point (x, y, z) is under this body's surface */
  readonly inside: (x: number, z: number, y: number) => boolean;
  /** the rest surface over (x, z) — what the player swims and wades against — or null where the body doesn't reach */
  readonly restAt: (x: number, z: number) => number | null;
  /** the reflect hook: the surface's shading for a view (Explore's top-down shot); omitted = it looks the same from anywhere */
  readonly reflect?: (view: WaterView) => void;
}

/** `app.world.water`: the level's registered bodies; each leaves with the scope that added it. */
export class WaterBodies {
  private readonly bodies = new Map<string, WaterBody>();

  add(body: WaterBody, scope: Scope): void {
    if (this.bodies.has(body.id)) throw new Error(`water body ${body.id} is already registered`);
    this.bodies.set(body.id, body);
    scope.onDispose(() => { if (this.bodies.get(body.id) === body) this.bodies.delete(body.id); });
  }

  get(id: string): WaterBody | null { return this.bodies.get(id) ?? null; }

  /** the open sea, or null on a level without one */
  get sea(): WaterBody | null { return this.get('sea'); }

  /** the sea's rest level, or null */
  get level(): number | null { return this.sea?.level ?? null; }

  /** the first body whose surface covers (x, y, z) */
  inside(x: number, z: number, y: number): WaterBody | null {
    for (const body of this.bodies.values()) if (body.inside(x, z, y)) return body;
    return null;
  }

  /** the first body's rest surface over (x, z) in registration order (the sea covers everything), or null off the water */
  restAt(x: number, z: number): number | null {
    for (const body of this.bodies.values()) {
      const y = body.restAt(x, z);
      if (y !== null) return y;
    }
    return null;
  }

  /** shade every body's surface for `view` (each body's own reflect hook) */
  reflect(view: WaterView): void {
    for (const body of this.bodies.values()) body.reflect?.(view);
  }

  /** the sea's moving surface at (x, z), or null on a level without one */
  surfaceAt(x: number, z: number): number | null {
    const sea = this.sea;
    return sea === null ? null : sea.surfaceAt(x, z);
  }

  get size(): number { return this.bodies.size; }
}

/** A body whose surface rides the engine's Gerstner swell (../waves.ts) over a flat rest level: an open sea. */
export function swellBody(id: string, level: number): WaterBody {
  return {
    id, level,
    surfaceAt: (x, z) => level + waveHeight(x, z),
    inside: (x, z, y) => insideWaterExtent(x, z) && y < level + waveHeight(x, z),
    restAt: (x, z) => (insideWaterExtent(x, z) ? level : null),
  };
}

/**
 * A still basin cut into the terrain (a pond, a river channel): water wherever the terrain's
 * `pondMask` is above 0, standing flat at its `waterLevel()` (both read from the terrain at call time).
 */
export function basinBody(id: string, terrain: { pondMask: (x: number, z: number) => number; waterLevel: () => number },
  reflect?: (view: WaterView) => void): WaterBody {
  const restAt = (x: number, z: number): number | null => terrain.pondMask(x, z) > 0 ? terrain.waterLevel() : null;
  return {
    id, get level() { return terrain.waterLevel(); }, restAt,
    surfaceAt: () => terrain.waterLevel(),
    inside: (x, z, y) => { const s = restAt(x, z); return s !== null && y < s; },
    ...(reflect === undefined ? {} : { reflect }),
  };
}
