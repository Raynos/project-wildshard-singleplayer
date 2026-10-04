// SF23 far view board: the dev-mode 3 × 3 grid (§3.3: Driftwood centre, Pine Hollow north, Nalati east, Sunscar Dunes
// west, Sky Reach south, the template in the corners) drawn by the render rings with only far proxies in the catalogue,
// streamed through the one allocator by the SF23 far ports (the baked far.glb parsed by three's GLTFLoader, region in
// uv.x). A camera on the centre cell turns to each neighbour; scripts/bake/far-board.mjs captures them.
import { BufferGeometry, Color, DirectionalLight, Group, HemisphereLight, Mesh, MeshLambertMaterial, PerspectiveCamera, PlaneGeometry, Scene, WebGLRenderer } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CONTENT_CAPS as C } from '../../../../src/engine/core/config';
import { ResidencyAllocator } from '../../../../src/game/grid/allocator';
import { FAR_RING, farRingCatalogue, type FarLookRuntime } from '../../../../src/game/grid/farProxy';
import { farRingPorts, type FarPrepared } from '../../../../src/game/grid/farView';
import { RenderRings, type RingCell } from '../../../../src/game/grid/rings';
import templateGlb from '../../../../public/assets/baked/_template/far.glb?url';
import template from '../../../../public/assets/baked/_template/far.json';
import driftwoodGlb from '../../../../public/assets/baked/driftwood-isle/far.glb?url';
import driftwood from '../../../../public/assets/baked/driftwood-isle/far.json';
import pineGlb from '../../../../public/assets/baked/pine-hollow/far.glb?url';
import pine from '../../../../public/assets/baked/pine-hollow/far.json';
import nalatiGlb from '../../../../public/assets/baked/nalati-grasslands/far.glb?url';
import nalati from '../../../../public/assets/baked/nalati-grasslands/far.json';
import sunscarGlb from '../../../../public/assets/baked/sunscar-dunes/far.glb?url';
import sunscar from '../../../../public/assets/baked/sunscar-dunes/far.json';
import reachGlb from '../../../../public/assets/baked/far-reach/far.glb?url';
import reach from '../../../../public/assets/baked/far-reach/far.json';

interface FarJson { far: { decoded: number; gpu: number }; look: { family: string; haze: { colour: number[]; near: number; far: number; max: number } } }
const shards: Record<string, { url: string; json: FarJson; label: string }> = {
  '_template': { url: templateGlb, json: template, label: 'Template' }, 'driftwood-isle': { url: driftwoodGlb, json: driftwood, label: 'Driftwood Isle' },
  'pine-hollow': { url: pineGlb, json: pine, label: 'Pine Hollow' }, 'nalati-grasslands': { url: nalatiGlb, json: nalati, label: 'Nalati Grasslands' },
  'sunscar-dunes': { url: sunscarGlb, json: sunscar, label: 'Sunscar Dunes' }, 'far-reach': { url: reachGlb, json: reach, label: 'Sky Reach' },
};
const layout: [number, number, string][] = [[-1, 1, '_template'], [0, 1, 'pine-hollow'], [1, 1, '_template'], [-1, 0, 'sunscar-dunes'], [0, 0, 'driftwood-isle'], [1, 0, 'nalati-grasslands'], [-1, -1, '_template'], [0, -1, 'far-reach'], [1, -1, '_template']];
const look = (json: FarJson): FarLookRuntime => {
  const family = json.look.family === 'toon' || json.look.family === 'painterly' ? json.look.family : 'pbr', [r = 0, g = 0, b = 0] = json.look.haze.colour;
  return { family, haze: { colour: [r, g, b], near: json.look.haze.near, far: json.look.haze.far, max: json.look.haze.max } };
};

