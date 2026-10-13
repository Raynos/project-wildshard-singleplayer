#!/usr/bin/env python3
"""One exact Linux candidate proof; no ref push, pin rewrite or release proof."""
import hashlib
import json
import os
import pathlib
import re
import subprocess
import sys
import urllib.request


def specification(raw):
    spec = json.loads(raw)
    for key, pattern in [('sha', r'[0-9a-f]{40}'), ('base', r'[0-9a-f]{40}'),
                         ('bundleSha256', r'[0-9a-f]{64}'), ('node', r'\d+\.\d+\.\d+')]:
        if not isinstance(spec.get(key), str) or not re.fullmatch(pattern, spec[key]):
            raise ValueError('Invalid proof ' + key)
    for key in ['releaseId', 'assetId']:
        if type(spec.get(key)) is not int or spec[key] <= 0:
            raise ValueError('Invalid proof ' + key)
    if not isinstance(spec.get('command'), str) or not spec['command'].strip():
        raise ValueError('Missing exact compare command')
    if not re.fullmatch(r'[a-z0-9-]+', spec.get('outputsJob', '')):
        raise ValueError('Invalid output job')
    if not re.fullmatch(r'[0-9a-f]{64}', spec.get('outputsSha256', '')):
        raise ValueError('Invalid expected output-map hash')
    if type(spec.get('outputsCount')) is not int or spec['outputsCount'] <= 0:
        raise ValueError('Invalid expected output count')
    return spec


def git(*args):
    return subprocess.check_output(['git', *args], text=True).strip()


def api(route, binary=False, method='GET'):
    repo = os.environ['GITHUB_REPOSITORY']
    request = urllib.request.Request('https://api.github.com/repos/' + repo + route,
                                    method=method, headers={
        'Authorization': 'Bearer ' + os.environ['GH_TOKEN'],
        'Accept': 'application/octet-stream' if binary else 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
    })
    with urllib.request.urlopen(request, timeout=60) as response:
        data = response.read()
    return data if binary or method == 'DELETE' else json.loads(data)


def restore(spec, evidence):
    release = api('/releases/' + str(spec['releaseId']))
    if not release['draft'] or release['tag_name'] != 'sp-x7-linux-proof-' + spec['sha']:
        raise ValueError('Bundle release is not this candidate draft')
    if not any(asset['id'] == spec['assetId'] for asset in release['assets']):
        raise ValueError('Bundle asset does not belong to candidate draft')
    data = api('/releases/assets/' + str(spec['assetId']), binary=True)
    if hashlib.sha256(data).hexdigest() != spec['bundleSha256']:
        raise ValueError('Candidate bundle digest mismatch')
    bundle = evidence / 'candidate.bundle'
    bundle.write_bytes(data)
    # The full main checkout supplies prerequisites; a missing base refuses.
    git('cat-file', '-e', spec['base'] + '^{commit}')
    git('bundle', 'verify', str(bundle))
    ref = 'refs/proofs/sp-x7/' + spec['sha']
    git('fetch', str(bundle), ref)
    git('checkout', '--detach', 'FETCH_HEAD')
    if git('rev-parse', 'HEAD') != spec['sha']:
        raise ValueError('Fetched candidate SHA mismatch')
    # No longer needed once verified and imported. DELETE removes its assets too.
    api('/releases/' + str(spec['releaseId']), method='DELETE')
    bundle.unlink()
    (evidence / 'transport.json').write_text(json.dumps({
        'sha': git('rev-parse', 'HEAD'), 'tree': git('rev-parse', 'HEAD^{tree}'),
        'bundleSha256': spec['bundleSha256'], 'draftReleaseDeleted': True,
    }, indent=2) + '\n')


def expected_outputs(root, spec):
    catalog = json.loads((root / 'scripts/generation-jobs.json').read_text())
    job = next(row for row in catalog['jobs'] if row['id'] == spec['outputsJob'])
    pins = job['buildOutputs']
    digest = hashlib.sha256(json.dumps(pins, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    if len(pins) != spec['outputsCount'] or digest != spec['outputsSha256']:
        raise ValueError('Candidate output pins differ from supplied Darwin evidence')
    outputs = []
    for file, pin in sorted(pins.items()):
        if (not file or file.startswith('/') or '..' in pathlib.PurePosixPath(file).parts or
                not re.fullmatch(r'[0-9a-f]{64}', pin)):
            raise ValueError('Invalid expected output path or hash')
        outputs.append({'file': file, 'sha256': pin})
    return outputs


def output_hashes(root, outputs):
    rows = []
    for row in outputs:
        path = (root / row['file']).resolve()
        if not path.is_relative_to(root) or not path.is_file():
            rows.append(dict(row, actual=None, matched=False))
            continue
        data = path.read_bytes()
        digest = hashlib.sha256(data).hexdigest()
        rows.append(dict(row, actual=digest, bytes=len(data), matched=digest == row['sha256']))
    return rows


def compare(spec, evidence):
    identity = json.loads(subprocess.check_output(['node', '-p',
        'JSON.stringify({node:process.versions.node,platform:process.platform,arch:process.arch})'], text=True))
    identity.update(sha=git('rev-parse', 'HEAD'), tree=git('rev-parse', 'HEAD^{tree}'), command=spec['command'])
    (evidence / 'identity.json').write_text(json.dumps(identity, indent=2) + '\n')
    if (identity['sha'] != spec['sha'] or identity['node'] != spec['node'] or
            identity['platform'] != 'linux' or identity['arch'] != 'x64'):
        raise ValueError('Wrong candidate, Node version or Linux x64 host')
    outputs = expected_outputs(pathlib.Path.cwd().resolve(), spec)
    env = dict(os.environ, GITHUB_SHA=identity['sha'], NINE_PROOF_CACHE=str(evidence / 'cold-cache'))
    # Workflow main's GITHUB_SHA must never label this private checkout.
    with (evidence / 'compare.log').open('w') as log:
        process = subprocess.run(['bash', '-e', '-o', 'pipefail', '-c', spec['command']],
                                 env=env, stdout=log, stderr=subprocess.STDOUT, timeout=600)
    rows = output_hashes(pathlib.Path.cwd().resolve(), outputs)
    result = {'exitCode': process.returncode, 'outputs': rows}
    (evidence / 'result.json').write_text(json.dumps(result, indent=2) + '\n')
    print((evidence / 'compare.log').read_text())
    print(json.dumps(result, indent=2))
    if process.returncode != 0 or not all(row['matched'] for row in rows):
        raise ValueError('Exact candidate generation comparison failed')


def main():
    evidence = pathlib.Path(os.environ['PROOF_OUT']).resolve()
    evidence.mkdir(parents=True, exist_ok=True)
    try:
        spec = specification(os.environ['CANDIDATE_SPEC'])
        if sys.argv[1:] == ['restore']:
            restore(spec, evidence)
        elif sys.argv[1:] == ['compare']:
            compare(spec, evidence)
        else:
            raise ValueError('Expected restore or compare phase')
    except Exception as error:
        (evidence / 'failure.txt').write_text(str(error) + '\n')
        raise


if __name__ == '__main__':
    main()
