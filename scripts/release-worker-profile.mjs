// Diagnostic only. Sample the actual worker; never install a game clock or input.
import{mkdirSync,writeFileSync}from'node:fs';
import{dirname}from'node:path';
import{gzipSync}from'node:zlib';
import{observeReleasePorts,finishReleasePorts}from'./release-port-profile.mjs';
/** Attach only to an exact worker in this owned browser. */
export async function profileReleaseWorker(browser,workerURL,file,{durationMs=60000,page}={}){
  if(page===undefined)throw new Error('Native port diagnosis needs the actual grid page');
  const traceCategories='devtools.timeline,v8,toplevel';
  const root=await browser.newBrowserCDPSession(),pending=new Map(),parsed=new Map();let serial=0,closed=false;
  const {targetInfos}=await root.send('Target.getTargets');
  const targets=targetInfos.filter(row=>row.type==='worker'&&row.url===workerURL);
  if(targets.length!==1){await root.detach();throw new Error('Exact release worker target missing or ambiguous');}
  const {sessionId}=await root.send('Target.attachToTarget',{targetId:targets[0].targetId,flatten:false});
  const receive=event=>{
    if(event.sessionId!==sessionId)return;const message=JSON.parse(event.message);
    if(message.method==='Debugger.scriptParsed')parsed.set(message.params.scriptId,message.params.url);
    const waiter=pending.get(message.id);if(waiter===undefined)return;
    pending.delete(message.id);clearTimeout(waiter.timer);
    if(message.error)waiter.reject(new Error(message.error.message));else waiter.resolve(message.result);
  };
  root.on('Target.receivedMessageFromTarget',receive);
  const send=(method,params={})=>new Promise((resolve,reject)=>{
    if(closed){reject(new Error('Worker profile session closed'));return;}
    const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(new Error('Worker profile RPC deadline: '+method));},15000);
    pending.set(id,{resolve,reject,timer});
    void root.send('Target.sendMessageToTarget',{sessionId,message:JSON.stringify({id,method,params})}).catch(error=>{pending.delete(id);clearTimeout(timer);reject(error);});
  });
  const detach=async()=>{
    closed=true;root.off('Target.receivedMessageFromTarget',receive);
    for(const row of pending.values()){clearTimeout(row.timer);row.reject(new Error('Worker profile retired'));}pending.clear();
    try{await root.send('Target.detachFromTarget',{sessionId});}finally{await root.detach();}
  };
  let portEvidence;
  const collectPorts=async()=>{
    if(portEvidence!==undefined)return portEvidence;
    const captured=await Promise.allSettled([
      page.evaluate(finishReleasePorts),
      send('Runtime.evaluate',{expression:`(${finishReleasePorts.toString()})()`,returnByValue:true}),
    ]);
    const [pageResult,workerResult]=captured,errors=[];
    for(const [realm,result]of [['page',pageResult],['worker',workerResult]]){
      if(result.status==='rejected')errors.push(`${realm}: ${String(result.reason)}`);
    }
    if(workerResult.status==='fulfilled'&&workerResult.value.exceptionDetails!==undefined)errors.push(`worker: ${JSON.stringify(workerResult.value.exceptionDetails)}`);
    if(pageResult.status==='fulfilled'&&pageResult.value.cleanupError)errors.push(`page: ${pageResult.value.cleanupError}`);
    if(workerResult.status==='fulfilled'&&workerResult.value.result?.value?.cleanupError)errors.push(`worker: ${workerResult.value.result.value.cleanupError}`);
    const storage=await page.evaluate(()=>Reflect.get(globalThis,'__releaseStorageFaults')).catch(error=>({captureError:String(error)}));
    portEvidence={page:pageResult.status==='fulfilled'?pageResult.value:null,worker:workerResult.status==='fulfilled'?workerResult.value.result?.value:null,storage,errors};
    mkdirSync(dirname(file),{recursive:true});
    writeFileSync(file.replace(/\.json$/u,'-ports.json'),JSON.stringify(portEvidence)+'\n');
    return portEvidence;
  };
  let started;
  try{
    await page.evaluate(observeReleasePorts);
    const installed=await send('Runtime.evaluate',{expression:`(${observeReleasePorts.toString()})();undefined`,returnByValue:true});
    if(installed.exceptionDetails!==undefined)throw new Error('Native worker port observer failed to install');
    await root.send('Tracing.start',{categories:traceCategories,transferMode:'ReturnAsStream'});
    await send('Profiler.enable');await send('Profiler.setSamplingInterval',{interval:1000});
    const clock=await send('Runtime.evaluate',{expression:'({origin:performance.timeOrigin,now:performance.now()})',returnByValue:true});
    const before=Date.now();await send('Profiler.start');started={before,after:Date.now(),clock:clock.result?.value};
  }catch(error){try{await collectPorts();}finally{await detach();}throw error;}
  let finished,timer;
  const stop=()=>{
    if(finished!==undefined)return finished;clearTimeout(timer);
    finished=(async()=>{
      try{
        const before=Date.now(),{profile}=await send('Profiler.stop'),after=Date.now();
        const ports=await collectPorts();
        const clock=await send('Runtime.evaluate',{expression:'({origin:performance.timeOrigin,now:performance.now()})',returnByValue:true});
        const complete=new Promise((resolve,reject)=>{
          const deadline=setTimeout(()=>{root.off('Tracing.tracingComplete',received);reject(new Error('Worker trace completion deadline'));},15000);
          const received=event=>{clearTimeout(deadline);resolve(event);};root.once('Tracing.tracingComplete',received);
        });
        void complete.catch(()=>undefined);
        await root.send('Tracing.end');const traced=await complete;
        if(typeof traced.stream!=='string')throw new Error('Worker trace has no stream');
        const chunks=[];let total=0;
        try{for(;;){const chunk=await root.send('IO.read',{handle:traced.stream});const bytes=Buffer.from(chunk.data,chunk.base64Encoded?'base64':'utf8');total+=bytes.length;if(total>128*1024*1024)throw new Error('Worker diagnostic trace exceeds128MiB');chunks.push(bytes);if(chunk.eof)break;}}
        finally{await root.send('IO.close',{handle:traced.stream});}
        const traceBytes=Buffer.concat(chunks),trace=JSON.parse(traceBytes.toString()),traceFile=file.replace(/\.json$/u,'-trace.json.gz');
        mkdirSync(dirname(file),{recursive:true});writeFileSync(traceFile,gzipSync(traceBytes));
        const traceEvidence={file:traceFile,bytes:traceBytes.length,events:trace.traceEvents?.length,categories:traceCategories,screenshots:false};
        await send('Debugger.enable');
        const sources=[];
        for(const[scriptId,url]of parsed)if(url===workerURL||/\/standalone\/serverRuntime[^/]*\.js$/u.test(url)){
          const{scriptSource}=await send('Debugger.getScriptSource',{scriptId});sources.push({scriptId,url,scriptSource});
        }
        const portFile=file.replace(/\.json$/u,'-ports.json');
        const result={protocol:'release-worker-cpu/1',workerURL,intervalMicros:1000,started,stopped:{before,after,clock:clock.result?.value},profile,sources,trace:traceEvidence,portFile};
        mkdirSync(dirname(file),{recursive:true});writeFileSync(file,JSON.stringify(result)+'\n');
        if(ports.errors.length>0)throw new Error('Native port observer cleanup refused: '+ports.errors.join('; '));
        if(ports.page?.overflow||ports.worker?.overflow)throw new Error('Native port diagnostic overflow');
        console.log('Captured actual worker CPU profile',JSON.stringify({file,workerURL,profileMs:(profile.endTime-profile.startTime)/1000,samples:profile.samples?.length,sources:sources.length}));
        return result;
      }finally{try{await collectPorts();}finally{await detach();}}
    })();
    // A timed capture can fail before the caller finishes its road proof; the
    // same rejection is still checked by the explicit final stop below.
    void finished.catch(()=>undefined);return finished;
  };
  timer=setTimeout(()=>{void stop();},durationMs);
  return stop;
}
