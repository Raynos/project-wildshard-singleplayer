/**
 * The far tier's impostor at run time (G539: near = the full cell, mid = its far proxy, far = this). One quad under the
 * cell's root, turned about the vertical to face the camera in the vertex shader; it samples the two baked views
 * (`@wildshard/sdk/bake/farImpostor`) nearest the camera's azimuth and blends them, then hazes exactly as the proxy does
 * (the proxy's own haze toward the frame's air, after tone mapping and the output conversion). The band between proxy
 * and impostor is a screen-door cross-fade: the proxy keeps the fragments under the band's dither and the impostor the
 * rest, so a cell never pops between them. The texels pack to RGBA 5551 (2 bytes, the bake's own quantisation) and leave
 * the JS heap once uploaded. Generic: nothing here knows a shard.
 */
import { DataTexture, LinearFilter, Mesh, PlaneGeometry, RGBAFormat, ShaderMaterial, Sphere, UnsignedShort5551Type, Vector3, type Color, type Material, type Object3D } from 'three';
import { gpuOnlyTexture } from '@wildshard/engine/core/gpuOnly';
import type { FarImpostor } from '@wildshard/format/shardSections';
import type { FarHaze } from './farProxy';

/** A decoded impostor: its row and its packed texels. */
export interface FarImpostorData { readonly row: FarImpostor; readonly texels: Uint16Array; readonly width: number; readonly height: number }

/** The far tier's bands (m, camera to the cell's square): the proxy hands over to the impostor across `fade` about `from`. */
export const FAR_BANDS = { from: 2000, fade: 300 } as const;
/** The band share (0: proxy only, 1: impostor only) at a distance. */
export function farBandShare(distance: number): number {
  const t = (distance - (FAR_BANDS.from - FAR_BANDS.fade / 2)) / FAR_BANDS.fade;
  return Math.min(1, Math.max(0, t));
}

/**
 * Decode a baked impostor image (PNG bytes) to packed RGBA 5551 texels. Browser-only (an image decoder and a 2D canvas);
 * null where neither exists (Node tests, a worker without OffscreenCanvas): the cell keeps its proxy at every distance.
 */
export async function decodeFarImpostor(row: FarImpostor, bytes: Uint8Array): Promise<FarImpostorData | null> {
  if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas !== 'function') return null;
  const bitmap = await createImageBitmap(new Blob([bytes.slice().buffer], { type: 'image/png' }), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  const rows = Math.ceil(row.views / row.cols), width = row.cols * row.tile[0], height = rows * row.tile[1];
  try {
    if (bitmap.width !== width || bitmap.height !== height) throw new Error(`Far impostor is ${String(bitmap.width)} × ${String(bitmap.height)}, its row says ${String(width)} × ${String(height)}`);
    const context = new OffscreenCanvas(width, height).getContext('2d', { willReadFrequently: true });
    if (context === null) return null;
    context.drawImage(bitmap, 0, 0);
    const rgba = context.getImageData(0, 0, width, height).data, texels = new Uint16Array(width * height);
    // the image's top row is the texture's last (texture v runs up): rows flip as they pack
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = ((height - 1 - y) * width + x) * 4, five = (k: number): number => Math.round((rgba[i + k] ?? 0) * 31 / 255);
      texels[y * width + x] = (five(0) << 11) | (five(1) << 6) | (five(2) << 1) | ((rgba[i + 3] ?? 0) >= 128 ? 1 : 0);
    }
    return { row, texels, width, height };
  } finally { bitmap.close(); }
}

const vertex = /* glsl */ `
uniform vec4 uFrame;
uniform vec2 uGrid;
varying vec2 vUv;
varying vec4 vTiles;
varying float vMix;
varying float vFarDepth;
void main() {
  vec3 centre = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec2 d = cameraPosition.xz - centre.xz;
  float a = atan(d.x, d.y);
  vec3 world = centre + vec3(cos(a), 0.0, -sin(a)) * (position.x * uFrame.x) + vec3(0.0, mix(uFrame.y, uFrame.z, position.y), 0.0);
  float s = mod(a / 6.2831853 * uFrame.w + uFrame.w, uFrame.w), i0 = floor(s), i1 = mod(i0 + 1.0, uFrame.w);
  vMix = s - i0;
  vTiles = vec4(mod(i0, uGrid.x), floor(i0 / uGrid.x), mod(i1, uGrid.x), floor(i1 / uGrid.x));
  vUv = vec2(position.x + 0.5, position.y);
  vec4 mv = viewMatrix * vec4(world, 1.0);
  vFarDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const fragment = /* glsl */ `
