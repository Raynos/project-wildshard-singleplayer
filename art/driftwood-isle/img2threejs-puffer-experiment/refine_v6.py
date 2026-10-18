from pathlib import Path
p=Path(__file__).parent;t=(p/'v5-createPuffer.ts').read_text()
extra=r'''
  // V6 macro reconstruction: cheek wraps a tapered six-edge socket; broad low muzzle.
  loft('body',[[-.80,.12,.77,.13],[-.62,.42,.78,.36],[-.36,.69,.81,.55],[-.04,.76,.81,.60],[.27,.70,.82,.56],[.50,.56,.90,.40],[.69,.34,1.00,.26],[.81,.10,1.06,.12]],10,'#24786e');
  loft('pouch',[[.10,.32,.55,.28],[.32,.58,.56,.42],[.56,.69,.58,.46],[.81,.65,.59,.42],[1.01,.48,.62,.32],[1.10,.24,.65,.18],[1.12,.03,.67,.04]],10,'#ead5a4');
  for(const id of ['upper-face','mouth']){const g=meshes[id].geometry;const a=g.getAttribute('position');for(let i=0;i<a.count;i++)a.setXYZ(i,a.getX(i)*1.1,.88+(a.getY(i)-.88)*.58,a.getZ(i));a.needsUpdate=true;g.computeVertexNormals();}
  meshes['tongue'].parent?.position.set(0,.90,1.045);
  for(const [side,sign]of [['l',1],['r',-1]]as const){const x=(v:number)=>v*sign;
    const outline=[[.16,1.12,.79],[.52,1.25,.63],[.65,1.12,.47],[.62,.91,.55],[.38,.83,.82],[.18,.93,.94]];
    const v=outline.map(q=>[x(q[0]),q[1],q[2]]);v.push(...outline.map(q=>[x(q[0]*.90),q[1],q[2]-.19]));
    install('eye-patch-'+side,v,[[0,1,2],[0,2,3],[0,3,4],[0,4,5],[6,11,10,9,8,7],[0,6,7,1],[1,7,8,2],[2,8,9,3],[3,9,10,4],[4,10,11,5],[5,11,6,0]],'#d17b28');
    install('brow-'+side,[[x(.12),1.07,.91],[x(.57),1.23,.66],[x(.65),1.34,.43],[x(.30),1.34,.66],[x(.14),1.20,.80],[x(.12),1.07,.66],[x(.55),1.20,.42],[x(.60),1.29,.29],[x(.29),1.26,.43],[x(.16),1.15,.56]],[[0,1,2,3,4],[5,9,8,7,6],[0,5,6,1],[1,6,7,2],[2,7,8,3],[3,8,9,4],[4,9,5,0]],'#d6791f');
    for(const[name,z]of [['front',.36],['rear',-.50]]as const){
      const v=[[x(.39),.51,z-.13],[x(.62),.52,z-.10],[x(.92),.26,z+.10],[x(1.01),.13,z+.31],[x(.86),.10,z+.47],[x(.60),.09,z+.49],[x(.44),.18,z+.28],[x(.65),.30,z+.23],[x(.58),.07,z-.02]];
      install('fin-'+name+'-'+side,v,[[0,7,1],[1,7,2],[2,7,3],[3,7,4],[4,7,5],[5,7,6],[6,7,0],[0,1,8],[1,2,8],[2,3,8],[3,4,8],[4,5,8],[5,6,8],[6,0,8]],'#2e8174');
      meshes['fin-band-'+name+'-'+side].visible=false;
      // Four faceted radial solid lobes, merged under the first named toe pivot.
      const tv:number[][]=[],tf:number[][]=[];
      for(let j=0;j<4;j++){const a=(-.55+j*.40),cx=.69+Math.sin(a)*.27,cz=z+.28+Math.cos(a)*.11;const tip=[x(cx+Math.sin(a)*.22),.07,cz+Math.cos(a)*.24];const start=tv.length;
        for(let k=0;k<5;k++){const q=k*Math.PI*2/5;tv.push([x(cx+Math.cos(q)*.092),.115+Math.sin(q)*.085,cz]);}tv.push(tip);
        for(let k=0;k<5;k++)tf.push([start+k,start+(k+1)%5,start+5]);tf.push([start+4,start+3,start+2,start+1,start]);}
      install('toe-'+name+'-'+side+'0',tv,tf,'#f1dfb3');meshes['toe-'+name+'-'+side+'1'].visible=false;meshes['toe-'+name+'-'+side+'2'].visible=false;
    }
  }
  root.userData.experimentRefinement='V6 tapered cheek sockets, slanted integrated brow hood, compressed wide muzzle, broad upper pouch, closed fan feet and four radial cream lobes. Visual review pending; static only.';
'''
t=t.replace('  return root;',extra+'\n  return root;',1);(p/'createPuffer.ts').write_text(t)
