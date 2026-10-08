/** Select only a uniquely identifiable WebContent descendant of this capture process. Never guess another tab's PID.
 * @param {string} text `ps -axo pid=,ppid=,comm=`
 * @param {number} owner
 * @returns {number|null}
 */
export function ownedWebContentPid(text, owner) {
  const processes = text.split('\n').flatMap(line => {
    const match = /^\s*(\d+)\s+(\d+)\s+(.+)$/u.exec(line);
    return match ? [{ pid: Number(match[1]), parent: Number(match[2]), command: match[3] }] : [];
  });
  const descendants = new Set([owner]);
  for (let previous = -1; previous !== descendants.size;) {
    previous = descendants.size;
    for (const row of processes) if (descendants.has(row.parent)) descendants.add(row.pid);
  }
  const candidates = processes.filter(row => row.pid !== owner && descendants.has(row.pid) && /WebContent|WebProcess/u.test(row.command));
  return candidates.length === 1 ? candidates[0]?.pid ?? null : null;
}

/** Keep native process maps and the original footprint distinct from JS heap/capacity. Unsupported reads are evidence.
 * @param {number|null} pid
 * @param {(command:string,args:string[])=>string} execute
 */
export function processMemory(pid, execute) {
  if (pid === null) return { pid, unavailable: 'No unique owned WebContent descendant', files: [] };
  const files = [];
  for (const [name, command, args] of [
    ['vmmap-summary', 'vmmap', ['-summary', String(pid)]],
    ['footprint', 'footprint', ['-f', 'bytes', '-p', String(pid)]],
  ]) {
    if (typeof name !== 'string' || typeof command !== 'string' || !Array.isArray(args)) throw new Error('Invalid native memory command');
    try { files.push({ name, text: execute(command, args) }); }
    catch (error) { files.push({ name, error: String(error) }); }
  }
  return { pid, unavailable: null, files };
}
