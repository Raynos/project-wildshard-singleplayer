/** Browser-side passive observations. Call only inside the approved isolated practice page.
 * Wrappers forward each original call exactly once and return its original result; no event, AI,
 * health, pose or time is injected. Matrix updates refresh cached world transforms only. */
export function installPublic4CameraObservation() {
  const d = window.__practiceDemo, g = d.game;
  window.__conchRenderTrace = []; window.__conchEvents = []; window.__conchRuntimeGeometry = null;
  window.__conchPhase = 'entry';
  let serial = 0, poseSerial = 0, bout = 0, attached = null, lastPose = null;
  const clock = () => ({ wallTime: performance.now(), wallEpoch: performance.timeOrigin + performance.now(),
    frame: g.frameCount, gameTime: g.frameTime, boutTime: d.arena.opponent.elapsed,
    fixedRemainder: d.arena.opponent.fixedTime, phase: window.__conchPhase, bout });
  const input = c => ({ ...clock(), poseIndex: ++poseSerial, t: c.t, dt: c.dt, speed: c.speed,
    phase: c.phase, flinch: c.flinch, deathT: c.deathT, alive: c.alive, state: c.state,
    attack: c.attack, stage: c.mem['conch-st'], guard: c.mem['conch-guard'], clock: c.mem['regular-clock'] });
  const meshesOf = a => { const meshes = []; a.mesh.updateMatrixWorld(true);
    a.mesh.traverse(mesh => { if (mesh.isSkinnedMesh) { mesh.skeleton.update(); meshes.push(mesh); } }); return meshes; };
  const record = () => {
    const a = d.arena.activeTargets[0], control = d.arena.opponent.callbacks.control(a), meshes = meshesOf(a);
    if (window.__conchRuntimeGeometry === null) window.__conchRuntimeGeometry = meshes.map((mesh, meshIndex) => ({
      meshIndex, name: mesh.name, positions: Array.from(mesh.geometry.getAttribute('position').array),
      indices: Array.from(mesh.geometry.getAttribute('skinIndex').array), weights: Array.from(mesh.geometry.getAttribute('skinWeight').array),
      triangles: Array.from(mesh.geometry.index?.array ?? []), bones: mesh.skeleton.bones.map(b => b.name),
      inverses: mesh.skeleton.boneInverses.map(m => m.toArray()), bind: mesh.bindMatrix.toArray(), bindMode: mesh.bindMode, world: mesh.matrixWorld.toArray(), bindInverse: mesh.bindMatrixInverse.toArray() }));
    const spec = control.current;
    return { ...clock(), sampleIndex: serial++, stage: a.mem['conch-st'], guard: a.mem['conch-guard'], clock: a.mem['regular-clock'],
      poseInput: lastPose, strike: JSON.parse(control.snapshot()).strike,
      strikeSpec: spec === null ? null : { id: spec.id, shape: spec.shape, range: spec.range, units: spec.units,
        windup: spec.windup, active: spec.active, recover: spec.recover, damage: spec.damage, motion: spec.motion },
      actorPosition: a.position.toArray(), actorYaw: a.yaw, scale: a.scale,
      playerPosition: d.player.position.toArray(), playerHp: d.arena.playerVitals.health,
      speed: a.speed, gait: a.phase, flinch: a.flinch, deathT: a.deathT, hp: a.hp, alive: a.alive,
      attackPhase: a.attackPhase, world: a.mesh.matrixWorld.toArray(),
      bones: Object.fromEntries(Object.entries(a.bones).map(([name, bone]) => [name, {
        local: [...bone.position, ...bone.quaternion, ...bone.scale], world: bone.matrixWorld.toArray() }])),
      arenaCenter: { ...d.arena.center },
      meshes: meshes.map(mesh => ({ bindMode: mesh.bindMode, world: mesh.matrixWorld.toArray(), bindInverse: mesh.bindMatrixInverse.toArray(),
        boneWorld: mesh.skeleton.bones.map(b => b.matrixWorld.toArray()) })) };
  };
  const event = (kind, extra = {}) => window.__conchEvents.push({ kind, ...record(), ...extra });
  const attach = () => {
    const a = d.arena.activeTargets[0]; if (!a || a === attached) return;
    attached = a; bout++; lastPose = null;
    const owner = d.arena.opponent, species = a.model.species, originalAnimate = species.animate;
    species.animate = function animate(c) { const sampled = input(c); const result = originalAnimate.call(this, c); lastPose = sampled; return result; };
    const originalHurt = owner.context.hurt;
    owner.context.hurt = function hurt(...args) { event('hurt-request-before', { requestedDamage: args[0] });
      const result = originalHurt.apply(this, args); event('hurt-request-after', { requestedDamage: args[0] }); return result; };
    const originalDamaged = a.onDamaged;
    a.onDamaged = function onDamaged(...args) { event('enemy-damage-before-presentation', { dealt: args[1], died: args[4], point: args[2].toArray() });
      const result = originalDamaged.apply(this, args); event('enemy-damage-after-presentation', { dealt: args[1], died: args[4] }); return result; };
    // Listen to the existing queued event stream. Never emit, consume, reorder or flush it.
    owner.events.on('damage.dealt', ({ req, dealt }) => event('damage.dealt', {
      dealt, target: req.target === owner.practicePlayer.health ? 'player' : 'enemy' }), owner.bout);
    event('bout-observer-attached');
  };
  const owner = d.arena.opponent, originalUpdate = owner.update;
  owner.update = function update(...args) { attach(); const result = originalUpdate.apply(this, args); return result; };
  attach();
  const originalRender = g.composer.render;
  g.viewmodel.visible = false;
  const label = document.createElement('div');
  label.style.cssText = 'pointer-events:none;position:fixed;top:200px;left:8px;right:8px;color:white;background:#000b;z-index:99999;padding:8px;font:12px monospace';
  document.body.append(label);
  g.composer.render = function render(...args) {
    const a = d.arena.activeTargets[0]; if (!a) return originalRender.apply(this, args);
    attach();
    const position = g.camera.position.clone(), quaternion = g.camera.quaternion.clone();
    g.camera.position.set(a.position.x + 4.4, a.position.y + 3.2, a.position.z + 6.4);
    g.camera.lookAt(a.position.x, a.position.y + 1.05, a.position.z); g.camera.updateMatrixWorld(true);
    const row = record(); row.camera = { position: g.camera.position.toArray(), quaternion: g.camera.quaternion.toArray(),
      restoredPosition: position.toArray(), restoredQuaternion: quaternion.toArray() };
    window.__conchRenderTrace.push(row);
    label.textContent = `CONCH4 ${window.__public4VariantLabel} · NORMAL CLOCK · FOLLOW CAMERA · ${window.__conchPhase} · f${row.frame} · ${row.gameTime.toFixed(3)}s · ${row.strike.phase}/${row.strike.elapsed.toFixed(3)} · mem ${row.clock?.toFixed(3)} · p${row.poseInput?.poseIndex ?? 'pending'}`;
    try { return originalRender.apply(this, args); }
    finally { g.camera.position.copy(position); g.camera.quaternion.copy(quaternion); g.camera.updateMatrixWorld(true); }
  };
  return { ...clock(), scope: 'Passive read-through owner wrappers. Full weighted geometry, render/world matrices, actual StrikeRunner snapshot, authored frame.attack and separate pose evaluation clocks. Damage records retain previous evaluated pose; never animate on observation.',
    camera: { offset: [4.4, 3.2, 6.4], targetOffset: [0, 1.05, 0], restoredAfterRender: true, viewmodelHidden: true },
    timebase: { performanceTimeOrigin: performance.timeOrigin, videoMapping: 'Burned-in frame/game clock anchors only. Exact codec cadence and timestamps are measured from completed video; no assumed render-to-video correspondence.' } };
}
