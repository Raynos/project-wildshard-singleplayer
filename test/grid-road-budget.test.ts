import { expect, it } from 'vitest';
import { Group, Mesh, MeshBasicMaterial, PerspectiveCamera } from 'three';
import { generatePlatform, type PlatformCell, type StripProfile } from '../src/engine/sim/strips';
import { GridAssembly } from '../src/game/grid/assembly';
import { roadLayout } from '../src/game/grid/roadLayout';
import { installRoadLook } from '../src/game/grid/roadLook';
import { installVoidLook } from '../src/game/grid/voidLook';
import { seamSolid } from '../src/game/grid/seamLook';
import { solidGeometry, type SolidPart } from '../src/game/grid/roadSolid';
import { cullPlan, cullRoadMesh, ROAD_LOD, roadResident, roadViewCost, type CullPlan } from '../src/game/grid/roadCull';

// The road look paints canvases; Node has none, so a do-nothing 2D context stands in (the geometry is what is measured).
const noop = (): unknown => new Proxy(() => undefined, { get: (_t, key) => (key === 'width' ? 0 : key === 'data' ? new Uint8ClampedArray(4 * 256 * 256) : noop()), apply: () => noop() });
Object.assign(globalThis, { document: { createElement: () => ({ width: 0, height: 0, getContext: () => noop() }) } });

/** A rough real-ish platform: every cell edge a smooth height wave with a cliff run, entries at road height (G93). */
function platform(assembly: GridAssembly): PlatformCell[] {
  const edge = (seed: number): StripProfile => ({
    heights: Array.from({ length: 257 }, (_, i) => (Math.abs(i - 128) <= 6 ? 0 : 3 * Math.sin(i / 9 + seed) + (i > 180 && i < 220 ? 9 : 0))),
    colours: Array.from({ length: 257 }, (_, i) => [0.3 + 0.1 * Math.sin(i / 5 + seed), 0.4, 0.2]), roadHeight: 0,
  });
  return assembly.cells.map((cell, k) => ({ instance: cell.instance, cell: cell.cell, origin: { x: cell.origin.x, z: cell.origin.z },
    edges: { north: edge(k), east: edge(k + 1), south: edge(k + 2), west: edge(k + 3) },
    observations: { north: { entryWidth: 8 }, east: { entryWidth: 8 }, south: { entryWidth: 8 }, west: { entryWidth: 8 } } }));
}

function build(): { roots: Group[]; plans: Map<Mesh, CullPlan>; culled: Mesh[] } {
  const assembly = new GridAssembly({ developer: false, devserver: false }), home = assembly.cell(assembly.cells.find((c) => c.cell[0] === 0 && c.cell[1] === 0)?.instance ?? '');
  const empty = assembly.emptyNeighbour.edge, cells = platform(assembly);
  // corners must agree between edges: fall back to road-level edges where the synthetic rows disagree (as the session does)
  let strips;
  try { strips = generatePlatform(cells, empty); } catch { const flat = { north: empty, east: empty, south: empty, west: empty }; strips = generatePlatform(cells.map((c): PlatformCell => ({ instance: c.instance, cell: c.cell, origin: c.origin, edges: flat })), empty); }
  const scene = new Group(), scope = { onDispose: () => undefined }, parts: SolidPart[] = [], plans = new Map<Mesh, CullPlan>(), culled: Mesh[] = [];
  const seams = seamSolid(strips, home, undefined, assembly.pitch);
  parts.push(...seams.parts);
  const cull = (mesh: Mesh): void => { plans.set(mesh, cullRoadMesh(mesh, assembly.pitch, undefined, mesh.name === 'grid-deck' ? ROAD_LOD : []).plan); culled.push(mesh); };
  const layout = roadLayout(assembly, (slug) => slug);
  installRoadLook({ layout, home, scene, scope, solid: (p) => { parts.push(p); }, cull });
  installVoidLook({ rail: layout.rail, home, scene, scope, solid: (p) => { parts.push(p); } });
  const deck = new Mesh(solidGeometry(parts), new MeshBasicMaterial()), curtain = new Mesh(seams.curtain, new MeshBasicMaterial());
  deck.name = 'grid-deck'; curtain.name = 'grid-seam-curtain';
  scene.add(deck, curtain); cull(deck); cull(curtain);
  return { roots: [scene], plans, culled };
}

it('keeps every road bin compact so frustum culling can drop it (no triangle spans a whole platform side)', () => {
  const { plans } = build();
  const widest = Math.max(...[...plans.values()].flatMap((p) => p.bins.map((b) => b.sphere.radius)));
  expect(widest).toBeLessThan(260);
});

it('draws the road system within §3.2 from every grid pose: ≤ 8 draws with shadows, ≤ 60k triangles', () => {
  const { roots, plans } = build();
  const resident = roadResident(roots, plans);
  expect(resident.triangles).toBeGreaterThan(10_000);
  const camera = new PerspectiveCamera(72, 1206 / 2622, 0.08, 2600); // the phone's portrait view, the game's far plane
  let worst = { draws: 0, triangles: 0 };
  const views: number[] = [];
  const poses = [[277.5, 277.5], [277.5, 0], [832.5, 0], [832.5, 832.5], [277.5, -240], [0, 0]] as const;
  for (const [x, z] of poses) for (let k = 0; k < 16; k++) {
    camera.position.set(x, 1.7 + 1.5, z); camera.rotation.set(-0.08, k * Math.PI / 8, 0, 'YXZ'); camera.updateMatrixWorld();
    const view = roadViewCost(roots, camera, plans);
    worst = { draws: Math.max(worst.draws, view.draws), triangles: Math.max(worst.triangles, view.triangles) }; views.push(view.triangles);
    expect(view.shadowDraws).toBe(0);
  }
  expect(worst.draws).toBeLessThanOrEqual(6); // solid, asphalt, junctions, signs, curtain, void floor
  // culling plus the far-bin LOD (the deck's clustered copies past 150 m and 450 m): every view within the 60k target
  views.sort((a, b) => a - b);
  expect(views[Math.floor(views.length / 2)] ?? Infinity).toBeLessThan(resident.triangles / 4);
  expect(worst.triangles).toBeLessThanOrEqual(60_000);
});

it('a culled mesh draws one contiguous range of only the bins in view, re-uploaded only when the set changes', () => {
  const { culled } = build();
  const deck = culled.find((m) => m.name === 'grid-deck');
  if (deck === undefined) throw new Error('no deck');
  const full = cullPlan(deck.geometry, 555).source.length, camera = new PerspectiveCamera(60, 0.46, 0.1, 2600);
  camera.position.set(277.5, 3, 0); camera.rotation.set(0, 0, 0); camera.updateMatrixWorld();
  const hook = deck.onBeforeRender.bind(deck), index = deck.geometry.getIndex();
  // three passes (renderer, scene, camera, geometry, material, group); the hook reads only the camera
  const call = (): void => { Reflect.apply(hook, deck, [null, null, camera, deck.geometry, deck.material, null]); };
  call();
  const first = deck.geometry.drawRange.count, version = index?.version ?? 0;
  expect(first).toBeGreaterThan(0); expect(first).toBeLessThan(full);
  call();
  expect(index?.version).toBe(version); // the same view: no upload
});
