import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

repo = Path.cwd()
game_source, docs_source = (Path(name).read_text() for name in sys.argv[1:])
with tempfile.TemporaryDirectory(dir=repo/'tmp', prefix='gen-docs-test-') as folder:
    root = Path(folder)
    def put(name, text):
        path = root/name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
    def module(name, exports):
        put('scripts/'+name+'.mjs', "import {appendFileSync} from 'node:fs';\n" + exports)
    def record(name):
        return "appendFileSync('calls.txt'," + json.dumps(name+'\n') + ");"
    module('quiet-cli', 'export function quietCli() {}')
    module('generation-scheduling', 'export function generationConcurrency(){return 1}')
    module('bake-loader', record('loader'))
    module('gen-shards', 'export function refreshDiscovery(){'+record('discovery')+'}export function genShards(){'+record('shards')+'}')
    for file, function in [('gen-budget-derivations','genBudgetDerivations'),('gen-ask-ids','genAskIds'),('generate','prepareGeneration'),('gen-starter-arm-clips','genStarterArmClips'),('gen-starter-weapons','genStarterWeapons'),('gen-starter-bag','genStarterBag'),('gen-starter-effects','genStarterEffects'),('gen-decision-policy','genDecisionPolicies'),('gen-format-schema','writeFormatJsonSchemas')]:
        module(file, 'export function '+function+'(){'+record(function)+'}')
    module('push-post-inputs', 'export function beginPushInputs(){return ()=>{'+record('seal')+'}}')
    put('vite/gen.ts', "import {appendFileSync} from 'node:fs';export function generateBootTables(){"+record('boot')+'}')
    put('scripts/gen.mjs', game_source)
    put('scripts/docs.mjs', docs_source)
    for file, function in [('gen-api','writeApiDocs'),('gen-host-catalogue','writeHostCatalogue'),('generator-inventory','writeGeneratorInventory')]:
        module(file, 'export function '+function+'(root){if(root!==new URL("../",import.meta.url).pathname.replace(/\\/$/,""))throw Error("wrong docs root");'+record(function)+'}')
    for file in ['webgpu-inventory','normalize/liveness']:
        module(file, record(file))
    env = {key:value for key,value in os.environ.items() if key not in {'WS_QUIET','WS_QUIET_ACTIVE','WS_PRECOMMIT_BOOT_CACHE'}}
    def run(script, *args):
        (root/'calls.txt').write_text('')
        result = subprocess.run(['node',script,*args], cwd=root, env=env, text=True, capture_output=True)
        return result, (root/'calls.txt').read_text().splitlines()
    docs_steps = ['writeApiDocs','writeHostCatalogue','webgpu-inventory','normalize/liveness','writeGeneratorInventory']
    for mode in [[],['--parallel'],['--proof'],['--build-inputs']]:
        result,calls = run('scripts/gen.mjs',*mode)
        assert result.returncode == 0,result.stderr
        assert not set(calls)&set(docs_steps),calls
        assert calls[-1]=='seal' and 'boot' in calls and calls.count('shards')==2,calls
    result,calls = run('scripts/docs.mjs')
    assert result.returncode==0,result.stderr
    assert calls == ['loader',*docs_steps],calls
    module('gen-host-catalogue', 'export function writeHostCatalogue(){throw Error("actual docs refusal")}')
    result,calls = run('scripts/docs.mjs')
    assert result.returncode!=0 and 'actual docs refusal' in result.stderr,result
    assert calls==['loader','writeApiDocs'],calls
    print('6 generation/docs separation regressions passed')
