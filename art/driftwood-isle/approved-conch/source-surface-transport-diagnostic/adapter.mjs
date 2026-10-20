/** One REST-only authored-surface transport experiment, no production edits. */
export async function installTransport(data) {
  const demo=window.__practiceDemo,g=demo.game,a=demo.arena.activeTargets[0];
  const fail=(condition,message)=>{if(!condition)throw new Error(message);};
  const same=(x,y)=>JSON.stringify(x)===JSON.stringify(y);
  const children=new Set(a.mesh.parent.children);
  const setup=await window.__installSelectedComparison();
  const added=a.mesh.parent.children.filter(o=>!children.has(o));fail(added.length===1,'Source root not unique');
  const source=added[0],native=[];a.mesh.traverse(o=>{if(o.isSkinnedMesh)native.push(o);});
  fail(native.length===1,'Expected single merged native mesh');const mesh=native[0];
  const original={geometry:mesh.geometry,material:mesh.material,frameGate:g.frameGate,clockRunning:g.clock.running,after:mesh.onAfterRender};
  const attr=name=>Array.from(mesh.geometry.getAttribute(name).array);
  for(const name of ['position','skinIndex','skinWeight']) fail(same(attr(name),data[name==='position'?'positions':name]),`Native ${name} differs from pinned source transport`);
  fail(!mesh.geometry.index,'Expected expanded unindexed native geometry');
  fail(same(mesh.skeleton.bones.map(b=>b.name),data.bones.map(b=>b.name)),'Bone order changed');
  const geometry=mesh.geometry.clone(),normal=geometry.getAttribute('normal').clone();normal.array.set(data.normals);normal.needsUpdate=true;geometry.setAttribute('normal',normal);geometry.clearGroups();
  for(const group of data.groups)geometry.addGroup(group.start,group.count,group.materialIndex);
  fail(same(Array.from(normal.array),data.normals),'Source normals did not restore exactly');
  const materialState=m=>({type:m.type,name:m.name,color:m.color?.toArray(),emissive:m.emissive?.toArray(),roughness:m.roughness,metalness:m.metalness,side:m.side,flatShading:m.flatShading,vertexColors:m.vertexColors,opacity:m.opacity,transparent:m.transparent,alphaTest:m.alphaTest,toneMapped:m.toneMapped,depthTest:m.depthTest,depthWrite:m.depthWrite,blending:m.blending,normalScale:m.normalScale?.toArray(),envMapIntensity:m.envMapIntensity,wireframe:m.wireframe,polygonOffset:m.polygonOffset,shadowSide:m.shadowSide,map:m.map?.uuid??null,normalMap:m.normalMap?.uuid??null});
  const rawMeshes=[],sourceMaterials=new Map();source.traverse(o=>{if(o.isMesh){rawMeshes.push(o);fail(!Array.isArray(o.material),'Unexpected source material array');const m=o.material;sourceMaterials.set(m.name,m);}});
  const materials=data.materials.map(row=>{
    const m=sourceMaterials.get(row.name);fail(!!m,`Missing source material ${row.name}`);const p=row.pbrMetallicRoughness;
    fail(m.type==='MeshStandardMaterial'&&same(m.color.toArray(),p.baseColorFactor.slice(0,3))&&m.roughness===p.roughnessFactor&&m.metalness===p.metallicFactor&&m.side===2&&!m.flatShading&&!m.vertexColors&&m.opacity===1&&!m.transparent,'Source material contract differs');
    const clone=m.clone();fail(same(materialState(clone),materialState(m)),'Cloned source material settings drift');return clone;
  });
  fail(rawMeshes.length===95 && sourceMaterials.size===14,'Unexpected GLTFLoader primitive/material count');
  const arraysBefore={};for(const [k,v] of Object.entries(original.geometry.attributes))arraysBefore[k]=Array.from(v.array);
  const rig=()=>({root:a.mesh.matrixWorld.toArray(),sourceRoot:source.matrixWorld.toArray(),meshWorld:mesh.matrixWorld.toArray(),bind:mesh.bindMatrix.toArray(),bindInverse:mesh.bindMatrixInverse.toArray(),inverses:mesh.skeleton.boneInverses.map(m=>m.toArray()),bones:mesh.skeleton.bones.map(b=>({name:b.name,position:b.position.toArray(),quaternion:b.quaternion.toArray(),scale:b.scale.toArray(),world:b.matrixWorld.toArray()})),boneMatrices:Array.from(mesh.skeleton.boneMatrices)});
  a.mesh.updateMatrixWorld(true);mesh.skeleton.update();const initialRig=rig();
  let maxRestDisplacement=0;const point=mesh.position.clone();
  for(let i=0;i<6570;i++){point.fromBufferAttribute(original.geometry.getAttribute('position'),i);const before=point.clone();mesh.applyBoneTransform(i,point);maxRestDisplacement=Math.max(maxRestDisplacement,point.distanceTo(before));}
  // Original retained capture independently reproduces 24.323 micrometres from f32 weights at world Y=900.
  fail(maxRestDisplacement<5e-5,`Native rest precision exceeded 50 micrometres: ${maxRestDisplacement}`);
  const lights=()=>{const rows=[];g.scene.traverse(o=>{if(o.isLight)rows.push({type:o.type,name:o.name,color:o.color.toArray(),intensity:o.intensity,world:o.matrixWorld.toArray(),target:o.target?.matrixWorld.toArray(),ground:o.groundColor?.toArray(),castShadow:o.castShadow,shadow:o.shadow?{bias:o.shadow.bias,normalBias:o.shadow.normalBias,radius:o.shadow.radius,mapSize:o.shadow.mapSize.toArray(),matrix:o.shadow.matrix.toArray(),cameraProjection:o.shadow.camera.projectionMatrix.toArray(),cameraWorld:o.shadow.camera.matrixWorld.toArray()}:null});});return rows;};
  const camera=()=>({position:g.camera.position.toArray(),quaternion:g.camera.quaternion.toArray(),up:g.camera.up.toArray(),projection:g.camera.projectionMatrix.toArray(),world:g.camera.matrixWorld.toArray(),fov:g.camera.fov,aspect:g.camera.aspect,near:g.camera.near,far:g.camera.far});
  let observed=[],shaderSources=[],shaderIds=new Map();const gl=g.renderer.getContext();
  const hooks=[mesh,...rawMeshes].map(o=>({o,after:o.onAfterRender}));
  for(const h of hooks)h.o.onAfterRender=function(...args){h.after.apply(this,args);const material=args[4],program=gl.getParameter(gl.CURRENT_PROGRAM);fail(!!program,'No actual draw program');fail(gl.getProgramParameter(program,gl.LINK_STATUS),'Unlinked draw program');const shaders=gl.getAttachedShaders(program).map(s=>({type:gl.getShaderParameter(s,gl.SHADER_TYPE),source:gl.getShaderSource(s)}));const key=JSON.stringify(shaders);if(!shaderIds.has(key)){shaderIds.set(key,shaderSources.length);shaderSources.push(shaders);}observed.push({mesh:this.name,material:materialState(material),group:args[5],program:shaderIds.get(key),castShadow:this.castShadow,receiveShadow:this.receiveShadow,camera:camera()});};
  g.frameGate=()=>false;g.clock.stop();
  const clocks=()=>({frame:g.frameCount,time:g.frameTime,clock:g.clock.elapsedTime,simulation:g.app.clock.snapshot()});
  const frozen=clocks();
  const restoreRefs=()=>{mesh.geometry=original.geometry;mesh.material=original.material;};
  const restore=()=>{restoreRefs();for(const h of hooks)h.o.onAfterRender=h.after;g.frameGate=original.frameGate;if(original.clockRunning)g.clock.start();geometry.dispose();materials.forEach(m=>m.dispose());return {geometryRestored:mesh.geometry===original.geometry,materialRestored:mesh.material===original.material,arraysUnchanged:Object.entries(original.geometry.attributes).every(([k,v])=>same(Array.from(v.array),arraysBefore[k]))};};
  window.__transport={capture(view){
    const state=window.__selectedComparison;state.view=view;state.requestPair=false;
    const captures={},states={};const before=rig();shaderSources=[];shaderIds=new Map();
    const apply=name=>{restoreRefs();state.variant=name==='raw-source'?'source':'native';if(name==='source-contract-native'){mesh.geometry=geometry;mesh.material=materials;}};
    try {
      for(const name of ['baseline-native','source-contract-native','raw-source','restored-baseline']){apply(name);g.composer.render(0);fail(!state.error,state.error);}
      for(const name of ['baseline-native','source-contract-native','raw-source','restored-baseline']){
        apply(name);observed=[];g.composer.render(0);fail(!state.error,state.error);fail(same(clocks(),frozen),'Simulation/clock moved within REST quartet');
        fail(observed.length===(name==='raw-source'||name==='source-contract-native'?95:1),`Unexpected operative selected draw count ${name}: ${observed.length}`);
        states[name]={comparison:structuredClone(state.last),draws:observed,lights:lights(),rig:rig(),clocks:clocks(),shadow:{enabled:g.renderer.shadowMap.enabled,type:g.renderer.shadowMap.type,autoUpdate:g.renderer.shadowMap.autoUpdate},renderer:{toneMapping:g.renderer.toneMapping,exposure:g.renderer.toneMappingExposure,outputColorSpace:g.renderer.outputColorSpace},composer:g.composer.passes.map(p=>({type:p.constructor.name,enabled:p.enabled}))};
        captures[name]=g.renderer.domElement.toDataURL('image/png');
      }
      fail(captures['baseline-native']===captures['restored-baseline'],'Restored baseline PNG changed');
      const base=states['baseline-native'];for(const s of Object.values(states)){
        fail(same(s.lights,base.lights),'Lighting drift inside quartet');fail(same(s.comparison.camera,base.comparison.camera),'Camera drift inside quartet');fail(same(s.rig,base.rig),'Rig drift inside quartet');
      }
      return {view,captures,states,shaderSources,before,initialRig,restoration:true};
    }finally{restoreRefs();state.variant='native';}
  },restore};
  return {setup,materials:materials.map(materialState),groups:geometry.groups,checks:{maxRestDisplacement,exactPositions:19710,exactNormals:19710,exactSkinIndices:data.skinIndex.length,exactSkinWeights:data.skinWeight.length,clonedGeometry:true,originalReferencesRetained:true},initialRig,frozen};
}
