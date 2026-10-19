/** Read-only telemetry and receiveShadow-only diagnostic inside the existing synchronous camera adapter. */
export function installReceivedShadowDiagnostic() {
  const g=window.__practiceDemo.game, actor=window.__practiceDemo.arena.activeTargets[0];
  const meshes=[];actor.mesh.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
  const originals=meshes.map(o=>o.receiveShadow);
  if(!meshes.length || originals.some(v=>v!==true))throw new Error('Expected original receiveShadow=true on every candidate mesh');
  const materialRows=()=>meshes.map(o=>({id:o.id,uuid:o.uuid,geometry:o.geometry.uuid,receiveShadow:o.receiveShadow,castShadow:o.castShadow,materials:(Array.isArray(o.material)?o.material:[o.material]).map(m=>({uuid:m.uuid,version:m.version,type:m.type,color:m.color?.toArray(),emissive:m.emissive?.toArray(),roughness:m.roughness,metalness:m.metalness,flatShading:m.flatShading,side:m.side,toneMapped:m.toneMapped}))}));
  const lights=()=>{const rows=[];g.scene.traverse(o=>{if(o.isLight)rows.push({id:o.id,type:o.type,color:o.color.toArray(),intensity:o.intensity,world:o.matrixWorld.toArray(),castShadow:o.castShadow,shadow:o.shadow?{bias:o.shadow.bias,normalBias:o.shadow.normalBias,radius:o.shadow.radius,mapSize:o.shadow.mapSize.toArray(),filterType:o.shadow.filterNode?.constructor.name,filterId:o.shadow.filterNode?.uuid,filterSource:o.shadow.filterNode?String(o.shadow.filterNode).slice(0,1000):null}:null});});return rows;};
  const programs=()=>meshes.map(o=>(Array.isArray(o.material)?o.material:[o.material]).map(m=>{const p=g.renderer.properties?.get(m);const program=p?.currentProgram; const gl=g.renderer.getContext?.();return {material:m.uuid,propertyKeys:p?Object.keys(p):[],programId:program?.id,cacheKey:program?.cacheKey,fragment:program?.fragmentShader&&gl?gl.getShaderSource(program.fragmentShader):null};}));
  const state={request:false,result:null,error:null,initial:materialRows(),originals,telemetry:{gameKeys:Object.keys(g),rendererType:g.renderer.constructor.name,composerType:g.composer.constructor.name,composerKeys:Object.keys(g.composer),passes:g.composer.passes?.map(p=>({type:p.constructor.name,enabled:p.enabled})),tier:g.tier??null}};
  window.__receivedShadowDiagnostic=state;
  const render=g.composer.render;
  g.composer.render=function(...args){
    if(!state.request)return render.apply(this,args);
    state.request=false;
    const common=structuredClone(window.__selectedComparison.last),before=materialRows(),lightBefore=lights(),captures={},states={};
    try {
      // Warm both cache variants at this exact observation; no extra simulation frames.
      for(const receive of [true,false,true]){meshes.forEach(o=>o.receiveShadow=receive);render.apply(this,args);}
      for(const [name,receive] of [['on',true],['off',false],['restored',true]]){
        meshes.forEach(o=>o.receiveShadow=receive);render.apply(this,args);
        captures[name]=g.renderer.domElement.toDataURL('image/png');
        states[name]={meshes:materialRows(),lights:lights(),programs:programs(),root:actor.mesh.matrixWorld.toArray(),camera:{position:g.camera.position.toArray(),quaternion:g.camera.quaternion.toArray()},gameFrame:g.frameCount,gameTime:g.frameTime};
      }
      state.result={common,before,lightBefore,captures,states};
    }catch(e){state.error=String(e);throw e;}
    finally{meshes.forEach((o,i)=>o.receiveShadow=originals[i]);if(state.result)state.result.after=materialRows();}
  };
  state.restore=()=>{meshes.forEach((o,i)=>o.receiveShadow=originals[i]);return materialRows();};
  return {initial:state.initial,telemetry:state.telemetry};
}
