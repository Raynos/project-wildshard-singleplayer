import { CONTENT_CAPS as C } from '@wildshard/engine/core/config';
import { admitScript, type ScriptAdmission } from '@wildshard/engine/script/admission';
import { SCRIPT_LIMITS } from '@wildshard/engine/script/host';
import { worstContentCost } from './budget';
import { parseShardfile, type Shardfile } from './schema';
import { assetCost } from './assets';
import { validateTerrainAssets } from './terrain';
import { validateMeshCollisionAssets } from './meshCollision';
import { validateNativeGround } from './nativeGround';
import { validateMeshEntryways } from './meshEntryways';
import { checkPropMaterialNames, glbMaterialNames, validatePropMaterials, type PropMaterials } from './propMaterials';
import { validateSkinAssets } from './skins';
import { validateEntrywayTerrain } from './entryways';
import { validateEntrywayClearance } from './entryClearance';
import { validateSocketLandings } from './entryLanding';
import { portalLinkEntries } from './portalLink';
import { validatePortalFloors } from './portalFloor';
import { clientScriptViewCost } from './clientScripts';
import { preflightShardfile } from './preflight';
import { preflightAssetGraph } from './assetGraph';
import { compendiumSketches } from './sketch';
import { assertCommonsCosts, type CommonsCosts } from './commonsCosts';
import type { MemoryAdmission } from '../grid/memoryAdmission';

function acceptsTotal(memory: MemoryAdmission | undefined, source: Shardfile, stage: 'declared' | 'actual', cost: ReturnType<typeof worstContentCost>): boolean {
  if (cost.playing <= C.playing && cost.loading <= C.loading) return true;
  return memory?.accept({ stage, owner: source.identity.slug, id: `${source.identity.slug}:worst-location`,
    claimedBytes: cost.accounted, accountedBytes: cost.accounted, playingBytes: cost.playing, loadingBytes: cost.loading }) ?? false;
}

/** Check declared residency before immutable reads; exact parsed headers are checked again on admission. */
export function preflightDeclaredCosts(source: Shardfile, memory?: MemoryAdmission): { commons: CommonsCosts; worst: ReturnType<typeof worstContentCost> } {
  const commons = assertCommonsCosts(source.requires.commons, source.requires.commonsCosts);
  const files = new Map(source.files.map(file => [file.hash, file]));
  const closure = (roots: readonly string[]): Set<string> => {
    const found = new Set<string>(), pending = [...roots];
    while (pending.length > 0) {
      const ref = pending.pop(); if (ref === undefined || found.has(ref)) continue;
      found.add(ref); pending.push(...files.get(ref)?.dependencies ?? []);
    }
    return found;
  };
  const sum = (refs: Iterable<string>, excluded: ReadonlySet<string> = new Set(), includeCommons = false) => {
    let resident = 0, compressed = 0, triangles = 0, draws = 0;
    for (const ref of refs) {
      if (excluded.has(ref)) continue;
      const file = files.get(ref), hash = ref.replace(/^commons:/u, ''), shared = includeCommons && ref.startsWith('commons:') ? commons[hash] : undefined;
      if (file !== undefined) { resident += file.decoded + file.gpu; compressed += file.compressed; triangles += file.triangles; draws += file.draws; }
      else if (shared !== undefined) { resident += shared.decoded + shared.gpu; compressed += source.requires.commonsWire[hash] ?? 0; triangles += shared.triangles; draws += shared.draws; }
    }
    return { resident, compressed, triangles, draws };
  };
  const library = closure(source.library), libraryCost = sum(library), critical = sum(closure(source.critical), new Set(), true);
  if (libraryCost.resident > source.budgets.library.resident || libraryCost.compressed > source.budgets.library.compressed) throw new Error('declared bundle cost exceeds budget');
  if (critical.resident > source.budgets.sim.resident || critical.compressed > source.budgets.sim.compressed) throw new Error('declared critical bundle cap or budget exceeded');
  for (const tile of [...source.tiles, ...source.far === null ? [] : [source.far]]) {
    const cost = sum(closure(tile.files), library);
    if (cost.resident > tile.decoded + tile.gpu || cost.compressed > tile.compressed || cost.triangles > tile.triangles || cost.draws > tile.draws) throw new Error('declared tile or far cost exceeds budget');
  }
  const resident = Object.values(commons).reduce((total, cost) => total + cost.decoded + cost.gpu, 0);
  const worst = worstContentCost(source, resident);
  if (!acceptsTotal(memory, source, 'declared', worst)) throw new Error(`declared worst-location total exceeds envelope: ${worst.playing}`);
  return { commons, worst };
}

