from pathlib import Path
p=Path(__file__).parent;t=(p/'v3-createPuffer.ts').read_text();extra=r'''
  // V4: closed fin volumes and embedded face geometry, replacing thin wedges.
  for(const [side,sign] of [['l',1],['r',-1]] as const){
    const x=(v:number)=>v*sign;
    // Orange face field has physical depth and overlaps the cranial body at the sides.
    install('eye-patch-'+side,[[x(.13),1.16,.77],[x(.62),1.28,.53],[x(.61),.86,.65],[x(.18),.84,.96],[x(.12),1.13,.53],[x(.55),1.24,.30],[x(.53),.84,.44],[x(.16),.82,.72]],[[0,1,2,3],[4,7,6,5],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]],'#cb721e');
    install('brow-'+side,[[x(.14),1.105,.86],[x(.61),1.25,.68],[x(.62),1.38,.51],[x(.20),1.30,.73],[x(.14),1.10,.61],[x(.57),1.22,.44],[x(.56),1.32,.32],[x(.20),1.25,.56]],[[0,1,2,3],[4,7,6,5],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]],'#d97716');
    const eye=meshes['eye-'+side];eye.geometry.scale(1,.95,.78);eye.parent?.position.set(x(.425),1.075,.716);
    const pupil=meshes['pupil-'+side];pupil.geometry.scale(.84,.78,1);pupil.parent?.position.set(x(.425),1.072,.768);
    meshes['glint-'+side].parent?.position.set(x(.40),1.11,.793);
    for(const [name,z]of [['front',.36],['rear',-.50]] as const){
      const top=name==='front'?.55:.49;
      const v=[[x(.39),top,z-.12],[x(.68),top-.04,z-.12],[x(.71),top-.08,z+.16],[x(.42),top,z+.16],[x(.49),.07,z+.10],[x(.96),.07,z+.16],[x(.94),.07,z+.46],[x(.52),.07,z+.49],[x(.72),.21,z+.31]];
      install('fin-'+name+'-'+side,v,[[0,3,2,1],[0,1,5,4],[1,2,8,5],[2,3,7,8],[3,0,4,7],[5,8,6],[8,7,6],[4,5,6,7]],'#2c8074');
      install('fin-band-'+name+'-'+side,[[x(.50),.075,z+.34],[x(.94),.075,z+.31],[x(.94),.13,z+.46],[x(.52),.13,z+.49],[x(.51),.20,z+.30],[x(.93),.20,z+.29],[x(.91),.23,z+.37],[x(.54),.23,z+.40]],[[0,1,2,3],[4,7,6,5],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]],'#dc9828');
      for(let j=0;j<3;j++)meshes['toe-'+name+'-'+side+j].parent?.position.set(x(.57+j*.15),.08,z+.49);
    }
  }
  // Lower lip and side planes broaden into the pouch instead of sitting as a narrow frame.
  loft('pouch',[[.10,.30,.54,.28],[.33,.55,.56,.43],[.58,.65,.57,.48],[.82,.60,.58,.43],[1.01,.46,.60,.33],[1.10,.24,.64,.19],[1.12,.03,.67,.05]],10,'#ead09a');
  // Integrated muzzle planes overlap a shallow inset, not a thin edge-only arch.
  const lipOuter=[[-.32,.86,1.05],[-.25,1.08,1.00],[0,1.23,.94],[.25,1.08,1.00],[.32,.86,1.05]];
  const lipInner=[[-.23,.89,1.075],[-.15,1.05,1.035],[0,1.13,1.00],[.15,1.05,1.035],[.23,.89,1.075]];
  const lipVerts=[...lipOuter,...lipInner,...lipOuter.map(v=>[v[0]*1.12,v[1],v[2]-.22]),...lipInner.map(v=>[v[0],v[1],v[2]-.13])];const lipFaces:number[][]=[];
  for(let i=0;i<4;i++)lipFaces.push([i,i+1,6+i,5+i],[i,10+i,11+i,i+1],[5+i,6+i,16+i,15+i],[10+i,15+i,16+i,11+i]);lipFaces.push([0,5,15,10],[4,14,19,9]);install('upper-face',lipVerts,lipFaces,'#edcf8c');
  install('mouth',[[-.23,.89,1.025],[.23,.89,1.025],[.15,1.05,.985],[0,1.13,.95],[-.15,1.05,.985],[0,.95,.94]],[[0,1,5],[1,2,5],[2,3,5],[3,4,5],[4,0,5]],'#512018');
  meshes['tongue'].parent?.position.set(0,.916,1.045);
  for(const id of ['tail-border','tail-fan']){const m=meshes[id];m.geometry.translate(0,-.78,1.04);m.parent?.position.set(0,.78,-1.04);m.parent?.rotation.set(0,.65,0);}
  root.userData.experimentRefinement='V4 solid closed fins with shoulder overlap, deeper facial orange volume, eyes occluded by descending brows, broad muzzle-to-pouch transition. Static geometry only.';
''';t=t.replace('  return root;',extra+'\n  return root;',1);(p/'createPuffer.ts').write_text(t)
