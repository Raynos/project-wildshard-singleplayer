/** Read-only browser statements. No app module, pose, scope or cache is mutated. */
export const TILE_STATE = String.raw`(() => {
  const api=window.__wildshard,world=api?.world,game=world?.game;
  if(!game) return null;
  const scopes=[],seen=new Set();
  const visit=(scope,path)=>{
    if(!scope||seen.has(scope)||scope.disposed||scope.disposing)return;
    seen.add(scope);const name=path+'/'+scope.name;
    if(/^tile:(render|colliders):\d+$/.test(scope.name)||/^ring:.*:l[01]\//.test(scope.name))scopes.push(name);
    for(const child of scope.children??[])visit(child,name);
  };
  visit(game.engineScope,'engine');visit(game.levelScope,'level');
  const render=new Set(),colliders=new Set();
  for(const path of scopes){
    let m=/\/tile:render:(\d+)$/.exec(path);if(m)render.add(Number(m[1]));
    m=/\/tile:colliders:(\d+)$/.exec(path);if(m)colliders.add(Number(m[1]));
  }
  const resident=api.shard.shardfileResidency;
  for(const key of resident?.tiles?.fine??[]){const m=/^0\/(\d+)\/(\d+)$/.exec(key);if(m)render.add(Number(m[2])*8+Number(m[1]));}
  const grid=api.shard.grid,state=grid?.state(),live=state?.live?.live;
  return {at:performance.now(),origin:performance.timeOrigin,level:game.level.id,
    product:api.shard.shardfile?.source?.identity?.slug??null,
    tier:api.boot.tier,scale:game.renderer.getPixelRatio(),clock:api.app.clock.mode,
    frame:game.frameCount,controls:world.hud.entered&&!world.hud.paused&&game.frameGate(),
    lost:game.renderer.getContext().isContextLost(),feet:{x:world.player.position.x,z:world.player.position.z},
    render:[...render].sort((a,b)=>a-b),colliders:[...colliders].sort((a,b)=>a-b),scopes,
    settings:api.debugSettings?.()??[],claims:resident?.allocator?.entries()??null,
    grid:state===undefined?null:{home:state.home,current:live?.current,inside:state.inside,
      ready:live?.gameplayReady,pending:live?.pending??[],retiring:live?.retiring??[],
      residents:live?.residents??[],inFlight:state.rings.inFlight,queued:state.rings.queued,
      tileGhosts:state.rings.ghosts?.count??null,regionGhosts:live?.ghosts?.count??null,
      crossing:state.live.crossing,timing:state.live.crossingTiming??[],
      claims:grid.residency().claims,road:grid.roadResident(),roadTiles:grid.roadTileResidency()}
  };
})()`;

/** Capture actual minimap paint, not a reconstructed copy of the overlay. Bounded scalar evidence only. */
export const TILE_PAINT_INIT = String.raw`(() => {
  const colors=new Set(['rgba(80, 200, 120, 0.22)','rgba(255, 190, 70, 0.22)','rgba(255, 255, 255, 0.55)']);
  const rows=new Map(),labels=new Set(),original=CanvasRenderingContext2D.prototype.fillRect;
  CanvasRenderingContext2D.prototype.fillRect=function(...args){
    const color=String(this.fillStyle);
    if(colors.has(color)){
      const key=color+':'+args.map(n=>Math.round(n*100)/100).join(',');
      if(rows.size<2048)rows.set(key,{color,rect:args,at:performance.now()});
    }
    return original.apply(this,args);
  };
  const text=CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText=function(...args){
    if(/^\d+\.\d MB$/.test(String(args[0]))&&labels.size<128)labels.add(String(args[0]));
    return text.apply(this,args);
  };
  window.__tilePlanPaint=()=>({rects:[...rows.values()],labels:[...labels]});
})()`;

/** Frame samples precede expensive census/dump reads. Live requestAnimationFrame, no capture clock/forced GC. */
export const TILE_FRAMES = String.raw`new Promise(resolve=>{
  const api=window.__wildshard,origin=performance.timeOrigin,start=performance.now();
  let last=start;const gaps=[];
  const tick=now=>{
    if(window.__wildshard!==api||performance.timeOrigin!==origin){resolve({error:'Document/API changed'});return;}
    gaps.push(now-last);last=now;
    if(now-start<8000){requestAnimationFrame(tick);return;}
    const sorted=[...gaps].sort((a,b)=>a-b);
    resolve({frames:gaps.length,durationMs:now-start,maxMs:Math.max(...gaps),p95Ms:sorted[Math.floor(sorted.length*.95)]??null});
  };requestAnimationFrame(tick);
})`;

/** Keep frame-only counters during a real crossing; the heavy census runs afterwards. */
export const TILE_LEG_START = String.raw`(() => {
  const origin=performance.timeOrigin,startedAt=performance.now();
  const state={startedAt,frames:0,maxMs:0,last:null,done:false,documentChanged:false};
  window.__tilePlanLeg=state;
  const tick=now=>{
    if(state.done)return;
    if(performance.timeOrigin!==origin){state.documentChanged=true;state.done=true;return;}
    if(state.last!==null)state.maxMs=Math.max(state.maxMs,now-state.last);
    state.last=now;state.frames++;requestAnimationFrame(tick);
  };requestAnimationFrame(tick);return startedAt;
})()`;
export const TILE_LEG_END = String.raw`(() => {
  const state=window.__tilePlanLeg;if(!state)throw Error('Missing crossing frame sample');
  state.done=true;return {...state,endedAt:performance.now()};
})()`;
