"""Focused source/packing proofs only. No physics world, gait, or visual verdict."""
import unittest
import json
import struct
import zlib
import math
from pathlib import Path
from collections import Counter
import numpy as np
from scipy.spatial import ConvexHull
from scipy.spatial.transform import Rotation
import generate as g

class SourceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.model=json.loads((g.HERE/'model.json').read_bytes());cls.parts={p['name']:p for p in cls.model['parts']};cls.recipe=json.loads((g.HERE/'recipe.json').read_bytes());cls.report=json.loads((g.HERE/'construction.json').read_bytes());cls.source=json.loads(g.SOURCE.read_bytes());cls.contract=json.loads((g.HERE/'contract.json').read_bytes())
    def test_pinned_inputs_original_failed_candidate_and_reproducibility(self):
        freeze=json.loads((g.HERE/'freeze.json').read_bytes())
        for p,s in freeze['inputs'].items():self.assertEqual(g.sha((g.BASE/p).read_bytes()),s,p)
        for name,raw in g.build().items():self.assertEqual(raw,(g.HERE/name).read_bytes(),name)
        self.assertEqual(g.sha((g.HERE/'generate.py').read_bytes()),freeze['generatorSha256'])
    def test_native_source_strict_structure_and_rigid_weights(self):
        self.assertEqual([p['name'] for p in self.model['parts']],g.OWNERS)
        names=[b['name'] for b in self.model['bones']];seen=[]
        for b in self.model['bones']:
            self.assertTrue(b['parent'] is None or b['parent'] in seen);seen.append(b['name'])
        for p in self.model['parts']:
            n=len(p['positions'])//3;self.assertEqual(n%3,0)
            for _,_,w,k in g.ATTRS:self.assertEqual(len(p[k]),n*w);self.assertTrue(np.isfinite(p[k]).all())
            self.assertEqual(p['skinIndices'],[names.index(p['name']),0,0,0]*n)
            self.assertEqual(p['skinWeights'],[1,0,0,0]*n)
            self.assertTrue(np.allclose(np.linalg.norm(np.array(p['normals']).reshape(-1,3),axis=1),1,rtol=0,atol=1e-5))
            pts=np.array(p['positions']).reshape(-1,3,3)
            self.assertGreater(np.min(np.linalg.norm(np.cross(pts[:,1]-pts[:,0],pts[:,2]-pts[:,0]),axis=1)),1e-12)
    def test_every_source_mesh_accounted_and_unmodified_regions_exact(self):
        mapping=json.loads(g.MAP.read_bytes());old={p['name']:p for p in self.source['parts']};cursor=Counter();rows=self.report['changes'];count=0;max_normal_change=0
        self.assertEqual(set(r['sourceMesh'] for r in rows),set(r['name'] for r in mapping))
        for row in rows:
            owner=row['owner'];p=self.parts[owner];start=cursor[owner]
            if row['operation'].startswith('exact retained'):
                source_map=next(m for m in mapping if m['name']==row['sourceMesh']);orig=old[source_map['joint']];s=source_map['vertexStart'];n=source_map['vertexCount'];count+=n
                actual=np.array(p['positions']).reshape(-1,3)[start:start+n]
                original=np.array(orig['positions']).reshape(-1,3)[s:s+n]
                np.testing.assert_array_equal(actual,original@g.B.T)
                np.testing.assert_array_equal(np.array(p['colorsLinear']).reshape(-1,3)[start:start+n],np.array(orig['colorsLinear']).reshape(-1,3)[s:s+n])
                normals=np.array(orig['normals']).reshape(-1,3)[s:s+n]@g.B.T
                out=np.array(p['normals']).reshape(-1,3)[start:start+n]
                max_normal_change=max(max_normal_change,float(np.max(np.abs(out-normals))))
                np.testing.assert_array_equal(out,normals)
            else:n=3*(row['retainedSurfaceTriangles']+row['newCapTriangles'])
            cursor[owner]+=n
        self.assertEqual(count,5802)
        for p in self.model['parts']:self.assertEqual(cursor[p['name']],len(p['positions'])//3)
    def test_hinge_segmentation_conserves_original_external_surface_area(self):
        for side in ['Left','Right']:
            name='leg'+side;p=next(p for p in self.source['parts'] if p['name']==name);tri=g.source_mesh(p,0,132)
            stations=np.array([next(b['pos'] for b in self.source['bones'] if b['name']==name+s) for s in ['', 'Knee','Ankle']])
            for t in tri:
                for v in t:v[9]=int(np.argmin(np.linalg.norm(stations-v[:3],axis=1)))
            area=lambda ts:sum(np.linalg.norm(np.cross(t[1,:3]-t[0,:3],t[2,:3]-t[0,:3]))/2 for t in ts)
            pieces=[g.clip(tri,lo,hi) for lo,hi in [(0,1),(1,1.9),(1.9,2)]]
            self.assertAlmostEqual(area(tri),sum(area(t) for t in pieces),12)
            for t in pieces:
                closed,n=g.cap(t);self.assertGreater(n,0);self.assertEqual(g.mesh_report(closed)['nonTwoEdges'],0)
        for row in self.report['newClosedMeshes']:
            self.assertEqual(row['nonTwoEdges'],0);self.assertEqual(row['orientationErrors'],0)
    def test_real_sole_geometry_no_lift_and_full_source_bind_clearance(self):
        self.assertEqual(self.contract['rootRenderOffset'],[0,0,0])
        for p in self.parts.values():self.assertGreaterEqual(min(p['positions'][1::3]),0)
        for foot in self.contract['feet']:
            self.assertGreaterEqual(len(foot['supportPolygon']),3)
            self.assertEqual(foot['bindMinimumY'],0)
            self.assertTrue(all(p[1]==0 for p in foot['supportPolygon']))
            self.assertGreater(ConvexHull(np.array(foot['supportPolygon'])[:,[0,2]]).volume,0)
    def test_complete_float32_packing_roundtrip(self):
        meta=json.loads((g.HERE/'metadata.json').read_bytes());raw=zlib.decompress((g.HERE/'payload.bin').read_bytes());self.assertEqual(len(raw),meta['bytes'])
        self.assertEqual(meta['bodies'][0]['bones'],self.model['bones'])
        for p,row in zip(self.model['parts'],meta['bodies'][0]['hard']):
            n=len(p['positions'])//3
            for (_,kind,w,key),offset in zip(g.ATTRS,row['offsets']):
                dtype='<u2' if kind=='u16' else '<f4';actual=np.frombuffer(raw,dtype=dtype,count=n*w,offset=offset);np.testing.assert_array_equal(actual,np.array(p[key],dtype=dtype))
    def test_eight_hulls_exact_packed_surface_support_and_budget(self):
        self.assertEqual(len(self.recipe['parts']),8);self.assertEqual(sum(len(h['points']) for h in self.recipe['parts']),333)
        for h in self.recipe['parts']:
            self.assertLessEqual(len(h['points']),128);pivot=np.array(next(b['pos'] for b in self.model['bones'] if b['name']==h['bone']));local=np.array(h['points']);points=np.array(self.parts[h['bone']]['positions'],dtype=np.float32).reshape(-1,3).astype(float)
            hull=ConvexHull(local);self.assertGreater(hull.volume,1e-9)
            self.assertLess(np.max((points-pivot)@hull.equations[:,:3].T+hull.equations[:,3]),2e-14)
            cloud={tuple(v) for v in points}
            for v in local+pivot:self.assertLess(np.min(np.linalg.norm(points-v,axis=1)),1e-15)
            for r in [Rotation.from_euler('xyz',[.31,.67,-.28]).as_matrix(),np.eye(3)]:
                for d in np.eye(3).tolist()+[[-1,2,-3],[.4,-.8,.6]]:
                    d=np.array(d);self.assertAlmostEqual(np.max(((points-pivot)@r.T)@d),np.max((local@r.T)@d),12)
    def test_basis_fk_skin_weapon_commutation_nonzero_yaw_scale(self):
        source={b['name']:np.array(b['pos']) for b in self.source['bones']};target={b['name']:np.array(b['pos']) for b in self.model['bones']}
        for name in source:np.testing.assert_array_equal(target[name],g.B@source[name])
        self.assertEqual(np.linalg.det(g.B),1)
        for yaw in [.37,math.pi/2,-2.4]:
            for scale in [.7,1,1.3]:
                world={};worldB={}
                for j,b in enumerate(self.model['bones']):
                    name=b['name'];parent=b['parent'];rot=np.eye(3) if name in self.contract['fixedJoints'] else Rotation.from_euler('xyz',[.03*j,.07*j,-.02*j]).as_matrix();local=source[name]-(source[parent] if parent else 0);localB=g.B@local;converted=g.B@rot@g.B.T
                    rp,tp=world.get(parent,(Rotation.from_euler('y',yaw).as_matrix(),np.array([1.,2.,3.])));rb,tb=worldB.get(parent,(g.B@Rotation.from_euler('y',yaw).as_matrix()@g.B.T,g.B@np.array([1.,2.,3.])));world[name]=(rp@rot,tp+scale*rp@local);worldB[name]=(rb@converted,tb+scale*rb@localB)
                    np.testing.assert_allclose(worldB[name][0],g.B@world[name][0]@g.B.T,atol=1e-14);np.testing.assert_allclose(worldB[name][1],g.B@world[name][1],atol=1e-14)
                for p in self.parts.values():
                    name=p['name'];points=np.array(p['positions']).reshape(-1,3);r,t=world[name];rb,tb=worldB[name]
                    np.testing.assert_allclose((scale*((points@g.B.T-source[name])@r.T)+t)@g.B.T,scale*((points-target[name])@rb.T)+tb,atol=1e-14)
        self.assertLess(target['legLeft'][0],0);self.assertGreater(target['rapierArm'][0],0)
if __name__=='__main__':unittest.main(verbosity=2)
