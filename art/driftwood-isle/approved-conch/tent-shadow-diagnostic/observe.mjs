/** Common control/candidate observation module. Uses the COMMON public pre-start rest controls. */
import '../selected-native-color-view/comparison.mjs';
import { firstUseEvidence, inspectRig } from './first-use.mjs';
import { checkRig, assertShader, assertComparable } from './contract.mjs';
import { assertRest } from './rest-controls.mjs';
import { setting } from '../../../../src/engine/ui/Settings';
export async function installObservation() {
  const demo = window.__practiceDemo, game = demo.game, actor = demo.arena.activeTargets[0];
  if (!actor || demo.arena.activeTargets.length !== 1) throw new Error('Expected unique actual actor');
  assertRest(game);
  const identity = firstUseEvidence(game, 'prepared');
  const setup = await window.__installSelectedComparison();
  const gl = game.renderer.getContext(), programs = [];
  const meshes = [];
  actor.mesh.traverse(o => { if (o.isSkinnedMesh) meshes.push(o); });
  const originals = meshes.map(o => o.onAfterRender);
  for (const [i, mesh] of meshes.entries()) mesh.onAfterRender = function (...args) {
    originals[i].apply(this, args);
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (!materials.includes(args[4])) return;
    const program = gl.getParameter(gl.CURRENT_PROGRAM);
    if (!program) throw new Error('Selected draw has no active GPU program');
    const shaders = gl.getAttachedShaders(program);
    const fragment = shaders?.find(s => gl.getShaderParameter(s, gl.SHADER_TYPE) === gl.FRAGMENT_SHADER);
    const source = fragment ? gl.getShaderSource(fragment) : null;
    assertShader(source, identity.variant);
    const linked = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (linked !== true) throw new Error('Selected GPU program is not linked');
    programs.push({ mesh:i, name:mesh.name, fragment:source, linked });
  };
  const clocks = () => ({ frame:game.frameCount, time:game.frameTime, engineClock:game.clock.elapsedTime,
    simulation:game.app.clock.snapshot(), alpha:game.alpha, fixedSteps:game.fixedSteps });
  const effectiveVisible = object => { for (let o=object; o!==null; o=o.parent) if (!o.visible) return false; return true; };
  const actual = () => {
    const lights = [], receivers = [];
    game.scene.updateMatrixWorld(true);
    game.scene.traverse(o => {
      if (o.isLight) lights.push({ type:o.type, name:o.name, color:o.color.toArray(), intensity:o.intensity,
        world:o.matrixWorld.toArray(), target:o.target?.matrixWorld.toArray(), ground:o.groundColor?.toArray(), cast:o.castShadow,
        shadow:o.shadow ? { bias:o.shadow.bias, normalBias:o.shadow.normalBias, radius:o.shadow.radius,
          matrix:o.shadow.matrix.toArray(), camera:o.shadow.camera.projectionMatrix.toArray(), cameraWorld:o.shadow.camera.matrixWorld.toArray(),
          mapSize:o.shadow.mapSize.toArray(), map:o.shadow.map ? { width:o.shadow.map.width, height:o.shadow.map.height,
            depthFormat:o.shadow.map.depthTexture?.format, depthType:o.shadow.map.depthTexture?.type } : null,
          autoUpdate:o.shadow.autoUpdate } : null });
      if (o.isMesh && o.receiveShadow && effectiveVisible(o)) receivers.push({ name:o.name, type:o.type, cast:o.castShadow,
        materials:(Array.isArray(o.material) ? o.material : [o.material]).map(m => ({ type:m.type, node:m.isNodeMaterial === true,
          color:m.color?.toArray(), emissive:m.emissive?.toArray(), side:m.side, flatShading:m.flatShading, roughness:m.roughness,
          metalness:m.metalness, transparent:m.transparent, opacity:m.opacity, depthWrite:m.depthWrite, depthTest:m.depthTest, toneMapped:m.toneMapped })) });
    });
    return { clocks:clocks(), rig:inspectRig(game), lights, receivers, shadowType:game.renderer.shadowMap.type,
      shadowAutoUpdate:game.renderer.shadowMap.autoUpdate, fixedShadowSamples:setting('fixedShadowSamples'),
      background:game.scene.background?.toArray(), composer:game.composer.passes.map(p => ({ type:p.constructor.name, enabled:p.enabled })) };
  };
  const baselineClock = clocks();
  return { setup, identity, capture(view) {
    if (meshes.some(mesh => mesh.castShadow !== true || mesh.receiveShadow !== true)) throw new Error('Selected cast/receive flags changed');
    const startedAt = new Date().toISOString(), wallStart = performance.now();
    const comparison = window.__selectedComparison;
    comparison.view = view; comparison.variant = 'native';
    const captures = [], states = [];
    // The shared adapter sets the exact final camera inside composer.render. CSM must see THAT camera.
    const render = game.renderer.render;
    let updated = false;
    game.renderer.render = function (...args) {
      if (!updated) { updated = true; game.sky.update(0); game.shardFrame(); }
      return render.apply(this, args);
    };
    try {
      for (let pass = 0; pass < 4; pass++) {
        updated = false; programs.length = 0;
        game.composer.render(0);
        if (comparison.error) throw new Error(comparison.error);
        firstUseEvidence(game); checkRig(inspectRig(game)); assertComparable(baselineClock, clocks());
        if (new Set(programs.map(p => p.mesh)).size !== meshes.length) throw new Error('Selected draw evidence is incomplete');
        if (pass >= 2) {
          captures.push(game.renderer.domElement.toDataURL('image/png'));
          states.push({ ...actual(), observation:structuredClone(comparison.last), programs:structuredClone(programs) });
        }
      }
      if (captures[0] !== captures[1]) throw new Error('Repeated rest renders differ');
      // comparison.frame is harness bookkeeping, not a simulation control.
      const semantic = ({ programs:_programs, observation, ...state }) => {
        const { frame:_frame, ...controls } = observation;
        return { ...state, observation:controls };
      };
      assertComparable(semantic(states[0]), semantic(states[1]));
      return { realtime:{ startedAt, finishedAt:new Date().toISOString(), wallStart, wallEnd:performance.now() },
        image:captures[0], repeatByteIdentical:true, state:semantic(states[1]), programs:states[1].programs };
    } finally { game.renderer.render = render; }
  }, dispose() { meshes.forEach((mesh,i) => { mesh.onAfterRender = originals[i]; }); } };
}
