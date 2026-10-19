/** Supplement the exact existing Conch4 passive/follow-camera recorder.
 * No render, animation, health, physics or clock is advanced by this supplement. */
export function installLiveEvidence(variant) {
 const d=window.__practiceDemo,g=d.game,gl=g.renderer.getContext();
 if(variant!=='original4'&&variant!=='tent')throw new Error('Unknown fixed observation variant');
 const state={variant,firstUse:variant==='tent'?window.__readPublic4TentFirstUse():null,errors:[],shaders:[],clocks:[],startedWall:performance.now(),frames:0,draws:0,traceBytes:0,eventsBytes:0,traceStartCount:window.__conchRenderTrace.length,meshes:0};
 window.__public4LiveEvidence=state;
 const light=g.sky.csm.lights[0],filter=light.shadow.filterNode,meshIds=new WeakMap(),programIds=new WeakMap();let nextMesh=0,nextProgram=0,traceCursor=0,eventCursor=0;
 const clock=()=>({wall:performance.now(),wallEpoch:performance.timeOrigin+performance.now(),frame:g.frameCount,time:g.frameTime,engineClock:g.clock.elapsedTime,simulation:g.app.clock.snapshot(),fixedSteps:g.fixedSteps,alpha:g.alpha,boutTime:d.arena.opponent.elapsed,fixedRemainder:d.arena.opponent.fixedTime,state:g.app.state,phase:window.__conchPhase});
 const fail=message=>{if(!state.errors.includes(message))state.errors.push(message);};
 const attach=()=>{
  for(const actor of d.arena.activeTargets)actor.mesh.traverse(mesh=>{
   if(!mesh.isSkinnedMesh||meshIds.has(mesh))return;
   const id=nextMesh++;state.meshes=nextMesh;meshIds.set(mesh,id);const original=mesh.onAfterRender;
   mesh.onAfterRender=function(...args){
    const result=original.apply(this,args);
    try {
     const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];if(!materials.includes(args[4]))return result;
     state.draws++;
     if(!mesh.castShadow||!mesh.receiveShadow)fail('Native cast/receive flag changed');
     const program=gl.getParameter(gl.CURRENT_PROGRAM);
     if(!program||gl.getProgramParameter(program,gl.LINK_STATUS)!==true){fail('Native draw has no linked program');return result;}
     let pid=programIds.get(program);if(pid===undefined){pid=nextProgram++;programIds.set(program,pid);}
     if(state.shaders.some(row=>row.mesh===id&&row.program===pid))return result;
     const shader=gl.getAttachedShaders(program)?.find(s=>gl.getShaderParameter(s,gl.SHADER_TYPE)===gl.FRAGMENT_SHADER),fragment=shader?gl.getShaderSource(shader):null;
     state.shaders.push({mesh:id,program:pid,name:mesh.name,linked:true,cast:mesh.castShadow,receive:mesh.receiveShadow,fragment,clock:clock()});
    }catch(error){fail(error.message);}return result;
   };
  });
 };
 const original=g.composer.render;
 g.composer.render=function(...args){
  attach();const result=original.apply(this,args);
  try {
   const c=clock();state.frames++;
   if(c.simulation.captureFps!==null||c.simulation.scale!==1)fail('Clock is not normal-speed live mode');
   if(g.sky.csm.lights.length!==1||g.sky.csm.lights[0]!==light||light.shadow.filterNode!==filter)fail('Light/filter identity changed');
   state.clocks.push(c);
   // Retain whole streams. A cap stops the attempt; it never silently drops frames.
   while(traceCursor<window.__conchRenderTrace.length)state.traceBytes+=new TextEncoder().encode(JSON.stringify(window.__conchRenderTrace[traceCursor++])).length;
   while(eventCursor<window.__conchEvents.length)state.eventsBytes+=new TextEncoder().encode(JSON.stringify(window.__conchEvents[eventCursor++])).length;
   if(state.traceBytes+state.eventsBytes>48*1024*1024||state.frames>18000)fail('Complete trace budget exhausted');
  }catch(error){fail(error.message);}return result;
 };
 state.rig={cascades:g.sky.csm.cascades,shadowLights:g.sky.csm.lights.length,sceneShadowLights:0,mode:g.sky.csm.mode,maxFar:g.sky.csm.maxFar,margin:g.sky.csm.lightMargin,fade:g.sky.csm.fade,breaks:[...g.sky.csm.breaks],mapSize:light.shadow.mapSize.toArray(),radius:light.shadow.radius,bias:light.shadow.bias,normalBias:light.shadow.normalBias};
 g.scene.traverse(o=>{if(o.isLight&&o.castShadow)state.rig.sceneShadowLights++;});
 return {variant,firstUse:state.firstUse,rig:state.rig,startedWall:state.startedWall,camera:'Existing Conch4 diagnostic follow camera, viewmodel hidden. Logged player placement/aim; normal clocks. Not ordinary first-person play.'};
}
