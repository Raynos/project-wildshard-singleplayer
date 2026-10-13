import { expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Give isolated Git fixtures a deterministic initial branch.
import process from 'node:process';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the actual private-bundle reader in disposable Git repositories.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the defining transport helper, not a fixture copy.
import { resolve } from 'node:path';

it('verifies private transport and refuses altered pins, bytes and hosts', () => {
  const code = `import hashlib, importlib.util, json, pathlib, subprocess, sys, tempfile
s=importlib.util.spec_from_file_location('candidate',sys.argv[1])
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
def run(root,*args):
 return subprocess.check_output(['git',*args],cwd=root,text=True).strip()
with tempfile.TemporaryDirectory() as t:
 root=pathlib.Path(t);source=root/'source';target=root/'target';evidence=root/'evidence'
 source.mkdir();target.mkdir();evidence.mkdir()
 run(source,'init','-q');run(source,'config','user.name','fixture');run(source,'config','user.email','fixture@example.test')
 (source/'value').write_text('base');run(source,'add','value');run(source,'commit','-qm','base');base=run(source,'rev-parse','HEAD')
 subprocess.run(['git','clone','-q',str(source),str(target)],check=True)
 (source/'value').write_text('candidate');run(source,'commit','-qam','candidate');sha=run(source,'rev-parse','HEAD')
 ref='refs/proofs/sp-x7/'+sha;run(source,'update-ref',ref,sha)
 bundle=root/'candidate.bundle';run(source,'bundle','create',str(bundle),ref,'^'+base);data=bundle.read_bytes()
 pins={'value':hashlib.sha256(b'candidate').hexdigest()}
 spec={'sha':sha,'base':base,'bundleSha256':hashlib.sha256(data).hexdigest(),'node':'24.18.1','releaseId':1,'assetId':2,'command':'true','outputsJob':'fixture','outputsCount':1,'outputsSha256':hashlib.sha256(json.dumps(pins,sort_keys=True,separators=(',',':')).encode()).hexdigest()}
 m.specification(json.dumps(spec))
 deleted=[]
 def api(route,binary=False,method='GET'):
  if method=='DELETE':
   assert run(target,'rev-parse','HEAD')==sha;deleted.append(route);return b''
  if binary:return data
  return {'draft':True,'tag_name':'sp-x7-linux-proof-'+sha,'assets':[{'id':2}]}
 m.api=api
 import os
 os.chdir(target)
 bad=dict(spec,bundleSha256='0'*64)
 try:m.restore(bad,evidence);raise AssertionError('bad bundle passed')
 except ValueError:pass
 assert not deleted
 m.restore(spec,evidence)
 assert deleted==['/releases/1'] and run(target,'rev-parse','HEAD')==sha
 assert run(target,'rev-parse','refs/heads/master')==base
 assert not (evidence/'candidate.bundle').exists()
 (target/'scripts').mkdir();(target/'scripts/generation-jobs.json').write_text(json.dumps({'jobs':[{'id':'fixture','buildOutputs':pins}]}))
 rows=m.expected_outputs(target,spec);assert m.output_hashes(target.resolve(),rows)[0]['matched']
 (target/'value').write_text('different');assert not m.output_hashes(target.resolve(),rows)[0]['matched']
 (target/'value').unlink();assert not m.output_hashes(target.resolve(),rows)[0]['matched']
 try:m.expected_outputs(target,dict(spec,outputsSha256='0'*64));raise AssertionError('changed pins passed')
 except ValueError:pass
 # Report-only whole products retain strict pins without promotion to buildOutputs.
 pairs={'left':hashlib.sha256(b'left').hexdigest(),'right':hashlib.sha256(b'right').hexdigest()}
 multi={k:v for k,v in spec.items() if k!='outputsJob'}
 multi.update(outputsJobs=['left-product','right-product'],outputsField='comparisonOutputs',outputsCount=2,outputsSha256=hashlib.sha256(json.dumps(pairs,sort_keys=True,separators=(',',':')).encode()).hexdigest())
 catalog={'jobs':[{'id':'left-product','comparisonOutputs':{'left':pairs['left']}}, {'id':'right-product','comparisonOutputs':{'right':pairs['right']}}]}
 (target/'scripts/generation-jobs.json').write_text(json.dumps(catalog))
 m.specification(json.dumps(multi));assert [row['file'] for row in m.expected_outputs(target,multi)]==['left','right']
 for override in [dict(outputsJobs=['left-product','left-product']),dict(outputsField='outputs'),dict(outputsJob='fixture'),dict(outputsCount=1),dict(outputsJobs=['left-product','absent-product']),dict(outputsField='buildOutputs')]:
  bad=dict(multi,**override)
  try:m.specification(json.dumps(bad));m.expected_outputs(target,bad);raise AssertionError('invalid comparison contract passed')
  except ValueError:pass
 catalog['jobs'][1]['comparisonOutputs']={'left':pairs['left']}
 (target/'scripts/generation-jobs.json').write_text(json.dumps(catalog))
 try:m.expected_outputs(target,multi);raise AssertionError('overlapping products passed')
 except ValueError:pass
 original=subprocess.check_output
 def output(command,**kwargs):
  if command[0]=='node':return json.dumps({'node':'24.18.1','platform':'darwin','arch':'arm64'})
  return original(command,**kwargs)
 subprocess.check_output=output
 try:m.compare(spec,evidence);raise AssertionError('wrong host passed')
 except ValueError:pass
 assert not (evidence/'compare.log').exists()
print('transport, build/comparison pins, changed/missing bytes and Linux host refusals PASS')
`;
  const run = spawnSync('python3', ['-c', code, resolve('scripts/generation-candidate.py')], { encoding: 'utf8', timeout: 5000, env: { ...process.env, GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'init.defaultBranch', GIT_CONFIG_VALUE_0: 'master' } });
  expect(run.status, run.stdout + run.stderr).toBe(0);
});
