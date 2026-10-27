"""G757 exact-batch metadata: publish before upload, consume in push CI."""
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time

VARIABLE = 'WS_GATE_DEFERRED'


def handoff_record(base, tip, tags):
    if any(not isinstance(sha, str) or not re.fullmatch(r'[0-9a-f]{40}', sha) for sha in (base, tip)):
        raise ValueError('Handoff requires exact base and tip SHAs')
    if not isinstance(tags, list) or not tags:
        raise ValueError('Handoff requires explicit unfinished steps')
    steps = []
    for tag in tags:
        if not isinstance(tag, str) or not re.fullmatch(r'Gate-deferred: [a-z][a-z0-9-]*', tag):
            raise ValueError('Invalid Gate-deferred tag')
        steps.append(tag.removeprefix('Gate-deferred: '))
    if len(set(steps)) != len(steps):
        raise ValueError('Duplicate handoff step')
    return {'base': base, 'tip': tip, 'steps': steps}


def read_handoffs(encoded):
    if not encoded:
        return []
    value = json.loads(encoded)
    if not isinstance(value, dict) or value.get('schema') != 1 or not isinstance(value.get('batches'), list):
        raise ValueError('Invalid gate handoff inventory')
    rows = []
    for row in value['batches']:
        if not isinstance(row, dict) or not isinstance(row.get('steps'), list):
            raise ValueError('Invalid gate handoff batch')
        exact = handoff_record(row.get('base'), row.get('tip'), ['Gate-deferred: ' + step for step in row['steps'] if isinstance(step, str)])
        if exact != row:
            raise ValueError('Unexpected or missing gate handoff fields')
        rows.append(exact)
    if len({row['tip'] for row in rows}) != len(rows) or len(rows) > 32:
        raise ValueError('Ambiguous gate handoff inventory')
    return rows


def publish_handoff(root, base, tip, tags, runner=subprocess.run):
    """Only the serialized pusher writes this bounded non-secret metadata.

    Publication is before git upload, so CI cannot begin without its exact
    handoff record. A failed API write refuses upload; no test is waived.
    Keep recent tips because older push runs can already be executing.
    """
    exact = handoff_record(base, tip, tags)
    endpoint = 'repos/{owner}/{repo}/actions/variables'
    deadline = time.monotonic() + 10
    def api(arguments, body=None):
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise ValueError('Handoff publication exceeded its metadata allowance')
        return runner(['gh', 'api', *arguments], cwd=root, capture_output=True,
                      text=True, input=body, timeout=remaining, check=False)
    current = api([endpoint + '/' + VARIABLE])
    missing = current.returncode != 0 and 'HTTP 404' in current.stderr
    if current.returncode != 0 and not missing:
        raise ValueError('Cannot read gate handoffs: ' + current.stderr.strip()[:500])
    rows = [] if missing else read_handoffs(json.loads(current.stdout)['value'])
    prior = next((row for row in rows if row['tip'] == tip), None)
    if prior is not None:
        if prior['base'] != base:
            raise ValueError('A committed tip already has a different CI base')
        exact['steps'] = list(dict.fromkeys(prior['steps'] + exact['steps']))
    rows = [row for row in rows if row['tip'] != tip] + [exact]
    value = json.dumps({'schema': 1, 'batches': rows[-32:]}, separators=(',', ':'))
    payload = json.dumps({'name': VARIABLE, 'value': value})
    updated = api(['--method', 'POST' if missing else 'PATCH', endpoint if missing else endpoint + '/' + VARIABLE, '--input', '-'], payload)
    if updated.returncode != 0:
        raise ValueError('Cannot publish gate handoff: ' + updated.stderr.strip()[:500])
    return exact


def selected_handoff(encoded, tip):
    if not isinstance(tip, str) or not re.fullmatch(r'[0-9a-f]{40}', tip):
        raise ValueError('CI handoff requires its exact checked-out SHA')
    return next((row for row in read_handoffs(encoded) if row['tip'] == tip), None)


if __name__ == '__main__':
    if sys.argv[1:] != ['--select']:
        raise SystemExit('Expected --select')
    row = selected_handoff(os.environ.get(VARIABLE, ''), os.environ.get('GITHUB_SHA'))
    output = 'active=false\n' if row is None else 'active=true\nbase=' + row['base'] + '\nsteps=' + json.dumps(row['steps']) + '\n'
    with Path(os.environ['GITHUB_OUTPUT']).open('a') as handle:
        handle.write(output)
