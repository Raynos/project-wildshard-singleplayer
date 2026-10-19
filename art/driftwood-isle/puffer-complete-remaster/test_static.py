"""Focused static composition regressions; not visual/runtime acceptance."""
import copy,hashlib,json,unittest
from pathlib import Path
from assemble_static import build,HERE,assemble
class StaticStudyTests(unittest.TestCase):
 def test_saved_matches_reproduction(self):
  native,_=build();self.assertEqual(native,json.loads((HERE/'complete-native.json').read_text()))
 def test_immutable_retained_inputs(self):
  approval=json.loads((HERE/'static-study-approval.json').read_text())
  for pin in [approval['body'],approval['attachmentAudit'],*approval['componentPins'].values()]:assemble.load_pin(pin)
 def test_only_owned_replacements(self):
  a=json.loads((HERE/'static-study-approval.json').read_text());sources={k:assemble.load_pin(p) for k,p in a['componentPins'].items()};body=assemble.load_pin(a['body']);out,_=build()
  for old,new in zip(body['parts'],out['parts']):
   if old['name'] not in {assemble.CORE,assemble.TAIL,*assemble.FINS}:self.assertEqual(old,new)
  self.assertEqual(body['bones'],out['bones'])
 def test_changed_bone_rejected(self):
  a=json.loads((HERE/'static-study-approval.json').read_text());sources={k:assemble.load_pin(p) for k,p in a['componentPins'].items()};body=assemble.load_pin(a['body']);body['bones'][0]['pos'][0]+=.01
  with self.assertRaises(ValueError):assemble.compose_checked(body,sources)
 def test_overlapping_fin_change_rejected(self):
  a=json.loads((HERE/'static-study-approval.json').read_text());sources={k:assemble.load_pin(p) for k,p in a['componentPins'].items()};body=assemble.load_pin(a['body']);assemble.parts(body)[assemble.FINS[0]]['positions'][0]+=.001
  with self.assertRaises(ValueError):assemble.compose_checked(body,sources)
 def test_explicit_inherited_exposure(self):
  a=json.loads((HERE/'source-attachment-audit.json').read_text());self.assertTrue(all(a['checks'].values()));self.assertEqual(len(a['inheritedExceptions']),2)
  for x in a['inheritedExceptions']:self.assertGreater(x['maxSignedDistance'],0);self.assertFalse(x['allInside'])
if __name__=='__main__':unittest.main()
