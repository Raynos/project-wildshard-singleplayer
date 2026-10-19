"""Fail-closed, offline native component composition. No runtime admission.

Triangle soup is addressed by semantic part name and exact oriented triangle
content, never by inherited body offsets. Standard library only.
"""
import argparse
import copy
import hashlib
import json
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
FIELDS = {'positions': 3, 'colorsLinear': 3, 'skinIndices': 4,
          'skinWeights': 4, 'furLen': 1}
CORE = 'Continuous mantle cheek and pouch'
TAIL = 'Tail root'
FINS = ['Volumetric connected finL', 'Volumetric connected finR']


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()


def load_pin(pin):
    path = (REPO / pin['path']).resolve()
    require(path.is_relative_to(REPO), 'Input outside repository')
    raw = path.read_bytes()
    require(digest(raw) == pin['sha256'], f"Hash mismatch: {pin['path']}")
    return json.loads(raw)


def parts(native):
    result = {p['name']: p for p in native['parts']}
    require(len(result) == len(native['parts']), 'Duplicate semantic part name')
    return result


def validate(native, base):
    require(set(native) == set(base), 'Unknown native top-level fields')
    for key in ('schema', 'coordinates', 'bones'):
        require(native[key] == base[key], f'Changed {key}; explicit rebind required')
    names = {b['name'] for b in native['bones']}
    require(len(names) == len(native['bones']), 'Duplicate bones')
    for p in parts(native).values():
        require(set(p) == {'name', *FIELDS}, 'Unknown part attributes')
        count = len(p['positions']) // 3
        require(count > 0 and count % 3 == 0, 'Invalid triangle soup')
        for field, width in FIELDS.items():
            require(len(p[field]) == count * width, f'Invalid {field} length')
            require(all(isinstance(v, (int, float)) and not isinstance(v, bool)
                        and math.isfinite(v) for v in p[field]), f'Invalid {field} values')
        for i in range(count):
            inds = p['skinIndices'][i*4:i*4+4]
            weights = p['skinWeights'][i*4:i*4+4]
            require(all(int(v) == v and 0 <= v < len(names) for v in inds), 'Invalid bone index')
            require(all(0 <= v <= 1 for v in weights) and abs(sum(weights)-1) < 1e-6,
                    'Invalid normalized binding')


def triangle_positions(part, index):
    values = part['positions'][index*9:index*9+9]
    return [values[i:i+3] for i in range(0, 9, 3)]


def geometry_key(points):
    # Cyclic permutations preserve winding. Reversal must fail.
    return min(canonical(points[i:] + points[:i]) for i in range(3))


def triangle_record(part, index):
    return {key: value[index*3*width:(index+1)*3*width]
            for key, width in FIELDS.items() for value in [part[key]]}


def aligned_record(record, rotation):
    return {key: value[rotation*width:] + value[:rotation*width]
            for key, width in FIELDS.items() for value in [record[key]]}


