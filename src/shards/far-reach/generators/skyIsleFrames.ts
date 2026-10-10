import { Box3, DoubleSide, Mesh, MeshBasicMaterial, Vector3, type BufferAttribute, type BufferGeometry } from 'three';
import { readSourceModel } from '@wildshard/sdk/bake/skinned';
import { hdGeometry } from '@wildshard/sdk/looks/modelIntake';
import { SKY_ISLE_HD, SKY_ISLE_MODELS } from '../data/skyIsles';
import { skyIsleHitDown, type SkyIsleFrame } from '../world/skyIsleHd';
import { skyHdUrl } from '../boot/files';

/**
 * Build-time only (SHARD-PLATFORM M3, offline bakes): each textured sky-isle model's unit frame (world/skyIsleHd.ts), found
 * here once from its GLB as the page loads it (three's own GLTFLoader, the same intake), baked by
 * `scripts/bake-sky-world.mjs` into `data/skyIsleFrames.json`. The page moves its loaded model by the row
 * (`skyIsleUnit`); the far bake (generators/farLook.ts) finds its own model's frame here too.
 */

const median = (v: number[]): number => { const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] ?? 0; };

/**
 * A model's unit frame: its turf level (the median first hit straight down over the middle of its top: bushes and the
 * crag's outcrop are outliers) to y 0, centred on its top, its rim's median radius to 1; the top's radius per angle bin
 * (the farthest vertex near the turf level in each) and its widest reach under the turf, both in unit radii.
 */
export function skyIsleFrame(geometry: BufferGeometry): Omit<SkyIsleFrame, 'model'> {
  const probe = new Mesh(geometry, new MeshBasicMaterial({ side: DoubleSide }));
  const p = geometry.getAttribute('position') as BufferAttribute, box = new Box3().setFromBufferAttribute(p);
  const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2, half = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2;
  const hits: number[] = [];
  for (let i = -3; i <= 3; i++) for (let k = -3; k <= 3; k++) {
    const hit = skyIsleHitDown(probe, new Vector3(cx + (i / 3) * half * 0.45, box.max.y + 1, cz + (k / 3) * half * 0.45)); if (hit !== undefined) hits.push(hit);
  }
  const deck = median(hits), lip = deck - (box.max.y - box.min.y) * 0.06;
  const top = new Box3();
  for (let i = 0; i < p.count; i++) if (p.getY(i) > lip) top.expandByPoint(new Vector3(p.getX(i), p.getY(i), p.getZ(i)));
  const tx = (top.min.x + top.max.x) / 2, tz = (top.min.z + top.max.z) / 2, bins = SKY_ISLE_HD.rimBins, rim = new Float32Array(bins);
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) <= lip) continue;
    const dx = p.getX(i) - tx, dz = p.getZ(i) - tz, b = Math.floor(((Math.atan2(dz, dx) / (Math.PI * 2)) + 1) * bins) % bins;
    rim[b] = Math.max(rim[b] ?? 0, Math.hypot(dx, dz));
  }
  const k = 1 / Math.max(1e-6, median([...rim].filter((r) => r > 0)));
  let bulge = 0;
  for (let i = 0; i < p.count; i++) if (p.getY(i) <= deck) bulge = Math.max(bulge, Math.hypot(p.getX(i) - tx, p.getZ(i) - tz) * k);
  for (let b = 0; b < bins; b++) rim[b] = (rim[b] ?? 0) * k;
  return { tx, deck, tz, k, bulge, rim: Array.from(rim) };
}

/** Every sky-isle model's frame from its GLB (`read` returns a public file's bytes), in SKY_ISLE_MODELS order. */
export async function bakeSkyIsleFrames(read: (url: string) => Uint8Array): Promise<SkyIsleFrame[]> {
  const frames: SkyIsleFrame[] = [];
  for (const model of SKY_ISLE_MODELS) {
    const source = await readSourceModel(read(skyHdUrl(model))), hd = hdGeometry(source.gltf.scene, (material) => source.texture(material) !== null);
    if (hd === null) throw new Error(`far-reach sky isle frames: ${model} has no textured mesh`);
    frames.push({ model, ...skyIsleFrame(hd.geometry) });
  }
  return frames;
}
