// Reproducible decision-data probe: run against the same clean source tree as the measured preview.
// node --experimental-transform-types --import <tree>/scripts/bake-loader.mjs <probe> --tree=<tree> --input=<measurement.json> --out=<model.json>
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const flag = name => { const arg = process.argv.find(v => v.startsWith(`--${name}=`)); if (arg === undefined) throw Error(`Missing ${name}`); return arg.slice(name.length + 3); };
const tree = resolve(flag('tree')), measurement = JSON.parse(readFileSync(flag('input'), 'utf8'));
const load = path => import(pathToFileURL(join(tree, path)).href);
const read = path => JSON.parse(readFileSync(join(tree, path), 'utf8'));
const fromTree = createRequire(join(tree, 'package.json'));
assert.ok(['off', 'on'].includes(measurement.hybrid));
assert.ok(Number.isFinite(measurement.webContentMB) && measurement.webContentMB > 0);
assert.ok(Number.isFinite(measurement.glMB) && measurement.glMB > 0);
const noop = () => new Proxy(() => undefined, { get: (_t, key) => key === 'width' ? 0 : key === 'data' ? new Uint8ClampedArray(4 * 256 * 256) : noop(), apply: () => noop() });
class StubCanvas { width = 0; height = 0; getContext() { return noop(); } }
Object.assign(globalThis, { HTMLCanvasElement: StubCanvas, document: { createElement: () => new StubCanvas() } });
const [{ Group }, { Scope }, { CONTENT_CAPS }, { ResidencyAllocator }, { runtimeAccountedBytes }, { GridAssembly }, { generatePlatform }, { loadGridEdgeProfiles }, { readGridEdges }, { installPlatformRoad }, { roadLayout }, { RenderRings }, { clientRingCatalogue }, { jsonResidentBytes, productResidentBytes }, { leaseClientLibrary }, { default: template }, { findShard }, { jsonSlot }] = await Promise.all([
 import(pathToFileURL(join(dirname(fromTree.resolve('three')), 'three.module.js')).href), load('src/engine/app/scope.ts'), load('src/engine/core/config.ts'), load('src/game/grid/allocator.ts'), load('src/game/grid/runtimeCost.ts'),
 load('src/game/grid/assembly.ts'), load('src/engine/sim/strips.ts'), load('src/game/grid/edgeProfiles.ts'), load('src/game/grid/edgeSources.ts'),
 load('src/game/grid/roadLookPlatform.ts'), load('src/game/grid/roadLayout.ts'), load('src/game/grid/rings.ts'), load('src/game/shardfile/clientRings.ts'),
 load('src/game/shardfile/productCost.ts'), load('src/game/shardfile/clientLibrary.ts'), load('src/shards/_template/shard.config.ts'),
 load('src/game/shard/registry.ts'), load('src/engine/saves/slots.ts'),
]);
jsonSlot('debug.plugin.driftwood-isle.driftwoodHybrid', 'device').write(measurement.hybrid);
const { declaredSeaLevel } = await load('src/shards/driftwood-isle/world/sea.ts');
assert.equal(declaredSeaLevel(), measurement.hybrid === 'on' ? 0 : 0.8, 'Node edge observations must match the measured hybrid pick');
const measurementRow = { webContentMB: measurement.webContentMB, glMB: measurement.glMB, engineBaseMB: 299, rev: measurement.rev, device: measurement.device, evidence: measurement.evidence };
const homeBytes = runtimeAccountedBytes(measurementRow);
assert.equal(measurement.coldPlayMB.length, 3, 'Three independent cold play medians are required');
const coldHomes = measurement.coldPlayMB.map((webContentMB, index) => ({ run: index + 1, webContentMB, bytes: runtimeAccountedBytes({ ...measurementRow, webContentMB }) }));
const assets = new Map(template.files.map(f => [f.hash, new Uint8Array(readFileSync(join(tree, `src/shards/_template/assets/${f.hash}`)))]));
const { loadRapier } = await load('src/engine/physics/rapier.ts');
const rapier = await loadRapier(readFileSync(join(tree, 'public/assets/physics/rapier.wasm')));
const { createShardfileSim } = await load('src/game/shardfile/simulation.ts');
const { installStripCollider } = await load('src/engine/physics/stripColliders.ts');
const { installEntrySockets } = await load('src/engine/physics/entrySockets.ts');
const { installGridBorders } = await load('src/engine/physics/gridBorders.ts');

