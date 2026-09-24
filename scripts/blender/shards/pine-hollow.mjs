// Pine Hollow's half of scripts/blender/export-scene.mjs (PINE-HOLLOW-REMASTER PH-0.3; the Blender build itself is wave 2,
// PH-U17). The shard is photoreal PBR, so the area grid's colour is the splat-weighted mean albedo of its four Poly Haven
// ground layers × the def's groundTints (linear), and the real weights go beside it in splat.bin (u8 × 4 per area vertex,
// same order as area.bin) so a Blender material can blend the actual textures.
//
// Layout specs for the bake: the forest (the game's own placeForest on the baked grid, every tree in the chunk, so the
// bake sees the canopy around the area), the cabin sites, the pond and the trails. No structures yet: the cabins are
// built from textures at runtime (Cabin.ts is async and loads Poly Haven sets), so structures.bin carries 0 tris.
//
// Layer albedo: the mean of each public/assets/tex/<layer>/diffuse_1k.jpg, sRGB-decoded (measured 2026-09-24).
import { writeFileSync } from 'node:fs';

const LAYER_ALBEDO = {
  forest_ground_04: [0.1526, 0.1089, 0.064],
  leafy_grass: [0.3196, 0.236, 0.1066],
  rock_ground: [0.191, 0.1633, 0.133],
  stony_dirt_path: [0.0793, 0.0486, 0.0281],
};

/** the area's splat weights, filled by groundColor's callback in area.bin order, written by layout() */
let splat = new Uint8Array(0);

export function groundColor({ hf, def, area }) {
  const layers = def.assets.groundLayers.map((name, i) => {
    const a = LAYER_ALBEDO[name];
    if (!a) throw new Error(`pine-hollow.mjs: no albedo for ground layer ${name}`);
    const t = def.assets.groundTints[i];
    return [a[0] * t[0], a[1] * t[1], a[2] * t[2]];
  });
  splat = new Uint8Array(area.nx * area.nz * 4);
  let n = 0;
  return (c, x, z) => {
    const w = hf.splatAt(x, z);
    let r = 0, g = 0, b = 0;
    for (let k = 0; k < 4; k++) { const L = layers[k]; r += w[k] * L[0]; g += w[k] * L[1]; b += w[k] * L[2]; splat[n++] = Math.round(Math.min(1, Math.max(0, w[k])) * 255); }
    c.setRGB(r, g, b);
  };
}

export async function layout({ imp, hf, def, CACHE }) {
  writeFileSync(`${CACHE}/splat.bin`, splat);
  const placement = await imp('src/world/placement.ts');
  const variants = def.trees.factory === 'none' ? [] : placement.TREE_SPECS.map((s) => ({ trunkRadius: s.trunk, height: s.height }));
  const { trees } = placement.placeForest(variants);
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const t = def.terrain;
  return {
    scene: {
      trees: trees.map((tr) => ({ x: r3(tr.x), y: r3(tr.y), z: r3(tr.z), variant: tr.variant, scale: r3(tr.scale), rot: r3(tr.rot), height: r3(tr.height), r: r3(tr.r) })),
      treeSpecs: placement.TREE_SPECS,
      cabins: t.cabinSites.map((s) => ({ ...s, y: r3(hf.heightAt(s.x, s.z)) })),
      pond: t.pond ? { ...t.pond, level: r3(t.waterLevel()) } : null,
      trails: t.trails,
      groundLayers: def.assets.groundLayers,
    },
    summary: `trees ${trees.length}, cabins ${t.cabinSites.length}, pond ${t.pond ? 'yes' : 'no'}`,
  };
}
