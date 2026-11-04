// DL17's in-page readings, shared by the complete-at-control gate (scripts/complete-at-control.mjs, Chromium) and the
// Simulator boost lap (scripts/sim-boost-lap.mjs): the residency snapshot the page runs, the lap's pops and the request rule.

/** In-page residency snapshot: everything that could still change what is drawn near the player. Self-contained: it also
 *  runs from the init script in the control frame. */
export function snapshot() {
  const api = window.__wildshard, grid = api?.shard?.grid, file = api?.shard?.shardfile, reachM = Number(window.__dl17Reach) || 220;
  const marks = performance.getEntriesByType('mark').filter(m => m.name.startsWith('wildshard.spawn-view')).map(m => ({ name: m.name, detail: m.detail }));
  let scene = null;
  try {
    const world = api.requireWorld(), p = world.player.position, v = world.player.velocity;
    let meshes = 0, visible = 0; const list = [], lods = [], texturesPending = [];
    // an instanced mesh's own transform says nothing of where its instances stand: it counts as within reach
    const near = o => { const e = o.matrixWorld.elements; return o.isInstancedMesh === true || Math.hypot(e[12] - p.x, e[14] - p.z) <= reachM; };
    const shown = o => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true; };
    world.game.scene.traverse(o => {
      // the player's own viewmodel (held weapons, arms, the board) hangs under the game's camera: not level content (any other
      // camera in the scene is level content, so a mesh under it still counts)
      for (let q = o.parent; q; q = q.parent) if (q === world.game.camera) return;
      if (o.isLOD && shown(o) && near(o) && o.getCurrentLevel() > 0) lods.push(`${o.name === '' ? o.uuid : o.name}@${o.getCurrentLevel()}`);
      if (!(o.isMesh || o.isInstancedMesh)) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      // additive blending (THREE.AdditiveBlending) is an effect: sparks, dust, glows
      if (mats.some(m => m?.blending === 2)) return;
      meshes++;
      const on = shown(o), close = on && near(o);
      if (on) visible++;
      const chain = []; for (let q = o; q && chain.length < 4; q = q.parent) chain.push(q.name === '' ? q.type : q.name);
      const g = o.geometry;
      const sig = [g?.uuid, g?.attributes?.position?.count ?? 0, g?.index?.count ?? 0,
        ...mats.map(m => `${m?.uuid}:${m?.map?.uuid ?? ''}:${m?.map?.image?.width ?? ''}`)].join('|');
      list.push([o.uuid, chain.join('<'), sig, on, close, o.isSkinnedMesh === true]);
      if (close) for (const m of mats) for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'alphaMap']) {
        const t = m?.[key];
        if (t?.isTexture !== true || t.isRenderTargetTexture === true) continue;
        const img = t.image;
        const empty = img === null || img === undefined || (t.isCompressedTexture ? !(t.mipmaps?.length > 0) : img.width === 0 || img.complete === false);
        if (empty && texturesPending.length < 50) texturesPending.push(`${chain.join('<')}.${key}`);
      }
    });
    scene = { meshes, visible, list, lods, texturesPending, player: [p.x, p.y, p.z], speed: Math.hypot(v.x, v.z), hover: world.player.hover, boost: world.player.hoverBoost,
      limit: typeof world.player.hoverSpeedLimit === 'function' ? world.player.hoverSpeedLimit() : null };
  } catch (error) { scene = { error: String(error) }; }
  let gridState = null;
  if (grid !== undefined) {
    try {
      const s = grid.state();
      gridState = { pitch: s.pitch, feet: s.feet, home: s.home, rings: s.rings, ringsReady: s.ringsReady, near: s.near,
        cells: (s.cells ?? []).map(c => ({ id: c.instance, slug: c.slug, cell: c.cell, shows: c.shows, drawn: c.drawn })) };
    } catch (error) { gridState = { error: String(error) }; }
  }
  let fine = null, residency = null;
  try { fine = file?.fine ? [...file.fine].map(String).sort((a, b) => a.localeCompare(b)) : null; } catch { fine = null; }
  try {
    const raw = api?.shard?.shardfileResidency;
    residency = raw ? JSON.parse(JSON.stringify(typeof raw === 'function' ? raw() : raw, (_key, value) => (typeof value === 'function' ? undefined : value))) : null;
  } catch (error) { residency = { error: String(error) }; }
  let textures = null;
  try { const t = api?.textures?.(); textures = t === undefined ? null : { mode: t.mode, why: t.why }; } catch (error) { textures = { error: String(error) }; }
  return { at: performance.now(), when: Date.now(), marks, scene, grid: gridState, fine, residency, textures };
}

/** A mesh signature's geometry id and texture ids (the snapshot's `geometry|positions|indices|material:map:width…`). */
function sigParts(sig) {
  const parts = sig.split('|');
  return { geometry: parts[0], maps: parts.slice(3).map(m => m.split(':')[1] ?? '').filter(map => map !== '') };
}

