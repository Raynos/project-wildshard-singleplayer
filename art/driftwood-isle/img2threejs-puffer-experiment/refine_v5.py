from pathlib import Path
p=Path(__file__).parent;t=(p/'v4-createPuffer.ts').read_text()
# These face loops were traced clockwise viewed from +Z, unlike the brow loop.
t=t.replace("if(id.endsWith('-r'))faces=faces.map(f=>[...f].reverse());","if(id.startsWith('eye-patch-') || id==='upper-face')faces=faces.map(f=>[...f].reverse());\n    if(id.endsWith('-r'))faces=faces.map(f=>[...f].reverse());")
extra=r'''
  // V5 feet: broad solid ivory lobes replace tiny cone fragments.
  for(const [side,sign]of [['l',1],['r',-1]] as const){const x=(v:number)=>v*sign;for(const[name,z]of [['front',.36],['rear',-.50]] as const){for(let j=0;j<3;j++){const c=.57+j*.15;install('toe-'+name+'-'+side+j,[[x(c-.085),.08,z+.38],[x(c+.085),.08,z+.38],[x(c+.065),.055,z+.55],[x(c-.065),.055,z+.55],[x(c),.145,z+.43],[x(c),.07,z+.60]],[[0,4,1],[0,3,5,4],[4,5,2,1],[3,2,5],[0,1,2,3]],'#f2dca5');}}}
  root.userData.experimentRefinement='V5 corrected cheek/muzzle face winding, broad closed ivory toes. Static geometry; current visual acceptance still pending.';
'''
t=t.replace('  return root;',extra+'\n  return root;',1);(p/'createPuffer.ts').write_text(t)
