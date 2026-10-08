(async()=>{
 const probe=window.__wildshard,w=probe.requireWorld(),g=w.game,b=g.app.debug.snapshot()['nalati.boss'],d=b.dungeon;
 const bytes=mesh=>mesh?Object.values(mesh.geometry.attributes).reduce((n,a)=>n+a.array.byteLength,0)+(mesh.geometry.index?.array.byteLength??0):0;
 const staticMesh=()=>d.group.getObjectByName('kurgan-interior');
 const result={build:(await(await fetch('/version.json')).json()),settings:JSON.parse(localStorage.getItem('wildshard.save.v2.global')).keys.settings.data,viewport:[innerWidth,innerHeight,devicePixelRatio],initial:{present:!!staticMesh(),bytes:bytes(staticMesh()),colliders:w.physics.world.colliders.len()},events:[]};
 const originalVisible=d.setVisible, originalFade=b.ui.fade;
 d.setVisible=function(on){const before=staticMesh(),start=performance.now(),fade=b.ui.black;const opacity=fade?getComputedStyle(fade).opacity:null;const value=originalVisible.call(this,on);result.events.push({type:'setVisible',on,hadStatic:!!before,hasStatic:!!staticMesh(),ms:performance.now()-start,gameTime:g.app.clock.now,fadeOpacity:opacity});return value;};
 b.ui.fade=function(on,ms){result.events.push({type:'fade',on,ms,gameTime:g.app.clock.now});return originalFade.call(this,on,ms);};
 const capture=async()=>{if(g.volumetrics)Reflect.set(g.volumetrics,'frame',0);const canvas=g.snapshot(402);if(!canvas)throw new Error('No snapshot');const a=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;const h=await crypto.subtle.digest('SHA-256',a);return {w:canvas.width,h:canvas.height,hash:Array.from(new Uint8Array(h),v=>v.toString(16).padStart(2,'0')).join(''),image:canvas.toDataURL('image/png')};};
 try{
  await probe.pose({x:0,z:0,yaw:0,pitch:-.12});await window.__parity.advance(30);
  result.centre={position:w.player.position.toArray(),frame:g.frameNo,clock:g.app.clock.now,present:!!staticMesh(),bytes:bytes(staticMesh()),pixels:await capture(),repeat:await capture()};
  result.beforeEntry={present:!!staticMesh(),position:w.player.position.toArray(),trigger:'native KurganBoss.enter(false) via debug handle; normal app frames advance fade and install'};
  const start=performance.now();b.enter(false);await window.__parity.advance(1);result.triggered={inside:b.inside,fadeT:b.fadeT,present:!!staticMesh()};
  await window.__parity.advance(6);result.beforeBlack={inside:b.inside,fadeT:b.fadeT,present:!!staticMesh()};
  await window.__parity.advance(3);result.entered={inside:b.inside,wallMs:performance.now()-start,present:!!staticMesh(),bytes:bytes(staticMesh()),programs:g.renderer.info.programs.length};
  await window.__parity.advance(20);
  result.entry={position:w.player.position.toArray(),frame:g.frameNo,clock:g.app.clock.now,pixels:await capture(),repeat:await capture()};
  const same=staticMesh();b.exit(false);b.enter(false);await window.__parity.advance(10);result.reentry={sameMesh:staticMesh()===same,inside:b.inside,bytes:bytes(staticMesh())};
  result.errors=[...window.__wildshardHarness.errors];result.fatal=document.querySelector('#wserr')?.textContent??null;
  return result;
 } finally{d.setVisible=originalVisible;b.ui.fade=originalFade;}
})()
