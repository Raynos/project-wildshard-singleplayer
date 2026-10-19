/** Isolated rest comparison only. Actual host/composer/materials, no simulation or bone writes. */
import { compileGraph } from '../../../../src/engine/render/graph/compile';
import { lentToon } from '../../../../src/game/shardfile/lentLooks';
import graphs from '../../../../src/shards/driftwood-isle/data/lookGraphs.json';
import candidateGraph from '../selected-native-color/graph.json';
import { Box3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
const SOURCE = '/selected-source-21a6fd0d5e300c58952408913c69824228304141daab461fcb0122a388e27f1a.glb';
import { fitViews, DIRECTIONS as directions } from './camera-fit.mjs';
window.__selectedComparison = { ready:false, error:null };
window.__installSelectedComparison = async () => {
  const d = window.__practiceDemo, g = d?.game, a = d?.arena.activeTargets[0];
  if (!a || !g) throw new Error('Selected comparison needs one actual arena actor');
  const gltf = await new GLTFLoader().loadAsync(SOURCE), source = gltf.scene;
  source.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(source);
  a.mesh.updateMatrixWorld(true);
  const initialCameraFit=fitViews(bounds,a.mesh.matrixWorld,g.camera.aspect,g.camera.near,g.camera.far);
  const nativeMeshes = [];
  a.mesh.traverse(mesh => { if(mesh.isSkinnedMesh) nativeMeshes.push(mesh); });
  if(nativeMeshes.length < 1 || nativeMeshes.reduce((n,m)=>n+m.geometry.getAttribute('position').count,0)!==6570 || nativeMeshes.some(m=>m.skeleton.bones.length!==15)) throw new Error('Selected comparison requires 6570 vertices and the exact 15-bone rig');
  const baselineGraph = graphs.looks['driftwood-creature'];
  const restored = {...candidateGraph,nodes:{...candidateGraph.nodes,paint:{op:'vertexColour'}}};
  const canonical = value => JSON.stringify(value, (_key,item) => item && typeof item==='object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))) : item);
  if(canonical(restored)!==canonical(baselineGraph)) throw new Error('Only paint input may differ');
  const toon = lentToon('driftwood-creature');
  const originals = nativeMeshes.map(mesh=>mesh.material);
  const candidates = originals.map(material=>{ if(Array.isArray(material)) {if(material.length!==1)throw new Error('Expected one body material'); return material[0];} return material; });
  const baselines = candidates.map(material=>{
    const baseline=compileGraph(baselineGraph,{toon}).material;
    for(const name of ['color','emissive']) baseline[name].copy(material[name]);
    for(const name of ['side','flatShading','roughness','metalness','emissiveIntensity','opacity','transparent','depthTest','depthWrite','fog','toneMapped']) baseline[name]=material[name];
    return baseline;
  });
  const select = variant => nativeMeshes.forEach((mesh,index)=>{mesh.material=variant==='baseline'?(Array.isArray(originals[index])?[baselines[index]]:baselines[index]):originals[index];});
  const geometry = nativeMeshes.map(mesh => ({ name:mesh.name,
    attributes:Object.fromEntries(['position','normal','color','skinIndex','skinWeight','furLen','aAuthoredColour'].map(name => {
      const attr = mesh.geometry.getAttribute(name); if(!attr) throw new Error(`Missing ${name}`);
      return [name, { itemSize:attr.itemSize, normalized:attr.normalized, type:attr.array.constructor.name, values:Array.from(attr.array) }]; })),
    bones:mesh.skeleton.bones.map(b => b.name), inverses:mesh.skeleton.boneInverses.map(m => m.toArray()), bind:mesh.bindMatrix.toArray(),
    material:Array.isArray(mesh.material) ? mesh.material.map(m => ({type:m.type,name:m.name,side:m.side,color:m.color?.toArray(),vertexColors:m.vertexColors})) : {type:mesh.material.type,name:mesh.material.name,side:mesh.material.side,color:mesh.material.color?.toArray(),vertexColors:mesh.material.vertexColors} }));
  const sourceMaterials = [];
  source.traverse(mesh => { if(mesh.isMesh) { sourceMaterials.push({name:mesh.name,type:mesh.material.type,color:mesh.material.color?.toArray(),side:mesh.material.side}); mesh.castShadow=true; mesh.receiveShadow=true; } });
  source.matrixAutoUpdate = false;
  a.mesh.parent.add(source); source.visible=false;
  const lights=()=>{const rows=[];g.scene.traverse(o=>{if(o.isLight) rows.push({name:o.name,type:o.type,color:o.color.toArray(),intensity:o.intensity,world:o.matrixWorld.toArray()});});return rows;};
  const originalRender=g.composer.render, originalVisible=a.mesh.visible;
  const state = { ready:true, error:null, view:'front', variant:'native', frame:0, requestPair:false, pair:null, geometry, sourceMaterials,
    scope:'REST DIAGNOSTIC. Data-only zero-rotation pose. Camera and source-display visibility only. Actual arena host/composer, unchanged native shaders. No animation or gameplay acceptance.', last:null };
  window.__selectedComparison=state;
  const label=document.createElement('div'); label.style.cssText='pointer-events:none;position:fixed;top:180px;left:8px;right:8px;color:white;background:#000c;z-index:99999;padding:8px;font:12px monospace'; document.body.append(label);
  g.composer.render=function render(...args) {
    if(d.arena.activeTargets[0]!==a) { state.error='Actual actor changed'; return originalRender.apply(this,args); }
    const saved={viewmodel:g.viewmodel.visible,position:g.camera.position.clone(), quaternion:g.camera.quaternion.clone(), up:g.camera.up.clone(), fov:g.camera.fov};
    const rotations=Object.fromEntries(Object.entries(a.bones).map(([name,b])=>[name,b.rotation.toArray().slice(0,3)]));
    if(Object.values(rotations).some(values=>values.some(v=>Math.abs(v)>1e-8))) { state.error='Native joints are not in admitted rest pose'; return originalRender.apply(this,args); }
    a.mesh.updateMatrixWorld(true); source.matrix.copy(a.mesh.matrix); source.updateMatrixWorld(true);
    let cameraFit;
    try{cameraFit=fitViews(bounds,a.mesh.matrixWorld,g.camera.aspect,g.camera.near,g.camera.far);}catch(error){state.error=String(error);return originalRender.apply(this,args);}
    const {fov,aspect,distance,target}=cameraFit, view=cameraFit.views[state.view];
    g.camera.fov=fov;g.camera.up.fromArray(view.up);g.camera.position.fromArray(view.position);g.camera.quaternion.fromArray(view.quaternion);g.camera.updateProjectionMatrix();g.camera.updateMatrixWorld(true);
    g.viewmodel.visible=false; select(state.variant); a.mesh.visible=state.variant!=='source'; source.visible=state.variant==='source';
    state.last={view:state.view,variant:state.variant,frame:++state.frame,gameFrame:g.frameCount,gameTime:g.frameTime,root:a.mesh.matrixWorld.toArray(),
      sourceRoot:source.matrixWorld.toArray(),camera:{position:g.camera.position.toArray(),quaternion:g.camera.quaternion.toArray(),fov,aspect,target,distance,room:cameraFit.room,worldCorners:cameraFit.worldCorners,projectedCorners:view.projectedCorners},
      bones:Object.fromEntries(Object.entries(a.bones).map(([name,b])=>[name,{position:b.position.toArray(),rotation:b.rotation.toArray().slice(0,3),scale:b.scale.toArray(),world:b.matrixWorld.toArray()}])),
      meshes:nativeMeshes.map(mesh=>{mesh.skeleton.update();return {world:mesh.matrixWorld.toArray(),bindInverse:mesh.bindMatrixInverse.toArray(),boneMatrices:Array.from(mesh.skeleton.boneMatrices)};})};
    label.textContent=`CORRECTED CONCH · REST DIAGNOSTIC\n${state.variant==='native'?'NATIVE · ACTUAL FACETED HOST':'SOURCE GLB · SOURCE MATERIALS'} · ${state.view}\nNO ANIMATION / GAMEPLAY ACCEPTANCE`;
    try {
      if(state.requestPair) {
        state.requestPair=false;
        const common=structuredClone(state.last), captures={}, lightBefore=lights(), renderedLights={};
        for(const variant of ['baseline','native','source']) {
          select(variant); a.mesh.visible=variant!=='source';source.visible=variant==='source';
          originalRender.apply(this,args);
          captures[variant]=g.renderer.domElement.toDataURL('image/png');
          renderedLights[variant]=lights();
        }
        state.pair={...common, captures, renderPasses:3, identicalSimulationObservation:true,
          nativeRoot:a.mesh.matrixWorld.toArray(),sourceRoot:source.matrixWorld.toArray(),
          lightState:{before:lightBefore,baseline:renderedLights.baseline,native:renderedLights.native,source:renderedLights.source,after:lights()},
          scope:'Three synchronous actual composer passes; comparison-only baseline material switch through unchanged compileGraph and source visibility switch. Diagnostic cadence, never gameplay/animation evidence.'};
        return;
      }
      return originalRender.apply(this,args);
    } finally{select('native');g.viewmodel.visible=saved.viewmodel;a.mesh.visible=originalVisible;source.visible=false;g.camera.position.copy(saved.position);g.camera.quaternion.copy(saved.quaternion);g.camera.up.copy(saved.up);g.camera.fov=saved.fov;g.camera.updateProjectionMatrix();g.camera.updateMatrixWorld(true);}
  };
  return {geometry,sourceMaterials,baselineGraph,candidateGraph,initialCameraFit,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},directions};
};
