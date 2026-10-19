"""Read-only failure capture; does not suppress the original preflight guard."""
import sys,runpy,json
from pathlib import Path
D=Path(__file__).resolve().parent
out=Path(sys.argv[sys.argv.index('--')+1]);out.mkdir(parents=True,exist_ok=True)
sys.argv=['blender','--','--out',str(out)]
try:runpy.run_path(str(D/'build_integrated_face_seated_mouth.py'),run_name='__main__')
except Exception as exc:
 tb=exc.__traceback__;found=None
 while tb:
  if tb.tb_frame.f_code.co_name=='build_seated_mouth':found=tb.tb_frame.f_locals
  tb=tb.tb_next
 if found is not None:
  names=['i','f','g','triangle','edgeface','j','k','t','points','faces','roots','inner','outer','inner_back']
  r={'failure':str(exc),'locals':{n:found[n]for n in names if n in found}}
  for n in['hit','start','end']:
   if n in found:r['locals'][n]=list(found[n])if found[n]is not None else None
  (out/'crossing-diagnostic.json').write_text(json.dumps(r,indent=2)+'\n')
 raise
