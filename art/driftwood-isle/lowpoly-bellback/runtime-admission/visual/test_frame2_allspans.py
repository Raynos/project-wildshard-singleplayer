import unittest
from test_frame_candidate import HERE,load,Vector,analysis
class AllSpanTests(unittest.TestCase):
    def test_every_quad_of_all_three_repaired_lofts_on_both_diagonals(self):
        minimum={'Barrel timber hull':.996,'Lower timber jaw':.411,'Crown tie':.774}
        loft=load(HERE/'build_bellback_v6_frame2.py')
        for name,(rows,n) in analysis['specs'].items():
            obj=loft(name,rows,[0,1,2],n)
            for i,quad in enumerate(obj['faces'][:-2]):
                p=[Vector(obj['vertices'][k]) for k in quad]
                for tris in [((0,1,2),(0,2,3)),((0,1,3),(1,2,3))]:
                    ns=[(p[b]-p[a]).cross(p[c]-p[a]) for a,b,c in tris]
                    cosine=sum(a*b for a,b in zip(*ns))/(ns[0].length*ns[1].length)
                    self.assertGreater(cosine,minimum[name],(name,i,tris))
if __name__=='__main__':unittest.main()
