/** Aggregate matched native frame rows without dividing unrelated percentiles.
 * @param {Array<{calls:number,renderMs:number,workMs:number,triangles:number}>} frames */
export function nativeSummary(frames) {
  if (frames.length === 0) throw new Error('No completed census frames');
  const quantile = (values, q) => {
    const sorted = [...values].sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
  };
  for (const row of frames) if (![row.calls, row.renderMs, row.workMs, row.triangles].every(value => Number.isFinite(value) && value >= 0)) throw new Error('Invalid native frame counters');
  const costs = frames.filter(row => row.calls > 0).map(row => row.renderMs * 1000 / row.calls);
  return { frames: frames.length, drawsP50: quantile(frames.map(row => row.calls), .5), drawsMax: Math.max(...frames.map(row => row.calls)),
    workMsP50: quantile(frames.map(row => row.workMs), .5), renderMsP50: quantile(frames.map(row => row.renderMs), .5),
    renderUsPerDrawP50: costs.length > 0 ? quantile(costs, .5) : null, zeroDrawFrames: frames.length - costs.length,
    trianglesP50: quantile(frames.map(row => row.triangles), .5) };
}

/** Source-mapped sampled CPU. Attribute samples once to each category even if
 * recursive/nested wrappers occur. Wrapper overhead is the part of an engine
 * renderBufferDirect stack outside the stock three renderBufferDirect stack.
 * @param {object} profile @param {(frame: object)=>{source:string,name:string}} locate @param {number} frames */
export function sampledCpu(profile, locate, frames) {
  const nodes = new Map(profile.nodes.map(node => [node.id, node])), parents = new Map();
  for (const node of profile.nodes) for (const child of node.children ?? []) parents.set(child, node.id);
  const totals = { renderWorld: 0, stockDraw: 0, drawWrappers: 0, propertyHooks: 0 }, mapped = new Set(), identified = new Set(), locations = new Map();
  for (const node of profile.nodes) locations.set(node.id, locate(node.callFrame));
  for (let index = 0; index < (profile.samples ?? []).length; index++) {
    const categories = new Set(); let id = profile.samples[index];
    while (id !== undefined) {
      const node = nodes.get(id); if (!node) throw new Error('CPU profile references a missing node');
      const { source, name } = locations.get(id); if (source) mapped.add(source);
      if (/renderWorld/u.test(name) && source.includes('/core/worldDepth')) categories.add('renderWorld');
      if (/\/three\/(?:src\/renderers\/WebGLRenderer|build\/three(?:\.module)?\.js)/u.test(source) && /renderBufferDirect/u.test(name)) categories.add('stockDraw');
      if (/src\/engine\/render\//u.test(source) && (/renderBufferDirect/u.test(name)
        || (source.endsWith('/drawHooks.ts') && /(?:^|\s)submit(?:\s|$)/u.test(name)))) categories.add('drawWrappers');
      if (/src\/engine\/render\//u.test(source) && /properties\.get/u.test(name)) categories.add('propertyHooks');
      id = parents.get(id);
    }
    for (const category of categories) identified.add(category);
    if (categories.has('stockDraw')) categories.delete('drawWrappers');
    for (const category of categories) totals[category] += (profile.timeDeltas[index] ?? 0) / 1000;
  }
  const present = mapped.size > 0;
  return { frames, mappedSources: mapped.size, msPerFrame: Object.fromEntries(Object.entries(totals).map(([name, ms]) => [name, present && identified.has(name) && frames > 0 ? ms / frames : null])),
    qualifier: 'CDP sampled inclusive renderWorld/stock draw; exclusive engine draw-wrapper stack; not GPU time or an uninstrumented acceptance reading' };
}

/** @param {object[]} frames */
export function attributionSummary(frames) {
  const passes = new Map(), owners = new Map(), materials = new Set(), geometries = new Set(), programs = new Set();
  let draws = 0, nodeDraws = 0, singleCopyMain = 0;
  for (const frame of frames) for (const row of frame.draws) {
    draws += row.count;
    const pass = passes.get(row.pass) ?? 0; passes.set(row.pass, pass + row.count);
    const key = `${row.pass}|${row.owner}`, owner = owners.get(key) ?? 0; owners.set(key, owner + row.count);
    if (row.program !== null) programs.add(row.program);
    if (row.materialId) materials.add(row.materialId); if (row.geometryId) geometries.add(row.geometryId);
    if (row.nodeMaterial) nodeDraws += row.count;
    if (row.pass !== 'shadow' && row.instances === 1 && !row.skinned) singleCopyMain += row.count;
  }
  const mean = value => value / frames.length;
  return { frames: frames.length, draws: mean(draws), passes: Object.fromEntries([...passes].map(([key, value]) => [key, mean(value)])),
    byOwner: [...owners].map(([owner, count]) => ({ owner, drawsPerFrame: mean(count) })).sort((a, b) => b.drawsPerFrame - a.drawsPerFrame),
    programs: programs.size, programsPerFrame: mean(frames.reduce((sum, frame) => sum + new Set(frame.draws.map(row => row.program).filter(program => program !== null)).size, 0)),
    treeDraws: Object.fromEntries(['shadow', 'main'].map(pass => [pass, mean(frames.reduce((sum, frame) => sum + frame.draws.filter(row => row.owner.includes('/forest-tree') && (pass === 'shadow' ? row.pass === 'shadow' : row.pass !== 'shadow')).reduce((count, row) => count + row.count, 0), 0))])), materials: materials.size, geometries: geometries.size, nodeDraws: mean(nodeDraws), singleCopyMain: mean(singleCopyMain),
    useProgram: mean(frames.reduce((sum, frame) => sum + frame.useProgram, 0)), uniforms: mean(frames.reduce((sum, frame) => sum + frame.uniforms, 0)) };
}
