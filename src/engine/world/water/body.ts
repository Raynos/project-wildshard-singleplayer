import type { Scope } from '../../app/scope';
import { waveHeight } from '../waves';

/**
 * A body of water a level registers with the engine (01 §6, §17; 08 §6.1 step 4). S4.1 builds the subset the sea needs:
 * its rest `level`, the moving surface height and an inside test. X5 converts the other bodies (a pond, a river)
 * and adds `reflect`.
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
    inside: (x, z, y) => y < level + waveHeight(x, z),
  };
}
