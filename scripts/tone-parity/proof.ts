/**
 * Tone parity (D203 / D204 / D205): an engine graph preset against the family GLSL it ports, on fixed inputs, per channel.
 * Each case is one family material entry drawn twice through `clientMaterials`, as a shard draws it: as its family (the
 * patched classic program) and as `{ family: 'graph', preset }` (the engine's preset graph). Both draw on the same sphere
 * and the same shadowed floor, under one fixed sun, hemisphere and shadow map, unfogged and untoned, into a float
 * target. Every sample is a known normal (an orthographic sphere), so a row is N·L, the family's linear RGB, the graph's,
 * and graph / family per channel: where the two light models part (the shade band, the terminator, the lit band, the
 * cast shadow) reads off the rows. `window.toneParity` holds the result.
 */
import { BoxGeometry, BufferAttribute, Color, DirectionalLight, FloatType, HemisphereLight, Mesh, PCFShadowMap, PerspectiveCamera, PlaneGeometry, RGBAFormat, Scene, SphereGeometry, Vector3, WebGLRenderer, WebGLRenderTarget, type BufferGeometry, type Material } from 'three';
import { Scope } from '../../src/engine/app/scope';
import { clientMaterials } from '../../src/game/shardfile/clientMaterials';
import { emptyShardfile } from '../../src/sdk/author';
import { GRAPH_PRESET_VERSION, parseFamilyMaterial } from '../../src/format/materialFamilies';

interface ToneCase { readonly name: string; readonly entry: Readonly<Record<string, unknown>>; readonly looks: Readonly<Record<string, unknown>>; readonly hemi?: number }
interface ToneRow { readonly at: string; readonly ndl: number; readonly family: number[]; readonly graph: number[]; readonly ratio: number[] }

/** The cases: each family at its defaults, and at the look values its shard's damage row names. */
const CASES: readonly ToneCase[] = [
  { name: 'painterly-defaults', entry: { family: 'painterly', colour: [0.62, 0.58, 0.52] }, looks: {} },
  { name: 'painterly-ungraded', entry: { family: 'painterly', colour: [0.62, 0.58, 0.52] }, looks: { painterly: { grade: null } } },
  { name: 'painterly-no-hemi', entry: { family: 'painterly', colour: [0.62, 0.58, 0.52] }, looks: {}, hemi: 0 },
  { name: 'painterly-rim0', entry: { family: 'painterly', colour: [0.62, 0.58, 0.52], rim: 0 }, looks: {} },
  { name: 'painterly-shade0', entry: { family: 'painterly', colour: [0.62, 0.58, 0.52], shade: 0 }, looks: {} },
  { name: 'painterly-floor0', entry: { family: 'painterly', colour: [0.62, 0.58, 0.52], floor: 0 }, looks: {} },
  { name: 'painterly-bands0', entry: { family: 'painterly', colour: [0.62, 0.58, 0.52], bands: 0 }, looks: {} },
  { name: 'painterly-rim-only', entry: { family: 'painterly', colour: [0, 0, 0], rim: 1, shade: 0, floor: 0, bands: 0 }, looks: { painterly: { rim: [3, 3, 3], grade: null, warm: 0 } }, hemi: 0 },
  { name: 'toon-defaults', entry: { family: 'toon', colour: [0.6, 0.45, 0.3], faceted: false }, looks: {} },
  { name: 'toon-no-cloud', entry: { family: 'toon', colour: [0.6, 0.45, 0.3], faceted: false }, looks: { toon: { cloudShade: { strength: 0, scale: 60, wind: [0, 0] } } } },
];

const SIZE = 256, SUN = new Vector3(0.55, 0.62, 0.56).normalize();

/** white vertex colours: both programs multiply them in */
function coloured(geometry: BufferGeometry): BufferGeometry {
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 3).fill(1), 3));
  return geometry;
}

