/** Passive browser observer for explicitly identified private fixtures. Every wrapped owner call forwards once.
 * No pose evaluation, event flush, damage, clock step, body write or state restoration is permitted here. */
export function installNativeOwnerObservation(provenance) {
  const options = provenance === undefined ? { synthetic: true } : provenance;
  if (typeof options?.synthetic !== 'boolean') throw new Error('Explicit boolean observer provenance required');
  const demo = window.__practiceDemo;
  if (!demo?.arena.entered) throw new Error('Missing real private practice demo');
  const overlay = options.clockOverlay === true ? document.createElement('output') : null;
  if (overlay !== null) {
    overlay.id = 'native-owner-observation-clock';
    overlay.style.cssText = 'position:fixed;left:4px;top:4px;z-index:2147483647;pointer-events:none;background:#000;color:#fff;font:10px monospace;padding:3px;white-space:pre';
    document.body.append(overlay);
    demo.game.levelScope.onDispose(() => { overlay.remove(); });
  }
  const trace = { fixed: [], render: [], events: [], lifecycle: [], errors: [], overflow: false };
  // Compact mode is explicit so historical proof callers keep their original representation.
  // Definitions are exact source strings, not hashes, compressed payloads or reconstructed recipes.
  const compact = options.internDefinitions === true;
  const definitions = [], indexes = new Map();
  if (compact) Object.assign(trace, { schema: 'wildshard.native-owner.interned-trace.v1', definitions,
    encoding: 'Only pose.recipe and control.decision.contract are interned. json-string wrappers restore exact canonical JSON strings. All other fields and every row are retained.' });
  const intern = (kind, value) => {
    if (typeof value !== 'string') return value;
    let byValue = indexes.get(kind);
    if (!byValue) { byValue = new Map(); indexes.set(kind, byValue); }
    let id = byValue.get(value);
    if (id === undefined) { id = definitions.length; definitions.push({ kind, value }); byValue.set(value, id); }
    return { $nativeDefinition: id };
  };
  const encode = row => {
    if (!compact) return row;
    if (row.pose && typeof row.pose.recipe === 'string') row.pose.recipe = intern('pose.recipe', row.pose.recipe);
    if (typeof row.control === 'string') {
      const control = JSON.parse(row.control);
      // Noncanonical external strings remain verbatim rather than silently changing whitespace/key order.
      if (JSON.stringify(control) === row.control && typeof control.decision === 'string') {
        const decision = JSON.parse(control.decision);
        if (JSON.stringify(decision) === control.decision && typeof decision.contract === 'string') {
          decision.contract = intern('control.decision.contract', decision.contract);
          control.decision = { $nativeEncoding: 'json-string', value: decision };
          row.control = { $nativeEncoding: 'json-string', value: control };
        }
      }
    }
    return row;
  };
  window.__nativeOwnerTrace = trace; window.__nativeOwnerPhase = 'entry';
  let attached = null, attachedOwner = null, bout = 0;
  const append = (stream, value) => { if (trace[stream].length < 30000) trace[stream].push(encode(value)); else trace.overflow = true; };
  const observe = (stream, read) => {
    try { append(stream, read()); }
    catch (error) { if (trace.errors.length < 100) trace.errors.push({ stream, error: error instanceof Error ? error.message : String(error) }); else trace.overflow = true; }
  };
  const attachQuietly = () => {
    try { attach(); } catch (error) { if (trace.errors.length < 100) trace.errors.push({ stream: 'attach', error: error instanceof Error ? error.message : String(error) }); else trace.overflow = true; }
  };
  const stamp = () => ({ wallTime: performance.now(), frame: demo.game.frameCount, gameTime: demo.game.frameTime,
    alpha: demo.game.alpha, phase: window.__nativeOwnerPhase, bout });
  const sample = (owner = demo.arena.opponent) => {
    const native = owner?.native, view = owner?.targets[0];
    if (!native || !view) return { ...stamp(), missing: true };
    if (native.scope.disposed) return { ...stamp(), nativeScopeClosed: true, owner: native.corpse?.diagnostic() };
    const actor = native.actor, corpse = native.corpse, resource = corpse?.resource;
    const body = resource?.body, physical = body?.isValid() ? { handle: body.handle, enabled: body.isEnabled(),
      position: { ...body.translation() }, quaternion: { ...body.rotation() }, velocity: { ...body.linvel() } } : null;
    return { ...stamp(), nativeClock: { frame: native.host.clock.frame, now: native.host.clock.now },
      owner: corpse?.diagnostic(), nativeScopeClosed: native.scope.disposed,
      actor: { position: actor.position.toArray(), yaw: actor.yaw, hp: actor.hp, alive: actor.alive, state: actor.state,
        deathT: actor.deathT, memory: { ...actor.mem }, motor: actor.motor === null ? null : {
          enabled: actor.motor.collider.isEnabled(), handle: actor.motor.collider.handle } },
      control: native.control.snapshot(), pose: JSON.parse(native.pose.snapshot()), physical,
      view: { position: view.mesh.position.toArray(), quaternion: view.mesh.quaternion.toArray(),
        bones: Object.fromEntries(Object.entries(view.bones).map(([name, bone]) => [name, {
          position: bone.position.toArray(), quaternion: bone.quaternion.toArray(), scale: bone.scale.toArray() }])) },
      player: { position: demo.player.position.toArray(), vitals: demo.arena.playerVitals },
      loot: owner.loot?.receipt, capacity: { occupied: corpse?.lease.system?.occupied },
      physics: { bodies: native.host.physics.world.bodies.len(), colliders: native.host.physics.world.colliders.len(),
        controllers: native.host.physics.world.characterControllers.size } };
  };
  function attach() {
    const owner = demo.arena.opponent, native = owner?.native;
    if (!native || native === attached) return false;
    if (owner !== attachedOwner) {
      attachedOwner = owner;
      const originalRetry = owner.retry;
      owner.retry = function retry(...args) { const result = originalRetry.apply(this, args); attachQuietly(); return result; };
    }
    attached = native; bout++;
    observe('lifecycle', () => ({ event: 'attached', ...sample() }));
    const originalPre = native.preFixed, originalFixed = native.fixed, originalDispose = native.dispose;
    native.preFixed = function preFixed(...args) { const result = originalPre.apply(this, args); observe('fixed', () => ({ boundary: 'pre', ...sample(owner) })); return result; };
    native.fixed = function fixed(...args) { const result = originalFixed.apply(this, args); observe('fixed', () => ({ boundary: 'post', ...sample(owner) })); return result; };
    native.dispose = function dispose(...args) {
      observe('lifecycle', () => ({ event: 'dispose-before', ...stamp(), scopeClosed: native.scope.disposed, owner: native.corpse?.diagnostic() }));
      let returned = false;
      try { const result = originalDispose.apply(this, args); returned = true; return result; }
      finally { observe('lifecycle', () => ({ event: 'dispose-after', outcome: returned ? 'returned' : 'threw', ...stamp(),
        scopeClosed: native.scope.disposed, owner: native.corpse?.diagnostic(),
        remainingBodies: native.host.physics.disposed ? null : native.host.physics.world.bodies.len() })); }
    };
    owner.events.on('damage.dealt', ({ req, dealt, killed }) => observe('events', () => ({ event: 'damage.dealt',
      target: req.target === owner.practicePlayer.health ? 'player' : 'enemy', dealt, killed, point: req.point.toArray(), ...sample(owner) })), owner.bout);
    owner.events.on('actor.died', ({ actor }) => observe('events', () => ({ event: 'actor.died',
      target: actor.id === native.actor.entityId ? 'enemy' : 'player', ...sample(owner) })), owner.bout);
    return true;
  }
  attach();
  const composer = demo.game.composer, originalRender = composer.render;
  composer.render = function render(...args) {
    attachQuietly(); const result = originalRender.apply(this, args);
    observe('render', () => {
      const row = sample();
      if (overlay !== null) overlay.textContent = `PASSIVE DRAW ${row.frame} / BOUT ${row.bout}\nNATIVE ${row.nativeClock?.frame ?? 'closed'} / ${row.nativeClock?.now ?? '-'}s\nPERF ${row.wallTime.toFixed(3)}ms / ${row.phase}`;
      return row;
    });
    return result;
  };
  window.__nativeOwnerSample = sample;
  return { schema: 'wildshard.native-owner.passive-observer.v1', installed: stamp(),
    clocks: 'frame is Game.frameCount: completed draws before the current composer return increments it, not a fixed tick. nativeClock is the authoritative actor clock.',
    scope: 'Read-only snapshots after original pre/post/render calls and existing queued receipts; no extra evaluator or clock.',
    camera: 'Unmodified real player camera and viewmodel',
    clockOverlay: overlay !== null,
    traceEncoding: compact ? 'wildshard.native-owner.interned-trace.v1' : 'legacy-inline',
    clockCorrelation: 'When enabled, overlay is updated after the original draw from that same passive render sample. Match visible PERF/BOUT/NATIVE text to render trace rows; recorder may omit or repeat draws. Wall anchors alone are approximate, not exact video PTS mapping.', synthetic: options.synthetic, modelAdmission: false };
}

/** Reconstruct one row, not a second full trace. Reject invalid references rather than masking missing evidence. */
export function reconstructNativeOwnerRow(row, definitions) {
  const resolve = (reference, kind) => {
    if (reference === null || typeof reference !== 'object' || !Object.hasOwn(reference, '$nativeDefinition')) return reference;
    const definition = definitions[reference.$nativeDefinition];
    if (!definition || definition.kind !== kind || typeof definition.value !== 'string') throw new Error(`Invalid native definition: ${kind}`);
    return definition.value;
  };
  const restored = { ...row };
  if (row.pose) restored.pose = { ...row.pose, recipe: resolve(row.pose.recipe, 'pose.recipe') };
  if (row.control?.$nativeEncoding === 'json-string') {
    const control = { ...row.control.value };
    if (control.decision?.$nativeEncoding === 'json-string') {
      const decision = { ...control.decision.value };
      decision.contract = resolve(decision.contract, 'control.decision.contract');
      control.decision = JSON.stringify(decision);
    }
    restored.control = JSON.stringify(control);
  }
  return restored;
}
