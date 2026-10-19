"""Compare original-indexed Blender points, polygons, materials and normals."""
import hashlib,json,sys
from pathlib import Path
p=Path(__file__).resolve().parent;sys.path.insert(0,str(p))
files=[p.parent/'complete-pass2/build_conch_complete_pass2.py',p/'build_selected_conch.py']
allmeshes=[]
for file in files:
 import bpy; bpy.ops.wm.read_factory_settings(use_empty=True)
 text=file.read_text();text=text[:text.index('# Model source metadata.')]
 sys.argv=['diff','--','--out',str(p)];scope={'__name__':'__main__','__file__':str(file)};exec(compile(text,str(file),'exec'),scope)
 meshes={}
 for ob in scope['objects']:
  d=ob.data;d.calc_loop_triangles()
  meshes[ob.name]={'positions':[list(v.co) for v in d.vertices],'polygons':[list(v.vertices) for v in d.polygons],'normals':[list(v.normal) for v in d.polygons],'materialIndices':[v.material_index for v in d.polygons],'materials':[(m.name, list(m.diffuse_color)) for m in d.materials],'triangles':[list(t.vertices) for t in d.loop_triangles]}
 allmeshes.append(meshes)
a,b=allmeshes;assert list(a)==list(b)
rows=[]
for name in a:
 x,y=a[name],b[name];assert len(x['positions'])==len(y['positions'])
 changes={}
 for key in x:
  if x[key]!=y[key]:changes[key]=[{'index':i,'before':u,'after':v} for i,(u,v) in enumerate(zip(x[key],y[key])) if u!=v]
 rows.append({'mesh':name,'unchanged':not changes,'changes':changes})
changed=[r['mesh'] for r in rows if not r['unchanged']]
assert set(changed)=={'Raised breast carapace -1','Raised breast carapace 1','Swept shoulder armor -1','Swept shoulder armor 1'},changed
assert all('materials' not in r['changes'] and 'materialIndices' not in r['changes'] for r in rows)
report={'sourceFiles':[{'name':f.name,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()} for f in files],'changedMeshes':changed,'unchangedMeshCount':sum(r['unchanged'] for r in rows),'meshes':rows,'passed':True,'scope':'Original Blender indices after original mirror/recalculation, before export; changes include geometry-derived normals and any recalculation-induced polygon order changes. No forced normal fixes.'}
(p/'indexed-diff.json').write_text(json.dumps(report,indent=2));print('Changed:',changed,'Exact untouched:',report['unchangedMeshCount'])