async function prove(): Promise<unknown> {
  const canvas = document.getElementById('proof');
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Missing tone canvas');
  const renderer = new WebGLRenderer({ canvas, antialias: false });
  renderer.setSize(SIZE, SIZE, false); renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFShadowMap;
  const target = new WebGLRenderTarget(SIZE, SIZE, { type: FloatType, format: RGBAFormat });
  const scope = new Scope('tone-parity');
  // perspective, as the game: an orthographic camera's TSL view direction is the view axis, the classic chunks' the
  // direction to the eye, so a grazing rim would part on the camera alone
  const camera = new PerspectiveCamera(28, 1, 0.1, 20); camera.position.set(0, 0, 5); camera.lookAt(0, 0, 0);
  // the floor view: straight down on a lit floor with a box's shadow across it
  const floorCamera = new PerspectiveCamera(24, 1, 0.1, 40); floorCamera.position.set(0, 10, 0); floorCamera.up.set(0, 0, -1); floorCamera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(); floorCamera.updateMatrixWorld();
  /** a world point's pixel in the target (bottom-left origin, as readRenderTargetPixels reads) */
  const pixel = (at: Vector3, cam: PerspectiveCamera): [number, number] => { const p = at.clone().project(cam); return [Math.round((p.x * 0.5 + 0.5) * SIZE), Math.round((p.y * 0.5 + 0.5) * SIZE)]; };
  const results: Record<string, unknown> = {};
  try {
    for (const c of CASES) {
      const source = emptyShardfile({ slug: 'tone-parity', name: 'Tone parity', author: 'proof', seed: 1, revision: 1 });
      Object.assign(source.look.familyLooks, c.looks);
      const entry = parseFamilyMaterial(c.entry);
      Object.assign(source.look.materials, { family: entry, graph: { family: 'graph', preset: entry, version: GRAPH_PRESET_VERSION } });
      const client = await clientMaterials(source, new Map(), renderer, scope, { graphs: true });
      const pick = (id: string): Material => { const m = client.materials.get(id); if (m === undefined) throw new Error(`Missing ${id} material`); return m; };
      const rows: ToneRow[] = [];
      const read = (x: number, y: number): number[] => { const px = new Float32Array(4); renderer.readRenderTargetPixels(target, x, y, 1, 1, px); return Array.from(px.slice(0, 3), (v) => Math.round(v * 10000) / 10000); };
      const ratio = (a: number[], b: number[]): number[] => a.map((v, i) => Math.round(((b[i] ?? 0) / Math.max(v, 1e-5)) * 1000) / 1000);
      const draw = (scene: Scene, cam: PerspectiveCamera): void => { client.tick(0); renderer.setRenderTarget(target); renderer.clear(); renderer.render(scene, cam); renderer.setRenderTarget(null); };
      const lights = (scene: Scene): void => {
        const sun = new DirectionalLight(new Color(1, 0.94, 0.86), 2.8); sun.position.copy(SUN).multiplyScalar(10); sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 30 }); sun.shadow.camera.updateProjectionMatrix();
        scene.add(sun, sun.target, new HemisphereLight(new Color(0.55, 0.66, 0.85), new Color(0.32, 0.28, 0.22), 1.1 * (c.hemi ?? 1)));
      };
      // the sphere: N·L across its face
      const sphereRows = new Map<string, number[]>();
      for (const id of ['family', 'graph']) {
        const scene = new Scene(); lights(scene);
        scene.add(new Mesh(scope.own(coloured(new SphereGeometry(1, 128, 64))), pick(id)));
        draw(scene, camera);
        for (let gy = -3; gy <= 3; gy++) for (let gx = -3; gx <= 3; gx++) {
          const nx = gx * 0.3, ny = gy * 0.3, r2 = nx * nx + ny * ny; if (r2 > 0.92) continue;
          const n = new Vector3(nx, ny, Math.sqrt(1 - r2)), [px, py] = pixel(n, camera);
          sphereRows.set(`${id}:${gx},${gy}`, [n.dot(SUN), ...read(px, py)]);
        }
      }
      for (const [key, fam] of sphereRows) {
        if (!key.startsWith('family:')) continue;
        const at = key.slice(7), gr = sphereRows.get(`graph:${at}`); if (gr === undefined) continue;
        const f = fam.slice(1), g = gr.slice(1);
        rows.push({ at: `sphere ${at}`, ndl: Math.round((fam[0] ?? 0) * 1000) / 1000, family: f, graph: g, ratio: ratio(f, g) });
      }
      // the floor: lit, and in the box's cast shadow
      const floorRows = new Map<string, number[]>();
      for (const id of ['family', 'graph']) {
        const scene = new Scene(); lights(scene);
        const floor = new Mesh(scope.own(coloured(new PlaneGeometry(4, 4, 8, 8))), pick(id)); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
        const box = new Mesh(scope.own(coloured(new BoxGeometry(0.6, 3, 0.6))), pick(id)); box.position.set(0, 1.5, 0); box.castShadow = true; box.receiveShadow = true;
        scene.add(floor, box);
        draw(scene, floorCamera);
        // the shadow falls away from the sun: sample along -SUN's xz, and the lit floor on the sun's side
        const away = new Vector3(-SUN.x, 0, -SUN.z).normalize();
        const [sx, sy] = pixel(away.clone().multiplyScalar(1.2), floorCamera), [lx, ly] = pixel(away.clone().multiplyScalar(-1.2), floorCamera);
        floorRows.set(`${id}:shadow`, read(sx, sy)); floorRows.set(`${id}:lit`, read(lx, ly));
      }
      for (const at of ['lit', 'shadow']) {
        const f = floorRows.get(`family:${at}`) ?? [], g = floorRows.get(`graph:${at}`) ?? [];
        rows.push({ at: `floor ${at}`, ndl: Math.round(SUN.y * 1000) / 1000, family: f, graph: g, ratio: ratio(f, g) });
      }
      results[c.name] = { looks: c.looks, entry: c.entry, rows, materials: { family: pick('family').type, graph: pick('graph').type } };
    }
    return { pass: true, sun: SUN.toArray(), results };
  } finally { scope.dispose(); target.dispose(); }
}

let result: unknown;
try { result = await prove(); }
catch (error: unknown) { result = { pass: false, error: error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error) }; }
Reflect.set(window, 'toneParity', result);
