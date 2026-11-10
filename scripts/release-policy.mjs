// A recovery hold may resume only at its corrected engine or a descendant.
// This floor also covers ordinary pushes and explicit deploy dispatches.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
export function requireEngineFloor(policy, pin, compare = (base, head) => JSON.parse(execFileSync('gh',
  ['api', `repos/project-wildshard/engine/compare/${base}...${head}`, '--jq', '{status,base_commit:{sha:.base_commit.sha}}'],
  {encoding:'utf8', stdio:['ignore','pipe','pipe']}))) {
  if (policy.minimumEngineCommit === undefined) return;
  const base = policy.minimumEngineCommit, head = pin.engine?.commit;
  if (typeof base !== 'string' || !/^[a-f0-9]{40}$/u.test(base)
    || typeof head !== 'string' || !/^[a-f0-9]{40}$/u.test(head)) throw new Error('Invalid recovery engine floor');
  const result = compare(base, head);
  if (result.base_commit?.sha !== base || !['identical','ahead'].includes(result.status)) throw new Error('Recovery engine floor refused the old or divergent pin');
}
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  requireEngineFloor(JSON.parse(readFileSync('.github/deploy-pin.json','utf8')), JSON.parse(readFileSync('engine.pin.json','utf8')));
}
