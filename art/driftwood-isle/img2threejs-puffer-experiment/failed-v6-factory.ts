import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type ProceduralModelOptions = {
  wireframe?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  textureSize?: number;
  textureAnisotropy?: number;
  qualityPriority?: 'reference-fidelity' | 'balanced';
};

export type ProceduralModelRuntime = {
  nodes: Record<string, THREE.Object3D>;
  meshes: Record<string, THREE.Mesh>;
  sockets: Record<string, THREE.Object3D>;
  colliders: Record<string, unknown>;
  destructionGroups: Record<string, THREE.Object3D[]>;
};

type SculptMaterialSpec = Record<string, any>;

// bevelEnabled defaults to true on THREE.ExtrudeGeometry and rounds every
// corner — sharp/pointed profiles (blades, fork tines, spikes) need
// bevelEnabled: false plus lineTo()-only path segments near the tip, since a
// curve command cannot produce a true converging point.
function buildExtrudeShape(points: [number, number][], holes?: [number, number][][]): THREE.Shape {
  const shape = new THREE.Shape();
  if (points.length > 0) {
    shape.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) {
      shape.lineTo(points[i][0], points[i][1]);
    }
  }
  // Cutouts (e.g. an oval wire-cutter hole) as THREE.Path added to shape.holes —
  // dep-free boolean subtraction via the tessellator, no CSG library needed.
  for (const loop of holes ?? []) {
    if (loop.length < 3) continue;
    const path = new THREE.Path();
    path.moveTo(loop[0][0], loop[0][1]);
    for (let i = 1; i < loop.length; i += 1) path.lineTo(loop[i][0], loop[i][1]);
    path.closePath();
    shape.holes.push(path);
  }
  return shape;
}

// Build an N-gon oval loop (for hole authoring from a compact {cx,cy,rx,ry} descriptor).
function ovalLoop(cx: number, cy: number, rx: number, ry: number, seg = 24): [number, number][] {
  const loop: [number, number][] = [];
  for (let i = 0; i < seg; i += 1) {
    const a = (i / seg) * Math.PI * 2;
    loop.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return loop;
}

function buildExtrudeGeometry(profile: { points: [number, number][]; depth: number; holes?: [number, number][][]; ovalHoles?: { cx: number; cy: number; rx: number; ry: number }[] }): THREE.ExtrudeGeometry {
  const holes = [...(profile.holes ?? []), ...((profile.ovalHoles ?? []).map((o) => ovalLoop(o.cx, o.cy, o.rx, o.ry)))];
  const shape = buildExtrudeShape(profile.points, holes);
  return new THREE.ExtrudeGeometry(shape, {
    depth: profile.depth,
    bevelEnabled: false,
    steps: 1,
  });
}

type TaperedStation = { position: [number, number, number]; rx: number; rz: number; twist?: number };

// Frames come from PARALLEL TRANSPORT, not from a Frenet frame. A Frenet frame is defined by
// the curve's normal, which flips sign wherever the path has an inflection or straightens out,
// and every flip twists the surface 180 degrees within one segment. Carrying the previous frame
// forward and removing only its along-path component keeps the twist continuous. THREE's own
// extrudePath and TubeGeometry do not expose this, which is why this is hand-built.
function buildTaperedSweepGeometry(
  sweep: { stations: TaperedStation[]; radialSegments?: number; capEnds?: boolean },
): THREE.BufferGeometry {
  const stations = sweep.stations;
  if (stations.length < 2) throw new Error('tapered-sweep needs at least two stations');
  const radial = Math.max(3, sweep.radialSegments ?? 10);
  const centres = stations.map((s) => new THREE.Vector3(...s.position));

  const tangents = centres.map((_, i) => {
    const prev = centres[Math.max(0, i - 1)];
    const next = centres[Math.min(centres.length - 1, i + 1)];
    const t = next.clone().sub(prev);
    // Coincident neighbours would normalise to NaN and poison every downstream vertex.
    return t.lengthSq() < 1e-12 ? new THREE.Vector3(0, 1, 0) : t.normalize();
  });

  // Seed a reference axis that is not parallel to the first tangent, or the first cross
  // product is degenerate and the whole sweep collapses to a line.
  let ref = new THREE.Vector3(0, 0, 1);
  if (Math.abs(tangents[0].dot(ref)) > 0.9) ref = new THREE.Vector3(1, 0, 0);

  const normals: THREE.Vector3[] = [];
  const binormals: THREE.Vector3[] = [];
  let carried = ref.clone().sub(tangents[0].clone().multiplyScalar(ref.dot(tangents[0]))).normalize();
  for (let i = 0; i < tangents.length; i += 1) {
    const t = tangents[i];
    // Project the carried frame back onto the plane perpendicular to this tangent.
    const n = carried.clone().sub(t.clone().multiplyScalar(carried.dot(t)));
    if (n.lengthSq() < 1e-12) {
      const fallback = Math.abs(t.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      n.copy(fallback.sub(t.clone().multiplyScalar(fallback.dot(t))));
    }
    n.normalize();
    normals.push(n);
    binormals.push(new THREE.Vector3().crossVectors(t, n).normalize());
    carried = n;
  }

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const ringStart: number[] = [];
  const isPoint: boolean[] = [];

  for (let i = 0; i < stations.length; i += 1) {
    const st = stations[i];
    const v = i / (stations.length - 1);
    ringStart.push(positions.length / 3);
    // A station whose section has collapsed emits ONE vertex, not a ring of radius zero.
    // A degenerate ring still carries `radial` coincident vertices and `radial` zero-area
    // triangles, so the lock ends in a blunt cap the width of the floating-point noise
    // rather than at a point -- and a hair lock, a horn or a blade tip has to reach a point.
    if (st.rx <= 1e-6 && st.rz <= 1e-6) {
      isPoint.push(true);
      positions.push(centres[i].x, centres[i].y, centres[i].z);
      uvs.push(0.5, v);
      continue;
    }
    isPoint.push(false);
    const twist = ((st.twist ?? 0) * Math.PI) / 180;
    for (let j = 0; j <= radial; j += 1) {
      const theta = (j / radial) * Math.PI * 2 + twist;
      const offset = normals[i].clone().multiplyScalar(Math.cos(theta) * st.rx)
        .add(binormals[i].clone().multiplyScalar(Math.sin(theta) * st.rz));
      const p = centres[i].clone().add(offset);
      positions.push(p.x, p.y, p.z);
      uvs.push(j / radial, v);
    }
  }

  for (let i = 0; i < stations.length - 1; i += 1) {
    const a0 = ringStart[i];
    const b0 = ringStart[i + 1];
    if (isPoint[i] && isPoint[i + 1]) continue;   // two collapsed stations bound nothing
    for (let j = 0; j < radial; j += 1) {
      // Wound so the face normal points radially OUTWARD.
      //
      // Ring vertices advance from `normal` toward `binormal`, and binormal is
      // tangent x normal, so increasing theta runs counter-clockwise seen from the
      // far end of the segment. Taking the ring-to-ring edge first therefore puts
      // the cross product on the inside. Measured as signed volume on the built
      // mesh: every tapered-sweep came out negative -- a torso at -0.0674 and a
      // tail at -0.0044 against a positive ellipsoid head -- so every sweep this
      // generator has ever emitted rendered its back faces, with normals pointing
      // into the solid and every lighting judgement made on the wrong surface.
      if (isPoint[i]) indices.push(a0, b0 + j + 1, b0 + j);
      else if (isPoint[i + 1]) indices.push(a0 + j, a0 + j + 1, b0);
      else indices.push(a0 + j, a0 + j + 1, b0 + j, a0 + j + 1, b0 + j + 1, b0 + j);
    }
  }

  if (sweep.capEnds ?? true) {
    for (const end of [0, stations.length - 1]) {
      if (isPoint[end]) continue;   // a point end is already closed
      const centreIndex = positions.length / 3;
      positions.push(centres[end].x, centres[end].y, centres[end].z);
      uvs.push(0.5, end === 0 ? 0 : 1);
      const base = ringStart[end];
      for (let j = 0; j < radial; j += 1) {
        if (end === 0) indices.push(centreIndex, base + j + 1, base + j);
        else indices.push(centreIndex, base + j, base + j + 1);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function readLayerNumber(value: unknown, keys: string[], fallback: number): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of keys) {
      if (typeof record[key] === 'number') return record[key] as number;
    }
  }
  return fallback;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = /^#[0-9a-f]{3}$/i.test(hex)
    ? '#' + hex.slice(1).split('').map((part) => part + part).join('')
    : hex;
  const value = /^#[0-9a-f]{6}$/i.test(normalized) ? Number.parseInt(normalized.slice(1), 16) : 0x8a7a5f;
  return [clampAlbedoChannel((value >> 16) & 255), clampAlbedoChannel((value >> 8) & 255), clampAlbedoChannel(value & 255)];
}

function materialPalette(spec: SculptMaterialSpec): string[] {
  const palette = spec.colorVariation?.palette;
  if (Array.isArray(palette) && palette.length > 0) return palette.filter((value) => typeof value === 'string');
  const secondary = spec.albedo?.secondary;
  const colors = [spec.baseColor ?? spec.color ?? spec.albedo?.dominant, ...(Array.isArray(secondary) ? secondary : [])];
  return colors.filter((value): value is string => typeof value === 'string' && value.startsWith('#'));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampAlbedoChannel(value: number): number {
  return Math.max(30, Math.min(240, Math.round(value)));
}

function clampPbrF0(value: number): number {
  return Math.max(0.02, Math.min(1, value));
}

function clampPbrIor(value: number): number {
  return Math.max(1, Math.min(2.5, value));
}

function clampPbrMetalness(value: number): number {
  return value >= 0.5 ? 1 : 0;
}

function clampedAlbedoColor(spec: SculptMaterialSpec): THREE.Color {
  const source = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  // setStyle with an explicit SRGBColorSpace, NOT the numeric constructor.
  //
  // `new THREE.Color(r, g, b)` treats its arguments as LINEAR working-space components,
  // while an authored `baseColor` hex is sRGB. Feeding one to the other skipped the
  // transfer function and lifted every dark albedo: #2e2a28, authored as a near-black
  // vinyl, rendered at roughly sRGB 0.46 — a mid grey. The error is largest exactly where
  // it matters most, because the transfer curve is steepest near black.
  return new THREE.Color().setStyle(source, THREE.SRGBColorSpace);
}

function smoothCurve(value: number): number {
  return value * value * (3 - 2 * value);
}

function periodicHash(x: number, y: number, seed: number, periodX: number, periodY: number): number {
  const wrappedX = ((x % periodX) + periodX) % periodX;
  const wrappedY = ((y % periodY) + periodY) % periodY;
  let value = Math.imul(wrappedX + seed * 17, 374761393) ^ Math.imul(wrappedY + seed * 31, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function periodicValueNoise(u: number, v: number, seed: number, periodX: number, periodY: number): number {
  const x = u * periodX;
  const y = v * periodY;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothCurve(x - x0);
  const ty = smoothCurve(y - y0);
  const a = periodicHash(x0, y0, seed, periodX, periodY);
  const b = periodicHash(x0 + 1, y0, seed, periodX, periodY);
  const c = periodicHash(x0, y0 + 1, seed, periodX, periodY);
  const d = periodicHash(x0 + 1, y0 + 1, seed, periodX, periodY);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, tx), THREE.MathUtils.lerp(c, d, tx), ty);
}

type SurfaceBand = {
  frequency: number;
  amplitude: number;
  stretchX: number;
  stretchY: number;
  ridge: boolean;
};

function surfaceBands(spec: SculptMaterialSpec): SurfaceBand[] {
  const source = Array.isArray(spec.surfaceFrequencyBands) ? spec.surfaceFrequencyBands : [];
  const parsed = source.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const band = item as Record<string, unknown>;
    const frequency = typeof band.frequency === 'number' ? band.frequency : 0;
    const amplitude = typeof band.amplitude === 'number' ? band.amplitude : 0;
    if (frequency <= 0 || amplitude <= 0) return [];
    const stretch = Array.isArray(band.stretch) ? band.stretch : [1, 1];
    const description = `${String(band.pattern ?? '')} ${String(band.role ?? '')}`.toLowerCase();
    return [{
      frequency,
      amplitude,
      stretchX: typeof stretch[0] === 'number' ? Math.max(0.1, stretch[0]) : 1,
      stretchY: typeof stretch[1] === 'number' ? Math.max(0.1, stretch[1]) : 1,
      ridge: /(ridge|groove|grain|fiber|striated|crack)/.test(description),
    }];
  });
  return parsed.length > 0 ? parsed : [
    { frequency: 2, amplitude: 0.42, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 12, amplitude: 0.22, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 56, amplitude: 0.08, stretchX: 1, stretchY: 1, ridge: false },
  ];
}

function sampleSurface(u: number, v: number, bands: SurfaceBand[], seed: number): number {
  let value = 0;
  let weight = 0;
  for (let index = 0; index < bands.length; index += 1) {
    const band = bands[index];
    const periodX = Math.max(1, Math.round(band.frequency * band.stretchX));
    const periodY = Math.max(1, Math.round(band.frequency * band.stretchY));
    let sample = periodicValueNoise(u, v, seed + index * 1013, periodX, periodY);
    if (band.ridge) sample = 1 - Math.abs(sample * 2 - 1);
    value += sample * band.amplitude;
    weight += band.amplitude;
  }
  return weight > 0 ? clamp01(value / weight) : 0.5;
}

function mixPalette(colors: [number, number, number][], value: number): [number, number, number] {
  if (colors.length === 1) return colors[0];
  const scaled = clamp01(value) * (colors.length - 1);
  const index = Math.min(colors.length - 2, Math.floor(scaled));
  const mix = scaled - index;
  const a = colors[index];
  const b = colors[index + 1];
  return [
    Math.round(THREE.MathUtils.lerp(a[0], b[0], mix)),
    Math.round(THREE.MathUtils.lerp(a[1], b[1], mix)),
    Math.round(THREE.MathUtils.lerp(a[2], b[2], mix)),
  ];
}

type ColorGradientStop = { offset: number; color: string };
type ColorGradientSpec = {
  type: 'linear' | 'radial';
  axis: [number, number];
  stops: ColorGradientStop[];
};

function parseRgba(value: string): [number, number, number] {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value);
  if (!match) return [138, 122, 95];
  return [clampAlbedoChannel(Number(match[1])), clampAlbedoChannel(Number(match[2])), clampAlbedoChannel(Number(match[3]))];
}

// Analytical per-pixel gradient sample. The extraction schema's colorGradient carries
// exact rgba(...) stop colors (see extract_part_color_recipe.py), so this samples the
// same trend directly in JS math rather than round-tripping through a Canvas 2D
// createLinearGradient/createRadialGradient object — same visual result, and it composes
// directly with the existing noise/height-correlated colorVariation blend below.
function sampleColorGradient(gradient: ColorGradientSpec, u: number, v: number): [number, number, number] {
  const stops = gradient.stops.length >= 2 ? gradient.stops : [{ offset: 0, color: 'rgba(138,122,95,1)' }, { offset: 1, color: 'rgba(138,122,95,1)' }];
  let t: number;
  if (gradient.type === 'radial') {
    const [cx, cy] = gradient.axis;
    const dx = u - cx;
    const dy = v - cy;
    const maxRadius = Math.max(0.001, Math.hypot(Math.max(cx, 1 - cx), Math.max(cy, 1 - cy)));
    t = clamp01(Math.hypot(dx, dy) / maxRadius);
  } else {
    const [ax, ay] = gradient.axis;
    const projection = (u - 0.5) * ax + (v - 0.5) * ay;
    const maxProjection = 0.5 * (Math.abs(ax) + Math.abs(ay)) || 0.5;
    t = clamp01(projection / maxProjection + 0.5);
  }
  const scaled = t * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.max(0, Math.floor(scaled)));
  const mix = scaled - index;
  const a = parseRgba(stops[index].color);
  const b = parseRgba(stops[index + 1].color);
  return [
    THREE.MathUtils.lerp(a[0], b[0], mix),
    THREE.MathUtils.lerp(a[1], b[1], mix),
    THREE.MathUtils.lerp(a[2], b[2], mix),
  ];
}

function writePixel(data: Uint8ClampedArray, offset: number, red: number, green: number, blue: number): void {
  data[offset] = Math.max(0, Math.min(255, Math.round(red)));
  data[offset + 1] = Math.max(0, Math.min(255, Math.round(green)));
  data[offset + 2] = Math.max(0, Math.min(255, Math.round(blue)));
  data[offset + 3] = 255;
}

function makeCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function createMapTexture(
  canvas: HTMLCanvasElement,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [2, 2];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 2,
    typeof repeat[1] === 'number' ? repeat[1] : 2,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

type ProceduralTextureSet = {
  albedo: THREE.Texture;
  roughness: THREE.Texture;
  height: THREE.Texture;
  normal: THREE.Texture;
  ao: THREE.Texture;
  source: 'reference-pixel-extraction' | 'procedural';
};

function referenceMapUrl(spec: SculptMaterialSpec, channel: string): string | null {
  const reference = spec.referencePbr;
  if (!reference || typeof reference !== 'object') return null;
  if (reference.usable === false) return null;
  const confidence = typeof reference.confidence === 'number'
    ? reference.confidence
    : (typeof reference.estimatedFidelity === 'number' ? reference.estimatedFidelity : 0);
  const threshold = typeof reference.targetThreshold === 'number' ? reference.targetThreshold : 0.7;
  if (confidence < threshold) return null;
  const maps = reference.maps;
  if (!maps || typeof maps !== 'object') return null;
  const map = (maps as Record<string, unknown>)[channel];
  if (!map || typeof map !== 'object') return null;
  const record = map as Record<string, unknown>;
  const url = typeof record.url === 'string' && record.url.trim() ? record.url : record.path;
  return typeof url === 'string' && url.trim() ? url : null;
}

function createLoadedMapTexture(
  url: string,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.Texture {
  const texture = new THREE.TextureLoader().load(url);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [1, 1];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 1,
    typeof repeat[1] === 'number' ? repeat[1] : 1,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

function makeReferenceTextureSet(spec: SculptMaterialSpec, options: ProceduralModelOptions): ProceduralTextureSet | null {
  const albedo = referenceMapUrl(spec, 'albedo');
  const roughness = referenceMapUrl(spec, 'roughness');
  const height = referenceMapUrl(spec, 'height');
  const normal = referenceMapUrl(spec, 'normal');
  const ao = referenceMapUrl(spec, 'ao');
  if (!albedo || !roughness || !height || !normal || !ao) return null;
  return {
    albedo: createLoadedMapTexture(albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createLoadedMapTexture(roughness, THREE.NoColorSpace, spec, options),
    height: createLoadedMapTexture(height, THREE.NoColorSpace, spec, options),
    normal: createLoadedMapTexture(normal, THREE.NoColorSpace, spec, options),
    ao: createLoadedMapTexture(ao, THREE.NoColorSpace, spec, options),
    source: 'reference-pixel-extraction',
  };
}

function makeProceduralTextureSet(
  id: string,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): ProceduralTextureSet | null {
  if (typeof document === 'undefined') return null;
  const qualityFirst = (options.qualityPriority ?? 'reference-fidelity') === 'reference-fidelity';
  const requested = options.textureSize ?? spec.textureResolution;
  const requestedSize = typeof requested === 'number' && Number.isFinite(requested)
    ? requested
    : (qualityFirst ? 1024 : 512);
  const size = Math.max(256, Math.min(2048, 2 ** Math.round(Math.log2(requestedSize))));
  const canvases = {
    albedo: makeCanvas(size),
    roughness: makeCanvas(size),
    height: makeCanvas(size),
    normal: makeCanvas(size),
    ao: makeCanvas(size),
  };
  const contexts = {
    albedo: canvases.albedo.getContext('2d'),
    roughness: canvases.roughness.getContext('2d'),
    height: canvases.height.getContext('2d'),
    normal: canvases.normal.getContext('2d'),
    ao: canvases.ao.getContext('2d'),
  };
  if (!contexts.albedo || !contexts.roughness || !contexts.height || !contexts.normal || !contexts.ao) return null;
  const images = {
    albedo: contexts.albedo.createImageData(size, size),
    roughness: contexts.roughness.createImageData(size, size),
    height: contexts.height.createImageData(size, size),
    normal: contexts.normal.createImageData(size, size),
    ao: contexts.ao.createImageData(size, size),
  };
  const seed = hashString(id);
  const bands = surfaceBands(spec);
  const heightField = new Float32Array(size * size);
  const roughnessField = new Float32Array(size * size);
  const palette = materialPalette(spec);
  const fallback = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  const colors = (palette.length >= 2 ? palette : [fallback, '#6E614B', '#A08F70']).map(hexToRgb);
  const baseRoughness = clamp01(readLayerNumber(spec.roughness, ['base'], 0.76));
  const roughnessVariation = clamp01(readLayerNumber(spec.roughness, ['variation'], 0.18));
  const colorAmplitude = clamp01(readLayerNumber(spec.colorVariation, ['amplitude', 'variation'], 0.18));
  const heightCorrelation = clamp01(readLayerNumber(spec.colorVariation, ['heightCorrelation'], 0.3));
  const colorGradient: ColorGradientSpec | undefined = spec.colorGradient;
  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const index = y * size + x;
      const height = sampleSurface(u, v, bands, seed + 101);
      const roughNoise = sampleSurface(u, v, bands, seed + 7001);
      const colorNoise = sampleSurface(u, v, bands, seed + 15013);
      heightField[index] = height;
      roughnessField[index] = clamp01(baseRoughness + (roughNoise - 0.5) * roughnessVariation * 2);
      let color: [number, number, number];
      if (colorGradient) {
        // Evidence-derived spatial gradient (Plan 1.3 Workstream C) takes priority
        // over the noise-based palette blend below — it is a measured trend, not a guess.
        color = sampleColorGradient(colorGradient, u, v);
      } else {
        const paletteValue = clamp01(
          0.5 + (colorNoise - 0.5) * colorAmplitude * 2 + (height - 0.5) * heightCorrelation
        );
        color = mixPalette(colors, paletteValue);
      }
      writePixel(images.albedo.data, index * 4, color[0], color[1], color[2]);
    }
  }
  const normalStrength = Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35));
  const aoStrength = clamp01(readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35));
  for (let y = 0; y < size; y += 1) {
    const up = ((y - 1 + size) % size) * size;
    const down = ((y + 1) % size) * size;
    for (let x = 0; x < size; x += 1) {
      const left = (x - 1 + size) % size;
      const right = (x + 1) % size;
      const index = y * size + x;
      const center = heightField[index];
      const dx = (heightField[y * size + right] - heightField[y * size + left]) * normalStrength * 6;
      const dy = (heightField[down + x] - heightField[up + x]) * normalStrength * 6;
      const inverseLength = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const normalX = -dx * inverseLength;
      const normalY = -dy * inverseLength;
      const normalZ = inverseLength;
      const neighborAverage = (
        heightField[y * size + left] + heightField[y * size + right]
        + heightField[up + x] + heightField[down + x]
      ) * 0.25;
      const cavity = Math.max(0, neighborAverage - center);
      const ao = clamp01(1 - aoStrength * (cavity * 12 + (1 - center) * 0.16));
      const offset = index * 4;
      const heightByte = center * 255;
      const roughnessByte = roughnessField[index] * 255;
      writePixel(images.height.data, offset, heightByte, heightByte, heightByte);
      writePixel(images.roughness.data, offset, roughnessByte, roughnessByte, roughnessByte);
      writePixel(
        images.normal.data, offset,
        (normalX * 0.5 + 0.5) * 255,
        (normalY * 0.5 + 0.5) * 255,
        (normalZ * 0.5 + 0.5) * 255,
      );
      writePixel(images.ao.data, offset, ao * 255, ao * 255, ao * 255);
    }
  }
  contexts.albedo.putImageData(images.albedo, 0, 0);
  contexts.roughness.putImageData(images.roughness, 0, 0);
  contexts.height.putImageData(images.height, 0, 0);
  contexts.normal.putImageData(images.normal, 0, 0);
  contexts.ao.putImageData(images.ao, 0, 0);
  return {
    albedo: createMapTexture(canvases.albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createMapTexture(canvases.roughness, THREE.NoColorSpace, spec, options),
    height: createMapTexture(canvases.height, THREE.NoColorSpace, spec, options),
    normal: createMapTexture(canvases.normal, THREE.NoColorSpace, spec, options),
    ao: createMapTexture(canvases.ao, THREE.NoColorSpace, spec, options),
    source: 'procedural',
  };
}

