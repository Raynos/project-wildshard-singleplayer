"""Pin the two CF1 entry modules to the invocation's committed parent."""
import json
import os
from pathlib import Path
import subprocess

CHECKERS = ('scripts/precommit-inputs.mjs', 'scripts/precommit-related.mjs')
LOADER = """import {readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
const sources=JSON.parse(readFileSync(new URL('./checker-sources.json',import.meta.url),'utf8'));
registerHooks({load(url,context,next){
  return Object.hasOwn(sources,url)?{format:'module',source:sources[url],shortCircuit:true}:next(url,context);
}});
"""


def snapshot_checkers(root, parent, folder, environment=None, read_set=None):
    """Return a child environment; never modify the working tree or shared index."""
    root, folder = Path(root).resolve(), Path(folder).resolve()
    env = dict(os.environ if environment is None else environment)
    sources = {}
    inventory = subprocess.run(['git', 'ls-tree', '-z', parent, '--', *CHECKERS], cwd=root,
                               env=env, text=True, capture_output=True, check=False)
    if inventory.returncode != 0:
        raise RuntimeError('Cannot read committed CF1 checker parent')
    installed = {row.split('\t', 1)[1] for row in inventory.stdout.split('\0') if row}
    for name in CHECKERS:
        if name not in installed:
            continue
        result = subprocess.run(['git', 'show', parent + ':' + name], cwd=root,
                                env=env, text=True, capture_output=True, check=False)
        if result.returncode == 0:
            sources[(root / name).as_uri()] = result.stdout
        else:
            raise RuntimeError('Cannot read installed committed CF1 checker')
    # Tiny bootstrap repositories have no CF1 installation. A partly missing
    # installed checker is a real prerequisite refusal, never an inactive pass.
    if not sources:
        return env
    if len(sources) != len(CHECKERS):
        raise RuntimeError('Incomplete committed CF1 checker installation')
    folder.mkdir(parents=True, exist_ok=True)
    (folder / 'checker-sources.json').write_text(json.dumps(sources))
    loader = folder / 'checker-loader.mjs'
    loader.write_text(LOADER)
    env['NODE_OPTIONS'] = ' '.join(filter(None, [env.get('NODE_OPTIONS'), '--import=' + loader.as_uri()]))
    if read_set is not None:
        with Path(read_set).open('a') as output:
            output.write(json.dumps({'root': str(root), 'paths': list(CHECKERS)}) + '\n')
    return env
