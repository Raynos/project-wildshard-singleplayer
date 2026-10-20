"""Same full-silhouette supplemental framing for candidate and selected predecessor.
Run with Blender -P this script -- --kind candidate|predecessor --out DIRECTORY.
The normal ten-view protocol is retained and is the scoring evidence.
"""
from pathlib import Path
import sys,argparse
p=argparse.ArgumentParser();p.add_argument('--kind',choices=['candidate','predecessor'],required=True);p.add_argument('--out',required=True);a=p.parse_args(sys.argv[sys.argv.index('--')+1:])
here=Path(__file__).resolve().parent
source=here/'build_complete.py' if a.kind=='candidate' else here.parent/'complete-character-next/build_complete.py'
s=source.read_text().replace("camera.data.ortho_scale=5.0","camera.data.ortho_scale=6.0")
s=s.replace("views=[('hero',28,15),('front',0,0),('left',-90,0),('right',90,0),('back',180,0),('top',0,89.9),('elevated-front',0,39),('elevated-left',-90,39),('elevated-right',90,39),('elevated-back',180,39)]","views=[('hero',28,15)]")
sys.argv=['blender','--','--out',a.out,'--render']
exec(compile(s,str(source),'exec'),{'__file__':str(source),'__name__':'__main__'})
