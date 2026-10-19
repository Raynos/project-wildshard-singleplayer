/** Coverage is evidence, never an animation score. Button press clocks cannot qualify a hit. */
export function analyzeMotion5Coverage(trace, events) {
  const hits = events.filter(row => row.kind === 'enemy-damage-before-presentation');
  const ref = row => ({ bout:row.bout, frame:row.frame, sampleIndex:row.sampleIndex, wallTime:row.wallTime,
    stage:row.stage, clock:row.clock, guard:row.guard, flinch:row.flinch, tgState:row.tgState,
    poseIndex:row.poseInput?.poseIndex, poseClock:row.poseInput?.clock, poseStage:row.poseInput?.stage,
    poseFlinch:row.poseInput?.flinch, attack:row.poseInput?.attack, strike:row.strike, died:row.died });
  const targets = [
    {name:'ordinary-guarded-.10',stage:1,clock:.10,tolerance:.035,guard:1},
    {name:'ordinary-guarded-.20',stage:1,clock:.20,tolerance:.035,guard:1},
    {name:'ordinary-late-windup',stage:1,clock:.45,tolerance:.075,guard:1},
    {name:'counter-preparation-.215',stage:3,clock:.215,tolerance:.035},
    {name:'ordinary-active',stage:1,phase:'active'},
    {name:'recovery',stage:2},
  ].map(target => { const matched=hits.filter(row => row.stage===target.stage
    && (target.clock===undefined || Math.abs(row.clock-target.clock)<=target.tolerance)
    && (target.guard===undefined || row.guard===target.guard)
    && (target.phase===undefined || row.strike?.phase===target.phase));
    target.status=matched.length > 0?'observed-at-real-collision':'not-observed'; target.hits=matched.map(ref); return target;
  });
  const cycles=[]; let cycle=null, previous=null;
  for(const row of trace) {
    const phase=row.strike?.phase;
    if (previous?.bout!==row.bout) cycle=null;
    if(phase==='windup' && (previous?.strike?.phase!=='windup' || previous?.bout!==row.bout || row.strike.elapsed<previous.strike.elapsed)) {
      cycle={bout:row.bout,kind:row.stage===3?'counter':row.stage===1?'ordinary':'unknown',start:ref(row),phases:[phase],end:undefined};
      cycles.push(cycle);
    }
    if(cycle !== null) {
      if(cycle.phases.at(-1)!==phase) { cycle.phases.push(phase); }
      if(phase==='idle') {cycle.end=ref(row);cycle.complete=JSON.stringify(cycle.phases)===JSON.stringify(['windup','active','recover','idle']);
        cycle.enemyHits=hits.filter(hit=>hit.bout===row.bout&&hit.wallTime>=cycle.start.wallTime&&hit.wallTime<=row.wallTime).map(ref);
        cycle.uninterrupted=cycle.complete&&cycle.enemyHits.length===0; cycle=null;
      }
    }
    previous=row;
  }
  const deltas=trace.slice(1).flatMap((row,i)=>row.bout===trace[i].bout?[row.wallTime-trace[i].wallTime]:[]).filter(Number.isFinite);
  const deathTransitions=trace.slice(1).flatMap((row,i)=>{const before=trace[i];if(row.bout!==before.bout||!before.alive||row.alive)return [];
    return [{before:ref(before),after:ref(row),localAxisJumps:Object.fromEntries(Object.entries(row.bones).map(([name,bone])=>[name,bone.rotation?.map((v,axis)=>v-before.bones[name].rotation[axis])??null]))}];});
  const hitTransitions=hits.map(hit=>{const after=trace.find(row=>row.bout===hit.bout&&row.wallTime>hit.wallTime&&row.poseInput?.poseIndex>hit.poseInput?.poseIndex);
    return {before:ref(hit),after:after?ref(after):null,localAxisJumps:after?Object.fromEntries(Object.entries(after.bones).map(([name,bone])=>[name,bone.rotation?.map((v,axis)=>v-hit.bones[name].rotation[axis])??null])):null};});
  const clockZero=trace.filter(row=>row.poseInput && [2,4].includes(row.poseInput.stage)&&row.poseInput.clock===0&&row.poseInput.flinch>0);
  const repeated=hits.filter((row,i)=>i>0&&hits[i-1].bout===row.bout&&row.flinch>0);
  return { schema:'wildshard.conch.motion5.capture-coverage.v1',targets,cycles,hitTransitions,
    ordinaryWholeCycles:cycles.filter(row=>row.kind==='ordinary'&&row.uninterrupted).length,
    counterWholeCycles:cycles.filter(row=>row.kind==='counter'&&row.uninterrupted).length,
    clockZeroStun:clockZero.map(ref),repeatedHitsWhileFlinching:repeated.map(ref),deathTransitions,
    renderCadence:{samples:trace.length,wallDeltaMs:deltas,minimum:deltas.length > 0?Math.min(...deltas):null,maximum:deltas.length > 0?Math.max(...deltas):null},
    sourceRisks:{guardedPoint20LocalAxisJumpRad:.36631255398,motion4Point20Rad:.16759259259,livingDeathYawJumpRad:.8},
    note:'Not-observed means missing evidence, not proven unreachable. Actual collision and last pose-owned clocks are both retained. Complete sampled phase sequences do not prove every simulation tick was encoded. Independent frame/contact review still required.',
    acceptance:{visual:false,animation:false,interruptedContinuity:false} };
}
