/** Isolated rest comparison only. Actual host/composer/materials, no simulation or bone writes. */
import { Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
const SOURCE = '/selected-source-21a6fd0d5e300c58952408913c69824228304141daab461fcb0122a388e27f1a.glb';
const directions = { front:[0,0,-1], left:[1,0,0], right:[-1,0,0], back:[0,0,1], top:[0,1,0],
  'diag-front':[0,.8,-1], 'diag-left':[1,.8,0], 'diag-right':[-1,.8,0], 'diag-back':[0,.8,1] };
window.__selectedComparison = { ready:false, error:null };
window.__installSelectedComparison = async () => {
  const d = window.__practiceDemo, g = d?.game, a = d?.arena.activeTargets[0];
  if (!a || !g) throw new Error('Selected comparison needs one actual arena actor');
  const gltf = await new GLTFLoader().loadAsync(SOURCE), source = gltf.scene;
  source.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(source), center = bounds.getCenter(new Vector3()), size = bounds.getSize(new Vector3());
  const nativeMeshes = [];
  a.mesh.traverse(mesh => { if(mesh.isSkinnedMesh) nativeMeshes.push(mesh); });
  if(nativeMeshes.length < 1 || nativeMeshes.reduce((n,m)=>n+m.geometry.getAttribute('position').count,0)!==6570 || nativeMeshes.some(m=>m.skeleton.bones.length!==15)) throw new Error('Selected comparison requires 6570 vertices and the exact 15-bone rig');
  const geometry = nativeMeshes.map(mesh => ({ name:mesh.name,
    attributes:Object.fromEntries(['position','normal','color','skinIndex','skinWeight','furLen'].map(name => {
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
    const target=center.clone().applyMatrix4(a.mesh.matrixWorld), scale=a.mesh.getWorldScale(new Vector3()).length()/Math.sqrt(3);
    const radius=size.length()*.5*scale, fov=35, aspect=g.camera.aspect;
    const distance=radius/Math.sin(Math.atan(Math.tan(fov*Math.PI/360)*Math.min(1,aspect)))*1.08;
    const direction=new Vector3(...directions[state.view]).normalize().transformDirection(a.mesh.matrixWorld);
    g.camera.fov=fov; g.camera.up.set(0,1,0);
    if(state.view==='top') g.camera.up.set(0,0,-1).transformDirection(a.mesh.matrixWorld);
    g.camera.position.copy(target).addScaledVector(direction,distance);g.camera.lookAt(target);g.camera.updateProjectionMatrix();g.camera.updateMatrixWorld(true);
    g.viewmodel.visible=false; a.mesh.visible=state.variant==='native'; source.visible=state.variant==='source';
    state.last={view:state.view,variant:state.variant,frame:++state.frame,gameFrame:g.frameCount,gameTime:g.frameTime,root:a.mesh.matrixWorld.toArray(),
      sourceRoot:source.matrixWorld.toArray(),camera:{position:g.camera.position.toArray(),quaternion:g.camera.quaternion.toArray(),fov,aspect,target:target.toArray(),distance},
      bones:Object.fromEntries(Object.entries(a.bones).map(([name,b])=>[name,{position:b.position.toArray(),rotation:b.rotation.toArray().slice(0,3),scale:b.scale.toArray(),world:b.matrixWorld.toArray()}])),
      meshes:nativeMeshes.map(mesh=>{mesh.skeleton.update();return {world:mesh.matrixWorld.toArray(),bindInverse:mesh.bindMatrixInverse.toArray(),boneMatrices:Array.from(mesh.skeleton.boneMatrices)};})};
    label.textContent=`CORRECTED CONCH · REST DIAGNOSTIC\n${state.variant==='native'?'NATIVE · ACTUAL FACETED HOST':'SOURCE GLB · SOURCE MATERIALS'} · ${state.view}\nNO ANIMATION / GAMEPLAY ACCEPTANCE`;
    try {
      if(state.requestPair) {
        state.requestPair=false;
        const common=structuredClone(state.last), captures={}, lightBefore=lights(), renderedLights={};
        for(const variant of ['native','source']) {
          a.mesh.visible=variant==='native';source.visible=variant==='source';
          originalRender.apply(this,args);
          captures[variant]=g.renderer.domElement.toDataURL('image/png');
          renderedLights[variant]=lights();
        }
        state.pair={...common, captures, renderPasses:2, identicalSimulationObservation:true,
          nativeRoot:a.mesh.matrixWorld.toArray(),sourceRoot:source.matrixWorld.toArray(),
          lightState:{before:lightBefore,native:renderedLights.native,source:renderedLights.source,after:lights()},
          scope:'Two synchronous actual composer passes; visibility-only switch. Diagnostic cadence, never gameplay/animation evidence.'};
        return;
      }
      return originalRender.apply(this,args);
    } finally{g.viewmodel.visible=saved.viewmodel;a.mesh.visible=originalVisible;source.visible=false;g.camera.position.copy(saved.position);g.camera.quaternion.copy(saved.quaternion);g.camera.up.copy(saved.up);g.camera.fov=saved.fov;g.camera.updateProjectionMatrix();g.camera.updateMatrixWorld(true);}
  };
  return {geometry,sourceMaterials,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},directions};
};