uniform sampler2D uAtlas;
uniform vec2 uGrid;
uniform float uRange;
uniform float uBand;
uniform vec3 farHazeColour;
uniform vec3 farHaze;
varying vec2 vUv;
varying vec4 vTiles;
varying float vMix;
varying float vFarDepth;
vec3 farDecode(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c)); }
void main() {
  if (fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) >= uBand) discard;
  vec4 c0 = texture2D(uAtlas, vec2((vTiles.x + vUv.x) / uGrid.x, 1.0 - (vTiles.y + 1.0 - vUv.y) / uGrid.y));
  vec4 c1 = texture2D(uAtlas, vec2((vTiles.z + vUv.x) / uGrid.x, 1.0 - (vTiles.w + 1.0 - vUv.y) / uGrid.y));
  float w0 = c0.a * (1.0 - vMix), w1 = c1.a * vMix, w = w0 + w1;
  if (w < 0.5) discard;
  gl_FragColor = vec4(farDecode((c0.rgb * w0 + c1.rgb * w1) / w) * uRange, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  gl_FragColor.rgb = mix(gl_FragColor.rgb, farHazeColour, smoothstep(farHaze.x, farHaze.y, vFarDepth) * farHaze.z);
}`;

/** A drawn impostor: its mesh and the band share it draws at. */
export interface FarImpostorView { readonly mesh: Mesh; band: (share: number, shown: boolean) => void; dispose: () => void }

/** Install an impostor under a cell root, hazed toward `haze` (the proxy's own frame colour, shared, sRGB). */
export function installFarImpostor(root: Object3D, data: FarImpostorData, look: { readonly haze: FarHaze }, haze: Color, decorate?: (material: Material) => void): FarImpostorView {
  const { row } = data, rows = Math.ceil(row.views / row.cols);
  const texture = new DataTexture(data.texels, data.width, data.height, RGBAFormat, UnsignedShort5551Type);
  texture.magFilter = LinearFilter; texture.minFilter = LinearFilter; texture.generateMipmaps = false; texture.needsUpdate = true; texture.name = 'far-impostor';
  gpuOnlyTexture(texture, 'far-impostor');
  const material = new ShaderMaterial({
    vertexShader: vertex, fragmentShader: fragment, fog: false, lights: false,
    uniforms: { uAtlas: { value: texture }, uGrid: { value: [row.cols, rows] }, uFrame: { value: [row.width, row.bottom, row.top, row.views] }, uRange: { value: row.range },
      uBand: { value: 0 }, farHazeColour: { value: haze }, farHaze: { value: new Vector3(look.haze.near, look.haze.far, look.haze.max) } },
  });
  material.name = 'far-impostor';
  decorate?.(material);
  // the quad is placed in the vertex shader: x across (−½ … ½ of the width), y up (0 … 1 of the span)
  const geometry = new PlaneGeometry(1, 1).translate(0, 0.5, 0);
  geometry.boundingSphere = new Sphere(new Vector3(0, (row.bottom + row.top) / 2, 0), Math.hypot(row.width / 2, (row.top - row.bottom) / 2));
  const mesh = new Mesh(geometry, material);
  mesh.name = 'far-impostor'; mesh.castShadow = false; mesh.receiveShadow = false; mesh.matrixAutoUpdate = false; mesh.visible = false;
  mesh.updateMatrix(); root.add(mesh);
  const band = material.uniforms['uBand'];
  let disposed = false;
  return {
    mesh,
    band: (share, shown) => { if (band !== undefined) band.value = share; mesh.visible = shown && share > 0; },
    dispose: () => { if (disposed) return; disposed = true; mesh.removeFromParent(); geometry.dispose(); material.dispose(); texture.dispose(); },
  };
}
