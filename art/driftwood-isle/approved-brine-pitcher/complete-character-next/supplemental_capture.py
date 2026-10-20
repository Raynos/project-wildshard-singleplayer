"""One uncropped hero per source. Supplemental only, not the unchanged scoring protocol."""
import sys
from pathlib import Path
here=Path(__file__).resolve().parent;root=here.parents[3]
kind=sys.argv[sys.argv.index('--')+1]
assert kind in ('final','baseline')
source=here/'build_complete.py' if kind=='final' else here.parent/'build_pitcher_v3.py'
out=root/'tmp/pitcher-complete-next-20261020'/('supplemental-'+kind)
text=source.read_text().replace('camera.data.ortho_scale=5.0','camera.data.ortho_scale=5.5')
start=text.index(" views=[('hero'");end=text.index('\n cameras=[]',start)
text=text[:start]+" views=[('hero',28,15)]"+text[end:]
sys.argv=['blender','--','--out',str(out),'--render']
exec(compile(text,str(source),'exec'),{'__file__':str(source),'__name__':'__main__'})
