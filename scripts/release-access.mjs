// Read an existing project automation grant; never create one or change access.
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
export async function existingReleaseBypass() {
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) return process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  const project = JSON.parse(readFileSync('.vercel/project.json', 'utf8'));
  let metadata;
  if (process.env.VERCEL_BUILD_TOKEN) {
    const response = await fetch(`https://api.vercel.com/v9/projects/${project.projectId}?teamId=${project.orgId}`, {
      headers:{Authorization:`Bearer ${process.env.VERCEL_BUILD_TOKEN}`}, redirect:'error', signal:AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`Existing project access refused (${response.status})`);
    metadata = await response.json();
  } else {
    metadata = JSON.parse(execFileSync('vercel', ['api', `/v9/projects/${project.projectId}?teamId=${project.orgId}`, '--scope', 'raynos-projects'], {encoding:'utf8', stdio:['ignore','pipe','pipe']}));
  }
  const token = Object.entries(metadata.protectionBypass ?? {}).find(([,value]) => value.scope === 'automation-bypass')?.[0];
  if (!token) throw new Error('No existing automation bypass; project protection was not changed');
  return token;
}
