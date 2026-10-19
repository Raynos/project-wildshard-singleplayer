"""Diagnostic integrity tests, not clip/visual acceptance tests."""
import json, unittest
import numpy as np
from fit import OUT,N,basis,geometry,posed,rotation
class FitIntegrity(unittest.TestCase):
 def test_fourier_value_and_derivative_periodic(self):
  for d in [0,1,2]:np.testing.assert_allclose(basis([0],d),basis([1],d),atol=1e-10)
 def test_rigid_simplification_valid(self):
  for part in N['parts']:
   if part['name'].startswith('leg') and part['name'].endswith('_knee'):
    j=next(i for i,b in enumerate(N['bones']) if b['name']==part['name']);ix=np.array(part['skinIndices']).reshape(-1,4);w=np.array(part['skinWeights']).reshape(-1,4)
    np.testing.assert_allclose((w*(ix==j)).sum(1),1,atol=1e-12)
    v,*_=geometry(part['name']);np.testing.assert_allclose(posed(np.zeros((1,4)),part['name'])[0],v,atol=1e-12)
 def test_independent_rotation_order(self):
  from scipy.spatial.transform import Rotation
  q=np.array([[.13,-.23,-.51,.19]])
  for side in [-1,1]:
   r,k=rotation(q,side)
   # Intrinsic XYZ equals Rx @ Ry @ Rz; scipy uppercase specifies intrinsic axes.
   np.testing.assert_allclose(r[0],Rotation.from_euler('XYZ',[q[0,0],side*q[0,3],side*q[0,1]]).as_matrix(),atol=1e-14)
 def test_zero_speed_exact_leg_rest(self):
  fit=json.loads((OUT/'fit.json').read_text())
  for name,f in fit['fits'].items():
   q=(basis(np.arange(512)/512)@np.array(f['coefficients']))*0
   self.assertTrue(np.array_equal(q,np.zeros_like(q)))
   v,*_=geometry(name);np.testing.assert_allclose(posed(q,name),np.broadcast_to(v,(512,*v.shape)),atol=1e-12)
 def test_fitted_seams_and_fail_closed_report(self):
  fit=json.loads((OUT/'fit.json').read_text());report=json.loads((OUT/'evaluation.json').read_text())
  self.assertEqual(len(fit['fits']),4);self.assertFalse(report['accepted'])
  for f in fit['fits'].values():
   co=np.array(f['coefficients']);self.assertTrue(np.isfinite(co).all())
   np.testing.assert_allclose(basis([0])@co,basis([1])@co,atol=1e-6)
   np.testing.assert_allclose(basis([0],1)@co,basis([1],1)@co,atol=1e-4)
if __name__=='__main__':unittest.main()
