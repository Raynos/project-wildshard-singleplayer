/** Isolated host instrumentation; the only rendering mutation is the candidate's one assignment. */
import { installedGraphBackend } from '../../../../src/engine/render/graphBackend';
import { tentShadowFilter } from '../../../../src/engine/render/nodes/tentShadowFilter';
import { planeBiasShadowFilter } from '../../../../src/engine/render/nodes/planeBiasShadowFilter';
import { checkFirstUse } from './contract.mjs';
const observations = new WeakMap();
export function inspectRig(game) {
  const csm = game.sky.csm;
  const light = csm.lights[0];
  if (!light?.isDirectionalLight || !light.castShadow) throw new Error('Missing existing CSM shadow light');
  let sceneShadowLights = 0;
  game.scene.traverse(o => { if (o.isLight && o.castShadow) sceneShadowLights++; });
  return { cascades:csm.cascades, shadowLights:csm.lights.length, sceneShadowLights, mode:csm.mode,
    maxFar:csm.maxFar, margin:csm.lightMargin, fade:csm.fade, breaks:[...csm.breaks],
    mapSize:light.shadow.mapSize.toArray(), radius:light.shadow.radius, bias:light.shadow.bias, normalBias:light.shadow.normalBias };
}
export function firstUse(game, variant) {
  if (variant !== 'control' && variant !== 'tent') throw new Error('Unknown fixed diagnostic entry');
  if (observations.has(game)) throw new Error('First-use seam invoked twice');
  const backend = installedGraphBackend(game.renderer), info = game.renderer.info;
  const light = game.sky.csm.lights[0];
  let graphReceivers = 0;
  game.scene.traverse(o => { if (o.isMesh && (Array.isArray(o.material) ? o.material : [o.material]).some(m => m.isNodeMaterial)) graphReceivers++; });
  const before = { backendBuilds:backend === null ? null : backend.builds,
    programCount:Array.isArray(info.programs) ? info.programs.length : null,
    renderFrame:info.render.frame, renderCalls:info.render.calls, gameFrame:game.frameCount, gameTime:game.frameTime,
    graphReceivers, hasFilter:light?.shadow.filterNode !== undefined, rig:inspectRig(game) };
  checkFirstUse(before);
  if (variant === 'tent') light.shadow.filterNode = tentShadowFilter;
  observations.set(game, { variant, before, light });
}
export function firstUseEvidence(game, phase = 'compiled') {
  const state = observations.get(game);
  if (!state) throw new Error('Missing first-use evidence');
  const selected = state.variant === 'tent' ? tentShadowFilter : planeBiasShadowFilter;
  if (phase !== 'prepared' && phase !== 'compiled') throw new Error('Unknown observation phase');
  const expected = phase === 'prepared' && state.variant === 'control' ? undefined : selected;
  if (game.sky.csm.lights.length !== 1 || game.sky.csm.lights[0] !== state.light || state.light.shadow.filterNode !== expected)
    throw new Error('Existing light or imported filter identity changed');
  return { variant:state.variant, before:state.before, phase, importedFilterIdentity:expected === selected };
}