/** What a boost lap changed within reach of the player against the control snapshot `at`, from its samples, classified by
 *  the download plan's rule (root's ruling, G872 (A)): content that was not downloaded and loaded at control is a pop
 *  (RED): a mesh added after control, a mesh swapped to a geometry or texture no mesh held at control, a fine tile, an
 *  undecoded texture. A shard's own distance design on resident models (a mesh shown or hidden, swapped between resident
 *  geometries or textures, a THREE.LOD below level 0) is distance LOD: listed, not red. A mesh under another grid cell's
 *  region (`homeRegion` is the home cell's id) is the neighbour's; a skinned mesh (an animal, a person) is a moving
 *  actor: listed, never a pop. */
export function lapPops(at, lap, homeRegion) {
  const atList = at.scene?.list ?? [], atMeshes = new Map(atList.map(([id, , sig, on]) => [id, { sig, on }]));
  // DL5 target (root, G872): the Shardfile ring retires a tile beyond it and re-attaches the same model on return. A mesh
  // added after control is that model re-attached (listed, not a pop) only when one shown at control had its name, owner,
  // vertex and index counts and materials and textures (the whole signature but the new geometry's id), and that mesh
  // left the scene in an earlier sample (its retirement, sp-x9's review); anything else is a pop
  const model = (chain, sig) => `${chain.split('<').slice(0, 2).join('<')}|${sig.split('|').slice(1).join('|')}`;
  const atModels = new Map(), reattached = new Map(), retired = new Set();
  for (const [id, chain, sig, on] of atList) if (on) { const ids = atModels.get(model(chain, sig)) ?? []; ids.push(id); atModels.set(model(chain, sig), ids); }
  const residentGeometry = new Set(), residentMaps = new Set();
  for (const row of atList) { const parts = sigParts(row[2]); residentGeometry.add(parts.geometry); for (const map of parts.maps) residentMaps.add(map); }
  const pops = new Map(), neighbourPops = new Map(), actors = new Map(), distance = new Map();
  const fineAt = new Set(at.fine), fine = new Set(), lods = new Set(at.scene?.lods), textures = new Set();
  const neighbourChain = chain => homeRegion !== undefined && /region:[\w-]+/u.test(chain) && !chain.includes(`region:${homeRegion}`);
  for (const s of lap) {
    const present = new Set((s.scene?.list ?? []).map(([id]) => id));
    for (const [key, ids] of atModels) if (ids.some(id => !present.has(id))) retired.add(key);
    for (const key of s.fine ?? []) if (!fineAt.has(key)) fine.add(key);
    for (const lod of s.scene?.lods ?? []) lods.add(lod);
    for (const texture of s.scene?.texturesPending ?? []) textures.add(texture);
    for (const [id, chain, sig, , close, skinned] of s.scene?.list ?? []) {
      if (!close || pops.has(id) || neighbourPops.has(id) || actors.has(id) || reattached.has(id)) continue;
      if (skinned) { if (atMeshes.get(id)?.on !== true) actors.set(id, chain); continue; }
      const was = atMeshes.get(id);
      let red = null;
      if (was === undefined && retired.has(model(chain, sig))) { reattached.set(id, `re-attached ${chain}`); continue; }
      if (was === undefined) red = 'added';
      else if (was.sig !== sig) {
        const parts = sigParts(sig);
        if (!residentGeometry.has(parts.geometry) || parts.maps.some(map => !residentMaps.has(map))) red = 'swapped to non-resident data';
        else distance.set(id, `swapped ${chain}`);
      } else if (!was.on) distance.set(id, `shown ${chain}`);
      if (red !== null) (neighbourChain(chain) ? neighbourPops : pops).set(id, `${red} ${chain}`);
    }
  }
  for (const id of pops.keys()) distance.delete(id);
  return { fine: [...fine], pops: [...pops.values()], neighbourPops: [...neighbourPops.values()], actors: [...actors.values()],
    distanceLod: [...distance.values()], lods: [...lods], textures: [...textures], reattached: [...reattached.values()] };
}

/** DL17's request rule (root's ruling, G872 (a)): of one visit's requests (`{ url, by: 'page' | 'service-worker', start,
 *  end }`, end null while open), the level's are every level-content URL (`isLevelContent`) except the worker's offline
 *  precache: a service-worker fetch whose URL no page request is still reading or reads later (the page never requests
 *  it in the visit, lap included, or already had it before the worker's fetch began: the worker filling its cache with
 *  what the level loaded). A file the level needs shows as a page request too (also when the worker answers it from its
 *  cache), so any page request stays the level's. */
export function splitRequests(rows, isLevelContent) {
  const path = row => new URL(row.url).pathname, pageReads = new Map();
  for (const row of rows) if (row.by === 'page') { const reads = pageReads.get(path(row)) ?? []; reads.push(row); pageReads.set(path(row), reads); }
  const pageAfter = row => (pageReads.get(path(row)) ?? []).some(read => read.end === null || read.end === undefined || read.end > (row.start ?? 0));
  const precache = rows.filter(row => row.by === 'service-worker' && !pageAfter(row) && isLevelContent(row.url));
  const held = new Set(precache);
  return { level: rows.filter(row => isLevelContent(row.url) && !held.has(row)), precache };
}

