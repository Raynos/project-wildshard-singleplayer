// DL17's in-page readings, shared by the complete-at-control gate (scripts/complete-at-control.mjs, Chromium) and the
// Simulator boost lap (scripts/sim-boost-lap.mjs): the residency snapshot the page runs, and the lap's pops.

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

/** What a boost lap added against the control snapshot `at`, from its samples: fine tiles, meshes within reach of the
 *  player shown that control did not show as they are now (absent, hidden, or another geometry / material / texture: an
 *  LOD or texture swap), LODs below full detail and undecoded textures. A mesh under another grid cell's region
 *  (`homeRegion` is the home cell's id) is the neighbour's; a skinned mesh (an animal, a person) is a moving actor the
 *  level culls by distance: listed, never a pop. */
export function lapPops(at, lap, homeRegion) {
  const atMeshes = new Map((at.scene?.list ?? []).map(([id, , sig, on]) => [id, { sig, on }]));
  const pops = new Map(), neighbourPops = new Map(), actors = new Map();
  const fineAt = new Set(at.fine), fine = new Set(), lods = new Set(), textures = new Set();
  const neighbourChain = chain => homeRegion !== undefined && /region:[\w-]+/u.test(chain) && !chain.includes(`region:${homeRegion}`);
  for (const s of lap) {
    for (const key of s.fine ?? []) if (!fineAt.has(key)) fine.add(key);
    for (const lod of s.scene?.lods ?? []) lods.add(lod);
    for (const texture of s.scene?.texturesPending ?? []) textures.add(texture);
    for (const [id, chain, sig, , close, skinned] of s.scene?.list ?? []) {
      if (!close || pops.has(id) || neighbourPops.has(id) || actors.has(id)) continue;
      if (skinned) { if (atMeshes.get(id)?.on !== true) actors.set(id, chain); continue; }
      const was = atMeshes.get(id), why = was === undefined ? 'added' : !was.on ? 'shown' : was.sig === sig ? null : 'swapped';
      if (why !== null) (neighbourChain(chain) ? neighbourPops : pops).set(id, `${why} ${chain}`);
    }
  }
  return { fine: [...fine], pops: [...pops.values()], neighbourPops: [...neighbourPops.values()], actors: [...actors.values()], lods: [...lods], textures: [...textures] };
}
