from collections import Counter
import unittest
from test_frame_candidate import HERE,load,analysis
class CrownTopologyTests(unittest.TestCase):
    def test_closed_oriented_crown_keeps_caps_and_vertex_topology(self):
        rows,n=analysis['specs']['Crown tie'];obj=load(HERE/'build_bellback_v6_frame2.py')('Crown tie',rows,[0,1],n)
        edges=Counter()
        for face in obj['faces']:
            self.assertEqual(len(set(face)),len(face))
            for a,b in zip(face,face[1:]+face[:1]):edges[(a,b)]+=1
        self.assertTrue(all(count==1 and edges[(b,a)]==1 for (a,b),count in edges.items()))
        self.assertEqual(len(obj['vertices'])-len(edges)//2+len(obj['faces']),2)
        self.assertEqual(obj['faces'][-2:], [tuple(reversed(range(n))),tuple(5*n+i for i in range(n))])
        # This is combinatorial manifoldness, NOT geometric self-intersection freedom.
if __name__=='__main__':unittest.main()
