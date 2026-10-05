import { expect, it } from 'vitest';
import { BufferAttribute, type BufferGeometry, DataArrayTexture, Group, Mesh, type Material, type Object3D, Texture } from 'three';
import { Scope } from '../src/engine/app/scope';
import { generatePlatform, type GeneratedStrip, type PlatformCell } from '../src/engine/sim/strips';
import { GridAssembly } from '../src/game/grid/assembly';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { PageResidency } from '../src/game/grid/pageResidency';
import { runtimeAccountedBytes } from '../src/game/grid/runtimeCost';
import { DRIFTWOOD_RUNTIME_COST } from '../src/shards/driftwood-isle/data/runtimeCost';
import { loadGridEdgeProfiles } from '../src/game/grid/edgeProfiles';
import { readGridEdges } from '../src/game/grid/edgeSources';
import { PlatformRenderAdmissionError, PlatformRenderResidency, type PlatformRenderAdmission, type PlatformRenderBytePlan } from '../src/game/grid/renderResidency';
import { roadLayout } from '../src/game/grid/roadLayout';
import { installPlatformRoad } from '../src/game/grid/roadLookPlatform';
import { installRoadLook } from '../src/game/grid/roadLook';
import { installVoidLook } from '../src/game/grid/voidLook';
import { gravel, riprap, seamSolid, stone, strata } from '../src/game/grid/seamLook';
import { grainArray, solidGeometry, type SolidPart } from '../src/game/grid/roadSolid';
import { cullRoadMesh, gpuOnlyRoad, ROAD_LOD, type CullPlan } from '../src/game/grid/roadCull';
import templateBake from '../public/assets/baked/_template/terrain.bin?inline';
import driftwoodBake from '../public/assets/baked/driftwood-isle/terrain.bin?inline';
import pineBake from '../public/assets/baked/pine-hollow/terrain.bin?inline';
import nalatiBake from '../public/assets/baked/nalati-grasslands/terrain.bin?inline';

// The road look paints canvases; Node has none, so a do-nothing 2D context stands in (sizes and geometry are what is measured).
const noop = (): unknown => new Proxy(() => undefined, { get: (_t, key) => (key === 'width' ? 0 : key === 'data' ? new Uint8ClampedArray(4 * 256 * 256) : noop()), apply: () => noop() });
// It is an HTMLCanvasElement as far as `gpuOnlyTexture` asks, so an admitted canvas really shrinks to a pixel on upload.
class StubCanvas { width = 0; height = 0; getContext(): unknown { return noop(); } }
Object.assign(globalThis, { HTMLCanvasElement: StubCanvas, document: { createElement: () => new StubCanvas() } });

/** The real 3 × 3 platform: the shipped catalogue, every cell's edge rows read from its own baked terrain (as the session's
 *  legacy reader does), the session's fallbacks. */
async function realPlatform(): Promise<{ assembly: GridAssembly; strips: readonly GeneratedStrip[] }> {
  const assembly = new GridAssembly({ developer: false, devserver: false }), empty = assembly.emptyNeighbour.edge;
  const bakes: Readonly<Record<string, string>> = { '_template': templateBake, 'driftwood-isle': driftwoodBake, 'pine-hollow': pineBake, 'nalati-grasslands': nalatiBake };
  const fetchPublic = (url: string): Promise<Response> => {
    const bake = bakes[/\/assets\/baked\/([^/]+)\/terrain\.bin/u.exec(url)?.[1] ?? ''];
    return bake === undefined ? Promise.resolve(new Response(null, { status: 404 })) : fetch(bake);
  };
  const edges = await loadGridEdgeProfiles(assembly.cells, async (cell) => {
    try { return await readGridEdges(cell, { product: () => null, fetch: fetchPublic }); } catch {
      const closed = { entryWidth: 0 };
      return { kind: 'declared', profiles: { north: empty, east: empty, south: empty, west: empty }, observations: { north: closed, east: closed, south: closed, west: closed } };
    }
  });
  const flat = assembly.cells.map((cell): PlatformCell => ({ instance: cell.instance, cell: cell.cell, origin: { x: cell.origin.x, z: cell.origin.z }, edges: { north: empty, east: empty, south: empty, west: empty } }));
  let strips: readonly GeneratedStrip[];
  try { strips = generatePlatform(edges, empty); } catch { strips = generatePlatform(flat, empty); }
  return { assembly, strips };
}

