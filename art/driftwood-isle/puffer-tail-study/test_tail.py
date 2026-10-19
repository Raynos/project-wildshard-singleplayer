"""Structural tests, not visual acceptance or a continuous motion proof."""
import collections
import json
import math
import sys
import unittest
from pathlib import Path
from build_tail import build, BASE, HERE
sys.path.insert(0,str(HERE.parent/'approved-puffer'))
from native_export import validate_native

def sub(a,b):return [x-y for x,y in zip(a,b)]
def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def dot(a,b):return sum(x*y for x,y in zip(a,b))

class TailTests(unittest.TestCase):
    def setUp(self):self.mesh,self.native=build()
    def test_native(self):validate_native(self.native)
    def test_deterministic_source(self):
        self.assertEqual(self.mesh,json.loads((HERE/'tail-fan-indexed.json').read_text()))
        self.assertEqual(self.native,json.loads((HERE/'tail-native-study.json').read_text()))
    def test_closed_oriented_non_degenerate(self):
        v=self.mesh['vertices'];f=self.mesh['triangles'];edges=collections.defaultdict(list)
        for face in f:
            self.assertGreater(math.sqrt(dot(cross(sub(v[face[1]],v[face[0]]),sub(v[face[2]],v[face[0]])),cross(sub(v[face[1]],v[face[0]]),sub(v[face[2]],v[face[0]])))),1e-8)
            for a,b in zip(face,face[1:]+face[:1]):edges[tuple(sorted((a,b)))].append((a,b))
        for uses in edges.values():self.assertEqual(len(uses),2);self.assertEqual(uses[0],uses[1][::-1])
        self.assertEqual(len(v)-len(edges)+len(f),2)
        self.assertGreater(sum(dot(v[a],cross(v[b],v[c])) for a,b,c in f)/6,0)
    def test_pivot_and_root_unchanged(self):
        base=json.loads(BASE.read_text());p=next(p for p in base['parts']if p['name']=='Tail root')
        self.assertEqual(self.native['bones'],base['bones'])
        self.assertEqual(self.mesh['pivot'],base['bones'][2])
        for key,width in [('positions',3),('colorsLinear',3),('skinIndices',4),('skinWeights',4),('furLen',1)]:self.assertEqual(p[key][:132*width],self.native['parts'][0][key][:132*width])
    def test_tapered_fan_proportions(self):
        v=self.mesh['vertices'];span=max(p[1]for p in v)-min(p[1]for p in v)
        thickness=max(p[0]for p in v)-min(p[0]for p in v)
        self.assertLess(thickness/span,.25)
        self.assertGreater(thickness,.12)
        self.assertLess(min(p[2]for p in v),-1.15)
        self.assertGreater(max(p[2]for p in v),-.62)
        self.assertTrue(all(math.isfinite(x)for p in v for x in p))
    def test_root_inside_fan_overlap(self):
        # Ray parity: distal root axis is inside fan. This checks real overlap,
        # not merely overlapping bounding boxes; does not certify a union.
        p=[.279,.58,-.7475];direction=[1,.12345,.03111];hits=0
        for a,b,c in self.mesh['triangles']:
            a,b,c=[self.mesh['vertices'][i] for i in (a,b,c)];e1=sub(b,a);e2=sub(c,a);h=cross(direction,e2);det=dot(e1,h)
            if abs(det)<1e-12:continue
            s=sub(p,a);u=dot(s,h)/det;q=cross(s,e1);vv=dot(direction,q)/det;t=dot(e2,q)/det
            if 0<=u<=1 and 0<=vv and u+vv<=1 and t>1e-10:hits+=1
        self.assertEqual(hits%2,1)

if __name__=='__main__':unittest.main()
