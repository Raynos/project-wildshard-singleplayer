from pathlib import Path
p=Path(__file__).parent;t=(p/'v6-createPuffer.ts').read_text()
t=t.replace("if(id.endsWith('-r'))faces=faces.map(f=>[...f].reverse());","if(id.endsWith('-r') || /-r[0-9]+$/.test(id))faces=faces.map(f=>[...f].reverse());")
t=t.replace("cz=z+.28+Math.cos(a)*.11", "cz=z+.40+Math.cos(a)*.08")
extra=r'''
  // V7 embed eyes beneath solid brows and bury relocated spine roots.
  for(const [side,sign]of [['l',1],['r',-1]]as const){
    for(const id of ['eye-','pupil-','glint-']){const pivot=meshes[id+side].parent;if(pivot){pivot.position.y-=.035;pivot.position.z-=.075;}}
    const brow=meshes['brow-'+side].geometry,a=brow.getAttribute('position');
    for(let i=0;i<a.count;i++){const ax=Math.abs(a.getX(i));a.setY(i,Math.min(a.getY(i),1.20)+Math.max(0,a.getY(i)-1.20)*.45-Math.max(0,ax-.15)*.10);a.setZ(i,a.getZ(i)+.13);}a.needsUpdate=true;brow.computeVertexNormals();
    const cheek=meshes['eye-patch-'+side].geometry,c=cheek.getAttribute('position');
    for(let i=0;i<c.count;i++){c.setY(i,1.045+(c.getY(i)-1.045)*.76);c.setX(i,sign*(.40+(Math.abs(c.getX(i))-.40)*.88));c.setZ(i,c.getZ(i)-.065);}c.needsUpdate=true;cheek.computeVertexNormals();
  }
  for(const [id,m]of Object.entries(meshes)){if(id.startsWith('spine')){m.parent?.position.multiplyScalar(.92);m.parent!.position.y-=.04;}}
  // Break the latitude-belt regularity of the cream pouch with staggered side facets.
  const pg=meshes['pouch'].geometry,pa=pg.getAttribute('position');
  for(let i=0;i<pa.count;i++){const x=pa.getX(i),y=pa.getY(i),z=pa.getZ(i);pa.setY(i,y+Math.sin(z*8+x*4)*.033*Math.abs(x));}pa.needsUpdate=true;pg.computeVertexNormals();
  root.userData.experimentRefinement='V7 embedded eyes and advanced occluding brows, buried crown spines, correct mirrored radial toe winding and longer exposed toes, staggered pouch planes. Static only; pending likeness.';
'''
t=t.replace('  return root;',extra+'\n  return root;',1);(p/'createPuffer.ts').write_text(t)
