"""Real matched pass2/corrected captures; original camera/light/sample blocks.
Only .blend saving is suppressed. Full GLB build output is preserved per variant.
Raw renderer PNG bytes are never edited. Run after strict source/native tests.
"""
import hashlib,json,sys
from pathlib import Path
import bpy
p=Path(__file__).resolve().parent
sources={'baseline':p.parent/'complete-pass2/build_conch_complete_pass2.py','corrected':p/'build_selected_conch.py'}
# Capture unchanged original hero, then unchanged nine-view studio in fresh scenes.
receipts=[]
for variant,source in sources.items():
 out=p/'captures'/variant;out.mkdir(parents=True,exist_ok=True)
 text=source.read_text().replace("bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'conch-source.blend'))",'pass # Capture suppresses optional .blend only')
 for mode in ('hero','nine'):
  bpy.ops.wm.read_factory_settings(use_empty=False)
  sys.argv=['build','--','--out',str(out)]+(['--render'] if mode=='hero' else [])
  scope={'__name__':'__main__','__file__':str(source)}
  exec(compile(text,str(source),'exec'),scope)
  if mode=='nine':
   nine=p.parent/'complete-pass2/render_conch_complete_pass2_nine.py'
   code=nine.read_text().replace("g=runpy.run_path(str(Path(__file__).with_name('build_conch_complete_pass2.py')))",'g=source_scope')
   sys.argv=['nine','--','--out',str(out)]
   exec(compile(code,str(nine),'exec'),{'__name__':'__main__','__file__':str(nine),'source_scope':scope})
 for file in sorted(out.iterdir()):
  if file.is_file():receipts.append({'path':str(file.relative_to(p)),'bytes':file.stat().st_size,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()})
(p/'capture-receipts.json').write_text(json.dumps({'sources':{k:{'path':str(v.relative_to(p.parent)),'sha256':hashlib.sha256(v.read_bytes()).hexdigest()} for k,v in sources.items()},'renderMethod':'Exact original hero and nine-view code; fresh scene per studio; optional blend saves suppressed; raw PNG unchanged','files':receipts},indent=2))