function createSculptMaterial(id: string, spec: SculptMaterialSpec, options: ProceduralModelOptions, denseComponent = false): THREE.MeshPhysicalMaterial {
  // A material that declares -- with evidence -- that its subject carries no texture
  // detail gets NO texture set. Synthesising one anyway is not a harmless default: the
  // branch below then forces color to white and roughness to 1 and reads both from the
  // generated maps, so the authored albedo and the reference-derived roughness are both
  // discarded, and the model gains mottling the reference does not have. Measured on the
  // tuxedo cat, whose black fur rendered as speckled grey-and-white from a palette that
  // only ever described two flat regions.
  const textureless = (spec.textureless as { declared?: boolean } | undefined)?.declared === true;
  const textures = textureless
    ? null
    : makeReferenceTextureSet(spec, options) ?? makeProceduralTextureSet(id, spec, options);
  const material = new THREE.MeshPhysicalMaterial({
    color: textures ? 0xffffff : clampedAlbedoColor(spec),
    roughness: textures ? 1 : clamp01(readLayerNumber(spec.roughness, ['base'], 0.76)),
    metalness: clampPbrMetalness(readLayerNumber(spec.metalness, ['base'], 0.0)),
    clearcoat: clamp01(readLayerNumber(spec.clearcoat, ['base', 'amount'], 0)),
    clearcoatRoughness: clamp01(readLayerNumber(spec.clearcoatRoughness, ['base'], 0.25)),
    transmission: clamp01(readLayerNumber(spec.transmission, ['base', 'amount'], 0)),
    ior: clampPbrIor(readLayerNumber(spec.ior, ['base', 'value'], 1.5)),
    thickness: Math.max(0, readLayerNumber(spec.thickness, ['base', 'amount'], 0)),
    attenuationDistance: Math.max(0.001, readLayerNumber(spec.attenuationDistance, ['base', 'value'], Infinity)),
    attenuationColor: new THREE.Color(typeof spec.attenuationColor === 'string' ? spec.attenuationColor : '#ffffff'),
    sheen: clamp01(readLayerNumber(spec.sheen, ['base', 'amount'], 0)),
    sheenColor: new THREE.Color(typeof spec.sheenColor === 'string' ? spec.sheenColor : '#ffffff'),
    sheenRoughness: clamp01(readLayerNumber(spec.sheenRoughness, ['base'], 1.0)),
    iridescence: clamp01(readLayerNumber(spec.iridescence, ['base', 'amount'], 0)),
    iridescenceIOR: clampPbrIor(readLayerNumber(spec.iridescenceIOR, ['base', 'value'], 1.3)),
    anisotropy: clamp01(readLayerNumber(spec.anisotropy, ['base', 'amount'], 0)),
    anisotropyRotation: readLayerNumber(spec.anisotropy, ['rotation'], 0),
    specularIntensity: clampPbrF0(readLayerNumber(spec.specularF0 ?? spec.f0 ?? spec.specularIntensity, ['base', 'value'], 1.0)),
    specularColor: new THREE.Color(typeof spec.specularColor === 'string' ? spec.specularColor : '#ffffff'),
    emissive: new THREE.Color(typeof spec.emissive === 'string' ? spec.emissive : '#000000'),
    emissiveIntensity: Math.max(0, readLayerNumber(spec.emissiveIntensity, ['base'], 1.0)),
    opacity: clamp01(readLayerNumber(spec.opacity, ['base'], 1)),
    transparent: readLayerNumber(spec.transmission, ['base', 'amount'], 0) > 0 || readLayerNumber(spec.opacity, ['base'], 1) < 1,
    alphaTest: Math.max(0, readLayerNumber(spec.alpha, ['cutoff', 'alphaTest'], 0)),
    wireframe: options.wireframe ?? false,
    side: spec.doubleSided === true ? THREE.DoubleSide : THREE.FrontSide,
    flatShading: spec.flatShading === true,
  });
  if (textures) {
    material.map = textures.albedo;
    material.roughnessMap = textures.roughness;
    material.normalMap = textures.normal;
    material.normalScale.setScalar(Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35)));
    material.aoMap = textures.ao;
    material.aoMap.channel = 0;
    material.aoMapIntensity = readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35);
    const denseMesh = denseComponent || spec.denseMesh === true || spec.geometryDensity === 'dense' || spec.topologyClass === 'dense';
    const bumpScale = Math.max(0, readLayerNumber(spec.bump, ['amplitude', 'strength'], 0));
    const effectiveBumpScale = denseMesh ? Math.max(0.05, bumpScale) : bumpScale;
    if (effectiveBumpScale > 0) {
      material.bumpMap = textures.height;
      material.bumpScale = effectiveBumpScale;
    }
    const displacementScale = Math.max(0, readLayerNumber(spec.displacement, ['amplitude', 'strength'], 0));
    const effectiveDisplacementScale = denseMesh ? Math.max(0.005, displacementScale) : displacementScale;
    if (effectiveDisplacementScale > 0) {
      material.displacementMap = textures.height;
      material.displacementScale = effectiveDisplacementScale;
      material.displacementBias = -effectiveDisplacementScale * 0.5;
    }
  }
  material.envMapIntensity = readLayerNumber(spec, ['envMapIntensity'], 0.8);
  material.userData.sculptMaterial = spec;
  material.userData.proceduralMapsIndependent = true;
  material.userData.pbrConstraints = { albedoRange: [30, 240], binaryMetalness: true, f0Range: [0.02, 1], iorRange: [1, 2.5] };
  material.userData.pbrTextureSource = textures?.source ?? 'flat-fallback';
  material.userData.referencePbr = spec.referencePbr ?? null;
  material.userData.referenceMaterialId = spec.referenceMaterialId ?? spec.materialReference?.profileId ?? null;
  material.userData.materialEvidence = spec.materialEvidence ?? null;
  material.userData.validationViews = spec.materialReference?.validationViews ?? [];
  material.needsUpdate = true;
  return material;
}

type AttachmentEndpoint = {
  start: THREE.Vector3;
  midpoint: THREE.Vector3;
  quaternion: THREE.Quaternion;
  length: number;
  baseRadius: number;
  endRadius: number;
};

function readVector3(value: unknown, fallback: [number, number, number]): THREE.Vector3 {
  if (Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === 'number')) {
    return new THREE.Vector3(value[0], value[1], value[2]);
  }
  return new THREE.Vector3(fallback[0], fallback[1], fallback[2]);
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function makeAttachmentEndpoint(attachment: unknown): AttachmentEndpoint | null {
  if (!attachment || typeof attachment !== 'object') return null;
  const record = attachment as Record<string, unknown>;
  const start = readVector3(record.localStart, [0, 0, 0]);
  const end = readVector3(record.localEnd, [0, 1, 0]);
  const delta = end.clone().sub(start);
  const length = delta.length();
  if (length <= 0.0001) return null;
  const direction = delta.clone().normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  const baseRadius = Math.max(0.005, readNumber(record.baseRadius, 0.06));
  const endRadius = Math.max(0.003, readNumber(record.endRadius, baseRadius * 0.55));
  return {
    start,
    midpoint: delta.multiplyScalar(0.5),
    quaternion,
    length,
    baseRadius,
    endRadius,
  };
}

