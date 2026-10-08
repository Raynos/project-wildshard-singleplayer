(() => {
 const trace={programs:[],compile:[],resolve:[],parallel:false}; window.__shaderBoot=trace;
 const proto=WebGL2RenderingContext.prototype, ids=new WeakMap(), restore=[];
 const wrap=(key,fn)=>{const old=proto[key]; proto[key]=function(...args){return fn.call(this,old,args)};restore.push(()=>proto[key]=old)};
 const stage=()=>document.querySelector('.ws-load')?.getAttribute('data-step')??'';
 wrap('createProgram',function(old,args){const program=Reflect.apply(old,this,args); if(program){ids.set(program,trace.programs.length);trace.programs.push({at:performance.now(),stage:stage()})}return program});
 wrap('compileShader',function(old,args){const at=performance.now();const result=Reflect.apply(old,this,args);trace.compile.push({at,ms:performance.now()-at,stage:stage()});return result});
 wrap('getProgramParameter',function(old,args){const at=performance.now();const result=Reflect.apply(old,this,args);if(args[1]===this.LINK_STATUS)trace.resolve.push({id:ids.get(args[0]),at,ms:performance.now()-at,stage:stage()});return result});
 wrap('getExtension',function(old,args){const result=Reflect.apply(old,this,args);if(args[0]==='KHR_parallel_shader_compile')trace.parallel=Boolean(result);return result});
 const timer=setInterval(()=>{if(window.__coldBoot?.playable!==null&&window.__coldBoot?.playable!==undefined){clearInterval(timer);for(const undo of restore)undo()}},50);
})();