def geometry_index(part):
    result = {}
    for i in range(len(part['positions']) // 9):
        result.setdefault(geometry_key(triangle_positions(part, i)), []).append(i)
    return result


def find_triangle(part, lookup, points):
    matches = lookup.get(geometry_key(points), [])
    require(len(matches) == 1, 'Missing or ambiguous semantic component triangle')
    index = matches[0]
    actual = triangle_positions(part, index)
    rotations = [i for i in range(3) if actual[i:] + actual[:i] == points]
    require(len(rotations) == 1, 'Degenerate or reversed component triangle')
    return index, rotations[0]


def audit_sources(source):
    base, tail, fins, spikes, indexed = (source[k] for k in
                                        ('baseline', 'tail', 'fins', 'spikes', 'spike_indexed'))
    for native in (base, tail, fins, spikes):
        validate(native, base)
    bp, tp, fp, sp = map(parts, (base, tail, fins, spikes))
    require(set(tp) == {TAIL}, 'Tail study exceeds its part scope')
    require(set(fp) == set(FINS), 'Fin study exceeds its part scope')
    require(set(sp) == set(bp), 'Spike study changed part inventory')
    for name in bp:
        if name != CORE:
            require(sp[name] == bp[name], f'Spike study changed unrelated part {name}')
    for field in FIELDS:
        if field != 'positions':
            require(sp[CORE][field] == bp[CORE][field], f'Spike study changed {field}')
    # Tail's 44-triangle retained root includes all skin/material attributes.
    for field, width in FIELDS.items():
        require(tp[TAIL][field][:132*width] == bp[TAIL][field][:132*width],
                f'Tail changed retained attachment {field}')
    require(len(indexed['meshes']) == 8, 'Unexpected spike inventory')
    require([m['name'] for m in indexed['meshes']] ==
            [f'Cream crown spine {i}' for i in range(8)], 'Unknown spike identity')
    lookup = geometry_index(bp[CORE])
    expected = copy.deepcopy(base)
    records = []
    changed = []
    seen = set()
    for mesh in indexed['meshes']:
        require(len(mesh['vertices']) == 5 and len(mesh['triangles']) == 6, 'Unexpected wedge topology')
        triangles = []
        for face in mesh['triangles']:
            old = [mesh['originalVertices'][i] for i in face]
            new = [mesh['vertices'][i] for i in face]
            index, rotation = find_triangle(bp[CORE], lookup, old)
            require(index not in seen, 'Overlapping component ownership')
            seen.add(index)
            old_record = aligned_record(triangle_record(bp[CORE], index), rotation)
            new_record = copy.deepcopy(old_record)
            new_record['positions'] = sum(new, [])
            # Rotate the expected output back to baseline soup order.
            native_order = aligned_record(new_record, (-rotation) % 3)
            parts(expected)[CORE]['positions'][index*9:index*9+9] = native_order['positions']
            triangles.append({'before': old_record, 'after': new_record})
        if mesh['vertices'] != mesh['originalVertices']:
            changed.append(mesh['name'])
        records.append({'name': mesh['name'], 'triangles': triangles})
    require(len(changed) == 6, 'Expected exactly six changed subordinate wedges')
    require(expected['parts'] == spikes['parts'], 'Spike changes extend outside named wedges')
    return records, {'scope': 'PASS', 'changedSpikes': changed,
                     'retainedSpikeCount': 8, 'tailRetainedRootTriangles': 44,
                     'replacedParts': [TAIL, *FINS], 'identityTransform': True,
                     'bonesAndBindPivotsExact': True}


def compose_checked(body, source):
    """In-memory composition; caller must separately gate any persisted candidate."""
    records, audit = audit_sources(source)
    base = source['baseline']
    validate(body, base)
    bp, cp = parts(base), parts(body)
    require(set(cp) == set(bp), 'Body renamed/added parts: reviewed identity map required')
    for name in (TAIL, *FINS):
        require(cp[name] == bp[name], f'Overlapping body/part edit: {name}')
    result = copy.deepcopy(body)
    rp = parts(result)
    lookup = geometry_index(cp[CORE])
    consumed = set()
    for component in records:
        for record in component['triangles']:
            before = record['before']
            points = [before['positions'][i:i+3] for i in (0, 3, 6)]
            index, rotation = find_triangle(cp[CORE], lookup, points)
            require(index not in consumed, 'Overlapping spike components')
            consumed.add(index)
            require(aligned_record(triangle_record(cp[CORE], index), rotation) == before,
                    f"Body changed spike materials/binding: {component['name']}")
            new = aligned_record(record['after'], (-rotation) % 3)
            rp[CORE]['positions'][index*9:index*9+9] = new['positions']
    replacement = {**parts(source['tail']), **parts(source['fins'])}
    result['parts'] = [copy.deepcopy(replacement.get(p['name'], p)) for p in result['parts']]
    result['status'] = 'Unaccepted assembled remaster study; not runtime admitted'
    # All core non-position attributes, unrelated core triangles and other parts exact.
    for name in cp:
        if name not in replacement and name != CORE:
            require(parts(result)[name] == cp[name], 'Unrelated part changed')
    for index in range(len(cp[CORE]['positions']) // 9):
        if index not in consumed:
            require(triangle_record(rp[CORE], index) == triangle_record(cp[CORE], index),
                    'Unrelated core triangle changed')
    validate(result, base)
    return result, audit


def authorize(manifest, admission):
    require(admission.get('status') == 'root-approved-input-tuple', 'Final input tuple is not authorized')
    require(admission.get('componentPins') == manifest, 'Admission component tuple mismatch')
    require(bool(admission.get('reviewReference')), 'Missing independent body review reference')
    require(admission.get('body') is not None, 'Final body not pinned')
    # This intentionally requires a new-cage audit, not the existing V71 study audits.
    audit = load_pin(admission['attachmentAudit'])
    require(audit.get('bodySha256') == admission['body']['sha256'], 'Stale attachment body')
    require(audit.get('componentPins') == manifest, 'Stale attachment component tuple')
    require(audit.get('verdict') == 'PASS', 'New-cage attachment clearance not passed')
    require(audit.get('checks') == {
        'tailRootBurial': True, 'forefinRootBurial': True,
        'spikeRootClearance': True, 'inheritedExceptionsReviewed': True,
        'identityTransforms': True}, 'Incomplete new-cage attachment checks')
    return load_pin(admission['body'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--admission', type=Path)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    manifest = json.loads((HERE/'source-pins.json').read_text())
    source = {key: load_pin(pin) for key, pin in manifest.items()}
    _, audit = audit_sources(source)
    if args.admission or args.output:
        require(args.admission is not None and args.output is not None, 'Admission and output required together')
        admission = json.loads(args.admission.read_text())
        body = authorize(manifest, admission)
        result, audit = compose_checked(body, source)
        require(args.output.resolve().parent == HERE, 'Candidate output must stay in assembly directory')
        with args.output.open('x') as out:
            out.write(json.dumps(result, separators=(',', ':'), allow_nan=False)+'\n')
        audit['candidateSha256'] = digest(args.output.read_bytes())
    print(json.dumps(audit, indent=2))


if __name__ == '__main__':
    main()
