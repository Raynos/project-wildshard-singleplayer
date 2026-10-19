"""Read-only source winding audit. Refuses repair of folded polygon pairs."""
import json
import math
import export_native as bridge


def audit():
    raw = bridge.GLB.read_bytes()
    bridge.require(bridge.sha(raw) == bridge.GLB_SHA, 'Exact V6 GLB required')
    doc, binary = bridge.parse_glb(raw)
    bad = []
    for node_index, node, _, _ in bridge.scene_nodes(doc):
        if 'mesh' not in node:
            continue
        rows = []
        for primitive_index, primitive in enumerate(doc['meshes'][node['mesh']]['primitives']):
            positions = bridge.accessor(doc, binary, primitive['attributes']['POSITION'])
            normals = bridge.accessor(doc, binary, primitive['attributes']['NORMAL'])
            indices = [x[0] for x in bridge.accessor(doc, binary, primitive['indices'])]
            for j in range(0, len(indices), 3):
                points = [positions[k] for k in indices[j:j+3]]
                a, b, c = points
                u = [y-x for x, y in zip(a, b)]
                v = [y-x for x, y in zip(a, c)]
                cross = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]]
                magnitude = math.sqrt(sum(x*x for x in cross))
                bridge.require(magnitude > 1e-10, 'Degenerate triangle; inspect separately')
                ns = [normals[k] for k in indices[j:j+3]]
                dots = [sum(x*y for x, y in zip(cross, normal))/magnitude for normal in ns]
                rows.append(dict(node=node_index, name=node['name'], primitive=primitive_index,
                                 triangle=j//3, positions=points, normals=ns, normalCosines=dots))
        for row in rows:
            if max(row['normalCosines']) >= -1e-7:
                continue
            neighbors = []
            for other in rows:
                if other is row:
                    continue
                shared = set(row['positions']) & set(other['positions'])
                if len(shared) == 2 and row['normals'] == other['normals']:
                    neighbors.append({key: other[key] for key in ['primitive', 'triangle', 'normalCosines']})
            bad.append({**row, 'sharedEdgeSameNormalTriangles': neighbors,
                        'classification': 'ambiguous nonplanar or folded polygon; no winding repair emitted'})
    return {'glbSha256': bridge.GLB_SHA, 'sourceSha256': bridge.SOURCE_SHA, 'opposedTriangles': bad,
            'normalRepairApproved': False, 'runtimeAcceptance': False}


if __name__ == '__main__':
    print(json.dumps(audit(), indent=2))