async function layoutCase(developer) {
 const assembly = new GridAssembly({ developer, devserver: false }), home = assembly.cell('driftwood-isle'), neighbours = assembly.cells.filter(c => c.instance !== home.instance);
 const edgeClaims = [], edgeFailures = [];
 const product = slug => findShard(slug)?.shardfile === undefined ? null : slug === '_template' ? Promise.resolve({ admitted: { source: template } }) : (() => { throw Error(`No pinned product reader for ${slug}`); })();
 const offlineFetch = async url => {
  const file = join(tree, 'public', new URL(url, 'http://model.invalid').pathname);
  try { return new Response(readFileSync(file)); } catch { return new Response(null, { status: 404 }); }
 };
 const edges = await loadGridEdgeProfiles(assembly.cells, async cell => {
  try {
   const row = await readGridEdges(cell, { product, fetch: offlineFetch });
   edgeClaims.push({ id: `product:grid:edge:${cell.instance}`, category: 'product', owner: cell.instance, bytes: jsonResidentBytes(row), distance: 0, needed: true });
   return row;
  } catch (error) {
   edgeFailures.push({ instance: cell.instance, message: String(error) });
   const p = assembly.emptyNeighbour.edge, closed = { entryWidth: 0 };
   return { kind: 'declared', profiles: { north: p, east: p, south: p, west: p }, observations: { north: closed, east: closed, south: closed, west: closed } };
  }
 });
 let strips, generatorFallback = null;
 try { strips = generatePlatform(edges, assembly.emptyNeighbour.edge); }
 catch (error) {
  generatorFallback = String(error);
  strips = generatePlatform(assembly.cells.map(c => ({ instance: c.instance, cell: c.cell, origin: c.origin, edges: Object.fromEntries(['north','east','south','west'].map(s => [s, assembly.emptyNeighbour.edge])) })), assembly.emptyNeighbour.edge);
 }
 const roadScope = new Scope('model-road'), roadPlans = [];
 try {
  installPlatformRoad({ strips, home, pitch: assembly.pitch, layout: roadLayout(assembly, slug => findShard(slug)?.name ?? slug), scene: new Group(), scope: roadScope, plans: new Map(), admission: { allocate: (plan, build) => { roadPlans.push({ ...plan }); return build(roadScope); } } });
 } finally { roadScope.dispose(); }
 assert.deepEqual(roadPlans.map(p => p.id), ['road.asphalt','road.junctions','road.signs','road.void','road.deck','road.curtain']);
 const far = neighbours.map(cell => { const row = read(`public/assets/baked/${cell.slug}/far.json`); return { id: `render:${cell.instance}:far`, category: 'far', owner: cell.instance, bytes: Math.round(row.far.decoded + row.far.gpu), distance: 0, needed: true }; });
 const sourceCells = neighbours.filter(c => findShard(c.slug)?.shardfile !== undefined);
 assert.ok(sourceCells.every(c => c.slug === '_template'), 'Every data neighbour needs a real pinned source');
 const sourceMap = new Map(sourceCells.map(c => [c.instance, { source: template }])), catalogueTiles = clientRingCatalogue(sourceMap);
 const libraryCollector = new ResidencyAllocator({ playing: 10_000_000_000 }), libraryScope = new Scope('library-model');
 try { for (const cell of sourceCells) leaseClientLibrary(template, assets, { allocator: libraryCollector, scope: libraryScope, owner: cell.instance }); }
 catch (error) { libraryScope.dispose(); throw error; }
 const libraryClaims = libraryCollector.entries().map(({ id, category, bytes, owner }) => ({ id, category, bytes, owner, distance: 0, needed: true }));
 libraryScope.dispose(); assert.equal(libraryCollector.entries().length, 0);
 const highwayBytes = strips.reduce((sum, s) => sum + s.mesh.positions.byteLength + s.mesh.indices.byteLength, 0);
 const regionCosts = sourceCells.map(cell => {
  const resolution = template.edge.north.heights.length, generatedGround = template.terrain === null ? 2 * resolution ** 2 * 4 : 0;
  const noReward = () => { throw Error('Immutable basis measurement must not deliver quest rewards'); };
  const sim = createShardfileSim(template, assets, { rapier, playerBody: false, groundResolution: resolution, quest: { fact: noReward, coins: noReward } });
  let basis;
  try {
   for (const strip of strips) for (const duplicate of strip.duplicates.filter(r => r.instance === cell.instance)) installStripCollider(sim.host.physics, duplicate.mesh, sim.host.scope);
   installEntrySockets(sim.host.physics, sim.host.scope, [{ x: 0, z: 0 }], 'backstop');
   installGridBorders(sim.host.physics, sim.host.scope);
   basis = sim.host.physics.snapshot().byteLength;
  } finally { sim.dispose(); }
  return { instance: cell.instance, simBytes: template.budgets.sim.resident + generatedGround + 4096, basisBytes: basis };
 }).sort((a,b) => (b.simBytes + b.basisBytes) - (a.simBytes + a.basisBytes) || a.instance.localeCompare(b.instance));
 // Conservative live upper bound: the three heaviest owned regions allowed beside the borrowed home.
 const regions = regionCosts.slice(0, CONTENT_CAPS.simCount - 1);
 const core = [
  { id: 'sim:driftwood-isle', category: 'sim', owner: home.instance, bytes: homeBytes, distance: 0, needed: true },
  ...edgeClaims,
  ...(sourceCells.length === 0 ? [] : [{ id: 'product:grid:_template', category: 'product', owner: 'grid', bytes: productResidentBytes(template), distance: 0, needed: true }]),
  ...roadPlans.map(p => ({ id: `platform:render:${p.id}`, category: 'l0', owner: 'platform', bytes: p.jsBytes + p.gpuBytes, distance: 0, needed: true })),
  { id: 'sim:platform.highway', category: 'sim', owner: 'platform.highway', bytes: highwayBytes, distance: 0, needed: true },
  ...libraryClaims,
 ];
 const regionClaims = regions.flatMap(r => [
  { id: `sim:${r.instance}`, category: 'sim', owner: r.instance, bytes: r.simBytes, distance: 0, needed: true },
  { id: `sim-basis:${r.instance}`, category: 'sim', owner: r.instance, bytes: r.basisBytes, distance: 0, needed: true },
 ]);
 const prospective = claims => {
  const a = new ResidencyAllocator({ playing: 10_000_000_000 });
  for (const c of claims) assert.ok(a.reserve(c)); return a.cost();
 };
 const stage = claims => {
  const allocator = new ResidencyAllocator(), leases = []; let refused = null;
  for (const claim of claims) {
   const before = allocator.cost(), lease = allocator.reserve(claim);
   if (lease === null) { refused = { id: claim.id, bytes: claim.bytes, playingRequired: prospective([...allocator.entries(), claim]).playing, marginBytes: CONTENT_CAPS.playing - prospective([...allocator.entries(), claim]).playing, before }; break; }
   leases.push(lease);
  }
  const cost = prospective(claims), observed = allocator.cost(); for (const l of leases) l.release(); assert.equal(allocator.entries().length, 0);
  const coldRuns = coldHomes.map(home => {
   const actual = prospective(claims.map(c => c.id === 'sim:driftwood-isle' ? { ...c, bytes: home.bytes } : c));
   return { ...home, cost: actual, fits: actual.playing <= CONTENT_CAPS.playing, marginBytes: CONTENT_CAPS.playing - actual.playing };
  });
  return { fits: refused === null, cost, marginBytes: CONTENT_CAPS.playing - cost.playing, firstRefusal: refused, observedBeforeCleanup: observed, coldRuns };
 };
 const baseline = stage([...core, ...far]);
 const withRegions = stage([...core, ...far, ...regionClaims]);
 const dense = level => {
  const list = [];
  for (const cell of sourceCells) for (const tile of template.tiles.filter(t => t.lod === (level === 'l0' ? 0 : 1))) list.push({ id: `render:${cell.instance}:${level}/${tile.x}/${tile.z}`, category: level, owner: cell.instance, bytes: catalogueTiles(cell.instance, level, tile.x, tile.z), distance: 0, needed: true });
  return list.sort((a,b) => b.bytes - a.bytes || a.id.localeCompare(b.id)).slice(0, level === 'l0' ? CONTENT_CAPS.l0Count : CONTENT_CAPS.l1Count);
 };
 const coarse = dense('l1'), fine = dense('l0');
 const bounded = stage([...core, ...far, ...regionClaims, ...coarse, ...fine]);
 const route = [], allocator = new ResidencyAllocator(), coreLeases = []; let baseRefusal = null;
 for (const c of [...core, ...regionClaims]) {
  const lease = allocator.reserve(c);
  if (lease === null) { baseRefusal = c.id; break; }
  coreLeases.push(lease);
 }
 if (baseRefusal === null) {
  const farCosts = new Map(far.map(c => [c.owner,c.bytes]));
  const rings = new RenderRings(neighbours, allocator, (id,l,x,z) => l === 'far' ? farCosts.get(id) ?? null : catalogueTiles(id,l,x,z), {
   fetch: (_tile,done) => done({}), upload: () => ({ mask: () => undefined, shadow: () => undefined, dispose: () => undefined }), discard: () => undefined,
  });
  try {
   for (const [name,x,z,vx,vz] of [['spawn',0,-194,0,0],['home',0,0,0,0],['south-road',0,-277.5,0,-30],['SW-junction',-277.5,-277.5,-30,0],['template-4',-555,-555,-30,0],['west-road',-277.5,0,30,0],['NE-junction',277.5,277.5,0,30],['template-2',555,555,0,30],['U-turn',277.5,277.5,0,-30],['return-home',0,-194,0,0]]) {
    for (let i=0;i<120;i++) rings.step({ x,z,vx,vz });
    route.push({ name,x,z,cost:allocator.cost(),marginBytes:CONTENT_CAPS.playing-allocator.cost().playing,ready:rings.ready(),rings:rings.stats(),claims:allocator.entries() });
   }
  } finally { rings.dispose(); }
 }
 for (const lease of coreLeases) lease.release();
 assert.equal(allocator.entries().length, 0, 'Route model releases every ring and fixed claim');
 return { developer, cells:assembly.cells, edgeFailures, generatorFallback, roadPlans, highwayBytes, far, libraryClaims, productBytes:productResidentBytes(template), regionCosts, regionsSelectedForUpperBound:regions, continuationCacheBytes:0, baseline, withRegions, bounded, largestFineTiles:fine, largestCoarseTiles:coarse, route, baseRefusal, fullClaims:[...core,...far,...regionClaims,...coarse,...fine], caveats:['Road plans are the real preflight functions; canvas drawing is stubbed only for Node byte counts. Existing plan-equals-measured tests validate these builders.','Grid simCount4 permits home+3 owned regions; this upper bound selects the three heaviest immutable bases, without claiming they are simultaneously the actual closest cells.','Worst ring bound retains all eight far parents,32largest actual L1 tiles and40largest actual L0 tiles. Conservative count bound, not one camera sample.','Only currently admitted data neighbours refine; opaque Pine/Nalati/etc remain real far proxies. This does not claim future M3 native neighbours fit.','Fixed durable-only production continuation cache is zero; native basis byte claims are included separately. Measured opaque home already includes its own library/render/sim, so none are added twice.'] };
}
const cases = [];
for (const developer of [false,true]) cases.push(await layoutCase(developer));
const result = { tool:'grid-fit-model.mjs', input:measurement, caps:CONTENT_CAPS, homeAccountedBytes:homeBytes, engineCalibration:{ MB:299, evidence:'progress/memory/sf22a-2026-10-04.json',dated:true }, cases };
writeFileSync(flag('out'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(cases.map(c => ({ developer:c.developer, baseline:c.baseline,withRegions:c.withRegions,bounded:c.bounded, route:c.route.map(r=>({name:r.name,playingMB:r.cost.playing/1e6,marginMB:r.marginBytes/1e6,ready:r.ready,refused:r.rings.refused})) })),null,2));
