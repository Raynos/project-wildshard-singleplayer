/** Pure, fail-closed observations. No renderer internals or mutation. */
export function checkFirstUse(s) {
  if (s.backendBuilds !== null && s.backendBuilds !== 0) throw new Error('Node backend has already compiled or has unknown build count');
  if (s.programCount !== 0 || s.renderFrame !== 0 || s.renderCalls !== 0 || s.gameFrame !== 0 || s.gameTime !== 0)
    throw new Error('First-use renderer/clock evidence is not pristine');
  if (s.graphReceivers !== 0) throw new Error('Graph receiver already exists at prepare seam');
  if (s.hasFilter) throw new Error('Expected undefined first-use filterNode');
  checkRig(s.rig);
  return true;
}
export function checkRig(r) {
  if (r.cascades !== 1 || r.shadowLights !== 1 || r.sceneShadowLights !== 1 || r.mode !== 'practical' ||
      r.maxFar !== 80 || r.margin !== 60 || r.fade !== true || r.mapSize[0] !== 1024 || r.mapSize[1] !== 1024 ||
      r.radius !== 2 || r.bias !== -0.00012 || r.normalBias !== 0.05 || r.breaks.length !== 1 || r.breaks[0] !== 1)
    throw new Error('Diagnostic requires unchanged one-map phone rig');
}
export function assertComparable(control, tent) {
  if (JSON.stringify(control) !== JSON.stringify(tent)) throw new Error('Actual control/tent observation differs');
}
export function assertShader(fragment, variant) {
  if (typeof fragment !== 'string' || fragment.length < 100) throw new Error('Missing actual selected fragment');
  // Tokens come from generated arithmetic, never filter function names or configuration flags.
  const tent = /2704(?:\.0)?/u.test(fragment) && /144(?:\.0)?/u.test(fragment) && /floor\s*\(/u.test(fragment);
  const vogel = /2\.399963/u.test(fragment), noise = /52\.9829189/u.test(fragment);
  if (variant === 'tent' ? (!tent || vogel || noise) : (variant !== 'control' || tent || !vogel || !noise))
    throw new Error('Actual selected fragment does not prove the required shadow path');
}
