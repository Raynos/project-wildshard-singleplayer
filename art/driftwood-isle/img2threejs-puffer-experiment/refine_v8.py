from pathlib import Path
p=Path(__file__).parent;t=(p/'v7-createPuffer.ts').read_text()
t=t.replace("[x(.39),.51,z-.13],[x(.62),.52,z-.10]","[x(.42),.76,z-.16],[x(.65),.67,z-.13]")
t=t.replace("[x(.65),.30,z+.23]","[x(.70),.35,z+.22]")
extra=r'''
  // V8: a thin solid cream lip surrounding a genuinely triangular dark aperture.
  const oo=[[-.32,.88,1.055],[-.22,1.075,1.015],[0,1.16,.97],[.22,1.075,1.015],[.32,.88,1.055]];
  const ii=[[-.255,.89,1.08],[-.17,1.035,1.045],[0,1.105,1.015],[.17,1.035,1.045],[.255,.89,1.08]];
  const vv=[...oo,...ii,...oo.map(v=>[v[0]*1.08,v[1],v[2]-.13]),...ii.map(v=>[v[0],v[1],v[2]-.10])],ff:number[][]=[];
  for(let i=0;i<4;i++)ff.push([i,i+1,6+i,5+i],[i,10+i,11+i,i+1],[5+i,6+i,16+i,15+i],[10+i,15+i,16+i,11+i]);ff.push([0,5,15,10],[4,14,19,9]);install('upper-face',vv,ff,'#efd7a0');
  install('mouth',[[-.255,.89,1.04],[.255,.89,1.04],[.17,1.035,1.005],[0,1.105,.975],[-.17,1.035,1.005],[0,.96,.96]],[[0,1,5],[1,2,5],[2,3,5],[3,4,5],[4,0,5]],'#54221a');
  meshes['tongue'].parent?.position.set(0,.918,1.047);meshes['tongue'].geometry.scale(.85,.85,1);
  // Compress the forehead lip to a thick band rather than an orange sail.
  for(const side of ['l','r']){const g=meshes['brow-'+side].geometry,a=g.getAttribute('position');for(let i=0;i<a.count;i++){const z=a.getZ(i);a.setZ(i,.77+(z-.77)*.72);}a.needsUpdate=true;g.computeVertexNormals();}
  // Muted teal, warm ivory and red-orange fields match the reference palette under the fixed comparison lights.
  for(const [id,m]of Object.entries(meshes)){let c=id==='body'?'#1c645b':id==='pouch'?'#e3c38d':id==='upper-face'?'#e7c991':id.startsWith('fin-')?'#296f62':id.startsWith('brow-')?'#bd6419':id.startsWith('eye-patch-')?'#b96521':id.startsWith('eye-')?'#ce941b':null;if(c)(m.material as THREE.MeshStandardMaterial).color.set(c);}
  root.userData.experimentRefinement='V8 thin triangular muzzle rim, deeper dark opening and thicker rooted fin shoulders; narrowed brow sail. Bounded trial result, static only; visual review pending.';
'''
t=t.replace('  return root;',extra+'\n  return root;',1);(p/'createPuffer.ts').write_text(t)
