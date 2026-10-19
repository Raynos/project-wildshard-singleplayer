"""Execute only pure source helpers, with a numeric Vector substitute; no bpy."""
import ast
from collections import Counter
import json
import math
import unittest
from pathlib import Path
import prepare_seam_candidate as candidate
class Vector:
    def __init__(self,values):self.values=tuple(values)
    def __iter__(self):return iter(self.values)
    def __add__(self,other):return Vector(a+b for a,b in zip(self,other))
    def __sub__(self,other):return Vector(a-b for a,b in zip(self,other))
    def __mul__(self,n):return Vector(a*n for a in self)
    def dot(self,other):return sum(a*b for a,b in zip(self,other))
    @property
    def length(self):return math.sqrt(self.dot(self))
    def normalize(self):self.values=self.normalized().values
    def normalized(self):return self*(1/math.sqrt(self.dot(self)))
    def cross(self,other):
        a,b,c=self;d,e,f=other;return Vector((b*f-c*e,c*d-a*f,a*e-b*d))
def helpers(source):
    meshes={}
    def mesh(name,points,faces,colors):meshes[name]=(points,faces,colors)
    tree=ast.parse(source);functions=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in ['root','canopy']]
    ns=dict(Vector=Vector,math=math,mesh=mesh,leaf=lambda *args:None)
    exec(compile(ast.Module(body=functions,type_ignores=[]),'<pure-source-helpers>','exec'),ns)
    return ns,meshes

def all_meshes(source):
    meshes={}
    def mesh(name,points,faces,colors):
        if name in meshes:raise ValueError('Duplicate name')
        meshes[name]=(points,faces,colors)
    tree=ast.parse(source);start=next(i for i,n in enumerate(tree.body) if isinstance(n,ast.Expr) and isinstance(n.value,ast.Call) and isinstance(n.value.func,ast.Name) and n.value.func.id=='root')
    end=next(i for i,n in enumerate(tree.body) if isinstance(n,ast.For) and isinstance(n.iter,ast.Name) and n.iter.id=='parts')
    functions=[n for n in tree.body[:start] if isinstance(n,ast.FunctionDef) and n.name in ['root','stone','leaf','canopy']]
    ns=dict(Vector=Vector,math=math,mesh=mesh)
    exec(compile(ast.Module(body=functions+tree.body[start:end],type_ignores=[]),'<all-pure-source-geometry>','exec'),ns)
    return meshes

def seam(source):
    ns,meshes=helpers(source);ns['canopy']('Shin growth -1',(-1.01,-.23,1.02),.68,-1.3)
    return meshes['Shin growth -1 living seam']
def quality(points,faces):
    worst=1.;opposed=0
    for face in faces[1:-1]:
        p=[Vector(points[i]) for i in face]
        normal=Vector((0,0,0))
        for a,b in zip(p,p[1:]+p[:1]):normal=normal+a.cross(b)
        normal=normal.normalized()
        for a,b,c in [(0,1,2),(0,2,3),(0,1,3),(1,2,3)]:
            n=(p[b]-p[a]).cross(p[c]-p[a]).normalized();cos=n.dot(normal)
            worst=min(worst,cos);opposed+=cos<0
    return dict(minimumBothDiagonalTrianglePolygonCosine=worst,opposedBothDiagonalTriangles=opposed)
class SeamCandidate(unittest.TestCase):
    def test_source_patch_is_exact(self):
        self.assertEqual((candidate.HERE/'build_colossus_v4_seam1.py').read_text(),candidate.candidate_source())
    def test_points_caps_and_material_indices_unchanged(self):
        a=seam(candidate.SOURCE.read_text());b=seam(candidate.candidate_source())
        self.assertEqual(a[0],b[0]);self.assertEqual(a[1][0],b[1][0]);self.assertEqual(a[1][-1],b[1][-1]);self.assertEqual(a[2],b[2])
        self.assertEqual(len(a[0]),18);self.assertEqual(len(a[1]),14)
        self.assertNotEqual(a[1][1:-1],b[1][1:-1])
    def test_closed_oriented_edges(self):
        _,faces,_=seam(candidate.candidate_source());edges=Counter((a,b) for face in faces for a,b in zip(face,face[1:]+face[:1]))
        self.assertTrue(all(n==1 and edges[(b,a)]==1 for (a,b),n in edges.items()))
        self.assertEqual(len(edges)//2,30)
    def test_no_opposed_triangle_for_either_quad_diagonal(self):
        points,faces,_=seam(candidate.candidate_source());q=quality(points,faces)
        self.assertEqual(q['opposedBothDiagonalTriangles'],0)
        self.assertGreater(q['minimumBothDiagonalTrianglePolygonCosine'],.5)
    def test_all_227_source_meshes_only_target_side_changes(self):
        before=all_meshes(candidate.SOURCE.read_text());after=all_meshes(candidate.candidate_source())
        self.assertEqual(len(before),227);self.assertEqual(before.keys(),after.keys())
        changed=[]
        for name in before:
            a,b=before[name],after[name]
            self.assertEqual(a[0],b[0]);self.assertEqual(a[2],b[2])
            if a[1]!=b[1]:changed.append(name)
        self.assertEqual(changed,['Shin growth -1 living seam'])
    def test_unaffected_named_roots(self):
        a,ma=helpers(candidate.SOURCE.read_text());b,mb=helpers(candidate.candidate_source())
        for name in ['Shin growth 1','Rear nape leaves','Forearm growth -1']:
            a['canopy'](name,(1,-.23,1),.68,1.3);b['canopy'](name,(1,-.23,1),.68,1.3)
        for name in ['Other root','Shin growth -1 living seam extra']:
            rows=[(0,0,0,.1,.1),(1,1,1,.2,.1),(2,0,2,.1,.2),(3,1,3,.2,.2)]
            a['root'](name,rows);b['root'](name,rows)
        self.assertEqual(ma,mb)
if __name__=='__main__':unittest.main()