// Generated from ObjectSculptSpec target: Brine Puffer low-poly reference experiment
// Sculpt build pass: blockout
// This factory is intentionally pass-gated. Finish browser screenshot review before unlocking deeper passes.
export function createBrinePufferLowPolyReferenceExperimentModel(options: ProceduralModelOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = "Brine Puffer low-poly reference experiment";
  root.userData.reconstructionEvidence = {"itemFamily": null, "subtype": null, "componentAdapter": null, "route": null, "exactnessTier": null, "referenceCamera": {"solved": false, "fovDegrees": 40.0, "aspect": 1.0, "orientation": {"yaw": 0.0, "pitch": 0.0, "roll": 0.0}, "positionHint": [0.0, 0.0, 3.0], "note": "For likeness work, solve the reference camera (forge/stage1_intake/solve_camera_pose.py) so the review render aligns with the photo and the reference can be projected. Confirm by overlay review."}, "approximationNotes": []};
  root.userData.materialPipeline = {};
  root.userData.materialReferenceRegistry = null;

  const materialMap: Record<string, THREE.Material> = {};
  materialMap["teal"] = createSculptMaterial(
    "teal",
    {"id": "teal", "name": "teal", "type": "standard", "color": "#327e79", "baseColor": "#327e79", "roughness": {"base": 0.85, "variation": 0.025}, "metalness": {"base": 0}, "textureless": {"declared": true, "evidence": ["Approved low-poly reference shows broad matte color regions and planar facets, without pores, grain, print or mapped surface relief."]}, "localOverrides": [{"id": "teal-boundary", "region": "anatomical color boundary", "color": "#327e79", "evidenceRefs": ["full-object"]}], "albedo": {"dominant": "#327e79", "secondary": ["#327e79"]}, "flatShading": true},
    options
  );
  materialMap["cream"] = createSculptMaterial(
    "cream",
    {"id": "cream", "name": "cream", "type": "standard", "color": "#edd6a0", "baseColor": "#edd6a0", "roughness": {"base": 0.85, "variation": 0.025}, "metalness": {"base": 0}, "textureless": {"declared": true, "evidence": ["Approved low-poly reference shows broad matte color regions and planar facets, without pores, grain, print or mapped surface relief."]}, "localOverrides": [{"id": "cream-boundary", "region": "anatomical color boundary", "color": "#edd6a0", "evidenceRefs": ["full-object"]}], "albedo": {"dominant": "#edd6a0", "secondary": ["#edd6a0"]}, "flatShading": true},
    options
  );
  materialMap["orange"] = createSculptMaterial(
    "orange",
    {"id": "orange", "name": "orange", "type": "standard", "color": "#e98923", "baseColor": "#e98923", "roughness": {"base": 0.85, "variation": 0.025}, "metalness": {"base": 0}, "textureless": {"declared": true, "evidence": ["Approved low-poly reference shows broad matte color regions and planar facets, without pores, grain, print or mapped surface relief."]}, "localOverrides": [{"id": "orange-boundary", "region": "anatomical color boundary", "color": "#e98923", "evidenceRefs": ["full-object"]}], "albedo": {"dominant": "#e98923", "secondary": ["#e98923"]}, "flatShading": true},
    options
  );
  materialMap["amber"] = createSculptMaterial(
    "amber",
    {"id": "amber", "name": "amber", "type": "standard", "color": "#eeb625", "baseColor": "#eeb625", "roughness": {"base": 0.3, "variation": 0.025}, "metalness": {"base": 0}, "textureless": {"declared": true, "evidence": ["Approved low-poly reference shows broad matte color regions and planar facets, without pores, grain, print or mapped surface relief."]}, "localOverrides": [{"id": "amber-boundary", "region": "anatomical color boundary", "color": "#eeb625", "evidenceRefs": ["full-object"]}], "albedo": {"dominant": "#eeb625", "secondary": ["#eeb625"]}, "flatShading": true},
    options
  );
  materialMap["black"] = createSculptMaterial(
    "black",
    {"id": "black", "name": "black", "type": "standard", "color": "#171714", "baseColor": "#171714", "roughness": {"base": 0.85, "variation": 0.025}, "metalness": {"base": 0}, "textureless": {"declared": true, "evidence": ["Approved low-poly reference shows broad matte color regions and planar facets, without pores, grain, print or mapped surface relief."]}, "localOverrides": [{"id": "black-boundary", "region": "anatomical color boundary", "color": "#171714", "evidenceRefs": ["full-object"]}], "albedo": {"dominant": "#171714", "secondary": ["#171714"]}, "flatShading": true},
    options
  );
  materialMap["mouth"] = createSculptMaterial(
    "mouth",
    {"id": "mouth", "name": "mouth", "type": "standard", "color": "#52221a", "baseColor": "#52221a", "roughness": {"base": 0.85, "variation": 0.025}, "metalness": {"base": 0}, "textureless": {"declared": true, "evidence": ["Approved low-poly reference shows broad matte color regions and planar facets, without pores, grain, print or mapped surface relief."]}, "localOverrides": [{"id": "mouth-boundary", "region": "anatomical color boundary", "color": "#52221a", "evidenceRefs": ["full-object"]}], "albedo": {"dominant": "#52221a", "secondary": ["#52221a"]}, "flatShading": true},
    options
  );
  materialMap["tongue"] = createSculptMaterial(
    "tongue",
    {"id": "tongue", "name": "tongue", "type": "standard", "color": "#bd5b42", "baseColor": "#bd5b42", "roughness": {"base": 0.85, "variation": 0.025}, "metalness": {"base": 0}, "textureless": {"declared": true, "evidence": ["Approved low-poly reference shows broad matte color regions and planar facets, without pores, grain, print or mapped surface relief."]}, "localOverrides": [{"id": "tongue-boundary", "region": "anatomical color boundary", "color": "#bd5b42", "evidenceRefs": ["full-object"]}], "albedo": {"dominant": "#bd5b42", "secondary": ["#bd5b42"]}, "flatShading": true},
    options
  );
  materialMap["ivory"] = createSculptMaterial(
    "ivory",
    {"id": "ivory", "name": "ivory", "type": "standard", "color": "#f4dea2", "baseColor": "#f4dea2", "roughness": {"base": 0.85, "variation": 0.025}, "metalness": {"base": 0}, "textureless": {"declared": true, "evidence": ["Approved low-poly reference shows broad matte color regions and planar facets, without pores, grain, print or mapped surface relief."]}, "localOverrides": [{"id": "ivory-boundary", "region": "anatomical color boundary", "color": "#f4dea2", "evidenceRefs": ["full-object"]}], "albedo": {"dominant": "#f4dea2", "secondary": ["#f4dea2"]}, "flatShading": true},
    options
  );

  const nodes: Record<string, THREE.Object3D> = { root };
  const meshes: Record<string, THREE.Mesh> = {};
  const sockets: Record<string, THREE.Object3D> = {};
  const colliders: Record<string, unknown> = {};
  const destructionGroups: Record<string, THREE.Object3D[]> = {};

  const endpoint_body_0 = makeAttachmentEndpoint(null);
  const node_body_0 = new THREE.Group();
  node_body_0.name = "body__pivot";
  node_body_0.scale.set(1, 1, 1);
  if (endpoint_body_0) {
    node_body_0.position.copy(endpoint_body_0.start);
    node_body_0.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_body_0.position.set(0.0, 0.85, -0.08);
    node_body_0.rotation.set(0.0, 0.0, 0.0);
  }
  node_body_0.userData.sculptComponent = {"id": "body", "name": "body", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 1.36, "height": 1.43, "depth": 1.45, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0.85, -0.08], "rotation": [0, 0, 0], "scale": [1.36, 1.43, 1.45]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "teal", "materialLayers": ["teal"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "body-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(50, 126, 121, 1)", "secondaryAlbedo": "rgba(50, 126, 121, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_body_0.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_body_0);
  nodes["body"] = node_body_0;
  const mesh_body_0Geometry = endpoint_body_0
    ? new THREE.CylinderGeometry(endpoint_body_0.endRadius, endpoint_body_0.baseRadius, endpoint_body_0.length, 8, 4)
    : new THREE.SphereGeometry(0.5, 16, 10);
  if (!endpoint_body_0) {
    mesh_body_0Geometry.scale(1.36, 1.43, 1.45);
  }
  const mesh_body_0 = new THREE.Mesh(
    mesh_body_0Geometry,
    materialMap["teal"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_body_0.name = "body";
  if (endpoint_body_0) {
    mesh_body_0.position.copy(endpoint_body_0.midpoint);
    mesh_body_0.quaternion.copy(endpoint_body_0.quaternion);
  }
  mesh_body_0.castShadow = options.castShadow ?? true;
  mesh_body_0.receiveShadow = options.receiveShadow ?? true;
  mesh_body_0.userData.sculptComponent = {"id": "body", "name": "body", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 1.36, "height": 1.43, "depth": 1.45, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0.85, -0.08], "rotation": [0, 0, 0], "scale": [1.36, 1.43, 1.45]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "teal", "materialLayers": ["teal"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "body-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(50, 126, 121, 1)", "secondaryAlbedo": "rgba(50, 126, 121, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_body_0.add(mesh_body_0);
  meshes["body"] = mesh_body_0;
  colliders["body"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_body_0);

  const endpoint_pouch_1 = makeAttachmentEndpoint(null);
  const node_pouch_1 = new THREE.Group();
  node_pouch_1.name = "pouch__pivot";
  node_pouch_1.scale.set(1, 1, 1);
  if (endpoint_pouch_1) {
    node_pouch_1.position.copy(endpoint_pouch_1.start);
    node_pouch_1.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_pouch_1.position.set(0.0, 0.55, 0.49);
    node_pouch_1.rotation.set(0.0, 0.0, 0.0);
  }
  node_pouch_1.userData.sculptComponent = {"id": "pouch", "name": "pouch", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 1.17, "height": 0.98, "depth": 0.91, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0.55, 0.49], "rotation": [0, 0, 0], "scale": [1.17, 0.98, 0.91]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "cream", "materialLayers": ["cream"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "pouch-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(237, 214, 160, 1)", "secondaryAlbedo": "rgba(237, 214, 160, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_pouch_1.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_pouch_1);
  nodes["pouch"] = node_pouch_1;
  const mesh_pouch_1Geometry = endpoint_pouch_1
    ? new THREE.CylinderGeometry(endpoint_pouch_1.endRadius, endpoint_pouch_1.baseRadius, endpoint_pouch_1.length, 8, 4)
    : new THREE.SphereGeometry(0.5, 16, 10);
  if (!endpoint_pouch_1) {
    mesh_pouch_1Geometry.scale(1.17, 0.98, 0.91);
  }
  const mesh_pouch_1 = new THREE.Mesh(
    mesh_pouch_1Geometry,
    materialMap["cream"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_pouch_1.name = "pouch";
  if (endpoint_pouch_1) {
    mesh_pouch_1.position.copy(endpoint_pouch_1.midpoint);
    mesh_pouch_1.quaternion.copy(endpoint_pouch_1.quaternion);
  }
  mesh_pouch_1.castShadow = options.castShadow ?? true;
  mesh_pouch_1.receiveShadow = options.receiveShadow ?? true;
  mesh_pouch_1.userData.sculptComponent = {"id": "pouch", "name": "pouch", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 1.17, "height": 0.98, "depth": 0.91, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0.55, 0.49], "rotation": [0, 0, 0], "scale": [1.17, 0.98, 0.91]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "cream", "materialLayers": ["cream"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "pouch-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(237, 214, 160, 1)", "secondaryAlbedo": "rgba(237, 214, 160, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_pouch_1.add(mesh_pouch_1);
  meshes["pouch"] = mesh_pouch_1;
  colliders["pouch"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_pouch_1);

  const endpoint_mouth_2 = makeAttachmentEndpoint(null);
  const node_mouth_2 = new THREE.Group();
  node_mouth_2.name = "mouth__pivot";
  node_mouth_2.scale.set(1, 1, 1);
  if (endpoint_mouth_2) {
    node_mouth_2.position.copy(endpoint_mouth_2.start);
    node_mouth_2.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_mouth_2.position.set(0.0, 0.96, 0.94);
    node_mouth_2.rotation.set(0.0, 0.0, 0.0);
  }
  node_mouth_2.userData.sculptComponent = {"id": "mouth", "name": "mouth", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals", "profile2D": {"points": [[-0.25, -0.09], [0.25, -0.09], [0.18, 0.16], [0.04, 0.24], [-0.11, 0.15]], "depth": 0.06}}, "parent": null, "attachment": null, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0.96, 0.94], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mouth", "materialLayers": ["mouth"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "mouth-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(82, 34, 26, 1)", "secondaryAlbedo": "rgba(82, 34, 26, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_mouth_2.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_mouth_2);
  nodes["mouth"] = node_mouth_2;
  const mesh_mouth_2Geometry = endpoint_mouth_2
    ? new THREE.CylinderGeometry(endpoint_mouth_2.endRadius, endpoint_mouth_2.baseRadius, endpoint_mouth_2.length, 8, 4)
    : buildExtrudeGeometry({"points": [[-0.25, -0.09], [0.25, -0.09], [0.18, 0.16], [0.04, 0.24], [-0.11, 0.15]], "depth": 0.06});
  if (!endpoint_mouth_2) {
    mesh_mouth_2Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_mouth_2 = new THREE.Mesh(
    mesh_mouth_2Geometry,
    materialMap["mouth"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_mouth_2.name = "mouth";
  if (endpoint_mouth_2) {
    mesh_mouth_2.position.copy(endpoint_mouth_2.midpoint);
    mesh_mouth_2.quaternion.copy(endpoint_mouth_2.quaternion);
  }
  mesh_mouth_2.castShadow = options.castShadow ?? true;
  mesh_mouth_2.receiveShadow = options.receiveShadow ?? true;
  mesh_mouth_2.userData.sculptComponent = {"id": "mouth", "name": "mouth", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals", "profile2D": {"points": [[-0.25, -0.09], [0.25, -0.09], [0.18, 0.16], [0.04, 0.24], [-0.11, 0.15]], "depth": 0.06}}, "parent": null, "attachment": null, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0.96, 0.94], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "mouth", "materialLayers": ["mouth"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "mouth-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(82, 34, 26, 1)", "secondaryAlbedo": "rgba(82, 34, 26, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_mouth_2.add(mesh_mouth_2);
  meshes["mouth"] = mesh_mouth_2;
  colliders["mouth"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_mouth_2);

  const endpoint_upper_face_3 = makeAttachmentEndpoint(null);
  const node_upper_face_3 = new THREE.Group();
  node_upper_face_3.name = "upper-face__pivot";
  node_upper_face_3.scale.set(1, 1, 1);
  if (endpoint_upper_face_3) {
    node_upper_face_3.position.copy(endpoint_upper_face_3.start);
    node_upper_face_3.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_upper_face_3.position.set(0.0, 1.04, 0.88);
    node_upper_face_3.rotation.set(0.0, 0.0, 0.0);
  }
  node_upper_face_3.userData.sculptComponent = {"id": "upper-face", "name": "upper-face", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals", "profile2D": {"points": [[-0.29, -0.08], [-0.25, 0.12], [-0.1, 0.28], [0.04, 0.32], [0.18, 0.23], [0.28, -0.08], [0.19, 0.12], [0.04, 0.21], [-0.12, 0.12]], "depth": 0.08}}, "parent": null, "attachment": null, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 1.04, 0.88], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "cream", "materialLayers": ["cream"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "upper-face-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(237, 214, 160, 1)", "secondaryAlbedo": "rgba(237, 214, 160, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_upper_face_3.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_upper_face_3);
  nodes["upper-face"] = node_upper_face_3;
  const mesh_upper_face_3Geometry = endpoint_upper_face_3
    ? new THREE.CylinderGeometry(endpoint_upper_face_3.endRadius, endpoint_upper_face_3.baseRadius, endpoint_upper_face_3.length, 8, 4)
    : buildExtrudeGeometry({"points": [[-0.29, -0.08], [-0.25, 0.12], [-0.1, 0.28], [0.04, 0.32], [0.18, 0.23], [0.28, -0.08], [0.19, 0.12], [0.04, 0.21], [-0.12, 0.12]], "depth": 0.08});
  if (!endpoint_upper_face_3) {
    mesh_upper_face_3Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_upper_face_3 = new THREE.Mesh(
    mesh_upper_face_3Geometry,
    materialMap["cream"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_upper_face_3.name = "upper-face";
  if (endpoint_upper_face_3) {
    mesh_upper_face_3.position.copy(endpoint_upper_face_3.midpoint);
    mesh_upper_face_3.quaternion.copy(endpoint_upper_face_3.quaternion);
  }
  mesh_upper_face_3.castShadow = options.castShadow ?? true;
  mesh_upper_face_3.receiveShadow = options.receiveShadow ?? true;
  mesh_upper_face_3.userData.sculptComponent = {"id": "upper-face", "name": "upper-face", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals", "profile2D": {"points": [[-0.29, -0.08], [-0.25, 0.12], [-0.1, 0.28], [0.04, 0.32], [0.18, 0.23], [0.28, -0.08], [0.19, 0.12], [0.04, 0.21], [-0.12, 0.12]], "depth": 0.08}}, "parent": null, "attachment": null, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 1.04, 0.88], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "cream", "materialLayers": ["cream"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "upper-face-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(237, 214, 160, 1)", "secondaryAlbedo": "rgba(237, 214, 160, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_upper_face_3.add(mesh_upper_face_3);
  meshes["upper-face"] = mesh_upper_face_3;
  colliders["upper-face"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_upper_face_3);

  const endpoint_tongue_4 = makeAttachmentEndpoint(null);
  const node_tongue_4 = new THREE.Group();
  node_tongue_4.name = "tongue__pivot";
  node_tongue_4.scale.set(1, 1, 1);
  if (endpoint_tongue_4) {
    node_tongue_4.position.copy(endpoint_tongue_4.start);
    node_tongue_4.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_tongue_4.position.set(0.02, 0.92, 1.015);
    node_tongue_4.rotation.set(0.0, 0.0, 0.0);
  }
  node_tongue_4.userData.sculptComponent = {"id": "tongue", "name": "tongue", "level": "meso", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.25, "height": 0.06, "depth": 0.1, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.02, 0.92, 1.015], "rotation": [0, 0, 0], "scale": [0.25, 0.06, 0.1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "tongue", "materialLayers": ["tongue"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "tongue-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(189, 91, 66, 1)", "secondaryAlbedo": "rgba(189, 91, 66, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_tongue_4.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_tongue_4);
  nodes["tongue"] = node_tongue_4;
  const mesh_tongue_4Geometry = endpoint_tongue_4
    ? new THREE.CylinderGeometry(endpoint_tongue_4.endRadius, endpoint_tongue_4.baseRadius, endpoint_tongue_4.length, 8, 4)
    : new THREE.SphereGeometry(0.5, 16, 10);
  if (!endpoint_tongue_4) {
    mesh_tongue_4Geometry.scale(0.25, 0.06, 0.1);
  }
  const mesh_tongue_4 = new THREE.Mesh(
    mesh_tongue_4Geometry,
    materialMap["tongue"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_tongue_4.name = "tongue";
  if (endpoint_tongue_4) {
    mesh_tongue_4.position.copy(endpoint_tongue_4.midpoint);
    mesh_tongue_4.quaternion.copy(endpoint_tongue_4.quaternion);
  }
  mesh_tongue_4.castShadow = options.castShadow ?? true;
  mesh_tongue_4.receiveShadow = options.receiveShadow ?? true;
  mesh_tongue_4.userData.sculptComponent = {"id": "tongue", "name": "tongue", "level": "meso", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.25, "height": 0.06, "depth": 0.1, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.02, 0.92, 1.015], "rotation": [0, 0, 0], "scale": [0.25, 0.06, 0.1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "tongue", "materialLayers": ["tongue"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "tongue-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(189, 91, 66, 1)", "secondaryAlbedo": "rgba(189, 91, 66, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_tongue_4.add(mesh_tongue_4);
  meshes["tongue"] = mesh_tongue_4;
  colliders["tongue"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_tongue_4);

  const endpoint_eye_patch_l_5 = makeAttachmentEndpoint(null);
  const node_eye_patch_l_5 = new THREE.Group();
  node_eye_patch_l_5.name = "eye-patch-l__pivot";
  node_eye_patch_l_5.scale.set(1, 1, 1);
  if (endpoint_eye_patch_l_5) {
    node_eye_patch_l_5.position.copy(endpoint_eye_patch_l_5.start);
    node_eye_patch_l_5.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_eye_patch_l_5.position.set(0.4, 1.07, 0.5);
    node_eye_patch_l_5.rotation.set(0.0, 0.0, 0.0);
  }
  node_eye_patch_l_5.userData.sculptComponent = {"id": "eye-patch-l", "name": "eye-patch-l", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.48, "height": 0.42, "depth": 0.43, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.4, 1.07, 0.5], "rotation": [0, 0, 0], "scale": [0.48, 0.42, 0.43]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "orange", "materialLayers": ["orange"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "eye-patch-l-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(233, 137, 35, 1)", "secondaryAlbedo": "rgba(233, 137, 35, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_eye_patch_l_5.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_eye_patch_l_5);
  nodes["eye-patch-l"] = node_eye_patch_l_5;
  const mesh_eye_patch_l_5Geometry = endpoint_eye_patch_l_5
    ? new THREE.CylinderGeometry(endpoint_eye_patch_l_5.endRadius, endpoint_eye_patch_l_5.baseRadius, endpoint_eye_patch_l_5.length, 8, 4)
    : new THREE.SphereGeometry(0.5, 16, 10);
  if (!endpoint_eye_patch_l_5) {
    mesh_eye_patch_l_5Geometry.scale(0.48, 0.42, 0.43);
  }
  const mesh_eye_patch_l_5 = new THREE.Mesh(
    mesh_eye_patch_l_5Geometry,
    materialMap["orange"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_eye_patch_l_5.name = "eye-patch-l";
  if (endpoint_eye_patch_l_5) {
    mesh_eye_patch_l_5.position.copy(endpoint_eye_patch_l_5.midpoint);
    mesh_eye_patch_l_5.quaternion.copy(endpoint_eye_patch_l_5.quaternion);
  }
  mesh_eye_patch_l_5.castShadow = options.castShadow ?? true;
  mesh_eye_patch_l_5.receiveShadow = options.receiveShadow ?? true;
  mesh_eye_patch_l_5.userData.sculptComponent = {"id": "eye-patch-l", "name": "eye-patch-l", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.48, "height": 0.42, "depth": 0.43, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.4, 1.07, 0.5], "rotation": [0, 0, 0], "scale": [0.48, 0.42, 0.43]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "orange", "materialLayers": ["orange"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "eye-patch-l-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(233, 137, 35, 1)", "secondaryAlbedo": "rgba(233, 137, 35, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_eye_patch_l_5.add(mesh_eye_patch_l_5);
  meshes["eye-patch-l"] = mesh_eye_patch_l_5;
  colliders["eye-patch-l"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_eye_patch_l_5);

  const endpoint_eye_l_6 = makeAttachmentEndpoint(null);
  const node_eye_l_6 = new THREE.Group();
  node_eye_l_6.name = "eye-l__pivot";
  node_eye_l_6.scale.set(1, 1, 1);
  if (endpoint_eye_l_6) {
    node_eye_l_6.position.copy(endpoint_eye_l_6.start);
    node_eye_l_6.rotation.set(0.0, 0.35, 0.0);
  } else {
    node_eye_l_6.position.set(0.43, 1.09, 0.695);
    node_eye_l_6.rotation.set(0.0, 0.35, 0.0);
  }
  node_eye_l_6.userData.sculptComponent = {"id": "eye-l", "name": "eye-l", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.31, "height": 0.28, "depth": 0.13, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.43, 1.09, 0.695], "rotation": [0, 0.35, 0], "scale": [0.31, 0.28, 0.13]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "amber", "materialLayers": ["amber"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "eye-l-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(238, 182, 37, 1)", "secondaryAlbedo": "rgba(238, 182, 37, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_eye_l_6.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_eye_l_6);
  nodes["eye-l"] = node_eye_l_6;
  const mesh_eye_l_6Geometry = endpoint_eye_l_6
    ? new THREE.CylinderGeometry(endpoint_eye_l_6.endRadius, endpoint_eye_l_6.baseRadius, endpoint_eye_l_6.length, 8, 4)
    : new THREE.SphereGeometry(0.5, 16, 10);
  if (!endpoint_eye_l_6) {
    mesh_eye_l_6Geometry.scale(0.31, 0.28, 0.13);
  }
  const mesh_eye_l_6 = new THREE.Mesh(
    mesh_eye_l_6Geometry,
    materialMap["amber"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_eye_l_6.name = "eye-l";
  if (endpoint_eye_l_6) {
    mesh_eye_l_6.position.copy(endpoint_eye_l_6.midpoint);
    mesh_eye_l_6.quaternion.copy(endpoint_eye_l_6.quaternion);
  }
  mesh_eye_l_6.castShadow = options.castShadow ?? true;
  mesh_eye_l_6.receiveShadow = options.receiveShadow ?? true;
  mesh_eye_l_6.userData.sculptComponent = {"id": "eye-l", "name": "eye-l", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.31, "height": 0.28, "depth": 0.13, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.43, 1.09, 0.695], "rotation": [0, 0.35, 0], "scale": [0.31, 0.28, 0.13]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "amber", "materialLayers": ["amber"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "eye-l-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(238, 182, 37, 1)", "secondaryAlbedo": "rgba(238, 182, 37, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_eye_l_6.add(mesh_eye_l_6);
  meshes["eye-l"] = mesh_eye_l_6;
  colliders["eye-l"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_eye_l_6);

  const endpoint_pupil_l_7 = makeAttachmentEndpoint(null);
  const node_pupil_l_7 = new THREE.Group();
  node_pupil_l_7.name = "pupil-l__pivot";
  node_pupil_l_7.scale.set(1, 1, 1);
  if (endpoint_pupil_l_7) {
    node_pupil_l_7.position.copy(endpoint_pupil_l_7.start);
    node_pupil_l_7.rotation.set(0.0, 0.35, 0.0);
  } else {
    node_pupil_l_7.position.set(0.43, 1.1, 0.762);
    node_pupil_l_7.rotation.set(0.0, 0.35, 0.0);
  }
  node_pupil_l_7.userData.sculptComponent = {"id": "pupil-l", "name": "pupil-l", "level": "meso", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.13, "height": 0.17, "depth": 0.045, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.43, 1.1, 0.762], "rotation": [0, 0.35, 0], "scale": [0.13, 0.17, 0.045]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "black", "materialLayers": ["black"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "pupil-l-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(23, 23, 20, 1)", "secondaryAlbedo": "rgba(23, 23, 20, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_pupil_l_7.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_pupil_l_7);
  nodes["pupil-l"] = node_pupil_l_7;
  const mesh_pupil_l_7Geometry = endpoint_pupil_l_7
    ? new THREE.CylinderGeometry(endpoint_pupil_l_7.endRadius, endpoint_pupil_l_7.baseRadius, endpoint_pupil_l_7.length, 8, 4)
    : new THREE.SphereGeometry(0.5, 16, 10);
  if (!endpoint_pupil_l_7) {
    mesh_pupil_l_7Geometry.scale(0.13, 0.17, 0.045);
  }
  const mesh_pupil_l_7 = new THREE.Mesh(
    mesh_pupil_l_7Geometry,
    materialMap["black"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_pupil_l_7.name = "pupil-l";
  if (endpoint_pupil_l_7) {
    mesh_pupil_l_7.position.copy(endpoint_pupil_l_7.midpoint);
    mesh_pupil_l_7.quaternion.copy(endpoint_pupil_l_7.quaternion);
  }
  mesh_pupil_l_7.castShadow = options.castShadow ?? true;
  mesh_pupil_l_7.receiveShadow = options.receiveShadow ?? true;
  mesh_pupil_l_7.userData.sculptComponent = {"id": "pupil-l", "name": "pupil-l", "level": "meso", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.13, "height": 0.17, "depth": 0.045, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.43, 1.1, 0.762], "rotation": [0, 0.35, 0], "scale": [0.13, 0.17, 0.045]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "black", "materialLayers": ["black"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "pupil-l-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(23, 23, 20, 1)", "secondaryAlbedo": "rgba(23, 23, 20, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_pupil_l_7.add(mesh_pupil_l_7);
  meshes["pupil-l"] = mesh_pupil_l_7;
  colliders["pupil-l"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_pupil_l_7);

  const endpoint_glint_l_8 = makeAttachmentEndpoint(null);
  const node_glint_l_8 = new THREE.Group();
  node_glint_l_8.name = "glint-l__pivot";
  node_glint_l_8.scale.set(1, 1, 1);
  if (endpoint_glint_l_8) {
    node_glint_l_8.position.copy(endpoint_glint_l_8.start);
    node_glint_l_8.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_glint_l_8.position.set(0.41, 1.15, 0.79);
    node_glint_l_8.rotation.set(0.0, 0.0, 0.0);
  }
  node_glint_l_8.userData.sculptComponent = {"id": "glint-l", "name": "glint-l", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.045, "height": 0.04, "depth": 0.018, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.41, 1.15, 0.79], "rotation": [0, 0, 0], "scale": [0.045, 0.04, 0.018]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "glint-l-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 222, 162, 1)", "secondaryAlbedo": "rgba(244, 222, 162, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_glint_l_8.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_glint_l_8);
  nodes["glint-l"] = node_glint_l_8;
  const mesh_glint_l_8Geometry = endpoint_glint_l_8
    ? new THREE.CylinderGeometry(endpoint_glint_l_8.endRadius, endpoint_glint_l_8.baseRadius, endpoint_glint_l_8.length, 8, 4)
    : new THREE.SphereGeometry(0.5, 16, 10);
  if (!endpoint_glint_l_8) {
    mesh_glint_l_8Geometry.scale(0.045, 0.04, 0.018);
  }
  const mesh_glint_l_8 = new THREE.Mesh(
    mesh_glint_l_8Geometry,
    materialMap["ivory"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_glint_l_8.name = "glint-l";
  if (endpoint_glint_l_8) {
    mesh_glint_l_8.position.copy(endpoint_glint_l_8.midpoint);
    mesh_glint_l_8.quaternion.copy(endpoint_glint_l_8.quaternion);
  }
  mesh_glint_l_8.castShadow = options.castShadow ?? true;
  mesh_glint_l_8.receiveShadow = options.receiveShadow ?? true;
  mesh_glint_l_8.userData.sculptComponent = {"id": "glint-l", "name": "glint-l", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.045, "height": 0.04, "depth": 0.018, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.41, 1.15, 0.79], "rotation": [0, 0, 0], "scale": [0.045, 0.04, 0.018]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "glint-l-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 222, 162, 1)", "secondaryAlbedo": "rgba(244, 222, 162, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_glint_l_8.add(mesh_glint_l_8);
  meshes["glint-l"] = mesh_glint_l_8;
  colliders["glint-l"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_glint_l_8);

  const endpoint_brow_l_9 = makeAttachmentEndpoint(null);
  const node_brow_l_9 = new THREE.Group();
  node_brow_l_9.name = "brow-l__pivot";
  node_brow_l_9.scale.set(1, 1, 1);
  if (endpoint_brow_l_9) {
    node_brow_l_9.position.copy(endpoint_brow_l_9.start);
    node_brow_l_9.rotation.set(0.0, 0.18, -0.23);
  } else {
    node_brow_l_9.position.set(0.38, 1.23, 0.64);
    node_brow_l_9.rotation.set(0.0, 0.18, -0.23);
  }
  node_brow_l_9.userData.sculptComponent = {"id": "brow-l", "name": "brow-l", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals", "profile2D": {"points": [[-0.25, -0.08], [0.25, -0.08], [0.21, 0.08], [-0.22, 0.12]], "depth": 0.17}}, "parent": null, "attachment": null, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.38, 1.23, 0.64], "rotation": [0, 0.18, -0.23], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "orange", "materialLayers": ["orange"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "brow-l-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(233, 137, 35, 1)", "secondaryAlbedo": "rgba(233, 137, 35, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_brow_l_9.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_brow_l_9);
  nodes["brow-l"] = node_brow_l_9;
  const mesh_brow_l_9Geometry = endpoint_brow_l_9
    ? new THREE.CylinderGeometry(endpoint_brow_l_9.endRadius, endpoint_brow_l_9.baseRadius, endpoint_brow_l_9.length, 8, 4)
    : buildExtrudeGeometry({"points": [[-0.25, -0.08], [0.25, -0.08], [0.21, 0.08], [-0.22, 0.12]], "depth": 0.17});
  if (!endpoint_brow_l_9) {
    mesh_brow_l_9Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_brow_l_9 = new THREE.Mesh(
    mesh_brow_l_9Geometry,
    materialMap["orange"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_brow_l_9.name = "brow-l";
  if (endpoint_brow_l_9) {
    mesh_brow_l_9.position.copy(endpoint_brow_l_9.midpoint);
    mesh_brow_l_9.quaternion.copy(endpoint_brow_l_9.quaternion);
  }
  mesh_brow_l_9.castShadow = options.castShadow ?? true;
  mesh_brow_l_9.receiveShadow = options.receiveShadow ?? true;
  mesh_brow_l_9.userData.sculptComponent = {"id": "brow-l", "name": "brow-l", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals", "profile2D": {"points": [[-0.25, -0.08], [0.25, -0.08], [0.21, 0.08], [-0.22, 0.12]], "depth": 0.17}}, "parent": null, "attachment": null, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.38, 1.23, 0.64], "rotation": [0, 0.18, -0.23], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "orange", "materialLayers": ["orange"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "brow-l-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(233, 137, 35, 1)", "secondaryAlbedo": "rgba(233, 137, 35, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_brow_l_9.add(mesh_brow_l_9);
  meshes["brow-l"] = mesh_brow_l_9;
  colliders["brow-l"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_brow_l_9);

  const endpoint_fin_front_l_10 = makeAttachmentEndpoint(null);
  const node_fin_front_l_10 = new THREE.Group();
  node_fin_front_l_10.name = "fin-front-l__pivot";
  node_fin_front_l_10.scale.set(1, 1, 1);
  if (endpoint_fin_front_l_10) {
    node_fin_front_l_10.position.copy(endpoint_fin_front_l_10.start);
    node_fin_front_l_10.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_fin_front_l_10.position.set(0.54, 0.08, 0.36);
    node_fin_front_l_10.rotation.set(0.0, 0.0, 0.0);
  }
  node_fin_front_l_10.userData.sculptComponent = {"id": "fin-front-l", "name": "fin-front-l", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "tapered-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals", "taperedSweep": {"stations": [{"position": [0.03, 0.46, -0.04], "rx": 0.12, "rz": 0.12}, {"position": [0.15, 0.17, 0.08], "rx": 0.22, "rz": 0.2}, {"position": [0.2, 0, 0.16], "rx": 0.27, "rz": 0.24}], "radialSegments": 5, "capEnds": true}}, "parent": null, "attachment": null, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.54, 0.08, 0.36], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "teal", "materialLayers": ["teal"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "fin-front-l-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(50, 126, 121, 1)", "secondaryAlbedo": "rgba(50, 126, 121, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_fin_front_l_10.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_fin_front_l_10);
  nodes["fin-front-l"] = node_fin_front_l_10;
  const mesh_fin_front_l_10Geometry = endpoint_fin_front_l_10
    ? new THREE.CylinderGeometry(endpoint_fin_front_l_10.endRadius, endpoint_fin_front_l_10.baseRadius, endpoint_fin_front_l_10.length, 8, 4)
    : buildTaperedSweepGeometry({"stations": [{"position": [0.03, 0.46, -0.04], "rx": 0.12, "rz": 0.12}, {"position": [0.15, 0.17, 0.08], "rx": 0.22, "rz": 0.2}, {"position": [0.2, 0, 0.16], "rx": 0.27, "rz": 0.24}], "radialSegments": 5, "capEnds": true});
  if (!endpoint_fin_front_l_10) {
    mesh_fin_front_l_10Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_fin_front_l_10 = new THREE.Mesh(
    mesh_fin_front_l_10Geometry,
    materialMap["teal"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_fin_front_l_10.name = "fin-front-l";
  if (endpoint_fin_front_l_10) {
    mesh_fin_front_l_10.position.copy(endpoint_fin_front_l_10.midpoint);
    mesh_fin_front_l_10.quaternion.copy(endpoint_fin_front_l_10.quaternion);
  }
  mesh_fin_front_l_10.castShadow = options.castShadow ?? true;
  mesh_fin_front_l_10.receiveShadow = options.receiveShadow ?? true;
  mesh_fin_front_l_10.userData.sculptComponent = {"id": "fin-front-l", "name": "fin-front-l", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "tapered-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals", "taperedSweep": {"stations": [{"position": [0.03, 0.46, -0.04], "rx": 0.12, "rz": 0.12}, {"position": [0.15, 0.17, 0.08], "rx": 0.22, "rz": 0.2}, {"position": [0.2, 0, 0.16], "rx": 0.27, "rz": 0.24}], "radialSegments": 5, "capEnds": true}}, "parent": null, "attachment": null, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.54, 0.08, 0.36], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "teal", "materialLayers": ["teal"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "fin-front-l-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(50, 126, 121, 1)", "secondaryAlbedo": "rgba(50, 126, 121, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_fin_front_l_10.add(mesh_fin_front_l_10);
  meshes["fin-front-l"] = mesh_fin_front_l_10;
  colliders["fin-front-l"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_fin_front_l_10);

  const endpoint_fin_band_front_l_11 = makeAttachmentEndpoint(null);
  const node_fin_band_front_l_11 = new THREE.Group();
  node_fin_band_front_l_11.name = "fin-band-front-l__pivot";
  node_fin_band_front_l_11.scale.set(1, 1, 1);
  if (endpoint_fin_band_front_l_11) {
    node_fin_band_front_l_11.position.copy(endpoint_fin_band_front_l_11.start);
    node_fin_band_front_l_11.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_fin_band_front_l_11.position.set(0.74, 0.1, 0.55);
    node_fin_band_front_l_11.rotation.set(0.0, 0.0, 0.0);
  }
  node_fin_band_front_l_11.userData.sculptComponent = {"id": "fin-band-front-l", "name": "fin-band-front-l", "level": "meso", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.45, "height": 0.16, "depth": 0.39, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.74, 0.1, 0.55], "rotation": [0, 0, 0], "scale": [0.45, 0.16, 0.39]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "orange", "materialLayers": ["orange"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "fin-band-front-l-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(233, 137, 35, 1)", "secondaryAlbedo": "rgba(233, 137, 35, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_fin_band_front_l_11.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_fin_band_front_l_11);
  nodes["fin-band-front-l"] = node_fin_band_front_l_11;
  const mesh_fin_band_front_l_11Geometry = endpoint_fin_band_front_l_11
    ? new THREE.CylinderGeometry(endpoint_fin_band_front_l_11.endRadius, endpoint_fin_band_front_l_11.baseRadius, endpoint_fin_band_front_l_11.length, 8, 4)
    : new THREE.SphereGeometry(0.5, 16, 10);
  if (!endpoint_fin_band_front_l_11) {
    mesh_fin_band_front_l_11Geometry.scale(0.45, 0.16, 0.39);
  }
  const mesh_fin_band_front_l_11 = new THREE.Mesh(
    mesh_fin_band_front_l_11Geometry,
    materialMap["orange"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_fin_band_front_l_11.name = "fin-band-front-l";
  if (endpoint_fin_band_front_l_11) {
    mesh_fin_band_front_l_11.position.copy(endpoint_fin_band_front_l_11.midpoint);
    mesh_fin_band_front_l_11.quaternion.copy(endpoint_fin_band_front_l_11.quaternion);
  }
  mesh_fin_band_front_l_11.castShadow = options.castShadow ?? true;
  mesh_fin_band_front_l_11.receiveShadow = options.receiveShadow ?? true;
  mesh_fin_band_front_l_11.userData.sculptComponent = {"id": "fin-band-front-l", "name": "fin-band-front-l", "level": "meso", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.45, "height": 0.16, "depth": 0.39, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.74, 0.1, 0.55], "rotation": [0, 0, 0], "scale": [0.45, 0.16, 0.39]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "orange", "materialLayers": ["orange"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "fin-band-front-l-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(233, 137, 35, 1)", "secondaryAlbedo": "rgba(233, 137, 35, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_fin_band_front_l_11.add(mesh_fin_band_front_l_11);
  meshes["fin-band-front-l"] = mesh_fin_band_front_l_11;
  colliders["fin-band-front-l"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_fin_band_front_l_11);

  const attachment_toe_front_l0_12 = null;
  const endpoint_toe_front_l0_12 = makeAttachmentEndpoint(attachment_toe_front_l0_12);
  const node_toe_front_l0_12 = new THREE.Group();
  node_toe_front_l0_12.name = "toe-front-l0__pivot";
  node_toe_front_l0_12.scale.set(1, 1, 1);
  if (endpoint_toe_front_l0_12) {
    node_toe_front_l0_12.position.copy(endpoint_toe_front_l0_12.start);
    node_toe_front_l0_12.rotation.set(1.5707963267948966, 0.0, 0.0);
  } else {
    node_toe_front_l0_12.position.set(0.56, 0.067, 0.7);
    node_toe_front_l0_12.rotation.set(1.5707963267948966, 0.0, 0.0);
  }
  node_toe_front_l0_12.userData.sculptComponent = {"id": "toe-front-l0", "name": "toe-front-l0", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "cone", "topologyClass": "assembled-solid", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.16, "height": 0.19, "depth": 0.18, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.56, 0.067, 0.7], "rotation": [1.5707963267948966, 0, 0], "scale": [0.16, 0.19, 0.18]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "toe-front-l0-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 222, 162, 1)", "secondaryAlbedo": "rgba(244, 222, 162, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_toe_front_l0_12.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_toe_front_l0_12);
  nodes["toe-front-l0"] = node_toe_front_l0_12;
  const mesh_toe_front_l0_12Geometry = endpoint_toe_front_l0_12
    ? new THREE.CylinderGeometry(endpoint_toe_front_l0_12.endRadius, endpoint_toe_front_l0_12.baseRadius, endpoint_toe_front_l0_12.length, 8, 4)
    : new THREE.ConeGeometry(0.5, 1, 10, 1);
  if (!endpoint_toe_front_l0_12) {
    mesh_toe_front_l0_12Geometry.scale(0.16, 0.19, 0.18);
  }
  const mesh_toe_front_l0_12 = new THREE.Mesh(
    mesh_toe_front_l0_12Geometry,
    materialMap["ivory"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_toe_front_l0_12.name = "toe-front-l0";
  if (endpoint_toe_front_l0_12) {
    mesh_toe_front_l0_12.position.copy(endpoint_toe_front_l0_12.midpoint);
    mesh_toe_front_l0_12.quaternion.copy(endpoint_toe_front_l0_12.quaternion);
  }
  mesh_toe_front_l0_12.castShadow = options.castShadow ?? true;
  mesh_toe_front_l0_12.receiveShadow = options.receiveShadow ?? true;
  mesh_toe_front_l0_12.userData.sculptComponent = {"id": "toe-front-l0", "name": "toe-front-l0", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "cone", "topologyClass": "assembled-solid", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.16, "height": 0.19, "depth": 0.18, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.56, 0.067, 0.7], "rotation": [1.5707963267948966, 0, 0], "scale": [0.16, 0.19, 0.18]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "toe-front-l0-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 222, 162, 1)", "secondaryAlbedo": "rgba(244, 222, 162, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_toe_front_l0_12.add(mesh_toe_front_l0_12);
  meshes["toe-front-l0"] = mesh_toe_front_l0_12;
  colliders["toe-front-l0"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_toe_front_l0_12);

  const attachment_toe_front_l1_13 = null;
  const endpoint_toe_front_l1_13 = makeAttachmentEndpoint(attachment_toe_front_l1_13);
  const node_toe_front_l1_13 = new THREE.Group();
  node_toe_front_l1_13.name = "toe-front-l1__pivot";
  node_toe_front_l1_13.scale.set(1, 1, 1);
  if (endpoint_toe_front_l1_13) {
    node_toe_front_l1_13.position.copy(endpoint_toe_front_l1_13.start);
    node_toe_front_l1_13.rotation.set(1.5707963267948966, 0.0, 0.0);
  } else {
    node_toe_front_l1_13.position.set(0.7100000000000001, 0.067, 0.7);
    node_toe_front_l1_13.rotation.set(1.5707963267948966, 0.0, 0.0);
  }
  node_toe_front_l1_13.userData.sculptComponent = {"id": "toe-front-l1", "name": "toe-front-l1", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "cone", "topologyClass": "assembled-solid", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.16, "height": 0.19, "depth": 0.18, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.7100000000000001, 0.067, 0.7], "rotation": [1.5707963267948966, 0, 0], "scale": [0.16, 0.19, 0.18]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "toe-front-l1-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 222, 162, 1)", "secondaryAlbedo": "rgba(244, 222, 162, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_toe_front_l1_13.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_toe_front_l1_13);
  nodes["toe-front-l1"] = node_toe_front_l1_13;
  const mesh_toe_front_l1_13Geometry = endpoint_toe_front_l1_13
    ? new THREE.CylinderGeometry(endpoint_toe_front_l1_13.endRadius, endpoint_toe_front_l1_13.baseRadius, endpoint_toe_front_l1_13.length, 8, 4)
    : new THREE.ConeGeometry(0.5, 1, 10, 1);
  if (!endpoint_toe_front_l1_13) {
    mesh_toe_front_l1_13Geometry.scale(0.16, 0.19, 0.18);
  }
  const mesh_toe_front_l1_13 = new THREE.Mesh(
    mesh_toe_front_l1_13Geometry,
    materialMap["ivory"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_toe_front_l1_13.name = "toe-front-l1";
  if (endpoint_toe_front_l1_13) {
    mesh_toe_front_l1_13.position.copy(endpoint_toe_front_l1_13.midpoint);
    mesh_toe_front_l1_13.quaternion.copy(endpoint_toe_front_l1_13.quaternion);
  }
  mesh_toe_front_l1_13.castShadow = options.castShadow ?? true;
  mesh_toe_front_l1_13.receiveShadow = options.receiveShadow ?? true;
  mesh_toe_front_l1_13.userData.sculptComponent = {"id": "toe-front-l1", "name": "toe-front-l1", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "cone", "topologyClass": "assembled-solid", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.16, "height": 0.19, "depth": 0.18, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.7100000000000001, 0.067, 0.7], "rotation": [1.5707963267948966, 0, 0], "scale": [0.16, 0.19, 0.18]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "toe-front-l1-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 222, 162, 1)", "secondaryAlbedo": "rgba(244, 222, 162, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_toe_front_l1_13.add(mesh_toe_front_l1_13);
  meshes["toe-front-l1"] = mesh_toe_front_l1_13;
  colliders["toe-front-l1"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_toe_front_l1_13);

  const attachment_toe_front_l2_14 = null;
  const endpoint_toe_front_l2_14 = makeAttachmentEndpoint(attachment_toe_front_l2_14);
  const node_toe_front_l2_14 = new THREE.Group();
  node_toe_front_l2_14.name = "toe-front-l2__pivot";
  node_toe_front_l2_14.scale.set(1, 1, 1);
  if (endpoint_toe_front_l2_14) {
    node_toe_front_l2_14.position.copy(endpoint_toe_front_l2_14.start);
    node_toe_front_l2_14.rotation.set(1.5707963267948966, 0.0, 0.0);
  } else {
    node_toe_front_l2_14.position.set(0.8600000000000001, 0.067, 0.7);
    node_toe_front_l2_14.rotation.set(1.5707963267948966, 0.0, 0.0);
  }
  node_toe_front_l2_14.userData.sculptComponent = {"id": "toe-front-l2", "name": "toe-front-l2", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "cone", "topologyClass": "assembled-solid", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.16, "height": 0.19, "depth": 0.18, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.8600000000000001, 0.067, 0.7], "rotation": [1.5707963267948966, 0, 0], "scale": [0.16, 0.19, 0.18]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "toe-front-l2-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 222, 162, 1)", "secondaryAlbedo": "rgba(244, 222, 162, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_toe_front_l2_14.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_toe_front_l2_14);
  nodes["toe-front-l2"] = node_toe_front_l2_14;
  const mesh_toe_front_l2_14Geometry = endpoint_toe_front_l2_14
    ? new THREE.CylinderGeometry(endpoint_toe_front_l2_14.endRadius, endpoint_toe_front_l2_14.baseRadius, endpoint_toe_front_l2_14.length, 8, 4)
    : new THREE.ConeGeometry(0.5, 1, 10, 1);
  if (!endpoint_toe_front_l2_14) {
    mesh_toe_front_l2_14Geometry.scale(0.16, 0.19, 0.18);
  }
  const mesh_toe_front_l2_14 = new THREE.Mesh(
    mesh_toe_front_l2_14Geometry,
    materialMap["ivory"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_toe_front_l2_14.name = "toe-front-l2";
  if (endpoint_toe_front_l2_14) {
    mesh_toe_front_l2_14.position.copy(endpoint_toe_front_l2_14.midpoint);
    mesh_toe_front_l2_14.quaternion.copy(endpoint_toe_front_l2_14.quaternion);
  }
  mesh_toe_front_l2_14.castShadow = options.castShadow ?? true;
  mesh_toe_front_l2_14.receiveShadow = options.receiveShadow ?? true;
  mesh_toe_front_l2_14.userData.sculptComponent = {"id": "toe-front-l2", "name": "toe-front-l2", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "cone", "topologyClass": "assembled-solid", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.16, "height": 0.19, "depth": 0.18, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.8600000000000001, 0.067, 0.7], "rotation": [1.5707963267948966, 0, 0], "scale": [0.16, 0.19, 0.18]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "toe-front-l2-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 222, 162, 1)", "secondaryAlbedo": "rgba(244, 222, 162, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_toe_front_l2_14.add(mesh_toe_front_l2_14);
  meshes["toe-front-l2"] = mesh_toe_front_l2_14;
  colliders["toe-front-l2"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_toe_front_l2_14);

  const endpoint_fin_rear_l_15 = makeAttachmentEndpoint(null);
  const node_fin_rear_l_15 = new THREE.Group();
  node_fin_rear_l_15.name = "fin-rear-l__pivot";
  node_fin_rear_l_15.scale.set(1, 1, 1);
  if (endpoint_fin_rear_l_15) {
    node_fin_rear_l_15.position.copy(endpoint_fin_rear_l_15.start);
    node_fin_rear_l_15.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_fin_rear_l_15.position.set(0.54, 0.08, -0.5);
    node_fin_rear_l_15.rotation.set(0.0, 0.0, 0.0);
  }
  node_fin_rear_l_15.userData.sculptComponent = {"id": "fin-rear-l", "name": "fin-rear-l", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "tapered-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals", "taperedSweep": {"stations": [{"position": [0.03, 0.46, -0.04], "rx": 0.12, "rz": 0.12}, {"position": [0.15, 0.17, 0.08], "rx": 0.22, "rz": 0.2}, {"position": [0.2, 0, 0.16], "rx": 0.27, "rz": 0.24}], "radialSegments": 5, "capEnds": true}}, "parent": null, "attachment": null, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.54, 0.08, -0.5], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "teal", "materialLayers": ["teal"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "fin-rear-l-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(50, 126, 121, 1)", "secondaryAlbedo": "rgba(50, 126, 121, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_fin_rear_l_15.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_fin_rear_l_15);
  nodes["fin-rear-l"] = node_fin_rear_l_15;
  const mesh_fin_rear_l_15Geometry = endpoint_fin_rear_l_15
    ? new THREE.CylinderGeometry(endpoint_fin_rear_l_15.endRadius, endpoint_fin_rear_l_15.baseRadius, endpoint_fin_rear_l_15.length, 8, 4)
    : buildTaperedSweepGeometry({"stations": [{"position": [0.03, 0.46, -0.04], "rx": 0.12, "rz": 0.12}, {"position": [0.15, 0.17, 0.08], "rx": 0.22, "rz": 0.2}, {"position": [0.2, 0, 0.16], "rx": 0.27, "rz": 0.24}], "radialSegments": 5, "capEnds": true});
  if (!endpoint_fin_rear_l_15) {
    mesh_fin_rear_l_15Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_fin_rear_l_15 = new THREE.Mesh(
    mesh_fin_rear_l_15Geometry,
    materialMap["teal"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_fin_rear_l_15.name = "fin-rear-l";
  if (endpoint_fin_rear_l_15) {
    mesh_fin_rear_l_15.position.copy(endpoint_fin_rear_l_15.midpoint);
    mesh_fin_rear_l_15.quaternion.copy(endpoint_fin_rear_l_15.quaternion);
  }
  mesh_fin_rear_l_15.castShadow = options.castShadow ?? true;
  mesh_fin_rear_l_15.receiveShadow = options.receiveShadow ?? true;
  mesh_fin_rear_l_15.userData.sculptComponent = {"id": "fin-rear-l", "name": "fin-rear-l", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "tapered-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals", "taperedSweep": {"stations": [{"position": [0.03, 0.46, -0.04], "rx": 0.12, "rz": 0.12}, {"position": [0.15, 0.17, 0.08], "rx": 0.22, "rz": 0.2}, {"position": [0.2, 0, 0.16], "rx": 0.27, "rz": 0.24}], "radialSegments": 5, "capEnds": true}}, "parent": null, "attachment": null, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.54, 0.08, -0.5], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "teal", "materialLayers": ["teal"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "fin-rear-l-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(50, 126, 121, 1)", "secondaryAlbedo": "rgba(50, 126, 121, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_fin_rear_l_15.add(mesh_fin_rear_l_15);
  meshes["fin-rear-l"] = mesh_fin_rear_l_15;
  colliders["fin-rear-l"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_fin_rear_l_15);

  const endpoint_fin_band_rear_l_16 = makeAttachmentEndpoint(null);
  const node_fin_band_rear_l_16 = new THREE.Group();
  node_fin_band_rear_l_16.name = "fin-band-rear-l__pivot";
  node_fin_band_rear_l_16.scale.set(1, 1, 1);
  if (endpoint_fin_band_rear_l_16) {
    node_fin_band_rear_l_16.position.copy(endpoint_fin_band_rear_l_16.start);
    node_fin_band_rear_l_16.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_fin_band_rear_l_16.position.set(0.74, 0.1, -0.31);
    node_fin_band_rear_l_16.rotation.set(0.0, 0.0, 0.0);
  }
  node_fin_band_rear_l_16.userData.sculptComponent = {"id": "fin-band-rear-l", "name": "fin-band-rear-l", "level": "meso", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.45, "height": 0.16, "depth": 0.39, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.74, 0.1, -0.31], "rotation": [0, 0, 0], "scale": [0.45, 0.16, 0.39]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "orange", "materialLayers": ["orange"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "fin-band-rear-l-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(233, 137, 35, 1)", "secondaryAlbedo": "rgba(233, 137, 35, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_fin_band_rear_l_16.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_fin_band_rear_l_16);
  nodes["fin-band-rear-l"] = node_fin_band_rear_l_16;
  const mesh_fin_band_rear_l_16Geometry = endpoint_fin_band_rear_l_16
    ? new THREE.CylinderGeometry(endpoint_fin_band_rear_l_16.endRadius, endpoint_fin_band_rear_l_16.baseRadius, endpoint_fin_band_rear_l_16.length, 8, 4)
    : new THREE.SphereGeometry(0.5, 16, 10);
  if (!endpoint_fin_band_rear_l_16) {
    mesh_fin_band_rear_l_16Geometry.scale(0.45, 0.16, 0.39);
  }
  const mesh_fin_band_rear_l_16 = new THREE.Mesh(
    mesh_fin_band_rear_l_16Geometry,
    materialMap["orange"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_fin_band_rear_l_16.name = "fin-band-rear-l";
  if (endpoint_fin_band_rear_l_16) {
    mesh_fin_band_rear_l_16.position.copy(endpoint_fin_band_rear_l_16.midpoint);
    mesh_fin_band_rear_l_16.quaternion.copy(endpoint_fin_band_rear_l_16.quaternion);
  }
  mesh_fin_band_rear_l_16.castShadow = options.castShadow ?? true;
  mesh_fin_band_rear_l_16.receiveShadow = options.receiveShadow ?? true;
  mesh_fin_band_rear_l_16.userData.sculptComponent = {"id": "fin-band-rear-l", "name": "fin-band-rear-l", "level": "meso", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.45, "height": 0.16, "depth": 0.39, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.74, 0.1, -0.31], "rotation": [0, 0, 0], "scale": [0.45, 0.16, 0.39]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "orange", "materialLayers": ["orange"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "fin-band-rear-l-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(233, 137, 35, 1)", "secondaryAlbedo": "rgba(233, 137, 35, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_fin_band_rear_l_16.add(mesh_fin_band_rear_l_16);
  meshes["fin-band-rear-l"] = mesh_fin_band_rear_l_16;
  colliders["fin-band-rear-l"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_fin_band_rear_l_16);

  const attachment_toe_rear_l0_17 = null;
  const endpoint_toe_rear_l0_17 = makeAttachmentEndpoint(attachment_toe_rear_l0_17);
  const node_toe_rear_l0_17 = new THREE.Group();
  node_toe_rear_l0_17.name = "toe-rear-l0__pivot";
  node_toe_rear_l0_17.scale.set(1, 1, 1);
  if (endpoint_toe_rear_l0_17) {
    node_toe_rear_l0_17.position.copy(endpoint_toe_rear_l0_17.start);
    node_toe_rear_l0_17.rotation.set(1.5707963267948966, 0.0, 0.0);
  } else {
    node_toe_rear_l0_17.position.set(0.56, 0.067, -0.15999999999999998);
    node_toe_rear_l0_17.rotation.set(1.5707963267948966, 0.0, 0.0);
  }
  node_toe_rear_l0_17.userData.sculptComponent = {"id": "toe-rear-l0", "name": "toe-rear-l0", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "cone", "topologyClass": "assembled-solid", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.16, "height": 0.19, "depth": 0.18, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.56, 0.067, -0.15999999999999998], "rotation": [1.5707963267948966, 0, 0], "scale": [0.16, 0.19, 0.18]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "toe-rear-l0-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 222, 162, 1)", "secondaryAlbedo": "rgba(244, 222, 162, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_toe_rear_l0_17.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_toe_rear_l0_17);
  nodes["toe-rear-l0"] = node_toe_rear_l0_17;
  const mesh_toe_rear_l0_17Geometry = endpoint_toe_rear_l0_17
    ? new THREE.CylinderGeometry(endpoint_toe_rear_l0_17.endRadius, endpoint_toe_rear_l0_17.baseRadius, endpoint_toe_rear_l0_17.length, 8, 4)
    : new THREE.ConeGeometry(0.5, 1, 10, 1);
  if (!endpoint_toe_rear_l0_17) {
    mesh_toe_rear_l0_17Geometry.scale(0.16, 0.19, 0.18);
  }
  const mesh_toe_rear_l0_17 = new THREE.Mesh(
    mesh_toe_rear_l0_17Geometry,
    materialMap["ivory"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_toe_rear_l0_17.name = "toe-rear-l0";
  if (endpoint_toe_rear_l0_17) {
    mesh_toe_rear_l0_17.position.copy(endpoint_toe_rear_l0_17.midpoint);
    mesh_toe_rear_l0_17.quaternion.copy(endpoint_toe_rear_l0_17.quaternion);
  }
  mesh_toe_rear_l0_17.castShadow = options.castShadow ?? true;
  mesh_toe_rear_l0_17.receiveShadow = options.receiveShadow ?? true;
  mesh_toe_rear_l0_17.userData.sculptComponent = {"id": "toe-rear-l0", "name": "toe-rear-l0", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "cone", "topologyClass": "assembled-solid", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.16, "height": 0.19, "depth": 0.18, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.56, 0.067, -0.15999999999999998], "rotation": [1.5707963267948966, 0, 0], "scale": [0.16, 0.19, 0.18]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "toe-rear-l0-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 222, 162, 1)", "secondaryAlbedo": "rgba(244, 222, 162, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_toe_rear_l0_17.add(mesh_toe_rear_l0_17);
  meshes["toe-rear-l0"] = mesh_toe_rear_l0_17;
  colliders["toe-rear-l0"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_toe_rear_l0_17);

  const attachment_toe_rear_l1_18 = null;
  const endpoint_toe_rear_l1_18 = makeAttachmentEndpoint(attachment_toe_rear_l1_18);
  const node_toe_rear_l1_18 = new THREE.Group();
  node_toe_rear_l1_18.name = "toe-rear-l1__pivot";
  node_toe_rear_l1_18.scale.set(1, 1, 1);
  if (endpoint_toe_rear_l1_18) {
    node_toe_rear_l1_18.position.copy(endpoint_toe_rear_l1_18.start);
    node_toe_rear_l1_18.rotation.set(1.5707963267948966, 0.0, 0.0);
  } else {
    node_toe_rear_l1_18.position.set(0.7100000000000001, 0.067, -0.15999999999999998);
    node_toe_rear_l1_18.rotation.set(1.5707963267948966, 0.0, 0.0);
  }
  node_toe_rear_l1_18.userData.sculptComponent = {"id": "toe-rear-l1", "name": "toe-rear-l1", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "cone", "topologyClass": "assembled-solid", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.16, "height": 0.19, "depth": 0.18, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.7100000000000001, 0.067, -0.15999999999999998], "rotation": [1.5707963267948966, 0, 0], "scale": [0.16, 0.19, 0.18]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "toe-rear-l1-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 222, 162, 1)", "secondaryAlbedo": "rgba(244, 222, 162, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_toe_rear_l1_18.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_toe_rear_l1_18);
  nodes["toe-rear-l1"] = node_toe_rear_l1_18;
  const mesh_toe_rear_l1_18Geometry = endpoint_toe_rear_l1_18
    ? new THREE.CylinderGeometry(endpoint_toe_rear_l1_18.endRadius, endpoint_toe_rear_l1_18.baseRadius, endpoint_toe_rear_l1_18.length, 8, 4)
    : new THREE.ConeGeometry(0.5, 1, 10, 1);
  if (!endpoint_toe_rear_l1_18) {
    mesh_toe_rear_l1_18Geometry.scale(0.16, 0.19, 0.18);
  }
  const mesh_toe_rear_l1_18 = new THREE.Mesh(
    mesh_toe_rear_l1_18Geometry,
    materialMap["ivory"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_toe_rear_l1_18.name = "toe-rear-l1";
  if (endpoint_toe_rear_l1_18) {
    mesh_toe_rear_l1_18.position.copy(endpoint_toe_rear_l1_18.midpoint);
    mesh_toe_rear_l1_18.quaternion.copy(endpoint_toe_rear_l1_18.quaternion);
  }
  mesh_toe_rear_l1_18.castShadow = options.castShadow ?? true;
  mesh_toe_rear_l1_18.receiveShadow = options.receiveShadow ?? true;
  mesh_toe_rear_l1_18.userData.sculptComponent = {"id": "toe-rear-l1", "name": "toe-rear-l1", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "cone", "topologyClass": "assembled-solid", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.16, "height": 0.19, "depth": 0.18, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.7100000000000001, 0.067, -0.15999999999999998], "rotation": [1.5707963267948966, 0, 0], "scale": [0.16, 0.19, 0.18]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "toe-rear-l1-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 222, 162, 1)", "secondaryAlbedo": "rgba(244, 222, 162, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_toe_rear_l1_18.add(mesh_toe_rear_l1_18);
  meshes["toe-rear-l1"] = mesh_toe_rear_l1_18;
  colliders["toe-rear-l1"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_toe_rear_l1_18);

  const attachment_toe_rear_l2_19 = null;
  const endpoint_toe_rear_l2_19 = makeAttachmentEndpoint(attachment_toe_rear_l2_19);
  const node_toe_rear_l2_19 = new THREE.Group();
  node_toe_rear_l2_19.name = "toe-rear-l2__pivot";
  node_toe_rear_l2_19.scale.set(1, 1, 1);
  if (endpoint_toe_rear_l2_19) {
    node_toe_rear_l2_19.position.copy(endpoint_toe_rear_l2_19.start);
    node_toe_rear_l2_19.rotation.set(1.5707963267948966, 0.0, 0.0);
  } else {
    node_toe_rear_l2_19.position.set(0.8600000000000001, 0.067, -0.15999999999999998);
    node_toe_rear_l2_19.rotation.set(1.5707963267948966, 0.0, 0.0);
  }
  node_toe_rear_l2_19.userData.sculptComponent = {"id": "toe-rear-l2", "name": "toe-rear-l2", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "cone", "topologyClass": "assembled-solid", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.16, "height": 0.19, "depth": 0.18, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.8600000000000001, 0.067, -0.15999999999999998], "rotation": [1.5707963267948966, 0, 0], "scale": [0.16, 0.19, 0.18]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "toe-rear-l2-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 222, 162, 1)", "secondaryAlbedo": "rgba(244, 222, 162, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_toe_rear_l2_19.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_toe_rear_l2_19);
  nodes["toe-rear-l2"] = node_toe_rear_l2_19;
  const mesh_toe_rear_l2_19Geometry = endpoint_toe_rear_l2_19
    ? new THREE.CylinderGeometry(endpoint_toe_rear_l2_19.endRadius, endpoint_toe_rear_l2_19.baseRadius, endpoint_toe_rear_l2_19.length, 8, 4)
    : new THREE.ConeGeometry(0.5, 1, 10, 1);
  if (!endpoint_toe_rear_l2_19) {
    mesh_toe_rear_l2_19Geometry.scale(0.16, 0.19, 0.18);
  }
  const mesh_toe_rear_l2_19 = new THREE.Mesh(
    mesh_toe_rear_l2_19Geometry,
    materialMap["ivory"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_toe_rear_l2_19.name = "toe-rear-l2";
  if (endpoint_toe_rear_l2_19) {
    mesh_toe_rear_l2_19.position.copy(endpoint_toe_rear_l2_19.midpoint);
    mesh_toe_rear_l2_19.quaternion.copy(endpoint_toe_rear_l2_19.quaternion);
  }
  mesh_toe_rear_l2_19.castShadow = options.castShadow ?? true;
  mesh_toe_rear_l2_19.receiveShadow = options.receiveShadow ?? true;
  mesh_toe_rear_l2_19.userData.sculptComponent = {"id": "toe-rear-l2", "name": "toe-rear-l2", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "cone", "topologyClass": "assembled-solid", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.16, "height": 0.19, "depth": 0.18, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.8600000000000001, 0.067, -0.15999999999999998], "rotation": [1.5707963267948966, 0, 0], "scale": [0.16, 0.19, 0.18]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "toe-rear-l2-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 222, 162, 1)", "secondaryAlbedo": "rgba(244, 222, 162, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_toe_rear_l2_19.add(mesh_toe_rear_l2_19);
  meshes["toe-rear-l2"] = mesh_toe_rear_l2_19;
  colliders["toe-rear-l2"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_toe_rear_l2_19);

  const endpoint_eye_patch_r_20 = makeAttachmentEndpoint(null);
  const node_eye_patch_r_20 = new THREE.Group();
  node_eye_patch_r_20.name = "eye-patch-r__pivot";
  node_eye_patch_r_20.scale.set(1, 1, 1);
  if (endpoint_eye_patch_r_20) {
    node_eye_patch_r_20.position.copy(endpoint_eye_patch_r_20.start);
    node_eye_patch_r_20.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_eye_patch_r_20.position.set(-0.4, 1.07, 0.5);
    node_eye_patch_r_20.rotation.set(0.0, 0.0, 0.0);
  }
  node_eye_patch_r_20.userData.sculptComponent = {"id": "eye-patch-r", "name": "eye-patch-r", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.48, "height": 0.42, "depth": 0.43, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.4, 1.07, 0.5], "rotation": [0, 0, 0], "scale": [0.48, 0.42, 0.43]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "orange", "materialLayers": ["orange"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "eye-patch-r-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(233, 137, 35, 1)", "secondaryAlbedo": "rgba(233, 137, 35, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_eye_patch_r_20.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_eye_patch_r_20);
  nodes["eye-patch-r"] = node_eye_patch_r_20;
  const mesh_eye_patch_r_20Geometry = endpoint_eye_patch_r_20
    ? new THREE.CylinderGeometry(endpoint_eye_patch_r_20.endRadius, endpoint_eye_patch_r_20.baseRadius, endpoint_eye_patch_r_20.length, 8, 4)
    : new THREE.SphereGeometry(0.5, 16, 10);
  if (!endpoint_eye_patch_r_20) {
    mesh_eye_patch_r_20Geometry.scale(0.48, 0.42, 0.43);
  }
  const mesh_eye_patch_r_20 = new THREE.Mesh(
    mesh_eye_patch_r_20Geometry,
    materialMap["orange"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_eye_patch_r_20.name = "eye-patch-r";
  if (endpoint_eye_patch_r_20) {
    mesh_eye_patch_r_20.position.copy(endpoint_eye_patch_r_20.midpoint);
    mesh_eye_patch_r_20.quaternion.copy(endpoint_eye_patch_r_20.quaternion);
  }
  mesh_eye_patch_r_20.castShadow = options.castShadow ?? true;
  mesh_eye_patch_r_20.receiveShadow = options.receiveShadow ?? true;
  mesh_eye_patch_r_20.userData.sculptComponent = {"id": "eye-patch-r", "name": "eye-patch-r", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.48, "height": 0.42, "depth": 0.43, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.4, 1.07, 0.5], "rotation": [0, 0, 0], "scale": [0.48, 0.42, 0.43]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "orange", "materialLayers": ["orange"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "eye-patch-r-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(233, 137, 35, 1)", "secondaryAlbedo": "rgba(233, 137, 35, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_eye_patch_r_20.add(mesh_eye_patch_r_20);
  meshes["eye-patch-r"] = mesh_eye_patch_r_20;
  colliders["eye-patch-r"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_eye_patch_r_20);

  const endpoint_eye_r_21 = makeAttachmentEndpoint(null);
  const node_eye_r_21 = new THREE.Group();
  node_eye_r_21.name = "eye-r__pivot";
  node_eye_r_21.scale.set(1, 1, 1);
  if (endpoint_eye_r_21) {
    node_eye_r_21.position.copy(endpoint_eye_r_21.start);
    node_eye_r_21.rotation.set(0.0, -0.35, 0.0);
  } else {
    node_eye_r_21.position.set(-0.43, 1.09, 0.695);
    node_eye_r_21.rotation.set(0.0, -0.35, 0.0);
  }
  node_eye_r_21.userData.sculptComponent = {"id": "eye-r", "name": "eye-r", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.31, "height": 0.28, "depth": 0.13, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.43, 1.09, 0.695], "rotation": [0, -0.35, 0], "scale": [0.31, 0.28, 0.13]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "amber", "materialLayers": ["amber"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "eye-r-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(238, 182, 37, 1)", "secondaryAlbedo": "rgba(238, 182, 37, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_eye_r_21.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_eye_r_21);
  nodes["eye-r"] = node_eye_r_21;
  const mesh_eye_r_21Geometry = endpoint_eye_r_21
    ? new THREE.CylinderGeometry(endpoint_eye_r_21.endRadius, endpoint_eye_r_21.baseRadius, endpoint_eye_r_21.length, 8, 4)
    : new THREE.SphereGeometry(0.5, 16, 10);
  if (!endpoint_eye_r_21) {
    mesh_eye_r_21Geometry.scale(0.31, 0.28, 0.13);
  }
  const mesh_eye_r_21 = new THREE.Mesh(
    mesh_eye_r_21Geometry,
    materialMap["amber"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_eye_r_21.name = "eye-r";
  if (endpoint_eye_r_21) {
    mesh_eye_r_21.position.copy(endpoint_eye_r_21.midpoint);
    mesh_eye_r_21.quaternion.copy(endpoint_eye_r_21.quaternion);
  }
  mesh_eye_r_21.castShadow = options.castShadow ?? true;
  mesh_eye_r_21.receiveShadow = options.receiveShadow ?? true;
  mesh_eye_r_21.userData.sculptComponent = {"id": "eye-r", "name": "eye-r", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.31, "height": 0.28, "depth": 0.13, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.43, 1.09, 0.695], "rotation": [0, -0.35, 0], "scale": [0.31, 0.28, 0.13]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "amber", "materialLayers": ["amber"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "eye-r-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(238, 182, 37, 1)", "secondaryAlbedo": "rgba(238, 182, 37, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_eye_r_21.add(mesh_eye_r_21);
  meshes["eye-r"] = mesh_eye_r_21;
  colliders["eye-r"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_eye_r_21);

  const endpoint_pupil_r_22 = makeAttachmentEndpoint(null);
  const node_pupil_r_22 = new THREE.Group();
  node_pupil_r_22.name = "pupil-r__pivot";
  node_pupil_r_22.scale.set(1, 1, 1);
  if (endpoint_pupil_r_22) {
    node_pupil_r_22.position.copy(endpoint_pupil_r_22.start);
    node_pupil_r_22.rotation.set(0.0, -0.35, 0.0);
  } else {
    node_pupil_r_22.position.set(-0.43, 1.1, 0.762);
    node_pupil_r_22.rotation.set(0.0, -0.35, 0.0);
  }
  node_pupil_r_22.userData.sculptComponent = {"id": "pupil-r", "name": "pupil-r", "level": "meso", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.13, "height": 0.17, "depth": 0.045, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.43, 1.1, 0.762], "rotation": [0, -0.35, 0], "scale": [0.13, 0.17, 0.045]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "black", "materialLayers": ["black"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "pupil-r-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(23, 23, 20, 1)", "secondaryAlbedo": "rgba(23, 23, 20, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_pupil_r_22.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_pupil_r_22);
  nodes["pupil-r"] = node_pupil_r_22;
  const mesh_pupil_r_22Geometry = endpoint_pupil_r_22
    ? new THREE.CylinderGeometry(endpoint_pupil_r_22.endRadius, endpoint_pupil_r_22.baseRadius, endpoint_pupil_r_22.length, 8, 4)
    : new THREE.SphereGeometry(0.5, 16, 10);
  if (!endpoint_pupil_r_22) {
    mesh_pupil_r_22Geometry.scale(0.13, 0.17, 0.045);
  }
  const mesh_pupil_r_22 = new THREE.Mesh(
    mesh_pupil_r_22Geometry,
    materialMap["black"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_pupil_r_22.name = "pupil-r";
  if (endpoint_pupil_r_22) {
    mesh_pupil_r_22.position.copy(endpoint_pupil_r_22.midpoint);
    mesh_pupil_r_22.quaternion.copy(endpoint_pupil_r_22.quaternion);
  }
  mesh_pupil_r_22.castShadow = options.castShadow ?? true;
  mesh_pupil_r_22.receiveShadow = options.receiveShadow ?? true;
  mesh_pupil_r_22.userData.sculptComponent = {"id": "pupil-r", "name": "pupil-r", "level": "meso", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.13, "height": 0.17, "depth": 0.045, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.43, 1.1, 0.762], "rotation": [0, -0.35, 0], "scale": [0.13, 0.17, 0.045]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "black", "materialLayers": ["black"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "pupil-r-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(23, 23, 20, 1)", "secondaryAlbedo": "rgba(23, 23, 20, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_pupil_r_22.add(mesh_pupil_r_22);
  meshes["pupil-r"] = mesh_pupil_r_22;
  colliders["pupil-r"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_pupil_r_22);

  const endpoint_glint_r_23 = makeAttachmentEndpoint(null);
  const node_glint_r_23 = new THREE.Group();
  node_glint_r_23.name = "glint-r__pivot";
  node_glint_r_23.scale.set(1, 1, 1);
  if (endpoint_glint_r_23) {
    node_glint_r_23.position.copy(endpoint_glint_r_23.start);
    node_glint_r_23.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_glint_r_23.position.set(-0.41, 1.15, 0.79);
    node_glint_r_23.rotation.set(0.0, 0.0, 0.0);
  }
  node_glint_r_23.userData.sculptComponent = {"id": "glint-r", "name": "glint-r", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.045, "height": 0.04, "depth": 0.018, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.41, 1.15, 0.79], "rotation": [0, 0, 0], "scale": [0.045, 0.04, 0.018]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "glint-r-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 222, 162, 1)", "secondaryAlbedo": "rgba(244, 222, 162, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_glint_r_23.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_glint_r_23);
  nodes["glint-r"] = node_glint_r_23;
  const mesh_glint_r_23Geometry = endpoint_glint_r_23
    ? new THREE.CylinderGeometry(endpoint_glint_r_23.endRadius, endpoint_glint_r_23.baseRadius, endpoint_glint_r_23.length, 8, 4)
    : new THREE.SphereGeometry(0.5, 16, 10);
  if (!endpoint_glint_r_23) {
    mesh_glint_r_23Geometry.scale(0.045, 0.04, 0.018);
  }
  const mesh_glint_r_23 = new THREE.Mesh(
    mesh_glint_r_23Geometry,
    materialMap["ivory"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_glint_r_23.name = "glint-r";
  if (endpoint_glint_r_23) {
    mesh_glint_r_23.position.copy(endpoint_glint_r_23.midpoint);
    mesh_glint_r_23.quaternion.copy(endpoint_glint_r_23.quaternion);
  }
  mesh_glint_r_23.castShadow = options.castShadow ?? true;
  mesh_glint_r_23.receiveShadow = options.receiveShadow ?? true;
  mesh_glint_r_23.userData.sculptComponent = {"id": "glint-r", "name": "glint-r", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.045, "height": 0.04, "depth": 0.018, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.41, 1.15, 0.79], "rotation": [0, 0, 0], "scale": [0.045, 0.04, 0.018]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "glint-r-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 222, 162, 1)", "secondaryAlbedo": "rgba(244, 222, 162, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_glint_r_23.add(mesh_glint_r_23);
  meshes["glint-r"] = mesh_glint_r_23;
  colliders["glint-r"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_glint_r_23);

  const endpoint_brow_r_24 = makeAttachmentEndpoint(null);
  const node_brow_r_24 = new THREE.Group();
  node_brow_r_24.name = "brow-r__pivot";
  node_brow_r_24.scale.set(1, 1, 1);
  if (endpoint_brow_r_24) {
    node_brow_r_24.position.copy(endpoint_brow_r_24.start);
    node_brow_r_24.rotation.set(0.0, -0.18, 0.23);
  } else {
    node_brow_r_24.position.set(-0.38, 1.23, 0.64);
    node_brow_r_24.rotation.set(0.0, -0.18, 0.23);
  }
  node_brow_r_24.userData.sculptComponent = {"id": "brow-r", "name": "brow-r", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals", "profile2D": {"points": [[-0.25, -0.08], [0.25, -0.08], [0.21, 0.08], [-0.22, 0.12]], "depth": 0.17}}, "parent": null, "attachment": null, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.38, 1.23, 0.64], "rotation": [0, -0.18, 0.23], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "orange", "materialLayers": ["orange"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "brow-r-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(233, 137, 35, 1)", "secondaryAlbedo": "rgba(233, 137, 35, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_brow_r_24.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_brow_r_24);
  nodes["brow-r"] = node_brow_r_24;
  const mesh_brow_r_24Geometry = endpoint_brow_r_24
    ? new THREE.CylinderGeometry(endpoint_brow_r_24.endRadius, endpoint_brow_r_24.baseRadius, endpoint_brow_r_24.length, 8, 4)
    : buildExtrudeGeometry({"points": [[-0.25, -0.08], [0.25, -0.08], [0.21, 0.08], [-0.22, 0.12]], "depth": 0.17});
  if (!endpoint_brow_r_24) {
    mesh_brow_r_24Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_brow_r_24 = new THREE.Mesh(
    mesh_brow_r_24Geometry,
    materialMap["orange"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_brow_r_24.name = "brow-r";
  if (endpoint_brow_r_24) {
    mesh_brow_r_24.position.copy(endpoint_brow_r_24.midpoint);
    mesh_brow_r_24.quaternion.copy(endpoint_brow_r_24.quaternion);
  }
  mesh_brow_r_24.castShadow = options.castShadow ?? true;
  mesh_brow_r_24.receiveShadow = options.receiveShadow ?? true;
  mesh_brow_r_24.userData.sculptComponent = {"id": "brow-r", "name": "brow-r", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals", "profile2D": {"points": [[-0.25, -0.08], [0.25, -0.08], [0.21, 0.08], [-0.22, 0.12]], "depth": 0.17}}, "parent": null, "attachment": null, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.38, 1.23, 0.64], "rotation": [0, -0.18, 0.23], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "orange", "materialLayers": ["orange"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "brow-r-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(233, 137, 35, 1)", "secondaryAlbedo": "rgba(233, 137, 35, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_brow_r_24.add(mesh_brow_r_24);
  meshes["brow-r"] = mesh_brow_r_24;
  colliders["brow-r"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_brow_r_24);

  const endpoint_fin_front_r_25 = makeAttachmentEndpoint(null);
  const node_fin_front_r_25 = new THREE.Group();
  node_fin_front_r_25.name = "fin-front-r__pivot";
  node_fin_front_r_25.scale.set(1, 1, 1);
  if (endpoint_fin_front_r_25) {
    node_fin_front_r_25.position.copy(endpoint_fin_front_r_25.start);
    node_fin_front_r_25.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_fin_front_r_25.position.set(-0.54, 0.08, 0.36);
    node_fin_front_r_25.rotation.set(0.0, 0.0, 0.0);
  }
  node_fin_front_r_25.userData.sculptComponent = {"id": "fin-front-r", "name": "fin-front-r", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "tapered-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals", "taperedSweep": {"stations": [{"position": [-0.03, 0.46, -0.04], "rx": 0.12, "rz": 0.12}, {"position": [-0.15, 0.17, 0.08], "rx": 0.22, "rz": 0.2}, {"position": [-0.2, 0, 0.16], "rx": 0.27, "rz": 0.24}], "radialSegments": 5, "capEnds": true}}, "parent": null, "attachment": null, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.54, 0.08, 0.36], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "teal", "materialLayers": ["teal"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "fin-front-r-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(50, 126, 121, 1)", "secondaryAlbedo": "rgba(50, 126, 121, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_fin_front_r_25.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_fin_front_r_25);
  nodes["fin-front-r"] = node_fin_front_r_25;
  const mesh_fin_front_r_25Geometry = endpoint_fin_front_r_25
    ? new THREE.CylinderGeometry(endpoint_fin_front_r_25.endRadius, endpoint_fin_front_r_25.baseRadius, endpoint_fin_front_r_25.length, 8, 4)
    : buildTaperedSweepGeometry({"stations": [{"position": [-0.03, 0.46, -0.04], "rx": 0.12, "rz": 0.12}, {"position": [-0.15, 0.17, 0.08], "rx": 0.22, "rz": 0.2}, {"position": [-0.2, 0, 0.16], "rx": 0.27, "rz": 0.24}], "radialSegments": 5, "capEnds": true});
  if (!endpoint_fin_front_r_25) {
    mesh_fin_front_r_25Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_fin_front_r_25 = new THREE.Mesh(
    mesh_fin_front_r_25Geometry,
    materialMap["teal"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_fin_front_r_25.name = "fin-front-r";
  if (endpoint_fin_front_r_25) {
    mesh_fin_front_r_25.position.copy(endpoint_fin_front_r_25.midpoint);
    mesh_fin_front_r_25.quaternion.copy(endpoint_fin_front_r_25.quaternion);
  }
  mesh_fin_front_r_25.castShadow = options.castShadow ?? true;
  mesh_fin_front_r_25.receiveShadow = options.receiveShadow ?? true;
  mesh_fin_front_r_25.userData.sculptComponent = {"id": "fin-front-r", "name": "fin-front-r", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "tapered-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals", "taperedSweep": {"stations": [{"position": [-0.03, 0.46, -0.04], "rx": 0.12, "rz": 0.12}, {"position": [-0.15, 0.17, 0.08], "rx": 0.22, "rz": 0.2}, {"position": [-0.2, 0, 0.16], "rx": 0.27, "rz": 0.24}], "radialSegments": 5, "capEnds": true}}, "parent": null, "attachment": null, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.54, 0.08, 0.36], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "teal", "materialLayers": ["teal"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "fin-front-r-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(50, 126, 121, 1)", "secondaryAlbedo": "rgba(50, 126, 121, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_fin_front_r_25.add(mesh_fin_front_r_25);
  meshes["fin-front-r"] = mesh_fin_front_r_25;
  colliders["fin-front-r"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_fin_front_r_25);

  const endpoint_fin_band_front_r_26 = makeAttachmentEndpoint(null);
  const node_fin_band_front_r_26 = new THREE.Group();
  node_fin_band_front_r_26.name = "fin-band-front-r__pivot";
  node_fin_band_front_r_26.scale.set(1, 1, 1);
  if (endpoint_fin_band_front_r_26) {
    node_fin_band_front_r_26.position.copy(endpoint_fin_band_front_r_26.start);
    node_fin_band_front_r_26.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_fin_band_front_r_26.position.set(-0.74, 0.1, 0.55);
    node_fin_band_front_r_26.rotation.set(0.0, 0.0, 0.0);
  }
  node_fin_band_front_r_26.userData.sculptComponent = {"id": "fin-band-front-r", "name": "fin-band-front-r", "level": "meso", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.45, "height": 0.16, "depth": 0.39, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.74, 0.1, 0.55], "rotation": [0, 0, 0], "scale": [0.45, 0.16, 0.39]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "orange", "materialLayers": ["orange"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "fin-band-front-r-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(233, 137, 35, 1)", "secondaryAlbedo": "rgba(233, 137, 35, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_fin_band_front_r_26.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_fin_band_front_r_26);
  nodes["fin-band-front-r"] = node_fin_band_front_r_26;
  const mesh_fin_band_front_r_26Geometry = endpoint_fin_band_front_r_26
    ? new THREE.CylinderGeometry(endpoint_fin_band_front_r_26.endRadius, endpoint_fin_band_front_r_26.baseRadius, endpoint_fin_band_front_r_26.length, 8, 4)
    : new THREE.SphereGeometry(0.5, 16, 10);
  if (!endpoint_fin_band_front_r_26) {
    mesh_fin_band_front_r_26Geometry.scale(0.45, 0.16, 0.39);
  }
  const mesh_fin_band_front_r_26 = new THREE.Mesh(
    mesh_fin_band_front_r_26Geometry,
    materialMap["orange"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_fin_band_front_r_26.name = "fin-band-front-r";
  if (endpoint_fin_band_front_r_26) {
    mesh_fin_band_front_r_26.position.copy(endpoint_fin_band_front_r_26.midpoint);
    mesh_fin_band_front_r_26.quaternion.copy(endpoint_fin_band_front_r_26.quaternion);
  }
  mesh_fin_band_front_r_26.castShadow = options.castShadow ?? true;
  mesh_fin_band_front_r_26.receiveShadow = options.receiveShadow ?? true;
  mesh_fin_band_front_r_26.userData.sculptComponent = {"id": "fin-band-front-r", "name": "fin-band-front-r", "level": "meso", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.45, "height": 0.16, "depth": 0.39, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.74, 0.1, 0.55], "rotation": [0, 0, 0], "scale": [0.45, 0.16, 0.39]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "orange", "materialLayers": ["orange"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "fin-band-front-r-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(233, 137, 35, 1)", "secondaryAlbedo": "rgba(233, 137, 35, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_fin_band_front_r_26.add(mesh_fin_band_front_r_26);
  meshes["fin-band-front-r"] = mesh_fin_band_front_r_26;
  colliders["fin-band-front-r"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_fin_band_front_r_26);

  const attachment_toe_front_r0_27 = null;
  const endpoint_toe_front_r0_27 = makeAttachmentEndpoint(attachment_toe_front_r0_27);
  const node_toe_front_r0_27 = new THREE.Group();
  node_toe_front_r0_27.name = "toe-front-r0__pivot";
  node_toe_front_r0_27.scale.set(1, 1, 1);
  if (endpoint_toe_front_r0_27) {
    node_toe_front_r0_27.position.copy(endpoint_toe_front_r0_27.start);
    node_toe_front_r0_27.rotation.set(1.5707963267948966, 0.0, 0.0);
  } else {
    node_toe_front_r0_27.position.set(-0.56, 0.067, 0.7);
    node_toe_front_r0_27.rotation.set(1.5707963267948966, 0.0, 0.0);
  }
  node_toe_front_r0_27.userData.sculptComponent = {"id": "toe-front-r0", "name": "toe-front-r0", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "cone", "topologyClass": "assembled-solid", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.16, "height": 0.19, "depth": 0.18, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.56, 0.067, 0.7], "rotation": [1.5707963267948966, 0, 0], "scale": [0.16, 0.19, 0.18]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "toe-front-r0-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 222, 162, 1)", "secondaryAlbedo": "rgba(244, 222, 162, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_toe_front_r0_27.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_toe_front_r0_27);
  nodes["toe-front-r0"] = node_toe_front_r0_27;
  const mesh_toe_front_r0_27Geometry = endpoint_toe_front_r0_27
    ? new THREE.CylinderGeometry(endpoint_toe_front_r0_27.endRadius, endpoint_toe_front_r0_27.baseRadius, endpoint_toe_front_r0_27.length, 8, 4)
    : new THREE.ConeGeometry(0.5, 1, 10, 1);
  if (!endpoint_toe_front_r0_27) {
    mesh_toe_front_r0_27Geometry.scale(0.16, 0.19, 0.18);
  }
  const mesh_toe_front_r0_27 = new THREE.Mesh(
    mesh_toe_front_r0_27Geometry,
    materialMap["ivory"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_toe_front_r0_27.name = "toe-front-r0";
  if (endpoint_toe_front_r0_27) {
    mesh_toe_front_r0_27.position.copy(endpoint_toe_front_r0_27.midpoint);
    mesh_toe_front_r0_27.quaternion.copy(endpoint_toe_front_r0_27.quaternion);
  }
  mesh_toe_front_r0_27.castShadow = options.castShadow ?? true;
  mesh_toe_front_r0_27.receiveShadow = options.receiveShadow ?? true;
  mesh_toe_front_r0_27.userData.sculptComponent = {"id": "toe-front-r0", "name": "toe-front-r0", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "cone", "topologyClass": "assembled-solid", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.16, "height": 0.19, "depth": 0.18, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.56, 0.067, 0.7], "rotation": [1.5707963267948966, 0, 0], "scale": [0.16, 0.19, 0.18]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "toe-front-r0-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 222, 162, 1)", "secondaryAlbedo": "rgba(244, 222, 162, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_toe_front_r0_27.add(mesh_toe_front_r0_27);
  meshes["toe-front-r0"] = mesh_toe_front_r0_27;
  colliders["toe-front-r0"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_toe_front_r0_27);

  const attachment_toe_front_r1_28 = null;
  const endpoint_toe_front_r1_28 = makeAttachmentEndpoint(attachment_toe_front_r1_28);
  const node_toe_front_r1_28 = new THREE.Group();
  node_toe_front_r1_28.name = "toe-front-r1__pivot";
  node_toe_front_r1_28.scale.set(1, 1, 1);
  if (endpoint_toe_front_r1_28) {
    node_toe_front_r1_28.position.copy(endpoint_toe_front_r1_28.start);
    node_toe_front_r1_28.rotation.set(1.5707963267948966, 0.0, 0.0);
  } else {
    node_toe_front_r1_28.position.set(-0.7100000000000001, 0.067, 0.7);
    node_toe_front_r1_28.rotation.set(1.5707963267948966, 0.0, 0.0);
  }
  node_toe_front_r1_28.userData.sculptComponent = {"id": "toe-front-r1", "name": "toe-front-r1", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "cone", "topologyClass": "assembled-solid", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.16, "height": 0.19, "depth": 0.18, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.7100000000000001, 0.067, 0.7], "rotation": [1.5707963267948966, 0, 0], "scale": [0.16, 0.19, 0.18]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "toe-front-r1-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 222, 162, 1)", "secondaryAlbedo": "rgba(244, 222, 162, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_toe_front_r1_28.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_toe_front_r1_28);
  nodes["toe-front-r1"] = node_toe_front_r1_28;
  const mesh_toe_front_r1_28Geometry = endpoint_toe_front_r1_28
    ? new THREE.CylinderGeometry(endpoint_toe_front_r1_28.endRadius, endpoint_toe_front_r1_28.baseRadius, endpoint_toe_front_r1_28.length, 8, 4)
    : new THREE.ConeGeometry(0.5, 1, 10, 1);
  if (!endpoint_toe_front_r1_28) {
    mesh_toe_front_r1_28Geometry.scale(0.16, 0.19, 0.18);
  }
  const mesh_toe_front_r1_28 = new THREE.Mesh(
    mesh_toe_front_r1_28Geometry,
    materialMap["ivory"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_toe_front_r1_28.name = "toe-front-r1";
  if (endpoint_toe_front_r1_28) {
    mesh_toe_front_r1_28.position.copy(endpoint_toe_front_r1_28.midpoint);
    mesh_toe_front_r1_28.quaternion.copy(endpoint_toe_front_r1_28.quaternion);
  }
  mesh_toe_front_r1_28.castShadow = options.castShadow ?? true;
  mesh_toe_front_r1_28.receiveShadow = options.receiveShadow ?? true;
  mesh_toe_front_r1_28.userData.sculptComponent = {"id": "toe-front-r1", "name": "toe-front-r1", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "cone", "topologyClass": "assembled-solid", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.16, "height": 0.19, "depth": 0.18, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.7100000000000001, 0.067, 0.7], "rotation": [1.5707963267948966, 0, 0], "scale": [0.16, 0.19, 0.18]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "toe-front-r1-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 222, 162, 1)", "secondaryAlbedo": "rgba(244, 222, 162, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_toe_front_r1_28.add(mesh_toe_front_r1_28);
  meshes["toe-front-r1"] = mesh_toe_front_r1_28;
  colliders["toe-front-r1"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_toe_front_r1_28);

  const attachment_toe_front_r2_29 = null;
  const endpoint_toe_front_r2_29 = makeAttachmentEndpoint(attachment_toe_front_r2_29);
  const node_toe_front_r2_29 = new THREE.Group();
  node_toe_front_r2_29.name = "toe-front-r2__pivot";
  node_toe_front_r2_29.scale.set(1, 1, 1);
  if (endpoint_toe_front_r2_29) {
    node_toe_front_r2_29.position.copy(endpoint_toe_front_r2_29.start);
    node_toe_front_r2_29.rotation.set(1.5707963267948966, 0.0, 0.0);
  } else {
    node_toe_front_r2_29.position.set(-0.8600000000000001, 0.067, 0.7);
    node_toe_front_r2_29.rotation.set(1.5707963267948966, 0.0, 0.0);
  }
  node_toe_front_r2_29.userData.sculptComponent = {"id": "toe-front-r2", "name": "toe-front-r2", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "cone", "topologyClass": "assembled-solid", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.16, "height": 0.19, "depth": 0.18, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.8600000000000001, 0.067, 0.7], "rotation": [1.5707963267948966, 0, 0], "scale": [0.16, 0.19, 0.18]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "toe-front-r2-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 222, 162, 1)", "secondaryAlbedo": "rgba(244, 222, 162, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_toe_front_r2_29.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_toe_front_r2_29);
  nodes["toe-front-r2"] = node_toe_front_r2_29;
  const mesh_toe_front_r2_29Geometry = endpoint_toe_front_r2_29
    ? new THREE.CylinderGeometry(endpoint_toe_front_r2_29.endRadius, endpoint_toe_front_r2_29.baseRadius, endpoint_toe_front_r2_29.length, 8, 4)
    : new THREE.ConeGeometry(0.5, 1, 10, 1);
  if (!endpoint_toe_front_r2_29) {
    mesh_toe_front_r2_29Geometry.scale(0.16, 0.19, 0.18);
  }
  const mesh_toe_front_r2_29 = new THREE.Mesh(
    mesh_toe_front_r2_29Geometry,
    materialMap["ivory"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_toe_front_r2_29.name = "toe-front-r2";
  if (endpoint_toe_front_r2_29) {
    mesh_toe_front_r2_29.position.copy(endpoint_toe_front_r2_29.midpoint);
    mesh_toe_front_r2_29.quaternion.copy(endpoint_toe_front_r2_29.quaternion);
  }
  mesh_toe_front_r2_29.castShadow = options.castShadow ?? true;
  mesh_toe_front_r2_29.receiveShadow = options.receiveShadow ?? true;
  mesh_toe_front_r2_29.userData.sculptComponent = {"id": "toe-front-r2", "name": "toe-front-r2", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "cone", "topologyClass": "assembled-solid", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.16, "height": 0.19, "depth": 0.18, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.8600000000000001, 0.067, 0.7], "rotation": [1.5707963267948966, 0, 0], "scale": [0.16, 0.19, 0.18]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "toe-front-r2-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 222, 162, 1)", "secondaryAlbedo": "rgba(244, 222, 162, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_toe_front_r2_29.add(mesh_toe_front_r2_29);
  meshes["toe-front-r2"] = mesh_toe_front_r2_29;
  colliders["toe-front-r2"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_toe_front_r2_29);

  const endpoint_fin_rear_r_30 = makeAttachmentEndpoint(null);
  const node_fin_rear_r_30 = new THREE.Group();
  node_fin_rear_r_30.name = "fin-rear-r__pivot";
  node_fin_rear_r_30.scale.set(1, 1, 1);
  if (endpoint_fin_rear_r_30) {
    node_fin_rear_r_30.position.copy(endpoint_fin_rear_r_30.start);
    node_fin_rear_r_30.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_fin_rear_r_30.position.set(-0.54, 0.08, -0.5);
    node_fin_rear_r_30.rotation.set(0.0, 0.0, 0.0);
  }
  node_fin_rear_r_30.userData.sculptComponent = {"id": "fin-rear-r", "name": "fin-rear-r", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "tapered-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals", "taperedSweep": {"stations": [{"position": [-0.03, 0.46, -0.04], "rx": 0.12, "rz": 0.12}, {"position": [-0.15, 0.17, 0.08], "rx": 0.22, "rz": 0.2}, {"position": [-0.2, 0, 0.16], "rx": 0.27, "rz": 0.24}], "radialSegments": 5, "capEnds": true}}, "parent": null, "attachment": null, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.54, 0.08, -0.5], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "teal", "materialLayers": ["teal"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "fin-rear-r-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(50, 126, 121, 1)", "secondaryAlbedo": "rgba(50, 126, 121, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_fin_rear_r_30.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_fin_rear_r_30);
  nodes["fin-rear-r"] = node_fin_rear_r_30;
  const mesh_fin_rear_r_30Geometry = endpoint_fin_rear_r_30
    ? new THREE.CylinderGeometry(endpoint_fin_rear_r_30.endRadius, endpoint_fin_rear_r_30.baseRadius, endpoint_fin_rear_r_30.length, 8, 4)
    : buildTaperedSweepGeometry({"stations": [{"position": [-0.03, 0.46, -0.04], "rx": 0.12, "rz": 0.12}, {"position": [-0.15, 0.17, 0.08], "rx": 0.22, "rz": 0.2}, {"position": [-0.2, 0, 0.16], "rx": 0.27, "rz": 0.24}], "radialSegments": 5, "capEnds": true});
  if (!endpoint_fin_rear_r_30) {
    mesh_fin_rear_r_30Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_fin_rear_r_30 = new THREE.Mesh(
    mesh_fin_rear_r_30Geometry,
    materialMap["teal"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_fin_rear_r_30.name = "fin-rear-r";
  if (endpoint_fin_rear_r_30) {
    mesh_fin_rear_r_30.position.copy(endpoint_fin_rear_r_30.midpoint);
    mesh_fin_rear_r_30.quaternion.copy(endpoint_fin_rear_r_30.quaternion);
  }
  mesh_fin_rear_r_30.castShadow = options.castShadow ?? true;
  mesh_fin_rear_r_30.receiveShadow = options.receiveShadow ?? true;
  mesh_fin_rear_r_30.userData.sculptComponent = {"id": "fin-rear-r", "name": "fin-rear-r", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "tapered-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals", "taperedSweep": {"stations": [{"position": [-0.03, 0.46, -0.04], "rx": 0.12, "rz": 0.12}, {"position": [-0.15, 0.17, 0.08], "rx": 0.22, "rz": 0.2}, {"position": [-0.2, 0, 0.16], "rx": 0.27, "rz": 0.24}], "radialSegments": 5, "capEnds": true}}, "parent": null, "attachment": null, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.54, 0.08, -0.5], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "teal", "materialLayers": ["teal"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "fin-rear-r-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(50, 126, 121, 1)", "secondaryAlbedo": "rgba(50, 126, 121, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_fin_rear_r_30.add(mesh_fin_rear_r_30);
  meshes["fin-rear-r"] = mesh_fin_rear_r_30;
  colliders["fin-rear-r"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_fin_rear_r_30);

  const endpoint_fin_band_rear_r_31 = makeAttachmentEndpoint(null);
  const node_fin_band_rear_r_31 = new THREE.Group();
  node_fin_band_rear_r_31.name = "fin-band-rear-r__pivot";
  node_fin_band_rear_r_31.scale.set(1, 1, 1);
  if (endpoint_fin_band_rear_r_31) {
    node_fin_band_rear_r_31.position.copy(endpoint_fin_band_rear_r_31.start);
    node_fin_band_rear_r_31.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_fin_band_rear_r_31.position.set(-0.74, 0.1, -0.31);
    node_fin_band_rear_r_31.rotation.set(0.0, 0.0, 0.0);
  }
  node_fin_band_rear_r_31.userData.sculptComponent = {"id": "fin-band-rear-r", "name": "fin-band-rear-r", "level": "meso", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.45, "height": 0.16, "depth": 0.39, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.74, 0.1, -0.31], "rotation": [0, 0, 0], "scale": [0.45, 0.16, 0.39]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "orange", "materialLayers": ["orange"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "fin-band-rear-r-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(233, 137, 35, 1)", "secondaryAlbedo": "rgba(233, 137, 35, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_fin_band_rear_r_31.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_fin_band_rear_r_31);
  nodes["fin-band-rear-r"] = node_fin_band_rear_r_31;
  const mesh_fin_band_rear_r_31Geometry = endpoint_fin_band_rear_r_31
    ? new THREE.CylinderGeometry(endpoint_fin_band_rear_r_31.endRadius, endpoint_fin_band_rear_r_31.baseRadius, endpoint_fin_band_rear_r_31.length, 8, 4)
    : new THREE.SphereGeometry(0.5, 16, 10);
  if (!endpoint_fin_band_rear_r_31) {
    mesh_fin_band_rear_r_31Geometry.scale(0.45, 0.16, 0.39);
  }
  const mesh_fin_band_rear_r_31 = new THREE.Mesh(
    mesh_fin_band_rear_r_31Geometry,
    materialMap["orange"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_fin_band_rear_r_31.name = "fin-band-rear-r";
  if (endpoint_fin_band_rear_r_31) {
    mesh_fin_band_rear_r_31.position.copy(endpoint_fin_band_rear_r_31.midpoint);
    mesh_fin_band_rear_r_31.quaternion.copy(endpoint_fin_band_rear_r_31.quaternion);
  }
  mesh_fin_band_rear_r_31.castShadow = options.castShadow ?? true;
  mesh_fin_band_rear_r_31.receiveShadow = options.receiveShadow ?? true;
  mesh_fin_band_rear_r_31.userData.sculptComponent = {"id": "fin-band-rear-r", "name": "fin-band-rear-r", "level": "meso", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.45, "height": 0.16, "depth": 0.39, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.74, 0.1, -0.31], "rotation": [0, 0, 0], "scale": [0.45, 0.16, 0.39]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "orange", "materialLayers": ["orange"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "fin-band-rear-r-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(233, 137, 35, 1)", "secondaryAlbedo": "rgba(233, 137, 35, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_fin_band_rear_r_31.add(mesh_fin_band_rear_r_31);
  meshes["fin-band-rear-r"] = mesh_fin_band_rear_r_31;
  colliders["fin-band-rear-r"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_fin_band_rear_r_31);

  const attachment_toe_rear_r0_32 = null;
  const endpoint_toe_rear_r0_32 = makeAttachmentEndpoint(attachment_toe_rear_r0_32);
  const node_toe_rear_r0_32 = new THREE.Group();
  node_toe_rear_r0_32.name = "toe-rear-r0__pivot";
  node_toe_rear_r0_32.scale.set(1, 1, 1);
  if (endpoint_toe_rear_r0_32) {
    node_toe_rear_r0_32.position.copy(endpoint_toe_rear_r0_32.start);
    node_toe_rear_r0_32.rotation.set(1.5707963267948966, 0.0, 0.0);
  } else {
    node_toe_rear_r0_32.position.set(-0.56, 0.067, -0.15999999999999998);
    node_toe_rear_r0_32.rotation.set(1.5707963267948966, 0.0, 0.0);
  }
  node_toe_rear_r0_32.userData.sculptComponent = {"id": "toe-rear-r0", "name": "toe-rear-r0", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "cone", "topologyClass": "assembled-solid", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.16, "height": 0.19, "depth": 0.18, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.56, 0.067, -0.15999999999999998], "rotation": [1.5707963267948966, 0, 0], "scale": [0.16, 0.19, 0.18]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "toe-rear-r0-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 222, 162, 1)", "secondaryAlbedo": "rgba(244, 222, 162, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_toe_rear_r0_32.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_toe_rear_r0_32);
  nodes["toe-rear-r0"] = node_toe_rear_r0_32;
  const mesh_toe_rear_r0_32Geometry = endpoint_toe_rear_r0_32
    ? new THREE.CylinderGeometry(endpoint_toe_rear_r0_32.endRadius, endpoint_toe_rear_r0_32.baseRadius, endpoint_toe_rear_r0_32.length, 8, 4)
    : new THREE.ConeGeometry(0.5, 1, 10, 1);
  if (!endpoint_toe_rear_r0_32) {
    mesh_toe_rear_r0_32Geometry.scale(0.16, 0.19, 0.18);
  }
  const mesh_toe_rear_r0_32 = new THREE.Mesh(
    mesh_toe_rear_r0_32Geometry,
    materialMap["ivory"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_toe_rear_r0_32.name = "toe-rear-r0";
  if (endpoint_toe_rear_r0_32) {
    mesh_toe_rear_r0_32.position.copy(endpoint_toe_rear_r0_32.midpoint);
    mesh_toe_rear_r0_32.quaternion.copy(endpoint_toe_rear_r0_32.quaternion);
  }
  mesh_toe_rear_r0_32.castShadow = options.castShadow ?? true;
  mesh_toe_rear_r0_32.receiveShadow = options.receiveShadow ?? true;
  mesh_toe_rear_r0_32.userData.sculptComponent = {"id": "toe-rear-r0", "name": "toe-rear-r0", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "cone", "topologyClass": "assembled-solid", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.16, "height": 0.19, "depth": 0.18, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.56, 0.067, -0.15999999999999998], "rotation": [1.5707963267948966, 0, 0], "scale": [0.16, 0.19, 0.18]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "toe-rear-r0-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 222, 162, 1)", "secondaryAlbedo": "rgba(244, 222, 162, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_toe_rear_r0_32.add(mesh_toe_rear_r0_32);
  meshes["toe-rear-r0"] = mesh_toe_rear_r0_32;
  colliders["toe-rear-r0"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_toe_rear_r0_32);

  const attachment_toe_rear_r1_33 = null;
  const endpoint_toe_rear_r1_33 = makeAttachmentEndpoint(attachment_toe_rear_r1_33);
  const node_toe_rear_r1_33 = new THREE.Group();
  node_toe_rear_r1_33.name = "toe-rear-r1__pivot";
  node_toe_rear_r1_33.scale.set(1, 1, 1);
  if (endpoint_toe_rear_r1_33) {
    node_toe_rear_r1_33.position.copy(endpoint_toe_rear_r1_33.start);
    node_toe_rear_r1_33.rotation.set(1.5707963267948966, 0.0, 0.0);
  } else {
    node_toe_rear_r1_33.position.set(-0.7100000000000001, 0.067, -0.15999999999999998);
    node_toe_rear_r1_33.rotation.set(1.5707963267948966, 0.0, 0.0);
  }
  node_toe_rear_r1_33.userData.sculptComponent = {"id": "toe-rear-r1", "name": "toe-rear-r1", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "cone", "topologyClass": "assembled-solid", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.16, "height": 0.19, "depth": 0.18, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.7100000000000001, 0.067, -0.15999999999999998], "rotation": [1.5707963267948966, 0, 0], "scale": [0.16, 0.19, 0.18]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "toe-rear-r1-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 222, 162, 1)", "secondaryAlbedo": "rgba(244, 222, 162, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_toe_rear_r1_33.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_toe_rear_r1_33);
  nodes["toe-rear-r1"] = node_toe_rear_r1_33;
  const mesh_toe_rear_r1_33Geometry = endpoint_toe_rear_r1_33
    ? new THREE.CylinderGeometry(endpoint_toe_rear_r1_33.endRadius, endpoint_toe_rear_r1_33.baseRadius, endpoint_toe_rear_r1_33.length, 8, 4)
    : new THREE.ConeGeometry(0.5, 1, 10, 1);
  if (!endpoint_toe_rear_r1_33) {
    mesh_toe_rear_r1_33Geometry.scale(0.16, 0.19, 0.18);
  }
  const mesh_toe_rear_r1_33 = new THREE.Mesh(
    mesh_toe_rear_r1_33Geometry,
    materialMap["ivory"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_toe_rear_r1_33.name = "toe-rear-r1";
  if (endpoint_toe_rear_r1_33) {
    mesh_toe_rear_r1_33.position.copy(endpoint_toe_rear_r1_33.midpoint);
    mesh_toe_rear_r1_33.quaternion.copy(endpoint_toe_rear_r1_33.quaternion);
  }
  mesh_toe_rear_r1_33.castShadow = options.castShadow ?? true;
  mesh_toe_rear_r1_33.receiveShadow = options.receiveShadow ?? true;
  mesh_toe_rear_r1_33.userData.sculptComponent = {"id": "toe-rear-r1", "name": "toe-rear-r1", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "cone", "topologyClass": "assembled-solid", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.16, "height": 0.19, "depth": 0.18, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.7100000000000001, 0.067, -0.15999999999999998], "rotation": [1.5707963267948966, 0, 0], "scale": [0.16, 0.19, 0.18]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "toe-rear-r1-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 222, 162, 1)", "secondaryAlbedo": "rgba(244, 222, 162, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_toe_rear_r1_33.add(mesh_toe_rear_r1_33);
  meshes["toe-rear-r1"] = mesh_toe_rear_r1_33;
  colliders["toe-rear-r1"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_toe_rear_r1_33);

  const attachment_toe_rear_r2_34 = null;
  const endpoint_toe_rear_r2_34 = makeAttachmentEndpoint(attachment_toe_rear_r2_34);
  const node_toe_rear_r2_34 = new THREE.Group();
  node_toe_rear_r2_34.name = "toe-rear-r2__pivot";
  node_toe_rear_r2_34.scale.set(1, 1, 1);
  if (endpoint_toe_rear_r2_34) {
    node_toe_rear_r2_34.position.copy(endpoint_toe_rear_r2_34.start);
    node_toe_rear_r2_34.rotation.set(1.5707963267948966, 0.0, 0.0);
  } else {
    node_toe_rear_r2_34.position.set(-0.8600000000000001, 0.067, -0.15999999999999998);
    node_toe_rear_r2_34.rotation.set(1.5707963267948966, 0.0, 0.0);
  }
  node_toe_rear_r2_34.userData.sculptComponent = {"id": "toe-rear-r2", "name": "toe-rear-r2", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "cone", "topologyClass": "assembled-solid", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.16, "height": 0.19, "depth": 0.18, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.8600000000000001, 0.067, -0.15999999999999998], "rotation": [1.5707963267948966, 0, 0], "scale": [0.16, 0.19, 0.18]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "toe-rear-r2-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 222, 162, 1)", "secondaryAlbedo": "rgba(244, 222, 162, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_toe_rear_r2_34.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_toe_rear_r2_34);
  nodes["toe-rear-r2"] = node_toe_rear_r2_34;
  const mesh_toe_rear_r2_34Geometry = endpoint_toe_rear_r2_34
    ? new THREE.CylinderGeometry(endpoint_toe_rear_r2_34.endRadius, endpoint_toe_rear_r2_34.baseRadius, endpoint_toe_rear_r2_34.length, 8, 4)
    : new THREE.ConeGeometry(0.5, 1, 10, 1);
  if (!endpoint_toe_rear_r2_34) {
    mesh_toe_rear_r2_34Geometry.scale(0.16, 0.19, 0.18);
  }
  const mesh_toe_rear_r2_34 = new THREE.Mesh(
    mesh_toe_rear_r2_34Geometry,
    materialMap["ivory"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_toe_rear_r2_34.name = "toe-rear-r2";
  if (endpoint_toe_rear_r2_34) {
    mesh_toe_rear_r2_34.position.copy(endpoint_toe_rear_r2_34.midpoint);
    mesh_toe_rear_r2_34.quaternion.copy(endpoint_toe_rear_r2_34.quaternion);
  }
  mesh_toe_rear_r2_34.castShadow = options.castShadow ?? true;
  mesh_toe_rear_r2_34.receiveShadow = options.receiveShadow ?? true;
  mesh_toe_rear_r2_34.userData.sculptComponent = {"id": "toe-rear-r2", "name": "toe-rear-r2", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "cone", "topologyClass": "assembled-solid", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.16, "height": 0.19, "depth": 0.18, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.8600000000000001, 0.067, -0.15999999999999998], "rotation": [1.5707963267948966, 0, 0], "scale": [0.16, 0.19, 0.18]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "toe-rear-r2-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 222, 162, 1)", "secondaryAlbedo": "rgba(244, 222, 162, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_toe_rear_r2_34.add(mesh_toe_rear_r2_34);
  meshes["toe-rear-r2"] = mesh_toe_rear_r2_34;
  colliders["toe-rear-r2"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_toe_rear_r2_34);

  const attachment_spine0_35 = null;
  const endpoint_spine0_35 = makeAttachmentEndpoint(attachment_spine0_35);
  const node_spine0_35 = new THREE.Group();
  node_spine0_35.name = "spine0__pivot";
  node_spine0_35.scale.set(1, 1, 1);
  if (endpoint_spine0_35) {
    node_spine0_35.position.copy(endpoint_spine0_35.start);
    node_spine0_35.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_spine0_35.position.set(0.0, 1.7, -0.15);
    node_spine0_35.rotation.set(0.0, 0.0, 0.0);
  }
  node_spine0_35.userData.sculptComponent = {"id": "spine0", "name": "spine0", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "cone", "topologyClass": "assembled-solid", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.252, "height": 0.36, "depth": 0.23399999999999999, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 1.7, -0.15], "rotation": [0, 0, 0], "scale": [0.252, 0.36, 0.23399999999999999]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "spine0-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 222, 162, 1)", "secondaryAlbedo": "rgba(244, 222, 162, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_spine0_35.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_spine0_35);
  nodes["spine0"] = node_spine0_35;
  const mesh_spine0_35Geometry = endpoint_spine0_35
    ? new THREE.CylinderGeometry(endpoint_spine0_35.endRadius, endpoint_spine0_35.baseRadius, endpoint_spine0_35.length, 8, 4)
    : new THREE.ConeGeometry(0.5, 1, 10, 1);
  if (!endpoint_spine0_35) {
    mesh_spine0_35Geometry.scale(0.252, 0.36, 0.23399999999999999);
  }
  const mesh_spine0_35 = new THREE.Mesh(
    mesh_spine0_35Geometry,
    materialMap["ivory"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_spine0_35.name = "spine0";
  if (endpoint_spine0_35) {
    mesh_spine0_35.position.copy(endpoint_spine0_35.midpoint);
    mesh_spine0_35.quaternion.copy(endpoint_spine0_35.quaternion);
  }
  mesh_spine0_35.castShadow = options.castShadow ?? true;
  mesh_spine0_35.receiveShadow = options.receiveShadow ?? true;
  mesh_spine0_35.userData.sculptComponent = {"id": "spine0", "name": "spine0", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "cone", "topologyClass": "assembled-solid", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.252, "height": 0.36, "depth": 0.23399999999999999, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 1.7, -0.15], "rotation": [0, 0, 0], "scale": [0.252, 0.36, 0.23399999999999999]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "spine0-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 222, 162, 1)", "secondaryAlbedo": "rgba(244, 222, 162, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_spine0_35.add(mesh_spine0_35);
  meshes["spine0"] = mesh_spine0_35;
  colliders["spine0"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_spine0_35);

  const attachment_spine1_36 = null;
  const endpoint_spine1_36 = makeAttachmentEndpoint(attachment_spine1_36);
  const node_spine1_36 = new THREE.Group();
  node_spine1_36.name = "spine1__pivot";
  node_spine1_36.scale.set(1, 1, 1);
  if (endpoint_spine1_36) {
    node_spine1_36.position.copy(endpoint_spine1_36.start);
    node_spine1_36.rotation.set(0.0, 0.0, -0.6);
  } else {
    node_spine1_36.position.set(0.48, 1.43, -0.31);
    node_spine1_36.rotation.set(0.0, 0.0, -0.6);
  }
  node_spine1_36.userData.sculptComponent = {"id": "spine1", "name": "spine1", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "cone", "topologyClass": "assembled-solid", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.21, "height": 0.3, "depth": 0.195, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.48, 1.43, -0.31], "rotation": [0, 0, -0.6], "scale": [0.21, 0.3, 0.195]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "spine1-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 222, 162, 1)", "secondaryAlbedo": "rgba(244, 222, 162, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_spine1_36.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_spine1_36);
  nodes["spine1"] = node_spine1_36;
  const mesh_spine1_36Geometry = endpoint_spine1_36
    ? new THREE.CylinderGeometry(endpoint_spine1_36.endRadius, endpoint_spine1_36.baseRadius, endpoint_spine1_36.length, 8, 4)
    : new THREE.ConeGeometry(0.5, 1, 10, 1);
  if (!endpoint_spine1_36) {
    mesh_spine1_36Geometry.scale(0.21, 0.3, 0.195);
  }
  const mesh_spine1_36 = new THREE.Mesh(
    mesh_spine1_36Geometry,
    materialMap["ivory"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_spine1_36.name = "spine1";
  if (endpoint_spine1_36) {
    mesh_spine1_36.position.copy(endpoint_spine1_36.midpoint);
    mesh_spine1_36.quaternion.copy(endpoint_spine1_36.quaternion);
  }
  mesh_spine1_36.castShadow = options.castShadow ?? true;
  mesh_spine1_36.receiveShadow = options.receiveShadow ?? true;
  mesh_spine1_36.userData.sculptComponent = {"id": "spine1", "name": "spine1", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "cone", "topologyClass": "assembled-solid", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.21, "height": 0.3, "depth": 0.195, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.48, 1.43, -0.31], "rotation": [0, 0, -0.6], "scale": [0.21, 0.3, 0.195]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "spine1-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 222, 162, 1)", "secondaryAlbedo": "rgba(244, 222, 162, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_spine1_36.add(mesh_spine1_36);
  meshes["spine1"] = mesh_spine1_36;
  colliders["spine1"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_spine1_36);

  const attachment_spine2_37 = null;
  const endpoint_spine2_37 = makeAttachmentEndpoint(attachment_spine2_37);
  const node_spine2_37 = new THREE.Group();
  node_spine2_37.name = "spine2__pivot";
  node_spine2_37.scale.set(1, 1, 1);
  if (endpoint_spine2_37) {
    node_spine2_37.position.copy(endpoint_spine2_37.start);
    node_spine2_37.rotation.set(0.0, 0.0, 0.6);
  } else {
    node_spine2_37.position.set(-0.48, 1.43, -0.31);
    node_spine2_37.rotation.set(0.0, 0.0, 0.6);
  }
  node_spine2_37.userData.sculptComponent = {"id": "spine2", "name": "spine2", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "cone", "topologyClass": "assembled-solid", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.21, "height": 0.3, "depth": 0.195, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.48, 1.43, -0.31], "rotation": [0, 0, 0.6], "scale": [0.21, 0.3, 0.195]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "spine2-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 222, 162, 1)", "secondaryAlbedo": "rgba(244, 222, 162, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_spine2_37.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_spine2_37);
  nodes["spine2"] = node_spine2_37;
  const mesh_spine2_37Geometry = endpoint_spine2_37
    ? new THREE.CylinderGeometry(endpoint_spine2_37.endRadius, endpoint_spine2_37.baseRadius, endpoint_spine2_37.length, 8, 4)
    : new THREE.ConeGeometry(0.5, 1, 10, 1);
  if (!endpoint_spine2_37) {
    mesh_spine2_37Geometry.scale(0.21, 0.3, 0.195);
  }
  const mesh_spine2_37 = new THREE.Mesh(
    mesh_spine2_37Geometry,
    materialMap["ivory"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_spine2_37.name = "spine2";
  if (endpoint_spine2_37) {
    mesh_spine2_37.position.copy(endpoint_spine2_37.midpoint);
    mesh_spine2_37.quaternion.copy(endpoint_spine2_37.quaternion);
  }
  mesh_spine2_37.castShadow = options.castShadow ?? true;
  mesh_spine2_37.receiveShadow = options.receiveShadow ?? true;
  mesh_spine2_37.userData.sculptComponent = {"id": "spine2", "name": "spine2", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "cone", "topologyClass": "assembled-solid", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.21, "height": 0.3, "depth": 0.195, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.48, 1.43, -0.31], "rotation": [0, 0, 0.6], "scale": [0.21, 0.3, 0.195]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "spine2-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 222, 162, 1)", "secondaryAlbedo": "rgba(244, 222, 162, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_spine2_37.add(mesh_spine2_37);
  meshes["spine2"] = mesh_spine2_37;
  colliders["spine2"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_spine2_37);

  const attachment_spine3_38 = null;
  const endpoint_spine3_38 = makeAttachmentEndpoint(attachment_spine3_38);
  const node_spine3_38 = new THREE.Group();
  node_spine3_38.name = "spine3__pivot";
  node_spine3_38.scale.set(1, 1, 1);
  if (endpoint_spine3_38) {
    node_spine3_38.position.copy(endpoint_spine3_38.start);
    node_spine3_38.rotation.set(0.0, 0.0, -1.0);
  } else {
    node_spine3_38.position.set(0.64, 1.13, -0.27);
    node_spine3_38.rotation.set(0.0, 0.0, -1.0);
  }
  node_spine3_38.userData.sculptComponent = {"id": "spine3", "name": "spine3", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "cone", "topologyClass": "assembled-solid", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.196, "height": 0.28, "depth": 0.18200000000000002, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.64, 1.13, -0.27], "rotation": [0, 0, -1], "scale": [0.196, 0.28, 0.18200000000000002]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "spine3-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 222, 162, 1)", "secondaryAlbedo": "rgba(244, 222, 162, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_spine3_38.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_spine3_38);
  nodes["spine3"] = node_spine3_38;
  const mesh_spine3_38Geometry = endpoint_spine3_38
    ? new THREE.CylinderGeometry(endpoint_spine3_38.endRadius, endpoint_spine3_38.baseRadius, endpoint_spine3_38.length, 8, 4)
    : new THREE.ConeGeometry(0.5, 1, 10, 1);
  if (!endpoint_spine3_38) {
    mesh_spine3_38Geometry.scale(0.196, 0.28, 0.18200000000000002);
  }
  const mesh_spine3_38 = new THREE.Mesh(
    mesh_spine3_38Geometry,
    materialMap["ivory"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_spine3_38.name = "spine3";
  if (endpoint_spine3_38) {
    mesh_spine3_38.position.copy(endpoint_spine3_38.midpoint);
    mesh_spine3_38.quaternion.copy(endpoint_spine3_38.quaternion);
  }
  mesh_spine3_38.castShadow = options.castShadow ?? true;
  mesh_spine3_38.receiveShadow = options.receiveShadow ?? true;
  mesh_spine3_38.userData.sculptComponent = {"id": "spine3", "name": "spine3", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "cone", "topologyClass": "assembled-solid", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.196, "height": 0.28, "depth": 0.18200000000000002, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.64, 1.13, -0.27], "rotation": [0, 0, -1], "scale": [0.196, 0.28, 0.18200000000000002]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "spine3-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 222, 162, 1)", "secondaryAlbedo": "rgba(244, 222, 162, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_spine3_38.add(mesh_spine3_38);
  meshes["spine3"] = mesh_spine3_38;
  colliders["spine3"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_spine3_38);

  const attachment_spine4_39 = null;
  const endpoint_spine4_39 = makeAttachmentEndpoint(attachment_spine4_39);
  const node_spine4_39 = new THREE.Group();
  node_spine4_39.name = "spine4__pivot";
  node_spine4_39.scale.set(1, 1, 1);
  if (endpoint_spine4_39) {
    node_spine4_39.position.copy(endpoint_spine4_39.start);
    node_spine4_39.rotation.set(0.0, 0.0, 1.0);
  } else {
    node_spine4_39.position.set(-0.64, 1.13, -0.27);
    node_spine4_39.rotation.set(0.0, 0.0, 1.0);
  }
  node_spine4_39.userData.sculptComponent = {"id": "spine4", "name": "spine4", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "cone", "topologyClass": "assembled-solid", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.196, "height": 0.28, "depth": 0.18200000000000002, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.64, 1.13, -0.27], "rotation": [0, 0, 1], "scale": [0.196, 0.28, 0.18200000000000002]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "spine4-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 222, 162, 1)", "secondaryAlbedo": "rgba(244, 222, 162, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_spine4_39.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_spine4_39);
  nodes["spine4"] = node_spine4_39;
  const mesh_spine4_39Geometry = endpoint_spine4_39
    ? new THREE.CylinderGeometry(endpoint_spine4_39.endRadius, endpoint_spine4_39.baseRadius, endpoint_spine4_39.length, 8, 4)
    : new THREE.ConeGeometry(0.5, 1, 10, 1);
  if (!endpoint_spine4_39) {
    mesh_spine4_39Geometry.scale(0.196, 0.28, 0.18200000000000002);
  }
  const mesh_spine4_39 = new THREE.Mesh(
    mesh_spine4_39Geometry,
    materialMap["ivory"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_spine4_39.name = "spine4";
  if (endpoint_spine4_39) {
    mesh_spine4_39.position.copy(endpoint_spine4_39.midpoint);
    mesh_spine4_39.quaternion.copy(endpoint_spine4_39.quaternion);
  }
  mesh_spine4_39.castShadow = options.castShadow ?? true;
  mesh_spine4_39.receiveShadow = options.receiveShadow ?? true;
  mesh_spine4_39.userData.sculptComponent = {"id": "spine4", "name": "spine4", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "cone", "topologyClass": "assembled-solid", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.196, "height": 0.28, "depth": 0.18200000000000002, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.64, 1.13, -0.27], "rotation": [0, 0, 1], "scale": [0.196, 0.28, 0.18200000000000002]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "spine4-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 222, 162, 1)", "secondaryAlbedo": "rgba(244, 222, 162, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_spine4_39.add(mesh_spine4_39);
  meshes["spine4"] = mesh_spine4_39;
  colliders["spine4"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_spine4_39);

  const attachment_spine5_40 = null;
  const endpoint_spine5_40 = makeAttachmentEndpoint(attachment_spine5_40);
  const node_spine5_40 = new THREE.Group();
  node_spine5_40.name = "spine5__pivot";
  node_spine5_40.scale.set(1, 1, 1);
  if (endpoint_spine5_40) {
    node_spine5_40.position.copy(endpoint_spine5_40.start);
    node_spine5_40.rotation.set(0.0, 0.0, -0.7);
  } else {
    node_spine5_40.position.set(0.48, 1.17, 0.42);
    node_spine5_40.rotation.set(0.0, 0.0, -0.7);
  }
  node_spine5_40.userData.sculptComponent = {"id": "spine5", "name": "spine5", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "cone", "topologyClass": "assembled-solid", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.182, "height": 0.26, "depth": 0.169, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.48, 1.17, 0.42], "rotation": [0, 0, -0.7], "scale": [0.182, 0.26, 0.169]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "spine5-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 222, 162, 1)", "secondaryAlbedo": "rgba(244, 222, 162, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_spine5_40.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_spine5_40);
  nodes["spine5"] = node_spine5_40;
  const mesh_spine5_40Geometry = endpoint_spine5_40
    ? new THREE.CylinderGeometry(endpoint_spine5_40.endRadius, endpoint_spine5_40.baseRadius, endpoint_spine5_40.length, 8, 4)
    : new THREE.ConeGeometry(0.5, 1, 10, 1);
  if (!endpoint_spine5_40) {
    mesh_spine5_40Geometry.scale(0.182, 0.26, 0.169);
  }
  const mesh_spine5_40 = new THREE.Mesh(
    mesh_spine5_40Geometry,
    materialMap["ivory"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_spine5_40.name = "spine5";
  if (endpoint_spine5_40) {
    mesh_spine5_40.position.copy(endpoint_spine5_40.midpoint);
    mesh_spine5_40.quaternion.copy(endpoint_spine5_40.quaternion);
  }
  mesh_spine5_40.castShadow = options.castShadow ?? true;
  mesh_spine5_40.receiveShadow = options.receiveShadow ?? true;
  mesh_spine5_40.userData.sculptComponent = {"id": "spine5", "name": "spine5", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "cone", "topologyClass": "assembled-solid", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.182, "height": 0.26, "depth": 0.169, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.48, 1.17, 0.42], "rotation": [0, 0, -0.7], "scale": [0.182, 0.26, 0.169]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "spine5-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 222, 162, 1)", "secondaryAlbedo": "rgba(244, 222, 162, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_spine5_40.add(mesh_spine5_40);
  meshes["spine5"] = mesh_spine5_40;
  colliders["spine5"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_spine5_40);

  const attachment_spine6_41 = null;
  const endpoint_spine6_41 = makeAttachmentEndpoint(attachment_spine6_41);
  const node_spine6_41 = new THREE.Group();
  node_spine6_41.name = "spine6__pivot";
  node_spine6_41.scale.set(1, 1, 1);
  if (endpoint_spine6_41) {
    node_spine6_41.position.copy(endpoint_spine6_41.start);
    node_spine6_41.rotation.set(0.0, 0.0, 0.7);
  } else {
    node_spine6_41.position.set(-0.48, 1.17, 0.42);
    node_spine6_41.rotation.set(0.0, 0.0, 0.7);
  }
  node_spine6_41.userData.sculptComponent = {"id": "spine6", "name": "spine6", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "cone", "topologyClass": "assembled-solid", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.182, "height": 0.26, "depth": 0.169, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.48, 1.17, 0.42], "rotation": [0, 0, 0.7], "scale": [0.182, 0.26, 0.169]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "spine6-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 222, 162, 1)", "secondaryAlbedo": "rgba(244, 222, 162, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_spine6_41.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_spine6_41);
  nodes["spine6"] = node_spine6_41;
  const mesh_spine6_41Geometry = endpoint_spine6_41
    ? new THREE.CylinderGeometry(endpoint_spine6_41.endRadius, endpoint_spine6_41.baseRadius, endpoint_spine6_41.length, 8, 4)
    : new THREE.ConeGeometry(0.5, 1, 10, 1);
  if (!endpoint_spine6_41) {
    mesh_spine6_41Geometry.scale(0.182, 0.26, 0.169);
  }
  const mesh_spine6_41 = new THREE.Mesh(
    mesh_spine6_41Geometry,
    materialMap["ivory"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_spine6_41.name = "spine6";
  if (endpoint_spine6_41) {
    mesh_spine6_41.position.copy(endpoint_spine6_41.midpoint);
    mesh_spine6_41.quaternion.copy(endpoint_spine6_41.quaternion);
  }
  mesh_spine6_41.castShadow = options.castShadow ?? true;
  mesh_spine6_41.receiveShadow = options.receiveShadow ?? true;
  mesh_spine6_41.userData.sculptComponent = {"id": "spine6", "name": "spine6", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "cone", "topologyClass": "assembled-solid", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.182, "height": 0.26, "depth": 0.169, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.48, 1.17, 0.42], "rotation": [0, 0, 0.7], "scale": [0.182, 0.26, 0.169]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "spine6-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(244, 222, 162, 1)", "secondaryAlbedo": "rgba(244, 222, 162, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_spine6_41.add(mesh_spine6_41);
  meshes["spine6"] = mesh_spine6_41;
  colliders["spine6"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_spine6_41);

  const endpoint_tail_root_42 = makeAttachmentEndpoint(null);
  const node_tail_root_42 = new THREE.Group();
  node_tail_root_42.name = "tail-root__pivot";
  node_tail_root_42.scale.set(1, 1, 1);
  if (endpoint_tail_root_42) {
    node_tail_root_42.position.copy(endpoint_tail_root_42.start);
    node_tail_root_42.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_tail_root_42.position.set(0.0, 0.61, -0.61);
    node_tail_root_42.rotation.set(0.0, 0.0, 0.0);
  }
  node_tail_root_42.userData.sculptComponent = {"id": "tail-root", "name": "tail-root", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "tapered-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals", "taperedSweep": {"stations": [{"position": [0, 0, 0], "rx": 0.18, "rz": 0.17}, {"position": [0, 0.1, -0.35], "rx": 0.08, "rz": 0.08}], "radialSegments": 6, "capEnds": true}}, "parent": null, "attachment": null, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0.61, -0.61], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "teal", "materialLayers": ["teal"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "tail-root-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(50, 126, 121, 1)", "secondaryAlbedo": "rgba(50, 126, 121, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_tail_root_42.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_tail_root_42);
  nodes["tail-root"] = node_tail_root_42;
  const mesh_tail_root_42Geometry = endpoint_tail_root_42
    ? new THREE.CylinderGeometry(endpoint_tail_root_42.endRadius, endpoint_tail_root_42.baseRadius, endpoint_tail_root_42.length, 8, 4)
    : buildTaperedSweepGeometry({"stations": [{"position": [0, 0, 0], "rx": 0.18, "rz": 0.17}, {"position": [0, 0.1, -0.35], "rx": 0.08, "rz": 0.08}], "radialSegments": 6, "capEnds": true});
  if (!endpoint_tail_root_42) {
    mesh_tail_root_42Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_tail_root_42 = new THREE.Mesh(
    mesh_tail_root_42Geometry,
    materialMap["teal"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_tail_root_42.name = "tail-root";
  if (endpoint_tail_root_42) {
    mesh_tail_root_42.position.copy(endpoint_tail_root_42.midpoint);
    mesh_tail_root_42.quaternion.copy(endpoint_tail_root_42.quaternion);
  }
  mesh_tail_root_42.castShadow = options.castShadow ?? true;
  mesh_tail_root_42.receiveShadow = options.receiveShadow ?? true;
  mesh_tail_root_42.userData.sculptComponent = {"id": "tail-root", "name": "tail-root", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "tapered-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals", "taperedSweep": {"stations": [{"position": [0, 0, 0], "rx": 0.18, "rz": 0.17}, {"position": [0, 0.1, -0.35], "rx": 0.08, "rz": 0.08}], "radialSegments": 6, "capEnds": true}}, "parent": null, "attachment": null, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0.61, -0.61], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "teal", "materialLayers": ["teal"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "tail-root-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(50, 126, 121, 1)", "secondaryAlbedo": "rgba(50, 126, 121, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_tail_root_42.add(mesh_tail_root_42);
  meshes["tail-root"] = mesh_tail_root_42;
  colliders["tail-root"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_tail_root_42);

  const endpoint_tail_border_43 = makeAttachmentEndpoint(null);
  const node_tail_border_43 = new THREE.Group();
  node_tail_border_43.name = "tail-border__pivot";
  node_tail_border_43.scale.set(1, 1, 1);
  if (endpoint_tail_border_43) {
    node_tail_border_43.position.copy(endpoint_tail_border_43.start);
    node_tail_border_43.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_tail_border_43.position.set(0.0, 0.82, -1.09);
    node_tail_border_43.rotation.set(0.0, 0.0, 0.0);
  }
  node_tail_border_43.userData.sculptComponent = {"id": "tail-border", "name": "tail-border", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.13, "height": 0.73, "depth": 0.7, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0.82, -1.09], "rotation": [0, 0, 0], "scale": [0.13, 0.73, 0.7]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "orange", "materialLayers": ["orange"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "tail-border-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(233, 137, 35, 1)", "secondaryAlbedo": "rgba(233, 137, 35, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_tail_border_43.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_tail_border_43);
  nodes["tail-border"] = node_tail_border_43;
  const mesh_tail_border_43Geometry = endpoint_tail_border_43
    ? new THREE.CylinderGeometry(endpoint_tail_border_43.endRadius, endpoint_tail_border_43.baseRadius, endpoint_tail_border_43.length, 8, 4)
    : new THREE.SphereGeometry(0.5, 16, 10);
  if (!endpoint_tail_border_43) {
    mesh_tail_border_43Geometry.scale(0.13, 0.73, 0.7);
  }
  const mesh_tail_border_43 = new THREE.Mesh(
    mesh_tail_border_43Geometry,
    materialMap["orange"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_tail_border_43.name = "tail-border";
  if (endpoint_tail_border_43) {
    mesh_tail_border_43.position.copy(endpoint_tail_border_43.midpoint);
    mesh_tail_border_43.quaternion.copy(endpoint_tail_border_43.quaternion);
  }
  mesh_tail_border_43.castShadow = options.castShadow ?? true;
  mesh_tail_border_43.receiveShadow = options.receiveShadow ?? true;
  mesh_tail_border_43.userData.sculptComponent = {"id": "tail-border", "name": "tail-border", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.13, "height": 0.73, "depth": 0.7, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0.82, -1.09], "rotation": [0, 0, 0], "scale": [0.13, 0.73, 0.7]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "orange", "materialLayers": ["orange"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "tail-border-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(233, 137, 35, 1)", "secondaryAlbedo": "rgba(233, 137, 35, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_tail_border_43.add(mesh_tail_border_43);
  meshes["tail-border"] = mesh_tail_border_43;
  colliders["tail-border"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_tail_border_43);

  const endpoint_tail_fan_44 = makeAttachmentEndpoint(null);
  const node_tail_fan_44 = new THREE.Group();
  node_tail_fan_44.name = "tail-fan__pivot";
  node_tail_fan_44.scale.set(1, 1, 1);
  if (endpoint_tail_fan_44) {
    node_tail_fan_44.position.copy(endpoint_tail_fan_44.start);
    node_tail_fan_44.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_tail_fan_44.position.set(0.0, 0.82, -1.11);
    node_tail_fan_44.rotation.set(0.0, 0.0, 0.0);
  }
  node_tail_fan_44.userData.sculptComponent = {"id": "tail-fan", "name": "tail-fan", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.16, "height": 0.58, "depth": 0.54, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0.82, -1.11], "rotation": [0, 0, 0], "scale": [0.16, 0.58, 0.54]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "teal", "materialLayers": ["teal"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "tail-fan-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(50, 126, 121, 1)", "secondaryAlbedo": "rgba(50, 126, 121, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_tail_fan_44.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_tail_fan_44);
  nodes["tail-fan"] = node_tail_fan_44;
  const mesh_tail_fan_44Geometry = endpoint_tail_fan_44
    ? new THREE.CylinderGeometry(endpoint_tail_fan_44.endRadius, endpoint_tail_fan_44.baseRadius, endpoint_tail_fan_44.length, 8, 4)
    : new THREE.SphereGeometry(0.5, 16, 10);
  if (!endpoint_tail_fan_44) {
    mesh_tail_fan_44Geometry.scale(0.16, 0.58, 0.54);
  }
  const mesh_tail_fan_44 = new THREE.Mesh(
    mesh_tail_fan_44Geometry,
    materialMap["teal"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_tail_fan_44.name = "tail-fan";
  if (endpoint_tail_fan_44) {
    mesh_tail_fan_44.position.copy(endpoint_tail_fan_44.midpoint);
    mesh_tail_fan_44.quaternion.copy(endpoint_tail_fan_44.quaternion);
  }
  mesh_tail_fan_44.castShadow = options.castShadow ?? true;
  mesh_tail_fan_44.receiveShadow = options.receiveShadow ?? true;
  mesh_tail_fan_44.userData.sculptComponent = {"id": "tail-fan", "name": "tail-fan", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.16, "height": 0.58, "depth": 0.54, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0.82, -1.11], "rotation": [0, 0, 0], "scale": [0.16, 0.58, 0.54]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "teal", "materialLayers": ["teal"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "tail-fan-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(50, 126, 121, 1)", "secondaryAlbedo": "rgba(50, 126, 121, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_tail_fan_44.add(mesh_tail_fan_44);
  meshes["tail-fan"] = mesh_tail_fan_44;
  colliders["tail-fan"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_tail_fan_44);

  const endpoint_cheek_l_45 = makeAttachmentEndpoint(null);
  const node_cheek_l_45 = new THREE.Group();
  node_cheek_l_45.name = "cheek-l__pivot";
  node_cheek_l_45.scale.set(1, 1, 1);
  if (endpoint_cheek_l_45) {
    node_cheek_l_45.position.copy(endpoint_cheek_l_45.start);
    node_cheek_l_45.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_cheek_l_45.position.set(0.47, 0.75, 0.66);
    node_cheek_l_45.rotation.set(0.0, 0.0, 0.0);
  }
  node_cheek_l_45.userData.sculptComponent = {"id": "cheek-l", "name": "cheek-l", "level": "meso", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.23, "height": 0.26, "depth": 0.16, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.47, 0.75, 0.66], "rotation": [0, 0, 0], "scale": [0.23, 0.26, 0.16]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "cream", "materialLayers": ["cream"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "cheek-l-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(237, 214, 160, 1)", "secondaryAlbedo": "rgba(237, 214, 160, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_cheek_l_45.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_cheek_l_45);
  nodes["cheek-l"] = node_cheek_l_45;
  const mesh_cheek_l_45Geometry = endpoint_cheek_l_45
    ? new THREE.CylinderGeometry(endpoint_cheek_l_45.endRadius, endpoint_cheek_l_45.baseRadius, endpoint_cheek_l_45.length, 8, 4)
    : new THREE.SphereGeometry(0.5, 16, 10);
  if (!endpoint_cheek_l_45) {
    mesh_cheek_l_45Geometry.scale(0.23, 0.26, 0.16);
  }
  const mesh_cheek_l_45 = new THREE.Mesh(
    mesh_cheek_l_45Geometry,
    materialMap["cream"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_cheek_l_45.name = "cheek-l";
  if (endpoint_cheek_l_45) {
    mesh_cheek_l_45.position.copy(endpoint_cheek_l_45.midpoint);
    mesh_cheek_l_45.quaternion.copy(endpoint_cheek_l_45.quaternion);
  }
  mesh_cheek_l_45.castShadow = options.castShadow ?? true;
  mesh_cheek_l_45.receiveShadow = options.receiveShadow ?? true;
  mesh_cheek_l_45.userData.sculptComponent = {"id": "cheek-l", "name": "cheek-l", "level": "meso", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.23, "height": 0.26, "depth": 0.16, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.47, 0.75, 0.66], "rotation": [0, 0, 0], "scale": [0.23, 0.26, 0.16]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "cream", "materialLayers": ["cream"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "cheek-l-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(237, 214, 160, 1)", "secondaryAlbedo": "rgba(237, 214, 160, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_cheek_l_45.add(mesh_cheek_l_45);
  meshes["cheek-l"] = mesh_cheek_l_45;
  colliders["cheek-l"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_cheek_l_45);

  const endpoint_cheek_r_46 = makeAttachmentEndpoint(null);
  const node_cheek_r_46 = new THREE.Group();
  node_cheek_r_46.name = "cheek-r__pivot";
  node_cheek_r_46.scale.set(1, 1, 1);
  if (endpoint_cheek_r_46) {
    node_cheek_r_46.position.copy(endpoint_cheek_r_46.start);
    node_cheek_r_46.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_cheek_r_46.position.set(-0.47, 0.75, 0.66);
    node_cheek_r_46.rotation.set(0.0, 0.0, 0.0);
  }
  node_cheek_r_46.userData.sculptComponent = {"id": "cheek-r", "name": "cheek-r", "level": "meso", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.23, "height": 0.26, "depth": 0.16, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.47, 0.75, 0.66], "rotation": [0, 0, 0], "scale": [0.23, 0.26, 0.16]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "cream", "materialLayers": ["cream"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "cheek-r-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(237, 214, 160, 1)", "secondaryAlbedo": "rgba(237, 214, 160, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_cheek_r_46.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_cheek_r_46);
  nodes["cheek-r"] = node_cheek_r_46;
  const mesh_cheek_r_46Geometry = endpoint_cheek_r_46
    ? new THREE.CylinderGeometry(endpoint_cheek_r_46.endRadius, endpoint_cheek_r_46.baseRadius, endpoint_cheek_r_46.length, 8, 4)
    : new THREE.SphereGeometry(0.5, 16, 10);
  if (!endpoint_cheek_r_46) {
    mesh_cheek_r_46Geometry.scale(0.23, 0.26, 0.16);
  }
  const mesh_cheek_r_46 = new THREE.Mesh(
    mesh_cheek_r_46Geometry,
    materialMap["cream"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_cheek_r_46.name = "cheek-r";
  if (endpoint_cheek_r_46) {
    mesh_cheek_r_46.position.copy(endpoint_cheek_r_46.midpoint);
    mesh_cheek_r_46.quaternion.copy(endpoint_cheek_r_46.quaternion);
  }
  mesh_cheek_r_46.castShadow = options.castShadow ?? true;
  mesh_cheek_r_46.receiveShadow = options.receiveShadow ?? true;
  mesh_cheek_r_46.userData.sculptComponent = {"id": "cheek-r", "name": "cheek-r", "level": "meso", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat face normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.23, "height": 0.26, "depth": 0.16, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.47, 0.75, 0.66], "rotation": [0, 0, 0], "scale": [0.23, 0.26, 0.16]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "cream", "materialLayers": ["cream"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "cheek-r-contour", "type": "contour", "description": "Reference-matched outer contour", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(237, 214, 160, 1)", "secondaryAlbedo": "rgba(237, 214, 160, 1)", "materialClass": "skin", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_cheek_r_46.add(mesh_cheek_r_46);
  meshes["cheek-r"] = mesh_cheek_r_46;
  colliders["cheek-r"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_cheek_r_46);

  root.userData.sculptRuntime = { nodes, meshes, sockets, colliders, destructionGroups } satisfies ProceduralModelRuntime;
  root.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  root.userData.actionReadiness = {
    note: 'Use root.userData.sculptRuntime.nodes for transforms, sockets for attachments, colliders for physics proxies, and destructionGroups for breakable sets.',
  };

  // Experiment refinement V3: authored sections replace generic primitive surfaces.
  // World-space geometry is rebased onto named component roots; pivots remain WIP.
  function install(id:string, vertices:number[][], faces:number[][], tint?:string) {
    const mesh=meshes[id]; if(!mesh) return;
    const positions:number[]=[];
    if(id.startsWith('eye-patch-') || id==='upper-face')faces=faces.map(f=>[...f].reverse());
    if(id.endsWith('-r'))faces=faces.map(f=>[...f].reverse());
    for(const f of faces) for(let k=1;k<f.length-1;k++) for(const i of [f[0],f[k],f[k+1]])positions.push(...vertices[i]);
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.computeVertexNormals();mesh.geometry.dispose();mesh.geometry=geo;
    mesh.parent?.position.set(0,0,0);mesh.parent?.rotation.set(0,0,0);mesh.position.set(0,0,0);mesh.quaternion.identity();
    if(tint){const mat=(mesh.material as THREE.MeshStandardMaterial).clone();mat.color.set(tint);mesh.material=mat;}
  }
  function loft(id:string, rows:number[][], n:number, tint?:string) {
    const v:number[][]=[],f:number[][]=[];
    for(const [z,w,cy,h] of rows) for(let i=0;i<n;i++){const a=2*Math.PI*i/n;v.push([w*Math.sin(a),cy+h*Math.cos(a),z]);}
    for(let r=0;r<rows.length-1;r++)for(let i=0;i<n;i++){const a=r*n+i,b=r*n+(i+1)%n,c=(r+1)*n+(i+1)%n,d=(r+1)*n+i;f.push(...((r+i)%2?[[a,c,b],[a,d,c]]:[[a,d,b],[b,d,c]]));}
    f.push(Array.from({length:n},(_,i)=>i),Array.from({length:n},(_,i)=>(rows.length-1)*n+n-1-i));install(id,v,f,tint);
  }
  loft('body',[[-.80,.10,.78,.13],[-.62,.37,.80,.40],[-.36,.61,.83,.61],[-.04,.69,.83,.66],[.27,.64,.84,.61],[.50,.52,.91,.43],[.69,.32,1.02,.28],[.81,.10,1.08,.13]],10,'#24786e');
  loft('pouch',[[.11,.28,.55,.28],[.33,.52,.56,.43],[.57,.62,.57,.48],[.81,.57,.57,.43],[.98,.43,.59,.33],[1.06,.21,.62,.19],[1.08,.03,.65,.05]],10,'#efd9a5');
  // Broad side cheek planes join pouch; no separate cheek knobs.
  for(const side of ['l','r']){meshes['cheek-'+side].visible=false;meshes['eye-patch-'+side].visible=false;}
  for(const [side,sign] of [['l',1],['r',-1]] as const){
    const x=(v:number)=>v*sign;
    const brow=[[x(.17),1.18,.80],[x(.60),1.29,.63],[x(.62),1.43,.53],[x(.22),1.36,.74],[x(.16),1.16,.65],[x(.58),1.27,.49],[x(.58),1.39,.42],[x(.23),1.32,.60]];
    install('brow-'+side,brow,[[0,1,2,3],[4,7,6,5],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]],'#e88120');
    install('eye-patch-'+side,[[x(.16),1.18,.73],[x(.60),1.29,.57],[x(.61),.96,.62],[x(.25),.92,.85],[x(.15),1.12,.60],[x(.55),1.24,.45],[x(.53),.94,.50],[x(.23),.91,.70]],[[0,1,2,3],[4,7,6,5],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]],'#e5a041');meshes['eye-patch-'+side].visible=true;
    const eye=meshes['eye-'+side];eye.parent?.position.set(x(.405),1.105,.711);eye.parent?.rotation.set(0,sign*.39,0);
    const pupil=meshes['pupil-'+side];pupil.parent?.position.set(x(.405),1.105,.778);pupil.parent?.rotation.set(0,sign*.39,0);
    const glint=meshes['glint-'+side];glint.parent?.position.set(x(.39),1.15,.797);
    for(const [name,z]of [['front',.37],['rear',-.46]] as const){
      const v=[[x(.46),.49,z-.09],[x(.63),.47,z-.07],[x(.94),.085,z+.27],[x(.76),.035,z+.44],[x(.48),.06,z+.33],[x(.43),.15,z+.02],[x(.64),.12,z+.20]];
      install('fin-'+name+'-'+side,v,[[0,1,6],[1,2,6],[2,3,6],[3,4,6],[4,5,6],[5,0,6],[0,5,4,3,2,1]],'#347f76');
      install('fin-band-'+name+'-'+side,[[x(.46),.10,z+.31],[x(.76),.09,z+.44],[x(.96),.12,z+.27],[x(.90),.21,z+.22],[x(.74),.18,z+.32],[x(.52),.20,z+.23]],[[0,1,4,5],[1,2,3,4],[0,5,4,3,2,1]],'#e7a133');
    }
  }
  // Cream muzzle is a thick peaked upper-lip shell with a genuine open inner boundary.
  const outer=[[-.29,.89,1.02],[-.22,1.13,.97],[0,1.27,.93],[.22,1.13,.97],[.29,.89,1.02]];
  const inner=[[-.22,.90,1.055],[-.15,1.07,1.02],[0,1.16,.99],[.15,1.07,1.02],[.22,.90,1.055]];
  const verts=[...outer,...inner,...outer.map(v=>[v[0],v[1],v[2]-.13]),...inner.map(v=>[v[0],v[1],v[2]-.13])];const faces:number[][]=[];
  for(let i=0;i<4;i++)faces.push([i,i+1,6+i,5+i],[i,10+i,11+i,i+1],[5+i,6+i,16+i,15+i],[10+i,15+i,16+i,11+i]);faces.push([0,5,15,10],[4,14,19,9]);install('upper-face',verts,faces,'#f1d496');
  install('mouth',[[-.22,.89,.995],[.22,.89,.995],[.15,1.07,.955],[0,1.16,.93],[-.15,1.07,.955],[0,.95,.91]],[[0,1,5],[1,2,5],[2,3,5],[3,4,5],[4,0,5]],'#562319');
  meshes['tongue'].parent?.position.set(0,.925,1.025);
  // Faceted fan: continuous closed volume, flat side axis, attached to tail stem.
  function fan(id:string, radius:number, thick:number,col:string){const v:number[][]=[],f:number[][]=[];for(const x of [-thick,thick])for(let i=0;i<8;i++){let a=i*Math.PI/4;v.push([x,.78+Math.cos(a)*radius,-1.04+Math.sin(a)*radius*.80]);}v.push([-thick-.025,.78,-1.04],[thick+.025,.78,-1.04]);for(let i=0;i<8;i++){let j=(i+1)%8;f.push([i,16,j],[i+8,j+8,17],[i,j,j+8,i+8]);}install(id,v,f,col);}
  fan('tail-border',.39,.055,'#e5a23a');fan('tail-fan',.305,.085,'#2c7770');
  root.userData.experimentRefinement='V3 custom sections, low-poly fins, planar brow/cheek wedges, thick lip opening and closed tail fan. Static geometry only; rig readiness unverified.';


  // V4: closed fin volumes and embedded face geometry, replacing thin wedges.
  for(const [side,sign] of [['l',1],['r',-1]] as const){
    const x=(v:number)=>v*sign;
    // Orange face field has physical depth and overlaps the cranial body at the sides.
    install('eye-patch-'+side,[[x(.13),1.16,.77],[x(.62),1.28,.53],[x(.61),.86,.65],[x(.18),.84,.96],[x(.12),1.13,.53],[x(.55),1.24,.30],[x(.53),.84,.44],[x(.16),.82,.72]],[[0,1,2,3],[4,7,6,5],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]],'#cb721e');
    install('brow-'+side,[[x(.14),1.105,.86],[x(.61),1.25,.68],[x(.62),1.38,.51],[x(.20),1.30,.73],[x(.14),1.10,.61],[x(.57),1.22,.44],[x(.56),1.32,.32],[x(.20),1.25,.56]],[[0,1,2,3],[4,7,6,5],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]],'#d97716');
    const eye=meshes['eye-'+side];eye.geometry.scale(1,.95,.78);eye.parent?.position.set(x(.425),1.075,.716);
    const pupil=meshes['pupil-'+side];pupil.geometry.scale(.84,.78,1);pupil.parent?.position.set(x(.425),1.072,.768);
    meshes['glint-'+side].parent?.position.set(x(.40),1.11,.793);
    for(const [name,z]of [['front',.36],['rear',-.50]] as const){
      const top=name==='front'?.55:.49;
      const v=[[x(.39),top,z-.12],[x(.68),top-.04,z-.12],[x(.71),top-.08,z+.16],[x(.42),top,z+.16],[x(.49),.07,z+.10],[x(.96),.07,z+.16],[x(.94),.07,z+.46],[x(.52),.07,z+.49],[x(.72),.21,z+.31]];
      install('fin-'+name+'-'+side,v,[[0,3,2,1],[0,1,5,4],[1,2,8,5],[2,3,7,8],[3,0,4,7],[5,8,6],[8,7,6],[4,5,6,7]],'#2c8074');
      install('fin-band-'+name+'-'+side,[[x(.50),.075,z+.34],[x(.94),.075,z+.31],[x(.94),.13,z+.46],[x(.52),.13,z+.49],[x(.51),.20,z+.30],[x(.93),.20,z+.29],[x(.91),.23,z+.37],[x(.54),.23,z+.40]],[[0,1,2,3],[4,7,6,5],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]],'#dc9828');
      for(let j=0;j<3;j++)meshes['toe-'+name+'-'+side+j].parent?.position.set(x(.57+j*.15),.08,z+.49);
    }
  }
  // Lower lip and side planes broaden into the pouch instead of sitting as a narrow frame.
  loft('pouch',[[.10,.30,.54,.28],[.33,.55,.56,.43],[.58,.65,.57,.48],[.82,.60,.58,.43],[1.01,.46,.60,.33],[1.10,.24,.64,.19],[1.12,.03,.67,.05]],10,'#ead09a');
  // Integrated muzzle planes overlap a shallow inset, not a thin edge-only arch.
  const lipOuter=[[-.32,.86,1.05],[-.25,1.08,1.00],[0,1.23,.94],[.25,1.08,1.00],[.32,.86,1.05]];
  const lipInner=[[-.23,.89,1.075],[-.15,1.05,1.035],[0,1.13,1.00],[.15,1.05,1.035],[.23,.89,1.075]];
  const lipVerts=[...lipOuter,...lipInner,...lipOuter.map(v=>[v[0]*1.12,v[1],v[2]-.22]),...lipInner.map(v=>[v[0],v[1],v[2]-.13])];const lipFaces:number[][]=[];
  for(let i=0;i<4;i++)lipFaces.push([i,i+1,6+i,5+i],[i,10+i,11+i,i+1],[5+i,6+i,16+i,15+i],[10+i,15+i,16+i,11+i]);lipFaces.push([0,5,15,10],[4,14,19,9]);install('upper-face',lipVerts,lipFaces,'#edcf8c');
  install('mouth',[[-.23,.89,1.025],[.23,.89,1.025],[.15,1.05,.985],[0,1.13,.95],[-.15,1.05,.985],[0,.95,.94]],[[0,1,5],[1,2,5],[2,3,5],[3,4,5],[4,0,5]],'#512018');
  meshes['tongue'].parent?.position.set(0,.916,1.045);
  for(const id of ['tail-border','tail-fan']){const m=meshes[id];m.geometry.translate(0,-.78,1.04);m.parent?.position.set(0,.78,-1.04);m.parent?.rotation.set(0,.65,0);}
  root.userData.experimentRefinement='V4 solid closed fins with shoulder overlap, deeper facial orange volume, eyes occluded by descending brows, broad muzzle-to-pouch transition. Static geometry only.';


  // V5 feet: broad solid ivory lobes replace tiny cone fragments.
  for(const [side,sign]of [['l',1],['r',-1]] as const){const x=(v:number)=>v*sign;for(const[name,z]of [['front',.36],['rear',-.50]] as const){for(let j=0;j<3;j++){const c=.57+j*.15;install('toe-'+name+'-'+side+j,[[x(c-.085),.08,z+.38],[x(c+.085),.08,z+.38],[x(c+.065),.055,z+.55],[x(c-.065),.055,z+.55],[x(c),.145,z+.43],[x(c),.07,z+.60]],[[0,4,1],[0,3,5,4],[4,5,2,1],[3,2,5],[0,1,2,3]],'#f2dca5');}}}
  root.userData.experimentRefinement='V5 corrected cheek/muzzle face winding, broad closed ivory toes. Static geometry; current visual acceptance still pending.';


  // V6 macro reconstruction: cheek wraps a tapered six-edge socket; broad low muzzle.
  loft('body',[[-.80,.12,.77,.13],[-.62,.42,.78,.36],[-.36,.69,.81,.55],[-.04,.76,.81,.60],[.27,.70,.82,.56],[.50,.56,.90,.40],[.69,.34,1.00,.26],[.81,.10,1.06,.12]],10,'#24786e');
  loft('pouch',[[.10,.32,.55,.28],[.32,.58,.56,.42],[.56,.69,.58,.46],[.81,.65,.59,.42],[1.01,.48,.62,.32],[1.10,.24,.65,.18],[1.12,.03,.67,.04]],10,'#ead5a4');
  for(const id of ['upper-face','mouth']){const g=meshes[id].geometry;const a=g.getAttribute('position');for(let i=0;i<a.count;i++)a.setXYZ(i,a.getX(i)*1.1,.88+(a.getY(i)-.88)*.58,a.getZ(i));a.needsUpdate=true;g.computeVertexNormals();}
  meshes['tongue'].parent?.position.set(0,.90,1.045);
  for(const [side,sign]of [['l',1],['r',-1]]as const){const x=(v:number)=>v*sign;
    const outline=[[.16,1.12,.79],[.52,1.25,.63],[.65,1.12,.47],[.62,.91,.55],[.38,.83,.82],[.18,.93,.94]];
    const v=outline.map(q=>[x(q[0]),q[1],q[2]]);v.push(...outline.map(q=>[x(q[0]*.90),q[1],q[2]-.19]));
    install('eye-patch-'+side,v,[[0,1,2],[0,2,3],[0,3,4],[0,4,5],[6,11,10,9,8,7],[0,6,7,1],[1,7,8,2],[2,8,9,3],[3,9,10,4],[4,10,11,5],[5,11,6,0]],'#d17b28');
    install('brow-'+side,[[x(.12),1.07,.91],[x(.57),1.23,.66],[x(.65),1.34,.43],[x(.30),1.34,.66],[x(.14),1.20,.80],[x(.12),1.07,.66],[x(.55),1.20,.42],[x(.60),1.29,.29],[x(.29),1.26,.43],[x(.16),1.15,.56]],[[0,1,2,3,4],[5,9,8,7,6],[0,5,6,1],[1,6,7,2],[2,7,8,3],[3,8,9,4],[4,9,5,0]],'#d6791f');
    for(const[name,z]of [['front',.36],['rear',-.50]]as const){
      const v=[[x(.39),.51,z-.13],[x(.62),.52,z-.10],[x(.92),.26,z+.10],[x(1.01),.13,z+.31],[x(.86),.10,z+.47],[x(.60),.09,z+.49],[x(.44),.18,z+.28],[x(.65),.30,z+.23],[x(.58),.07,z-.02]];
      install('fin-'+name+'-'+side,v,[[0,7,1],[1,7,2],[2,7,3],[3,7,4],[4,7,5],[5,7,6],[6,7,0],[0,1,8],[1,2,8],[2,3,8],[3,4,8],[4,5,8],[5,6,8],[6,0,8]],'#2e8174');
      meshes['fin-band-'+name+'-'+side].visible=false;
      // Four faceted radial solid lobes, merged under the first named toe pivot.
      const tv:number[][]=[],tf:number[][]=[];
      for(let j=0;j<4;j++){const a=(-.55+j*.40),cx=.69+Math.sin(a)*.27,cz=z+.28+Math.cos(a)*.11;const tip=[x(cx+Math.sin(a)*.22),.07,cz+Math.cos(a)*.24];const start=tv.length;
        for(let k=0;k<5;k++){const q=k*Math.PI*2/5;tv.push([x(cx+Math.cos(q)*.092),.115+Math.sin(q)*.085,cz]);}tv.push(tip);
        for(let k=0;k<5;k++)tf.push([start+k,start+(k+1)%5,start+5]);tf.push([start+4,start+3,start+2,start+1,start]);}
      install('toe-'+name+'-'+side+'0',tv,tf,'#f1dfb3');meshes['toe-'+name+'-'+side+'1'].visible=false;meshes['toe-'+name+'-'+side+'2'].visible=false;
    }
  }
  root.userData.experimentRefinement='V6 tapered cheek sockets, slanted integrated brow hood, compressed wide muzzle, broad upper pouch, closed fan feet and four radial cream lobes. Visual review pending; static only.';

  return root;
}

export function createBrinePufferLowPolyReferenceExperimentLookDevLights(
  mode: 'neutral' | 'grazing' | 'reference' = 'neutral',
): THREE.Group {
  const lights = new THREE.Group();
  lights.name = "Brine Puffer low-poly reference experiment look-dev lights";
  const hemi = new THREE.HemisphereLight(
    mode === 'reference' ? 0xfff0d6 : 0xf2f4ff,
    0x363b42,
    mode === 'grazing' ? 0.28 : mode === 'reference' ? 0.72 : 0.85,
  );
  lights.add(hemi);
  const key = new THREE.DirectionalLight(
    mode === 'reference' ? 0xffcf8a : 0xfff4e8,
    mode === 'grazing' ? 4.2 : mode === 'reference' ? 2.6 : 2.15,
  );
  if (mode === 'grazing') key.position.set(7.5, 1.1, 4.0);
  else if (mode === 'reference') key.position.set(-4.5, 7.5, 5.0);
  else key.position.set(-4.0, 6.0, 5.5);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.018;
  key.shadow.radius = 7;
  key.shadow.blurSamples = 24;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 30;
  key.shadow.camera.left = -2.6;
  key.shadow.camera.right = 2.6;
  key.shadow.camera.top = 2.6;
  key.shadow.camera.bottom = -2.6;
  key.shadow.camera.updateProjectionMatrix();
  lights.add(key);
  const fill = new THREE.DirectionalLight(0xa8c4ff, mode === 'grazing' ? 0.12 : 0.42);
  fill.position.set(4.0, 3.0, 3.5);
  lights.add(fill);
  const rim = new THREE.DirectionalLight(0xfff1c4, mode === 'grazing' ? 0.28 : 0.85);
  rim.position.set(0.5, 4.5, -6.0);
  lights.add(rim);
  lights.userData.reviewMode = mode;
  lights.userData.lightingFromPhoto = ["Key directional light from upper front left, intensity 3", "Hemisphere fill 1.4 and cool rear rim 0.5", "ACES tone mapping exposure 1.15; pale neutral background; contact shadow under grounded feet"];
  lights.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  return lights;
}

// PBR materials (clearcoat/iridescence/transmission/anisotropy) need an environment
// map to visually behave as intended — call this once per renderer and assign the
// result to scene.environment before rendering. No external HDR asset required.
export function createBrinePufferLowPolyReferenceExperimentEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return texture;
}

// Plan 1.3 §3.2 — auto-framing by bounding box. The Divine Eye can only compare a
// render to the reference if the object is FRAMED consistently (an object framed
// differently scores as wrong even when its shape is right). This positions the camera
// deterministically from the object's bounding box so it fills the frame at a stable
// margin, and sets near/far to the object scale. Call after adding the model to the
// scene, and again on resize (after updating camera.aspect).
export function frameBrinePufferLowPolyReferenceExperimentCamera(
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D,
  options: { margin?: number; azimuthDeg?: number; elevationDeg?: number } = {},
): void {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const margin = options.margin ?? 1.15;
  const maxDim = Math.max(size.x, size.y, size.z) * margin;
  const fov = (camera.fov * Math.PI) / 180;
  // distance so the largest object dimension fits vertically in the frame
  const distance = (maxDim / 2) / Math.tan(fov / 2);
  const az = ((options.azimuthDeg ?? 0) * Math.PI) / 180;
  const el = ((options.elevationDeg ?? 0) * Math.PI) / 180;
  const dir = new THREE.Vector3(
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    Math.cos(az) * Math.cos(el),
  );
  camera.position.copy(center).addScaledVector(dir, distance);
  camera.near = Math.max(0.01, distance - maxDim);
  camera.far = distance + maxDim * 2;
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}

// Plan 1.3 §3.2c — PRESENTATION composer (DOF + bloom). CRITICAL (R-POSTFX): this is
// for the showcase/hero render ONLY. The Divine Eye's EVALUATION render MUST use a
// plain renderer with NO composer — bloom blows highlights and DOF blurs edges, which
// would corrupt the deterministic IoU/DCD/edge/blowout signals. Enable dof/bloom ONLY
// when the reference photo actually exhibits them (detect_reference_effects.py authorizes).
export function createBrinePufferLowPolyReferenceExperimentPresentationComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: { dof?: boolean; bloom?: boolean; bloomStrength?: number; dofFocus?: number; dofAperture?: number } = {},
): EffectComposer {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  if (options.dof) {
    composer.addPass(new BokehPass(scene, camera, {
      focus: options.dofFocus ?? 10.0,
      aperture: options.dofAperture ?? 0.0002,
      maxblur: 0.01,
    }));
  }
  if (options.bloom) {
    const size = new THREE.Vector2();
    renderer.getSize(size);
    composer.addPass(new UnrealBloomPass(size, options.bloomStrength ?? 0.4, 0.4, 0.85));
  }
  return composer;
}

export function configureBrinePufferLowPolyReferenceExperimentRenderer(renderer: THREE.WebGLRenderer): void {
  // Load-bearing for view-dependent finishes (anodized / Doppler): without ACES + sRGB
  // the environment reflection reads flat/washed instead of a believable metal response.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}

export function createBrinePufferLowPolyReferenceExperimentInspectControls(
  camera: THREE.Camera,
  domElement: HTMLElement,
): OrbitControls {
  // View-dependent finishes only read correctly once the user orbits — their color
  // comes from the environment reflection, not albedo, so free rotation matters here.
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.minDistance = 1.0;
  controls.maxDistance = 8.0;
  controls.autoRotate = false;
  return controls;
}
