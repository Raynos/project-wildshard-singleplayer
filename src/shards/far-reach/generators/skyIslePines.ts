import { DoubleSide, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { readSourceModel } from './skinned';
import { skyIsleHitDown } from './skyIsleProbe';
import { hdGeometry } from '../runtime/looks/modelIntake';
import { SKY_ISLES, SKY_ISLE_HD, SKY_ISLE_MODELS, type SkyIsleModel } from '../data/skyIsles';
import { skyIslePose, skyIsleUnit, skyIsleWear, type SkyIsleFrame, type SkyIsleUnit } from '../world/skyIsleHd';
import { HD_URLS } from '../data/files';

/**
 * Build-time only (SHARD-PLATFORM M3, offline bakes): the firs on the decorative sky isles (world/build.ts), placed here
 * once as the page used to place them on load: each isle's pines from the archipelago's seeded stream (seed 9001, in
 * SKY_ISLES order: a turn, a distance and a size each), each stood on its model's turf by a ray straight down onto the
 * model in the isle's pose (a little sunk), or dropped where the turf is not (a lip, a bush top, a root). Baked by
 * `bake-sky-world.mjs` into `data/skyIslePines.json`; the page reads the rows (no ray at entry).
 */

/** One fir: its place (x, z), its size, and its height on the model's turf (null: no turf there, no fir on a model). */
export interface SkyIslePine { readonly x: number; readonly z: number; readonly size: number; readonly y: number | null }

/** Every sky isle's firs (`read` returns a public file's bytes; `frames` the models' unit frames), by isle id. */
export async function bakeSkyIslePines(read: (url: string) => Uint8Array, frames: readonly SkyIsleFrame[]): Promise<Record<string, SkyIslePine[]>> {
  const units = new Map<SkyIsleModel, { unit: SkyIsleUnit; probe: Mesh }>();
  for (const model of SKY_ISLE_MODELS) {
    const source = await readSourceModel(read(HD_URLS[model])), hd = hdGeometry(source.gltf.scene, (material) => source.texture(material) !== null);
    const frame = frames.find((f) => f.model === model);
    if (hd === null || frame === undefined) throw new Error(`far-reach sky isle pines: ${model} has no textured mesh or frame`);
    const unit = skyIsleUnit(hd.geometry, frame);
    units.set(model, { unit, probe: new Mesh(unit.geometry, new MeshBasicMaterial({ side: DoubleSide })) });
  }
  // each isle's pose, as skyIsleModels places the full list (its place among the isles wearing the same model)
  const worn = new Map<SkyIsleModel, number>(), up = new Vector3(0, 1, 0), local = new Vector3();
  let seed = 9001;
  const rnd = (): number => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const out: Record<string, SkyIslePine[]> = {};
  SKY_ISLES.forEach((s, i) => {
    const name = skyIsleWear(s, i), at = units.get(name), k = worn.get(name) ?? 0; worn.set(name, k + 1);
    if (at === undefined) throw new Error(`far-reach sky isle pines: ${s.id} wears no model`);
    const { yaw, sy } = skyIslePose(s, at.unit, k, false), pines: SkyIslePine[] = [];
    for (let p = 0; p < s.pines; p++) {
      const a = rnd() * Math.PI * 2, d = s.r * (0.2 + rnd() * 0.55), x = s.x + Math.cos(a) * d, z = s.z + Math.sin(a) * d, size = 0.7 + rnd() * 0.5;
      local.set((x - s.x) / s.r, 0, (z - s.z) / s.r).applyAxisAngle(up, -yaw);
      const hit = skyIsleHitDown(at.probe, new Vector3(local.x, 5, local.z));
      // on the model, the fir stands on its turf (a little sunk), or not at all where the turf is not
      pines.push({ x, z, size, y: hit === undefined || Math.abs(hit) > SKY_ISLE_HD.turf ? null : s.y + hit * s.r * sy - 0.2 });
    }
    out[s.id] = pines;
  });
  return out;
}
