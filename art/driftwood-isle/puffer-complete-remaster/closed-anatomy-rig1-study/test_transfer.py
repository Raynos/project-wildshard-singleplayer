import copy,json,unittest,sys
from pathlib import Path
sys.dont_write_bytecode=True
from transfer_weights import ROOT,SOURCE,SOURCE_SHA,REFERENCE,REFERENCE_SHA,pinned,transfer,encode,sha,non_skin
class TransferTests(unittest.TestCase):
 def setUp(self):self.s=pinned(SOURCE,SOURCE_SHA);self.r=pinned(REFERENCE,REFERENCE_SHA)
 def test_exact_saved_output_and552(self):
  out,rows=transfer(self.s,self.r)
  self.assertEqual(sum(r['changedRows'] for r in rows),552)
  self.assertEqual(non_skin(out),non_skin(self.s))
  self.assertEqual(encode(out),(Path(__file__).parent/'closed-anatomy-rig1-native.json').read_bytes())
  self.assertEqual(sha(encode(out)),'38e0ad4de8a25827ace7a366e70c3c21a860ce9221de64f4b4afaf0c27ec2b61')
 def test_wrong_source_pin_refused(self):
  with self.assertRaises(ValueError):pinned(SOURCE,REFERENCE_SHA)
 def test_wrong_bind_refused(self):
  self.s['bones'][0]['pos'][1]+=.001
  with self.assertRaises(ValueError):transfer(self.s,self.r)
 def test_geometry_change_refused(self):
  self.s['parts'][3]['positions'][0]+=.001
  with self.assertRaises(ValueError):transfer(self.s,self.r)
 def test_paint_change_refused(self):
  self.s['parts'][3]['colorsLinear'][0]+=.001
  with self.assertRaises(ValueError):transfer(self.s,self.r)
 def test_original_skin_change_refused(self):
  self.s['parts'][3]['skinWeights'][0]=.9
  with self.assertRaises(ValueError):transfer(self.s,self.r)
 def test_nonfin_values_preserved(self):
  out,_=transfer(self.s,self.r)
  self.assertEqual(out['parts'][:3],self.s['parts'][:3])
  self.assertEqual(out['bones'],self.s['bones'])
  for i in range(3,7):self.assertEqual(out['parts'][i],self.r['parts'][i])
if __name__=='__main__':unittest.main()
