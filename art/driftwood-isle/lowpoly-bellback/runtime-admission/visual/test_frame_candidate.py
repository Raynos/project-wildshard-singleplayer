import ast
import contextlib
import io
import math
from pathlib import Path
import runpy
import unittest
HERE=Path(__file__).resolve().parent
class Vector:
    def __init__(self, x):self.x=list(x.x if isinstance(x,Vector) else x)
    def __iter__(self):return iter(self.x)
    def __add__(self,b):return Vector([x+y for x,y in zip(self,b)])
    def __sub__(self,b):return Vector([x-y for x,y in zip(self,b)])
    def __mul__(self,b):return Vector([x*b for x in self])
    @property
    def length(self):return math.sqrt(sum(x*x for x in self))
    def normalized(self):return self*(1/self.length)
    def normalize(self):self.x=self.normalized().x
    def cross(self,b):
        x,y,z=self;u,v,w=b;return Vector([y*w-z*v,z*u-x*w,x*v-y*u])
def load(path):
    node=next(n for n in ast.parse(path.read_text()).body if isinstance(n,ast.FunctionDef) and n.name=='loft')
    ns={'math':math,'Vector':Vector,'mesh':lambda name,v,f,mats,ids:dict(name=name,vertices=v,faces=f,mats=mats,ids=ids)}
    exec(compile(ast.Module(body=[node],type_ignores=[]),str(path),'exec'),ns)
    return ns['loft']
with contextlib.redirect_stdout(io.StringIO()):analysis=runpy.run_path(str(HERE/'analyze_frames.py'))
class CandidateTests(unittest.TestCase):
    def test_bounded_connectivity_and_all_point_sets(self):
        old=load(HERE.parents[1]/'build_bellback_v6.py');new=load(HERE/'build_bellback_v6_frame1.py')
        for name,(rows,n) in analysis['specs'].items():
            a=old(name,rows,[0,1,2],n);b=new(name,rows,[0,1,2],n)
            self.assertEqual(a['vertices'],b['vertices']);self.assertEqual(a['ids'],b['ids']);self.assertEqual(a['mats'],b['mats'])
            changed=[i for i,(x,y) in enumerate(zip(a['faces'],b['faces'])) if x!=y]
            self.assertEqual(changed,list(range(n)) if name!='Crown tie' else [])
            self.assertEqual(len(a['faces']),len(b['faces']))
            if name=='Crown tie':self.assertEqual(a,b);continue
            for q in b['faces'][:n]:
                p=[Vector(b['vertices'][i]) for i in q]
                a=(p[1]-p[0]).cross(p[2]-p[0]);bnormal=(p[2]-p[0]).cross(p[3]-p[0])
                self.assertGreater(sum(x*y for x,y in zip(a,bnormal)),0)
    def test_unaffected_lofts_are_identical(self):
        old=load(HERE.parents[1]/'build_bellback_v6.py');new=load(HERE/'build_bellback_v6_frame1.py')
        for _,(rows,n) in analysis['specs'].items():self.assertEqual(old('Untouched mesh',rows,[0,1],n),new('Untouched mesh',rows,[0,1],n))
    def test_only_authorized_source_delta(self):
        with contextlib.redirect_stdout(io.StringIO()):spec=runpy.run_path(str(HERE/'prepare_frame_candidate.py'))
        self.assertEqual(spec['candidate'],(HERE/'build_bellback_v6_frame1.py').read_text())
if __name__=='__main__':unittest.main()
