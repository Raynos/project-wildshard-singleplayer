import contextlib
import io
import math
import runpy
import unittest
from test_frame_candidate import HERE, load, Vector, analysis
class CrownCandidateTests(unittest.TestCase):
    def test_whole_crown_has_coherent_splits_on_both_diagonals(self):
        rows,n=analysis['specs']['Crown tie'];new=load(HERE/'build_bellback_v6_frame2.py');obj=new('Crown tie',rows,[0,1],n)
        worst=1
        for quad in obj['faces'][:-2]:
            p=[Vector(obj['vertices'][i]) for i in quad]
            for tris in [((0,1,2),(0,2,3)),((0,1,3),(1,2,3))]:
                normals=[(p[b]-p[a]).cross(p[c]-p[a]) for a,b,c in tris]
                cosine=sum(a*b for a,b in zip(*normals))/(normals[0].length*normals[1].length)
                self.assertGreater(cosine,.77);worst=min(worst,cosine)
        self.assertAlmostEqual(worst,.774618,places=4)
    def test_only_twelve_crown_side_quads_change(self):
        a=load(HERE/'build_bellback_v6_frame1.py');b=load(HERE/'build_bellback_v6_frame2.py')
        for name,(rows,n) in analysis['specs'].items():
            x=a(name,rows,[0,1],n);y=b(name,rows,[0,1],n)
            self.assertEqual(x['vertices'],y['vertices']);self.assertEqual(x['ids'],y['ids']);self.assertEqual(x['faces'][-2:],y['faces'][-2:])
            changed=[i for i,(q,r) in enumerate(zip(x['faces'],y['faces'])) if q!=r]
            self.assertEqual(changed,list(range(12,18))+list(range(24,30)) if name=='Crown tie' else [])
    def test_exact_bounded_source_delta(self):
        with contextlib.redirect_stdout(io.StringIO()):spec=runpy.run_path(str(HERE/'prepare_frame2_candidate.py'))
        self.assertEqual(spec['candidate'],(HERE/'build_bellback_v6_frame2.py').read_text())
if __name__=='__main__':unittest.main()
