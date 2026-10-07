/**
 * The open plots (SHARD-PLATFORM G198 / G213 / G219): the grid's cells without a real shard that are not Template copies.
 * Each is a 500 × 500 m surveyed plot on the VR void's grid floor with a showroom at all four entries (a billboard of one
 * shard idea, a half-built demo corner of another, the survey sign "THIS PLOT IS YOURS TO BUILD") and a centrepiece (a
 * turning hologram of a shard being built over a stepped plinth, ringed by picture cards of every idea). The geometry is
 * `openPlotLayout.ts`; this file draws it and hands the platform its colliders.
 *
 * Cheap on the phone by construction: per plot one floor quad (grid shader, no texture), one vertex-coloured solid mesh
 * (light baked in), one static line draw, one picture-quad draw and one text-quad draw from two shared atlases, and the
 * hologram's line + card draws. A plot past `VISIBLE` m is hidden whole. Nothing changes per frame but the hologram's turn,
 * its scan plane and a shimmer on two line materials. The atlases are canvases painted once (text from GAME_STRINGS, the
 * pictures from `public/assets/grid/open-plot/<idea>.webp` once they decode) and freed after their last upload. Every
 * byte is one platform render claim in the allocator, admitted up front.
 */
import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, DoubleSide, Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial,
  type Object3D, PlaneGeometry, SRGBColorSpace, ShaderMaterial } from 'three';
import { CHUNK_HALF } from '@wildshard/engine/core/config';
import { fetchImage } from '@wildshard/engine/boot/bytes';
import type { Scope } from '@wildshard/engine/app/scope';
import type { StripMesh } from '@wildshard/engine/sim/strips';
import type { GridPlot } from './assembly';
import type { PlatformRenderAdmission } from './renderResidency';
import { GAME_STRINGS } from '../strings';
import { FACE, PICTURE_ATLAS, PLAQUE_RECT, PLOT_IDEAS, SIGN_RECT, TEXT_ATLAS, faceRect, labelRect, openPlotBytes, openPlotGeometry, type AtlasRect, type OpenPlotGeometry, type PlotIdea, type PlotSide } from './openPlotLayout';

/** A plot farther than this (m, from the feet to its square) is hidden whole; its beacons' beams are the far marker until then. */
const VISIBLE = 900;
const FLOOR_Y = 0.03;
const CYAN = new Color(0x38e6ff);
const DISPLAY = "'Rajdhani', 'Bahnschrift', 'DIN Alternate', 'Helvetica Neue', Arial, sans-serif", MONO = "'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace";

/** The platform colliders of every plot: its floor and every solid, one trimesh each in grid metres (origin = the plot centre). */
export function openPlotColliders(plots: readonly GridPlot[]): StripMesh[] {
  return plots.map((plot, ordinal) => {
    const { collider } = openPlotGeometry(ordinal);
    return { origin: { x: plot.origin.x, z: plot.origin.z }, positions: collider.positions, indices: collider.indices, colours: new Float32Array(collider.positions.length) };
  });
}