/** Admit exact bytes, graph closure, script growth and worst-location residency before a runtime is allocated. */
export function validateShardfileAssets(input: unknown, assets: ReadonlyMap<string, Uint8Array>, contentHash: (bytes: Uint8Array) => string, memory?: MemoryAdmission): Shardfile {
  preflightShardfile(input);
  const s = parseShardfile(input), files = new Map(s.files.map((f) => [f.hash, f]));
  preflightAssetGraph(s);
  const declared = preflightDeclaredCosts(s, memory).commons;
  const closure = (roots: readonly string[]): Set<string> => {
    const found = new Set<string>(), pending = [...roots];
    while (pending.length > 0) {
      const id = pending.pop(); if (id === undefined || found.has(id)) continue; found.add(id);
      if (!id.startsWith('commons:')) pending.push(...(files.get(id)?.dependencies ?? []));
    }
    return found;
  };
  const sum = (roots: readonly string[], excluded: ReadonlySet<string> = new Set()): { resident: number; compressed: number; triangles: number; draws: number } => {
    let resident = 0, compressed = 0, triangles = 0, draws = 0;
    for (const id of closure(roots)) {
      if (id.startsWith('commons:') || excluded.has(id)) continue;
      const f = files.get(id); if (f === undefined) throw new Error('missing dependency');
      resident += f.decoded + f.gpu; compressed += f.compressed; triangles += f.triangles; draws += f.draws;
    }
    return { resident, compressed, triangles, draws };
  };
  let commons = 0;
  const commonsCosts = new Map<string, ReturnType<typeof assetCost>>(), admissions = new Map<string, ScriptAdmission>();
  const propMaterials = s.props?.materials;
  const propModels = new Set([...s.props?.tiles ?? [], ...s.props?.panels ?? [], ...s.props?.models ?? []].map(row => row.file));
  if (s.props?.far !== undefined && s.props.far !== null) propModels.add(s.props.far);
  for (const hash of s.requires.commons) {
    const bytes = assets.get(`commons:${hash}`); if (bytes === undefined || bytes.length !== s.requires.commonsWire[hash] || contentHash(bytes) !== hash) throw new Error('unavailable commons asset or wire size mismatch');
    const kind = bytes[0] === 171 ? 'ktx2' : bytes[0] === 103 ? 'glb' : bytes[0] === 82 ? 'audio' : 'binary';
    const cost = assetCost(kind, bytes), pinned = declared[hash];
    if (pinned === undefined || (['decoded', 'gpu', 'triangles', 'draws'] as const).some(key => cost[key] !== pinned[key])) throw new Error('commons cost declaration differs from actual bytes');
    commons += cost.decoded + cost.gpu; commonsCosts.set(`commons:${hash}`, cost);
  }
  for (const f of s.files) {
    const bytes = assets.get(f.hash); if (bytes === undefined || bytes.length !== f.compressed || contentHash(bytes) !== f.hash) throw new Error('file hash or wire size mismatch');
    const actual = assetCost(f.kind, bytes);
    if (f.kind === 'wasm') admissions.set(f.hash, admitScript(bytes));
    if (actual.decoded > f.decoded || actual.gpu > f.gpu || actual.triangles > f.triangles || actual.draws > f.draws) throw new Error('asset cost declaration understated');
    if (propMaterials !== undefined && propModels.has(f.hash)) {
      checkPropMaterialNames(propMaterials, bytes);
      // Every GLB carries its own used slots; a dependency on another tile must not hide an uncharged texture.
      const used: PropMaterials = {};
      for (const name of glbMaterialNames(bytes)) {
        const binding = propMaterials[name]; if (binding === undefined) throw new Error(`Missing admitted prop material ${name}`);
        used[name] = binding;
      }
      validatePropMaterials(used, { look: s.look.materials, models: [f.hash], textures: s.props?.textures ?? [], files: s.files });
    }
  }
  const library = closure(s.library);
  const sketches = compendiumSketches(s.rows, assets);
  const sketchResident = [...sketches.values()].reduce((total, sketch) => total + sketch.decoded + sketch.gpu, 0);
  if (s.sim.scripts.some((id) => !id.startsWith('commons:') && files.get(id)?.kind !== 'wasm')) throw new Error('script reference is not an admitted Wasm file');
  for (const t of s.tiles) {
    const roots = closure(t.files);
    if (t.lod === 1 && [...roots].some((r) => library.has(r))) throw new Error('coarse dependency on library');
    const cost = sum(t.files, library);
    if (cost.resident > t.decoded + t.gpu || cost.compressed > t.compressed || cost.triangles > t.triangles || cost.draws > t.draws) throw new Error('tile dependency cost understated');
  }
  if (s.far !== null) {
    if ([...closure(s.far.files)].some((r) => library.has(r))) throw new Error('far dependency on library');
    const cost = sum(s.far.files);
    if (cost.resident > s.far.decoded + s.far.gpu || cost.compressed > s.far.compressed || cost.triangles > s.far.triangles || cost.draws > s.far.draws) throw new Error('far dependency cost understated');
  }
  for (const [roots, budget] of [[s.library, s.budgets.library], [s.critical, s.budgets.sim]] as const) {
    const cost = sum(roots); if (cost.resident > budget.resident || cost.compressed > budget.compressed) throw new Error('bundle dependency budget understated');
  }
  const critical = closure(s.critical), criticalCost = sum(s.critical);
  let criticalResident = criticalCost.resident, criticalWire = criticalCost.compressed;
  for (const ref of critical) if (ref.startsWith('commons:')) {
    const bytes = assets.get(ref), actual = commonsCosts.get(ref);
    if (bytes === undefined || actual === undefined) throw new Error('unavailable critical commons');
    criticalResident += actual.decoded + actual.gpu; criticalWire += bytes.length;
  }
  if (criticalWire > s.budgets.sim.compressed || s.sim.scripts.some((r) => !critical.has(r)) || [...critical].some((r) => library.has(r))) throw new Error('critical bundle cap, declared wire budget, render-library dependency or script omitted');
  let scriptMemory = 0;
  for (const module of new Set(s.sim.scripts)) {
    let admission = admissions.get(module);
    if (admission === undefined) {
      const bytes = assets.get(module); if (bytes === undefined) throw new Error('unavailable script');
      admission = admitScript(bytes); admissions.set(module, admission);
    }
    // One guest per module: live, last-good and in-flight copies at the admitted growth ceiling.
    scriptMemory += admission.maximumPages * 65536 * 3;
  }
  if (s.sim.scripts.length > SCRIPT_LIMITS.instances || scriptMemory > SCRIPT_LIMITS.memoryBytes || criticalResident + scriptMemory > s.budgets.sim.resident || criticalResident + scriptMemory > s.serverBudget.memory) throw new Error('script memory budget understated or above host cap');
  let clientMemory = 0;
  const clientModules = new Set(s.clientScripts.bindings.map((binding) => binding.module));
  for (const module of clientModules) {
    let admission = admissions.get(module);
    if (admission === undefined) {
      const bytes = assets.get(module); if (bytes === undefined) throw new Error('unavailable client script');
      admission = admitScript(bytes); admissions.set(module, admission);
    }
    clientMemory += admission.maximumPages * 65536 * 3;
  }
  const clientViews = clientScriptViewCost(s.clientScripts);
  const libraryResident = sum(s.library).resident + clientMemory + clientViews.decoded + clientViews.gpu;
  if (clientModules.size > SCRIPT_LIMITS.instances || clientMemory > SCRIPT_LIMITS.memoryBytes || libraryResident > s.budgets.library.resident) throw new Error('client script memory or view budget understated or above host cap');
  if (libraryResident + sketchResident > s.budgets.library.resident) throw new Error('compendium sketch raster budget understated');
  const cost = worstContentCost(s, commons);
  if (!acceptsTotal(memory, s, 'actual', cost)) throw new Error(`worst-location total exceeds envelope: ${cost.playing}`);
  validateNativeGround(s, assets);
  validateEntrywayTerrain(s, assets);
  validateEntrywayClearance(s, assets);
  validateMeshCollisionAssets(s, assets);
  validateMeshEntryways(s, assets);
  validateSocketLandings(s, assets);
  validatePortalFloors(portalLinkEntries(s.entryways), s, assets);
  if (s.terrain !== null) validateTerrainAssets(s.terrain, assets, s);
  if (s.meshCollision !== null) throw new Error('Compiled mesh collision runtime and entry admission pending');
  validateSkinAssets(s, assets);
  return s;
}
