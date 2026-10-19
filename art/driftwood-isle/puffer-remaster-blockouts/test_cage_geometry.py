"""Pure cage topology checks. Blender volume/containment checks remain mandatory."""
import json
import math
from pathlib import Path
import unittest
from collections import Counter
from cage_geometry import make_cage,make_fin

CONFIG=json.loads((Path(__file__).with_name('control_cages.json')).read_text())

class CageTests(unittest.TestCase):
    def test_three_distinct_controls(self):
        candidates=CONFIG['candidates']
        self.assertEqual(len(candidates),3)
        self.assertGreater(max(c['rowZ'][0]for c in candidates)-min(c['rowZ'][0]for c in candidates),.15)
        self.assertGreater(max(c['rowFrontY'][3]for c in candidates)-min(c['rowFrontY'][3]for c in candidates),.10)
        self.assertGreater(max(c['foreFan'][0]for c in candidates)-min(c['foreFan'][0]for c in candidates),.15)
    def check_closed(self,v,f):
        edges=Counter(tuple(sorted((a,b)))for p in f for a,b in zip(p,p[1:]+p[:1]))
        self.assertTrue(all(n==2 for n in edges.values()))
        self.assertEqual(len(v)-len(edges)+len(f),2)
        self.assertEqual({i for p in f for i in p},set(range(len(v))))
        self.assertTrue(all(math.isfinite(x)for p in v for x in p))
    def test_closed_cages(self):
        for c in CONFIG['candidates']:
            m=make_cage(c,CONFIG['columns']);self.check_closed(m['vertices'],m['faces'])
            self.assertEqual(len(m['colors']),len(m['faces']))
    def test_closed_fans_and_soles(self):
        for c in CONFIG['candidates']:
            for sign in(-1,1):
                v,f=make_fin(c['foreRoot'],c['foreFan'],c['fanWidth'],c['fanDepth'],sign)
                self.check_closed(v,f);self.assertAlmostEqual(min(p[2]for p in v),.008)
    def test_symmetric_eyes(self):
        for c in CONFIG['candidates']:
            m=make_cage(c,CONFIG['columns']);a,b=m['eyes']
            self.assertAlmostEqual(a['center'][0],-b['center'][0])
            self.assertAlmostEqual(a['center'][1],b['center'][1])
            self.assertAlmostEqual(a['center'][2],b['center'][2])
    def test_deterministic(self):
        for c in CONFIG['candidates']:self.assertEqual(make_cage(c,CONFIG['columns']),make_cage(c,CONFIG['columns']))

if __name__=='__main__':unittest.main()
