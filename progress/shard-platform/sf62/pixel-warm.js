(async()=>{
 const g=window.__wildshard.world.game, gate=g.frameGate;g.frameGate=()=>false;
 try {
  const {l:compile}=await import('/assets/ReloadPrompt-D2bx4Seu.js');
  async function pixels(){const canvas=g.snapshot(402);if(!canvas)throw new Error('snapshot unavailable');const rgba=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;const hash=await crypto.subtle.digest('SHA-256',rgba);return {width:canvas.width,height:canvas.height,hash:Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('')}}
  const start=await pixels(),repeat=await pixels();
  const pick={renderer:g.renderer,camera:g.camera,composer:g.composer,level:g.level,scene:g.scene,rootScene:g.scene};
  await compile(pick);const regional=await pixels();
  pick.rootScene=g.rootScene;await compile(pick);const root=await pixels();
  return {start,repeat,regional,root,regionalIsRoot:g.scene===g.rootScene,match:start.hash===repeat.hash&&repeat.hash===regional.hash&&regional.hash===root.hash};
 }finally{g.frameGate=gate}
})()