/** Texels of a full mip chain, counted level by level (WebGL2's texStorage allocation). */
function chain(w: number, h: number): number { let n = 0; for (let level = 0; level <= Math.floor(Math.log2(Math.max(w, h))); level++) n += Math.max(1, w >> level) * Math.max(1, h >> level); return n; }
const mapOf = (material: Material | Material[]): { image: { width: number; height: number } } | null => {
  const m = Array.isArray(material) ? material[0] : material;
  return m !== undefined && 'map' in m && m.map !== null && typeof m.map === 'object' && 'image' in m.map ? m.map as { image: { width: number; height: number } } : null;
};
/** What a built mesh really holds once drawn: every attribute and index array as uploaded to the GPU, and what stays on the
 *  CPU after three's upload hooks ran (an admitted mesh lets its vertex arrays and canvas go, `gpuOnlyRoad`), the cull's
 *  sorted source (CPU only), and its canvas (backing store on the CPU, every mip level on the GPU). */
function measured(mesh: Mesh, plan: CullPlan | undefined): { jsBytes: number; gpuBytes: number } {
  const geometry: BufferGeometry = mesh.geometry, arrays = (): number => {
    let n = 0;
    for (const name of Object.keys(geometry.attributes)) n += geometry.getAttribute(name).array.byteLength;
    return n + (geometry.getIndex()?.array.byteLength ?? 0);
  };
  const map = mapOf(mesh.material), w = map?.image.width ?? 0, h = map?.image.height ?? 0, gpu = arrays();
  uploaded(mesh);
  const left = mapOf(mesh.material), lw = left?.image.width ?? 0, lh = left?.image.height ?? 0;
  return { jsBytes: arrays() + (plan?.source.byteLength ?? 0) + lw * lh * 4, gpuBytes: gpu + (map === null ? 0 : chain(w, h) * 4) };
}
const isTexture = (v: unknown): v is Texture => v instanceof Texture;
/** three's first upload of a mesh: each attribute's (and the index's) onUpload hook, each map's onUpdate */
function uploaded(mesh: Mesh): void {
  const geometry: BufferGeometry = mesh.geometry;
  for (const a of [...Object.values(geometry.attributes), geometry.getIndex()]) if (a instanceof BufferAttribute) a.onUploadCallback();
  for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
    const map: unknown = 'map' in m ? m.map : null;
    if (isTexture(map)) map.onUpdate?.(map);
  }
}
const ID_OF: Readonly<Record<string, string>> = { 'grid-asphalt': 'road.asphalt', 'grid-junctions': 'road.junctions', 'grid-signs': 'road.signs', 'grid-void-floor': 'road.void', 'grid-deck': 'road.deck', 'grid-seam-curtain': 'road.curtain' };
const isMesh = (o: Object3D): o is Mesh => o instanceof Mesh;
const meshesOf = (roots: readonly Object3D[]): Mesh[] => { const out: Mesh[] = []; for (const r of roots) r.traverse((o) => { if (isMesh(o)) out.push(o); }); return out; };
const digest = (mesh: Mesh): string => {
  const g: BufferGeometry = mesh.geometry, parts = Object.keys(g.attributes).sort().map((n) => `${n}:${Array.from(g.getAttribute(n).array).join(',')}`);
  return `${mesh.name}|${parts.join('|')}|index:${Array.from(g.getIndex()?.array ?? []).join(',')}|range:${String(g.drawRange.start)},${String(g.drawRange.count)}`;
};

let platform: Promise<Awaited<ReturnType<typeof realPlatform>>> | undefined;
const real = (): Promise<Awaited<ReturnType<typeof realPlatform>>> => { platform ??= realPlatform(); return platform; };
const NO_SCOPE = { onDispose: (): void => undefined };
function install(assembly: GridAssembly, strips: readonly GeneratedStrip[], admission?: PlatformRenderAdmission, scope: { onDispose: (fn: () => void) => void } = NO_SCOPE) {
  const home = assembly.cell(assembly.cells.find((c) => c.cell[0] === 0 && c.cell[1] === 0)?.instance ?? ''), scene = new Group(), plans = new Map<Mesh, CullPlan>();
  const layout = roadLayout(assembly, (slug) => slug);
  const road = installPlatformRoad({ strips, home, pitch: assembly.pitch, layout, scene, scope, plans, ...(admission === undefined ? {} : { admission }) });
  return { scene, plans, road, home, layout };
}
const SLOW = 180_000;