/** Root's ruling (G872, wildshard-new 11-04): neighbour and outer-road work, as source spans of the grid session. A span runs
 *  from its `from` line up to its `to` line, both found once in the served build's own source of `file`. */
export const NEIGHBOUR_WORK = [
  { file: 'src/game/grid/session.ts', what: 'outer-ring strips', from: /^\s*const outerStrips = async /u, to: /^\s*const roadInput = /u },
  { file: 'src/game/grid/session.ts', what: 'outer-ring road', from: /^\s*const outer = async \(\): Promise<PlatformRoad>/u, to: /^\s*const completed = await /u },
  { file: 'src/game/grid/session.ts', what: 'outer-ring start', from: /this\.startOuterRoad = \(\) => \{/u, to: /^\s*const given = preparedRoad/u },
  { file: 'src/game/grid/session.ts', what: 'outer-ring platform', from: /^\s*prepareOuterStrips\(\): Promise<void> \{/u, to: /^\s*\/\*\* Step 2: the live crossing/u },
  // the cell the player is in admits no tile copy of itself (ce0ac0fa3c): these views are the cells round it
  { file: 'src/game/grid/session.ts', what: 'neighbour tile views', from: /^\s*private tileAdmission\(/u, to: /^\s*private refuse\(/u },
];
/** Each span's lines in `read(file)`'s source; an anchor missing or found twice refuses (the spans must follow edits). */
export function neighbourSpans(read, spans = NEIGHBOUR_WORK) {
  return spans.map(span => {
    const lines = read(span.file).split('\n'), at = re => lines.flatMap((line, i) => (re.test(line) ? [i + 1] : []));
    const [from, to] = [at(span.from), at(span.to)];
    if (from.length !== 1 || to.length !== 1 || to[0] <= from[0]) throw new Error(`neighbour span '${span.what}' has no single ${span.file} anchor pair`);
    return { file: span.file, what: span.what, from: from[0], to: to[0] };
  });
}
/** The neighbour span a source-mapped stack passes through (frames' `src` "path:line [name]"), else null. */
export function neighbourFrame(frames, spans) {
  for (const frame of frames) {
    const at = /^(.*):(\d+)(?: |$)/u.exec(frame.src ?? '');
    if (at === null) continue;
    const line = Number(at[2]), span = spans.find(s => at[1].endsWith(s.file) && line >= s.from && line < s.to);
    if (span !== undefined) return span.what;
  }
  return null;
}
/** Post-control level requests split by who asked (root's ruling, G872): a URL naming no level whose every page request
 *  after control has its own initiator stack, each passing through neighbour work, is the neighbour's (G828). Unknown
 *  evidence vetoes (sp-x1): a request with no stack, fewer stacks than page requests, or any stack from elsewhere keeps
 *  the URL the level's. A worker script's fetch carries no stack: each fetch pairs with its own constructor in order,
 *  every constructor since control must be neighbour work, and fewer constructors than fetches vetoes. The worker's own
 *  fetch follows the URL's verdict. */
export function splitByInitiator(after, trace, spans, namesLevel) {
  const path = url => { try { return new URL(url).pathname; } catch { return url; } };
  const group = rows => {
    const byPath = new Map();
    for (const row of [...rows].sort((a, b) => (a.msAfterControl ?? 0) - (b.msAfterControl ?? 0))) {
      const list = byPath.get(path(row.url)) ?? []; list.push(row); byPath.set(path(row.url), list);
    }
    return byPath;
  };
  const fetches = group(trace.initiators), builds = group(trace.workers), verdict = new Map();
  const of = url => {
    const key = path(url);
    if (verdict.has(key)) return verdict.get(key);
    const pages = after.filter(row => row.by === 'page' && path(row.url) === key).length, observed = fetches.get(key) ?? [];
    // a worker script: every constructor since control must be neighbour work (any other vetoes), and each fetch pairs
    // with its own constructor in order, so a stackless fetch never borrows another occurrence's (sp-x1)
    const constructors = builds.get(key) ?? [];
    if (constructors.length > 0 && constructors.length < observed.length) { verdict.set(key, null); return null; }
    const stacks = [...observed.filter(row => row.frames.length > 0).map(row => row.frames), ...constructors.map(row => row.frames)];
    const found = stacks.map(frames => (frames.length === 0 ? null : neighbourFrame(frames, spans)));
    if (observed.some((row, i) => row.frames.length === 0 && constructors[i] === undefined)) found.push(null);
    const what = !namesLevel(url) && stacks.length > 0 && observed.length >= pages && found.every(work => work !== null) ? found[0] : null;
    verdict.set(key, what);
    return what;
  };
  const neighbour = [], level = [];
  for (const row of after) { const what = of(row.url); if (what === null) level.push(row); else neighbour.push({ ...row, work: what }); }
  return { level, neighbour };
}
