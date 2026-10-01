import * as THREE from 'three';

/**
 * An estimate of the texture memory a scene holds: every texture its materials and uniforms reference, once, at its
 * pixel size × bytes per texel (× 4/3 with mipmaps; × 6 for a cube, × depth for an array). Render targets (the composer's,
 * the shadow maps) are not in the scene and not counted; a compressed (KTX2) texture counts at its format's block size
 * (ASTC 4×4 / BC7 / ETC2 EAC: 1 byte a texel; ETC1 / ETC2 RGB / BC1 / PVRTC 4bpp: ½).
 */
export function textureBytes(scene: THREE.Object3D): number {
  const seen = new Set<object>();
  const add = (v: unknown): void => { if (v instanceof THREE.Texture) seen.add(v as object); };
  const fromMaterial = (m: THREE.Material): void => {
    for (const v of Object.values(m)) add(v);
    const u = (m as Partial<THREE.ShaderMaterial>).uniforms;
    if (u) for (const x of Object.values(u)) { const val: unknown = x.value; if (Array.isArray(val)) val.forEach(add); else add(val); }
  };
  scene.traverse((o) => {
    const m = (o as Partial<THREE.Mesh>).material;
    if (Array.isArray(m)) m.forEach(fromMaterial); else if (m) fromMaterial(m);
  });
  if (scene instanceof THREE.Scene) { add(scene.background); add(scene.environment); }
  let bytes = 0;
  const num = (o: unknown, k: string): number => { const n: unknown = typeof o === 'object' && o !== null ? Reflect.get(o, k) : undefined; return typeof n === 'number' ? n : 0; };
  for (const t of seen) {
    const img: unknown = Reflect.get(t, 'image');
    const w = num(img, 'width'), h = num(img, 'height');
    if (w <= 0 || h <= 0) continue;
    const layers = t instanceof THREE.CubeTexture ? 6 : Math.max(1, num(img, 'depth'));
    const type = num(t, 'type'), format = num(t, 'format'), minFilter = num(t, 'minFilter');
    const compressed = t instanceof THREE.CompressedTexture, filtered = minFilter !== THREE.LinearFilter && minFilter !== THREE.NearestFilter;
    const bpp = compressed ? blockBytesPerTexel(format) : type === THREE.FloatType ? 16 : type === THREE.HalfFloatType ? 8 : format === THREE.RedFormat ? 1 : 4;
    // a KTX2 texture carries its own mip chain (its JS copy is dropped once uploaded: count the chain, not the array)
    const mips = compressed ? filtered : Reflect.get(t, 'generateMipmaps') === true && filtered;
    bytes += w * h * layers * bpp * (mips ? 4 / 3 : 1);
  }
  return bytes;
}

/** bytes a texel of a GPU-compressed format takes (its block's bytes ÷ its texels) */
function blockBytesPerTexel(format: number): number {
  switch (format) {
    case THREE.RGB_ETC1_Format: case THREE.RGB_ETC2_Format: case THREE.RGB_S3TC_DXT1_Format: case THREE.RGBA_S3TC_DXT1_Format:
    case THREE.RGB_PVRTC_4BPPV1_Format: case THREE.RGBA_PVRTC_4BPPV1_Format: case THREE.RED_RGTC1_Format: case THREE.SIGNED_RED_RGTC1_Format:
      return 0.5;
    case THREE.RGB_PVRTC_2BPPV1_Format: case THREE.RGBA_PVRTC_2BPPV1_Format:
      return 0.25;
    default:
      return 1; // ASTC 4×4, BC7 (BPTC), BC3 / DXT5, ETC2 EAC, RGTC2
  }
}
