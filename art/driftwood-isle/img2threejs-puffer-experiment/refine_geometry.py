from pathlib import Path
p=Path(__file__).parent; text=(p/'v2-createPuffer.ts').read_text();extra=r'''
  // Experiment refinement V3: authored sections replace generic primitive surfaces.
  // World-space geometry is rebased onto named component roots; pivots remain WIP.
  function install(id:string, vertices:number[][], faces:number[][], tint?:string) {
    const mesh=meshes[id]; if(!mesh) return;
    const positions:number[]=[];
    if(id.endsWith('-r'))faces=faces.map(f=>[...f].reverse());
    for(const f of faces) for(let k=1;k<f.length-1;k++) for(const i of [f[0],f[k],f[k+1]])positions.push(...vertices[i]);
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.computeVertexNormals();mesh.geometry.dispose();mesh.geometry=geo;
    mesh.parent?.position.set(0,0,0);mesh.parent?.rotation.set(0,0,0);mesh.position.set(0,0,0);mesh.quaternion.identity();
    if(tint){const mat=(mesh.material as THREE.MeshStandardMaterial).clone();mat.color.set(tint);mesh.material=mat;}
  }
  function loft(id:string, rows:number[][], n:number, tint?:string) {
    const v:number[][]=[],f:number[][]=[];
    for(const [z,w,cy,h] of rows) for(let i=0;i<n;i++){const a=2*Math.PI*i/n;v.push([w*Math.sin(a),cy+h*Math.cos(a),z]);}
    for(let r=0;r<rows.length-1;r++)for(let i=0;i<n;i++){const a=r*n+i,b=r*n+(i+1)%n,c=(r+1)*n+(i+1)%n,d=(r+1)*n+i;f.push(...((r+i)%2?[[a,c,b],[a,d,c]]:[[a,d,b],[b,d,c]]));}
    f.push(Array.from({length:n},(_,i)=>i),Array.from({length:n},(_,i)=>(rows.length-1)*n+n-1-i));install(id,v,f,tint);
  }
  loft('body',[[-.80,.10,.78,.13],[-.62,.37,.80,.40],[-.36,.61,.83,.61],[-.04,.69,.83,.66],[.27,.64,.84,.61],[.50,.52,.91,.43],[.69,.32,1.02,.28],[.81,.10,1.08,.13]],10,'#24786e');
  loft('pouch',[[.11,.28,.55,.28],[.33,.52,.56,.43],[.57,.62,.57,.48],[.81,.57,.57,.43],[.98,.43,.59,.33],[1.06,.21,.62,.19],[1.08,.03,.65,.05]],10,'#efd9a5');
  // Broad side cheek planes join pouch; no separate cheek knobs.
  for(const side of ['l','r']){meshes['cheek-'+side].visible=false;meshes['eye-patch-'+side].visible=false;}
  for(const [side,sign] of [['l',1],['r',-1]] as const){
    const x=(v:number)=>v*sign;
    const brow=[[x(.17),1.18,.80],[x(.60),1.29,.63],[x(.62),1.43,.53],[x(.22),1.36,.74],[x(.16),1.16,.65],[x(.58),1.27,.49],[x(.58),1.39,.42],[x(.23),1.32,.60]];
    install('brow-'+side,brow,[[0,1,2,3],[4,7,6,5],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]],'#e88120');
    install('eye-patch-'+side,[[x(.16),1.18,.73],[x(.60),1.29,.57],[x(.61),.96,.62],[x(.25),.92,.85],[x(.15),1.12,.60],[x(.55),1.24,.45],[x(.53),.94,.50],[x(.23),.91,.70]],[[0,1,2,3],[4,7,6,5],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]],'#e5a041');meshes['eye-patch-'+side].visible=true;
    const eye=meshes['eye-'+side];eye.parent?.position.set(x(.405),1.105,.711);eye.parent?.rotation.set(0,sign*.39,0);
    const pupil=meshes['pupil-'+side];pupil.parent?.position.set(x(.405),1.105,.778);pupil.parent?.rotation.set(0,sign*.39,0);
    const glint=meshes['glint-'+side];glint.parent?.position.set(x(.39),1.15,.797);
    for(const [name,z]of [['front',.37],['rear',-.46]] as const){
      const v=[[x(.46),.49,z-.09],[x(.63),.47,z-.07],[x(.94),.085,z+.27],[x(.76),.035,z+.44],[x(.48),.06,z+.33],[x(.43),.15,z+.02],[x(.64),.12,z+.20]];
      install('fin-'+name+'-'+side,v,[[0,1,6],[1,2,6],[2,3,6],[3,4,6],[4,5,6],[5,0,6],[0,5,4,3,2,1]],'#347f76');
      install('fin-band-'+name+'-'+side,[[x(.46),.10,z+.31],[x(.76),.09,z+.44],[x(.96),.12,z+.27],[x(.90),.21,z+.22],[x(.74),.18,z+.32],[x(.52),.20,z+.23]],[[0,1,4,5],[1,2,3,4],[0,5,4,3,2,1]],'#e7a133');
    }
  }
  // Cream muzzle is a thick peaked upper-lip shell with a genuine open inner boundary.
  const outer=[[-.29,.89,1.02],[-.22,1.13,.97],[0,1.27,.93],[.22,1.13,.97],[.29,.89,1.02]];
  const inner=[[-.22,.90,1.055],[-.15,1.07,1.02],[0,1.16,.99],[.15,1.07,1.02],[.22,.90,1.055]];
  const verts=[...outer,...inner,...outer.map(v=>[v[0],v[1],v[2]-.13]),...inner.map(v=>[v[0],v[1],v[2]-.13])];const faces:number[][]=[];
  for(let i=0;i<4;i++)faces.push([i,i+1,6+i,5+i],[i,10+i,11+i,i+1],[5+i,6+i,16+i,15+i],[10+i,15+i,16+i,11+i]);faces.push([0,5,15,10],[4,14,19,9]);install('upper-face',verts,faces,'#f1d496');
  install('mouth',[[-.22,.89,.995],[.22,.89,.995],[.15,1.07,.955],[0,1.16,.93],[-.15,1.07,.955],[0,.95,.91]],[[0,1,5],[1,2,5],[2,3,5],[3,4,5],[4,0,5]],'#562319');
  meshes['tongue'].parent?.position.set(0,.925,1.025);
  // Faceted fan: continuous closed volume, flat side axis, attached to tail stem.
  function fan(id:string, radius:number, thick:number,col:string){const v:number[][]=[],f:number[][]=[];for(const x of [-thick,thick])for(let i=0;i<8;i++){let a=i*Math.PI/4;v.push([x,.78+Math.cos(a)*radius,-1.04+Math.sin(a)*radius*.80]);}v.push([-thick-.025,.78,-1.04],[thick+.025,.78,-1.04]);for(let i=0;i<8;i++){let j=(i+1)%8;f.push([i,16,j],[i+8,j+8,17],[i,j,j+8,i+8]);}install(id,v,f,col);}
  fan('tail-border',.39,.055,'#e5a23a');fan('tail-fan',.305,.085,'#2c7770');
  root.userData.experimentRefinement='V3 custom sections, low-poly fins, planar brow/cheek wedges, thick lip opening and closed tail fan. Static geometry only; rig readiness unverified.';
'''
text=text.replace('  return root;',extra+'\n  return root;',1);(p/'createPuffer.ts').write_text(text)
