import { DataTexture, LinearFilter, LinearMipmapLinearFilter, RGBAFormat, UnsignedByteType } from 'three';

/**
 * The sward's tuft atlas (E399, every council round: 'a flat lit plane with dark spiky tufts'; the mockups' meadow is a
 * dense carpet of fine crossing blades). `variants` tufts side by side, each `w × h` texels: ~70 tapered, curved strands
 * fanning out of a root, drawn in code so no file ships. The channels are data, not colour: R the strand's own shade,
 * G how far along its strand the texel is (0 root, 1 tip), A the coverage. world/meadow.ts paints them.
 */
export const SWARD_ATLAS = { variants: 4, w: 128, h: 256, strands: 72 } as const;

export function swardAtlas(seed = 6417): DataTexture {
  const { variants, w, h, strands } = SWARD_ATLAS, W = w * variants, data = new Uint8Array(W * h * 4);
  let a = seed >>> 0;
  const rnd = (): number => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let v = 0; v < variants; v++) {
    const x0 = v * w;
    for (let s = 0; s < strands; s++) {
      // roots bunched in the middle, the outer strands shorter and leaning out (a tuft fans)
      const off = (rnd() + rnd() + rnd() - 1.5) / 1.5, rootX = w * (0.5 + off * 0.3);
      const len = h * (0.42 + 0.56 * rnd()) * (1 - 0.35 * Math.abs(off)), lean = (off * 0.55 + (rnd() - 0.5) * 0.5) * len * 0.45;
      const curl = (rnd() - 0.5) * len * 0.12, base = 1.1 + 1.4 * rnd(), shade = 0.5 + 0.5 * rnd();
      const steps = Math.ceil(len * 2);
      for (let i = 0; i <= steps; i++) {
        const t = i / steps, y = t * len, cx = rootX + lean * t * t + curl * Math.sin(t * Math.PI);
        const hw = base * (1 - t) ** 0.75 + 0.35;
        const row = Math.floor(y); if (row >= h) break;
        for (let px = Math.floor(cx - hw - 1); px <= Math.ceil(cx + hw + 1); px++) {
          if (px < 0 || px >= w) continue;
          const cover = Math.min(1, Math.max(0, hw + 0.5 - Math.abs(px + 0.5 - cx)));
          if (cover <= 0) continue;
          const k = ((row * W) + x0 + px) * 4, prior = (data[k + 3] ?? 0) / 255;
          // a later strand lies over an earlier one; its rounded edge a little darker
          const edge = 1 - 0.25 * Math.min(1, Math.abs(px + 0.5 - cx) / Math.max(hw, 0.5));
          if (cover >= prior || cover > 0.5) {
            data[k] = Math.round(255 * shade * edge); data[k + 1] = Math.round(255 * t); data[k + 2] = 0;
            data[k + 3] = Math.round(255 * Math.max(prior, cover));
          }
        }
      }
    }
  }
  const tex = new DataTexture(data, W, h, RGBAFormat, UnsignedByteType);
  tex.minFilter = LinearMipmapLinearFilter; tex.magFilter = LinearFilter; tex.generateMipmaps = true; tex.needsUpdate = true;
  tex.name = 'far.sward-atlas';
  return tex;
}