const renderer = new WebGLRenderer({ antialias: true }); renderer.setPixelRatio(2); renderer.setSize(innerWidth, innerHeight); document.body.append(renderer.domElement);
const scene = new Scene(), camera = new PerspectiveCamera(55, innerWidth / innerHeight, 1, FAR_RING.drawDistance);
scene.background = new Color(0.62, 0.74, 0.86);
const sun = new DirectionalLight(0xffffff, 2.2); sun.position.set(-400, 600, 300); scene.add(sun, new HemisphereLight(0xd6e6ff, 0x5a5040, 1.1));
// the platform deck (highway + strips) under the grid, the empty-neighbour sea beyond it
const deck = new Mesh(new PlaneGeometry(3 * C.pitch, 3 * C.pitch).rotateX(-Math.PI / 2), new MeshLambertMaterial({ color: 0x55585c })); deck.position.y = -0.4; scene.add(deck);
const sea = new Mesh(new PlaneGeometry(8000, 8000).rotateX(-Math.PI / 2), new MeshLambertMaterial({ color: 0x3d6f86 })); sea.position.y = -1.2; scene.add(sea);

const cells: RingCell[] = [], roots = new Map<string, Group>(), slugOf = new Map<string, string>(), bytes = new Map<string, number>();
for (const [x, z, slug] of layout) {
  const instance = `${slug}@${x},${z}`, origin = { x: x * C.pitch, z: -z * C.pitch }, root = new Group(), json = shards[slug]?.json;
  if (json === undefined) throw new Error(slug);
  // north is +z on the grid; three's camera looks down −z, so the board maps grid north to −z (the default forward)
  root.position.set(origin.x, 0, origin.z); root.updateMatrixWorld(); scene.add(root);
  cells.push({ instance, origin }); roots.set(instance, root); slugOf.set(instance, slug); bytes.set(instance, json.far.decoded + json.far.gpu);
}
const loader = new GLTFLoader();
async function load(instance: string): Promise<FarPrepared> {
  const shard = shards[slugOf.get(instance) ?? ''];
  if (shard === undefined) throw new Error(`unknown ${instance}`);
  const gltf = await loader.loadAsync(shard.url);
  const found: BufferGeometry[] = [];
  gltf.scene.traverse((o) => { if (o instanceof Mesh && o.geometry instanceof BufferGeometry) found.push(o.geometry); });
  const [geometry] = found; if (geometry === undefined || found.length !== 1) throw new Error(`${instance}: expected one far mesh`);
  return { geometry, look: look(shard.json) };
}
const allocator = new ResidencyAllocator(), farBytes = farRingCatalogue(bytes);
const rings = new RenderRings<FarPrepared>(cells, allocator, (instance, level) => farBytes(instance, level), farRingPorts({ root: (i) => roots.get(i) ?? scene, load }), { farCount: FAR_RING.count, viewDistance: FAR_RING.viewDistance, farPrefetch: FAR_RING.farPrefetch, residentCaps: { far: FAR_RING.count } });

const hud = document.getElementById('hud');
const views: Record<string, { label: string; yaw: number }> = {};
for (const [x, z, slug] of layout) if (x !== 0 || z !== 0) views[`${x},${z}`] = { label: `${z > 0 ? 'N' : z < 0 ? 'S' : ''}${x > 0 ? 'E' : x < 0 ? 'W' : ''} · ${shards[slug]?.label ?? slug}`, yaw: Math.atan2(-x, z) };
let view = '0,1';
function frame(): void {
  rings.step({ x: 0, z: 0, vx: 0, vz: 0 });
  const v = views[view]; camera.position.set(0, 32, 0); camera.rotation.set(-0.06, v?.yaw ?? 0, 0, 'YXZ');
  renderer.render(scene, camera);
  if (hud !== null) hud.textContent = `SF23 far view · from the centre (Driftwood) → ${v?.label ?? view}\nfar proxies ${rings.stats().resident.far}/${FAR_RING.count} · far ${(allocator.cost().input.far / 1e6).toFixed(2)} MB · draws ${renderer.info.render.calls}`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
declare global { interface Window { farView: { ready: () => boolean; show: (key: string) => void; views: () => string[]; stats: () => { far: number; farMB: number; draws: number } } } }
window.farView = {
  ready: () => rings.ready() && rings.stats().resident.far === cells.length,
  show: (key) => { view = key; },
  views: () => Object.keys(views),
  stats: () => ({ far: rings.stats().resident.far, farMB: allocator.cost().input.far / 1e6, draws: renderer.info.render.calls }),
};