const floorVertex = /* glsl */ `
varying vec2 vLocal;
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vLocal = position.xz; vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;
const floorFragment = /* glsl */ `
uniform vec3 uLine;
uniform vec3 uBase;
uniform float uHalf;
varying vec2 vLocal;
varying vec3 vWorld;
float lines(vec2 p, float cell, float width) {
  vec2 g = p / cell; vec2 w = fwidth(g);
  vec2 d = abs(fract(g - 0.5) - 0.5) / max(w, vec2(1e-5));
  return (1.0 - min(min(d.x, d.y) / width, 1.0)) * (1.0 - smoothstep(0.12, 0.45, max(w.x, w.y)));
}
void main() {
  float minor = lines(vLocal, 10.0, 1.0), major = lines(vLocal, 50.0, 1.7);
  float edge = uHalf - max(abs(vLocal.x), abs(vLocal.y));
  float border = exp(-edge / 1.2) + exp(-edge / 14.0) * 0.25; // the survey line and its glow
  float fade = exp(-length(vWorld.xz - cameraPosition.xz) / 1100.0);
  float lit = max(minor * 0.5, major) * (0.35 + 0.65 * fade) + border;
  gl_FragColor = vec4(uBase + uLine * lit, 1.0);
}`;

/** Fit `text` into `width` px, shrinking from `size`. */
function fit(g: CanvasRenderingContext2D, text: string, weight: number, size: number, family: string, width: number, spacing = 0): void {
  let px = size;
  for (;;) { g.font = `${weight} ${px}px ${family}`; if (g.measureText(text).width + spacing * text.length <= width || px <= 10) break; px -= 2; }
}
function spaced(g: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number): void {
  const total = g.measureText(text).width + spacing * (text.length - 1);
  let at = x - total / 2;
  for (const ch of text) { g.fillText(ch, at, y); at += g.measureText(ch).width + spacing; }
}
function panel(g: CanvasRenderingContext2D, r: AtlasRect, line = 4): void {
  g.fillStyle = '#0d1b26'; g.fillRect(r.x, r.y, r.w, r.h);
  g.strokeStyle = '#8fe3ff'; g.lineWidth = line; g.strokeRect(r.x + line / 2 + 2, r.y + line / 2 + 2, r.w - line - 4, r.h - line - 4);
}

/** The text atlas: the survey sign, the centre plaque, the demo labels (GAME_STRINGS.grid.plot). */
function paintText(g: CanvasRenderingContext2D): void {
  const s = GAME_STRINGS.grid.plot;
  g.textAlign = 'left'; g.textBaseline = 'middle';
  panel(g, SIGN_RECT, 6); g.fillStyle = '#ffffff'; fit(g, s.sign, 700, 92, DISPLAY, SIGN_RECT.w - 80, 4); spaced(g, s.sign, SIGN_RECT.w / 2, SIGN_RECT.y + 98, 4);
  g.fillStyle = '#5fdcff'; fit(g, s.signSub, 600, 46, DISPLAY, SIGN_RECT.w - 90, 2); spaced(g, s.signSub, SIGN_RECT.w / 2, SIGN_RECT.y + 190, 2);
  panel(g, PLAQUE_RECT, 4); g.fillStyle = '#8fe3ff'; fit(g, s.centre, 600, 64, MONO, PLAQUE_RECT.w - 80, 6); spaced(g, s.centre, PLAQUE_RECT.w / 2, PLAQUE_RECT.y + PLAQUE_RECT.h / 2, 6);
  for (const idea of PLOT_IDEAS) {
    const r = labelRect(idea), text = s.demo(s.ideas[idea]);
    panel(g, r, 3); g.fillStyle = '#ffffff'; fit(g, text, 700, 44, DISPLAY, r.w - 40, 2); spaced(g, text, r.x + r.w / 2, r.y + r.h / 2 + 2, 2);
  }
}
/** One billboard face: the header line, the picture (or a navy placeholder until it decodes), the idea's name. */
function paintFace(g: CanvasRenderingContext2D, idea: PlotIdea, image: CanvasImageSource | null): void {
  const r = faceRect(idea), s = GAME_STRINGS.grid.plot;
  g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillStyle = '#0d1b26'; g.fillRect(r.x, r.y, r.w, r.h);
  if (image === null) { g.fillStyle = '#16324a'; g.fillRect(r.x + 8, r.y + FACE.header, r.w - 16, FACE.picture); }
  else g.drawImage(image, r.x, r.y + FACE.header, r.w, FACE.picture);
  g.fillStyle = '#ffffff'; fit(g, s.billboard, 700, 44, DISPLAY, r.w - 50, 4); spaced(g, s.billboard, r.x + r.w / 2, r.y + FACE.header / 2 + 2, 4);
  g.fillStyle = '#8fe3ff'; g.fillRect(r.x, r.y + FACE.header - 3, r.w, 3); g.fillRect(r.x, r.y + FACE.header + FACE.picture, r.w, 3);
  g.fillStyle = '#ffffff'; fit(g, s.ideas[idea], 700, 42, DISPLAY, r.w - 50, 3); spaced(g, s.ideas[idea], r.x + r.w / 2, r.y + FACE.header + FACE.picture + (FACE.h - FACE.header - FACE.picture) / 2 + 2, 3);
}

/** The readout. */
export interface OpenPlotState {
  readonly plots: readonly { readonly instance: string; readonly visible: boolean; readonly entries: Readonly<Record<PlotSide, { readonly billboard: PlotIdea; readonly demo: PlotIdea }>> }[];
  /** pictures decoded of PLOT_IDEAS.length */
  readonly pictures: number;
  readonly draws: number; readonly triangles: number;
}

function geometry(positions: Float32Array, attrs: Readonly<Record<string, readonly [Float32Array, number]>>, indices?: Uint32Array): BufferGeometry {
  const g = new BufferGeometry().setAttribute('position', new BufferAttribute(positions, 3));
  for (const [name, [array, size]] of Object.entries(attrs)) g.setAttribute(name, new BufferAttribute(array, size));
  if (indices !== undefined) g.setIndex(new BufferAttribute(indices, 1));
  g.computeBoundingSphere();
  return g;
}

/** Draw every open plot in the home frame; disposed with the scope. `feet` is the traveller's feet in the home frame. */
export function installOpenPlots(input: {
  readonly plots: readonly GridPlot[]; readonly home: { readonly origin: { readonly x: number; readonly z: number } };
  readonly scene: Object3D; readonly scope: Scope; readonly admission?: PlatformRenderAdmission;
  readonly feet: () => { readonly x: number; readonly z: number };
}): { readonly step: (dt: number) => void; readonly state: () => OpenPlotState } {
  const { plots, home } = input;
  if (plots.length === 0) return { step: () => undefined, state: () => ({ plots: [], pictures: 0, draws: 0, triangles: 0 }) };
  const built = plots.map((plot, ordinal) => ({ plot, geometry: openPlotGeometry(ordinal) }));
  const canvasOk = typeof document !== 'undefined';
  const atlasBytes = canvasOk ? (PICTURE_ATLAS.w * PICTURE_ATLAS.h + TEXT_ATLAS.w * TEXT_ATLAS.h) * 4 : 0;
  const bufferBytes = built.reduce((sum, row) => sum + openPlotBytes(row.geometry), 0) + 4 * 3 * 4 * plots.length;
  // the atlases' canvases (JS until freed) and their textures with mips (GPU, 4/3); every buffer once each side
  const plan = { id: 'grid.open-plots', jsBytes: bufferBytes + atlasBytes, gpuBytes: bufferBytes + Math.ceil(atlasBytes * 4 / 3) };
  const groups: { group: Group; holo: Group; scan: Mesh; plot: GridPlot; geometry: OpenPlotGeometry }[] = [];
  let decoded = 0, draws = 0, triangles = 0, t = 0;
  let lineMaterial: LineBasicMaterial | null = null, holoMaterial: LineBasicMaterial | null = null, cardMaterial: MeshBasicMaterial | null = null, scanMaterial: MeshBasicMaterial | null = null;
  const build = (owner: Scope): void => {
    const disposables: { dispose: () => void }[] = [];
    owner.onDispose(() => { for (const group of groups) group.group.removeFromParent(); for (const d of disposables) d.dispose(); });
    // the two atlases (shared by every plot); the text is final at once, the pictures repaint as each decodes
    let pictureTexture: CanvasTexture | null = null, textTexture: CanvasTexture | null = null;
    if (canvasOk) {
      const pictureCanvas = document.createElement('canvas'), textCanvas = document.createElement('canvas');
      pictureCanvas.width = PICTURE_ATLAS.w; pictureCanvas.height = PICTURE_ATLAS.h; textCanvas.width = TEXT_ATLAS.w; textCanvas.height = TEXT_ATLAS.h;
      const pg = pictureCanvas.getContext('2d'), tg = textCanvas.getContext('2d');
      if (pg !== null && tg !== null) {
        for (const idea of PLOT_IDEAS) paintFace(pg, idea, null);
        paintText(tg);
        const pictures = new CanvasTexture(pictureCanvas), text = new CanvasTexture(textCanvas);
        for (const texture of [pictures, text]) { texture.colorSpace = SRGBColorSpace; texture.anisotropy = 4; disposables.push(texture); }
        // free a canvas once its final content is on the GPU (a GPU context loss reloads the page, G185)
        const release = (canvas: HTMLCanvasElement) => () => { canvas.width = 1; canvas.height = 1; };
        text.onUpdate = release(textCanvas);
        pictureTexture = pictures; textTexture = text;
        const load = async (idea: PlotIdea): Promise<void> => {
          try {
            const image = await fetchImage(`/assets/grid/open-plot/${idea}.webp`, FACE.w, false);
            if (owner.disposed) return;
            paintFace(pg, idea, image); decoded++;
            if ('close' in image) image.close();
            if (decoded === PLOT_IDEAS.length) pictures.onUpdate = release(pictureCanvas);
            pictures.needsUpdate = true;
          } catch (error) { console.warn(`[grid] open plot picture ${idea}:`, error); }
        };
        for (const idea of PLOT_IDEAS) void load(idea);
      }
    }
    const solidMaterial = new MeshBasicMaterial({ vertexColors: true });
    const lines = new LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.8, blending: AdditiveBlending, depthWrite: false, toneMapped: false });
    const holo = new LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.85, blending: AdditiveBlending, depthWrite: false, toneMapped: false });
    const pictureMaterial = pictureTexture === null ? null : new MeshBasicMaterial({ map: pictureTexture, toneMapped: false });
    const textMaterial = textTexture === null ? null : new MeshBasicMaterial({ map: textTexture, toneMapped: false });
    const cards = pictureTexture === null ? null : new MeshBasicMaterial({ map: pictureTexture, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false });
    const scan = new MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.16, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, toneMapped: false });
    const floorMaterial = new ShaderMaterial({ vertexShader: floorVertex, fragmentShader: floorFragment, fog: false, lights: false,
      uniforms: { uLine: { value: CYAN.clone().multiplyScalar(0.9) }, uBase: { value: new Color(0x03070d) }, uHalf: { value: CHUNK_HALF } } });
    floorMaterial.name = 'grid-open-plot-floor';
    disposables.push(solidMaterial, lines, holo, scan, floorMaterial, ...[pictureMaterial, textMaterial, cards].filter((m): m is MeshBasicMaterial => m !== null));
    lineMaterial = lines; holoMaterial = holo; cardMaterial = cards; scanMaterial = scan;
    const scanGeometry = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2); disposables.push(scanGeometry);
    for (const { plot, geometry: g } of built) {
      const group = new Group(); group.name = `grid-open-plot:${plot.instance}`;
      group.position.set(plot.origin.x - home.origin.x, 0, plot.origin.z - home.origin.z);
      const add = (object: Mesh | LineSegments, parent: Group = group): void => {
        object.matrixAutoUpdate = false; object.updateMatrix(); object.castShadow = false; object.receiveShadow = false; parent.add(object);
        disposables.push(object.geometry); draws++;
        const index = object.geometry.getIndex();
        if (object instanceof Mesh) triangles += (index === null ? object.geometry.getAttribute('position').count : index.count) / 3;
      };
      const H = CHUNK_HALF, floor = geometry(new Float32Array([-H, FLOOR_Y, -H, H, FLOOR_Y, -H, H, FLOOR_Y, H, -H, FLOOR_Y, H]), {}, new Uint32Array([0, 2, 1, 0, 3, 2]));
      const floorMesh = new Mesh(floor, floorMaterial); floorMesh.name = 'grid-open-plot-floor'; add(floorMesh);
      const solid = new Mesh(geometry(g.solid.positions, { color: [g.solid.colours, 3] }, g.solid.indices), solidMaterial); solid.name = 'grid-open-plot-solid'; add(solid);
      const wire = new LineSegments(geometry(g.lines, {}), lines); wire.name = 'grid-open-plot-lines'; add(wire);
      if (pictureMaterial !== null) { const m = new Mesh(geometry(g.pictures.positions, { uv: [g.pictures.uvs, 2] }, g.pictures.indices), pictureMaterial); m.name = 'grid-open-plot-billboards'; add(m); }
      if (textMaterial !== null) { const m = new Mesh(geometry(g.text.positions, { uv: [g.text.uvs, 2] }, g.text.indices), textMaterial); m.name = 'grid-open-plot-signs'; add(m); }
      // the centrepiece's turning hologram: its own group, rotated about y each step while the plot is visible
      const holoGroup = new Group(); holoGroup.name = 'grid-open-plot-hologram'; group.add(holoGroup);
      const holoLines = new LineSegments(geometry(g.holoLines, {}), holo); holoLines.name = 'grid-open-plot-holo-lines'; add(holoLines, holoGroup);
      if (cards !== null) { const m = new Mesh(geometry(g.holoCards.positions, { uv: [g.holoCards.uvs, 2] }, g.holoCards.indices), cards); m.name = 'grid-open-plot-holo-cards'; add(m, holoGroup); }
      const scanMesh = new Mesh(scanGeometry, scan); scanMesh.name = 'grid-open-plot-scan'; scanMesh.scale.set(g.scan.half * 2, 1, g.scan.half * 2); scanMesh.position.y = g.scan.low;
      scanMesh.castShadow = false; holoGroup.add(scanMesh); draws++;
      group.updateMatrixWorld(true);
      input.scene.add(group);
      groups.push({ group, holo: holoGroup, scan: scanMesh, plot, geometry: g });
    }
  };
  if (input.admission === undefined) build(input.scope); else input.admission.allocate(plan, build);
  const step = (dt: number): void => {
    t += dt;
    const feet = input.feet();
    let any = false;
    for (const row of groups) {
      const x = row.plot.origin.x - home.origin.x, z = row.plot.origin.z - home.origin.z;
      const distance = Math.hypot(Math.max(0, Math.abs(feet.x - x) - CHUNK_HALF), Math.max(0, Math.abs(feet.z - z) - CHUNK_HALF));
      const visible = distance <= VISIBLE;
      if (row.group.visible !== visible) row.group.visible = visible;
      if (!visible) continue;
      any = true;
      row.holo.rotation.y = t * 0.12;
      const k = 0.5 + 0.5 * Math.sin(t * 0.35);
      row.scan.position.y = row.geometry.scan.low + (row.geometry.scan.high - row.geometry.scan.low) * k;
      row.holo.updateMatrixWorld(true);
    }
    if (any) {
      if (holoMaterial !== null) holoMaterial.opacity = 0.7 + 0.2 * Math.sin(t * 2.1);
      if (lineMaterial !== null) lineMaterial.opacity = 0.72 + 0.1 * Math.sin(t * 1.3 + 1);
      if (cardMaterial !== null) cardMaterial.opacity = 0.84 + 0.08 * Math.sin(t * 1.7);
      if (scanMaterial !== null) scanMaterial.opacity = 0.12 + 0.06 * Math.sin(t * 3.1);
    }
  };
  return { step, state: () => ({ plots: groups.map((row) => ({ instance: row.plot.instance, visible: row.group.visible, entries: row.geometry.entries })), pictures: decoded, draws, triangles }) };
}