it('plans exactly the bytes every platform render builder allocates on the real 3 x 3 platform (G144)', async () => {
  const { assembly, strips } = await real(), scope = new Scope('road-bytes'), allocator = new ResidencyAllocator(), residency = new PlatformRenderResidency(allocator, scope);
  const seen: PlatformRenderBytePlan[] = [];
  const admission: PlatformRenderAdmission = { allocate: (plan, build) => { seen.push(plan); return residency.allocate(plan, build); } };
  try {
    const { road, plans } = install(assembly, strips, admission, scope);
    expect(seen.map((p) => p.id)).toEqual(['road.asphalt', 'road.junctions', 'road.signs', 'road.void', 'road.deck', 'road.curtain']);
    const grain = grainArray({ gravel, stone, strata, riprap });
    if (!(grain instanceof DataArrayTexture)) throw new Error('grain');
    const { width: gw, height: gh, depth: layers } = grain.image;
    // admitted, the deck hands its grain to `gpuOnlyRoad`: the array goes on upload (this probe copy shows it emptying)
    expect(grain.image.data?.byteLength ?? 0).toBeGreaterThan(0);
    gpuOnlyRoad(new Mesh(), [grain]); grain.onUpdate?.(grain);
    const grainBytes = { jsBytes: grain.image.data?.byteLength ?? 0, gpuBytes: chain(gw, gh) * 4 * layers };
    expect(grainBytes.jsBytes).toBe(0);
    const meshes = meshesOf(road.roots);
    expect(meshes.map((m) => m.name).sort()).toEqual(Object.keys(ID_OF).sort());
    for (const mesh of meshes) {
      const plan = seen.find((p) => p.id === ID_OF[mesh.name]), actual = measured(mesh, plans.get(mesh));
      const total = mesh.name === 'grid-deck' ? { jsBytes: actual.jsBytes + grainBytes.jsBytes, gpuBytes: actual.gpuBytes + grainBytes.gpuBytes } : actual;
      expect({ id: plan?.id, jsBytes: plan?.jsBytes, gpuBytes: plan?.gpuBytes }).toEqual({ id: ID_OF[mesh.name], ...total });
    }
    // every claim is held under its own id with the plan's bytes, and released after the resources on teardown
    expect(allocator.entries().map((e) => [e.id, e.bytes])).toEqual(seen.map((p) => [`platform:render:${p.id}`, p.jsBytes + p.gpuBytes]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
    // the culled meshes really clipped and the deck really carries its far LOD copies (the plan is not trivially the raw counts)
    const deck = meshes.find((m) => m.name === 'grid-deck'), deckPlan = deck === undefined ? undefined : plans.get(deck);
    expect(deckPlan?.bins.some((b) => b.levels.some((l) => l.count > 0))).toBe(true);
    // the real bakes' edges reach the platform: their cliffs raise road walls, so the curtain is not empty
    expect(meshes.find((m) => m.name === 'grid-seam-curtain')?.geometry.getAttribute('position').count ?? 0).toBeGreaterThan(0);
  } finally { scope.dispose(); }
  expect(allocator.entries()).toEqual([]);
}, SLOW);

it('builds the same bytes with the row OFF (no admission), with it ON, and through the pre-G144 hook path', async () => {
  const { assembly, strips } = await real(), scope = new Scope('road-bytes-identical');
  try {
    const off = install(assembly, strips), on = install(assembly, strips, new PlatformRenderResidency(new ResidencyAllocator(), scope), scope);
    // the pre-G144 composition (session.ts before installPlatformRoad): seamSolid, the bare cull hook, the deck built by hand
    const scene = new Group(), parts: SolidPart[] = [], plans = new Map<Mesh, CullPlan>(), lifetime = { onDispose: () => undefined };
    const cull = (mesh: Mesh): void => { plans.set(mesh, cullRoadMesh(mesh, assembly.pitch, undefined, mesh.name === 'grid-deck' ? ROAD_LOD : []).plan); };
    const seams = seamSolid(strips, off.home, undefined, assembly.pitch); parts.push(...seams.parts);
    installRoadLook({ layout: off.layout, home: off.home, scene, scope: lifetime, solid: (p) => { parts.push(p); }, cull });
    installVoidLook({ rail: off.layout.rail, home: off.home, scene, scope: lifetime, solid: (p) => { parts.push(p); } });
    const deck = new Mesh(solidGeometry(parts)), curtain = new Mesh(seams.curtain);
    deck.name = 'grid-deck'; curtain.name = 'grid-seam-curtain'; scene.add(deck, curtain); cull(deck); cull(curtain);
    const legacy = meshesOf([scene]).map(digest).sort(), offDigest = meshesOf(off.road.roots).map(digest).sort();
    expect(offDigest).toEqual(legacy);
    expect(meshesOf(on.road.roots).map(digest).sort()).toEqual(offDigest);
    expect(on.road.road).toEqual(off.road.road); expect(on.road.seams).toEqual(off.road.seams);
    const sources = (p: Map<Mesh, CullPlan>): string[] => [...p].map(([m, plan]) => `${m.name}:${Array.from(plan.source).join(',')}`).sort();
    expect(sources(on.plans)).toEqual(sources(off.plans)); expect(sources(off.plans)).toEqual(sources(plans));
  } finally { scope.dispose(); }
}, SLOW);

it('a refused plan never builds, and a refusal part-way disposes what was built before releasing its claims', async () => {
  const { assembly, strips } = await real();
  // nothing fits: the first plan (the asphalt) is refused before any geometry or canvas exists
  const tiny = new Scope('road-refused'), none = new ResidencyAllocator({ playing: 1 });
  let calls = 0;
  const counted = (allocator: ResidencyAllocator, scope: Scope): PlatformRenderAdmission => {
    const inner = new PlatformRenderResidency(allocator, scope);
    return { allocate: (plan, build) => inner.allocate(plan, (owner) => { calls++; return build(owner); }) };
  };
  let thrown: unknown;
  try { install(assembly, strips, counted(none, tiny), tiny); } catch (error) { thrown = error; }
  expect(thrown).toBeInstanceOf(PlatformRenderAdmissionError);
  expect(thrown instanceof PlatformRenderAdmissionError ? thrown.plan.id : '').toBe('road.asphalt');
  expect(calls).toBe(0); expect(none.entries()).toEqual([]);
  tiny.dispose();
  // room for the boulevard and the void but not the deck: four builds, then the deck's refusal; teardown leaves nothing
  const probe = new ResidencyAllocator(), before: number[] = [];
  const probeScope = new Scope('road-probe'), probeInner = new PlatformRenderResidency(probe, probeScope);
  install(assembly, strips, { allocate: (plan, build) => probeInner.allocate(plan, (owner) => { before.push(probe.cost().playing); return build(owner); }) }, probeScope);
  probeScope.dispose();
  const afterVoid = before[3] ?? 0, deckCost = (before[4] ?? 0) - afterVoid;
  expect(deckCost).toBeGreaterThan(0);
  const partScope = new Scope('road-partial'), partial = new ResidencyAllocator({ playing: afterVoid + deckCost / 2 });
  calls = 0; thrown = undefined;
  const scene = new Group(), home = assembly.cell(assembly.cells.find((c) => c.cell[0] === 0 && c.cell[1] === 0)?.instance ?? '');
  try { installPlatformRoad({ strips, home, pitch: assembly.pitch, layout: roadLayout(assembly, (slug) => slug), scene, scope: partScope, plans: new Map(), admission: counted(partial, partScope) }); } catch (error) { thrown = error; }
  expect(thrown instanceof PlatformRenderAdmissionError ? thrown.plan.id : '').toBe('road.deck');
  expect(calls).toBe(4); expect(partial.entries().map((e) => e.id)).toEqual(['platform:render:road.asphalt', 'platform:render:road.junctions', 'platform:render:road.signs', 'platform:render:road.void']);
  expect(meshesOf([scene]).map((m) => m.name).sort()).toEqual(['grid-asphalt', 'grid-junctions', 'grid-signs', 'grid-void-floor']);
  partScope.dispose();
  expect(partial.entries()).toEqual([]); expect(meshesOf([scene])).toEqual([]);
}, SLOW);

it('refuses the real platform before its deck allocation when the measured Driftwood home already occupies the shared envelope', async () => {
  const { assembly, strips } = await real(), scope = new Scope('measured-home-road'), page = new PageResidency();
  const claim = page.admitHome('driftwood-isle', runtimeAccountedBytes(DRIFTWOOD_RUNTIME_COST));
  const baseline = page.allocator.entries(), residency = new PlatformRenderResidency(page.allocator, scope), allocated: string[] = [];
  const admission: PlatformRenderAdmission = { allocate: (plan, build) => residency.allocate(plan, (owner) => {
    allocated.push(plan.id); return build(owner);
  }) };
  let failure: unknown;
  try {
    expect(page.allocator.cost().playing).toBe(969_497_001);
    try { install(assembly, strips, admission, scope); } catch (error) { failure = error; }
    if (!(failure instanceof PlatformRenderAdmissionError)) throw new Error('Expected real platform refusal under measured home cost');
    expect(failure.plan.id).toBe('road.deck');
    expect(allocated).toEqual(['road.asphalt', 'road.junctions', 'road.signs', 'road.void']);
    expect(page.allocator.has('platform:render:road.deck')).toBe(false);
    expect(page.allocator.cost().playing).toBeLessThanOrEqual(1_000_000_000);
    expect(page.home()).toBe(claim);
    scope.dispose(); expect(page.allocator.entries()).toEqual(baseline);
  } finally { scope.dispose(); page.dispose(); }
  expect(page.allocator.entries()).toEqual([]);
}, SLOW);
