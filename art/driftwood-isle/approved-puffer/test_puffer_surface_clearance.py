"""Pure classification tests, including exact frozen V70 cap queries."""
import hashlib
import json
from pathlib import Path
import unittest
from puffer_surface_clearance import classify_surface_point

CUBE = [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),
        (-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]
FACES = [(0,2,1),(0,3,2),(4,5,6),(4,6,7),(0,1,5),(0,5,4),
         (1,2,6),(1,6,5),(2,3,7),(2,7,6),(3,0,4),(3,4,7)]


def native_core():
    root = Path(__file__).resolve().parent
    raw = (root/'unaccepted-native-v70.json').read_bytes()
    if hashlib.sha256(raw).hexdigest() != '3d0606971754f7788e899fe31214748fd38f43b38b363f2d2b291be588de48dc':
        raise ValueError('Wrong frozen native baseline')
    part = next(p for p in json.loads(raw)['parts'] if p['name']=='Continuous mantle cheek and pouch')
    flat = part['positions']
    vertices = [(flat[i],flat[i+2],flat[i+1]) for i in range(0,len(flat),3)]
    faces = [(i+2,i+1,i) for i in range(0,len(vertices),3)]
    vertex_faces = {}
    for fi,face in enumerate(faces):
        for vi in face:
            vertex_faces.setdefault(vertices[vi],[]).append(fi)
    unseen = set(range(len(faces)))
    components = []
    while unseen:
        stack = [unseen.pop()]
        component = list(stack)
        while stack:
            fi = stack.pop()
            for vi in faces[fi]:
                for neighbor in vertex_faces[vertices[vi]]:
                    if neighbor in unseen:
                        unseen.remove(neighbor)
                        stack.append(neighbor)
                        component.append(neighbor)
        components.append(component)
    main = max(components,key=len)
    if len(main)!=1018:
        raise ValueError('Frozen core component identity changed')
    return vertices,[faces[i] for i in main]


class SurfaceClearanceTests(unittest.TestCase):
    def test_known_inside(self):
        result=classify_surface_point((0,0,0),CUBE,FACES,1)
        self.assertEqual(result['classification'],'inside')
        self.assertEqual(result['signedEuclideanDistance'],-1)

    def test_known_outside(self):
        result=classify_surface_point((2,0,0),CUBE,FACES,1)
        self.assertEqual(result['classification'],'outside')
        self.assertEqual(result['signedEuclideanDistance'],1)

    def test_boundary_tolerance(self):
        self.assertEqual(classify_surface_point((1,0,0),CUBE,FACES,0)['classification'],'boundary')

    def test_orientation_independent(self):
        self.assertEqual(classify_surface_point((0,0,0),CUBE,[tuple(reversed(f))for f in FACES],1)['classification'],'inside')

    def test_open_mesh_rejected(self):
        with self.assertRaises(ValueError):
            classify_surface_point((0,0,0),CUBE,FACES[:-1],1)

    def test_actual_v70_cap_queries(self):
        vertices,faces=native_core()
        root=Path(__file__).resolve().parent
        receipt=json.loads((root/'v71-triangle-attachment-failure-diagnostic.json').read_text())
        count=0
        for attachment in receipt['allAttachmentsReadOnly']:
            for sample in attachment['samples']:
                result=classify_surface_point(sample['query'],vertices,faces,sample['before']['distance'])
                expected='inside' if sample['signedBefore']<0 else 'outside'
                self.assertEqual(result['classification'],expected,(attachment['object'],sample['vertex']))
                count+=1
        self.assertEqual(count,80)


if __name__=='__main__':
    unittest.main()
