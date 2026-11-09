// A successful path-filtered workflow does not prove its source code.
export function codeProvingJobs(jobs, commit) {
  if (!Array.isArray(jobs)) return false;
  const passed = job => job.head_sha === commit && job.status === 'completed' && job.conclusion === 'success';
  for (const name of ['plan', 'e2e']) {
    const rows = jobs.filter(job => job.name === name);
    if (rows.length !== 1 || !passed(rows[0])) return false;
  }
  const tests = jobs.filter(job => /^tests(?: \([0-9]+\))?$/u.test(job.name));
  return tests.length > 0 && new Set(tests.map(job => job.name)).size === tests.length && tests.every(passed);
}
