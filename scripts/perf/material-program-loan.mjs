/** A capture-only compiled-program loan. No camera, clock, render policy or
 * uniform values are changed. Validate the whole loan before touching a material.
 * @param {readonly import('./material-program-loan.mjs').ProgramMaterial[]} materials
 * @param {readonly import('./material-program-loan.mjs').MaterialProgramLoan[]} programs
 */
export async function loanMaterialPrograms(materials, programs) {
  /** @param {string} source */
  const hash = async source => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source)))].map(n => n.toString(16).padStart(2, '0')).join('');
  /** @param {string} source @param {string} qualifier */
  const declarations = (source, qualifier) => [...source.matchAll(new RegExp(`\\b${qualifier}\\s+(?:(?:lowp|mediump|highp)\\s+)?(\\w+)\\s+(\\w+)\\s*(\\[[^\\]]+\\])?\\s*;`, 'gu'))].map(match => `${match[1]}:${match[2]}:${match[3] ?? ''}`).sort();
  /** @param {import('./material-program-loan.mjs').ProgramSource} program @param {string} qualifier */
  const contract = (program, qualifier) => [...new Set([...declarations(program.vertex, qualifier), ...declarations(program.fragment, qualifier)])].sort().join('\n');
  /** @type {Set<import('./material-program-loan.mjs').ProgramMaterial>} */
  const seen = new Set();
  /** @type {{material:import('./material-program-loan.mjs').ProgramMaterial,vertex:string,fragment:string}[]} */
  const changes = [];
  /** @type {import('./material-program-loan.mjs').ProgramLoanReceipt[]} */
  const receipts = [];
  for (const program of programs) {
    if (program.aliases.length === 0 || new Set(program.aliases).size !== program.aliases.length) throw new Error('Program loan needs unique material aliases');
    for (const source of [program.before, program.after]) {
      if (typeof source.vertex !== 'string' || typeof source.fragment !== 'string' || source.vertex.length === 0 || source.fragment.length === 0
        || !/^[a-f0-9]{64}$/u.test(source.vertexHash) || !/^[a-f0-9]{64}$/u.test(source.fragmentHash)
        || await hash(source.vertex) !== source.vertexHash || await hash(source.fragment) !== source.fragmentHash) throw new Error('Program loan source identity differs');
    }
    if(program.before.vertexHash===program.after.vertexHash&&program.before.fragmentHash===program.after.fragmentHash)throw new Error('Program loan has no compiled change');
    if (contract(program.before, 'attribute') !== contract(program.after, 'attribute')) throw new Error('Program loan changes vertex attributes');
    if (contract(program.before, 'uniform') !== contract(program.after, 'uniform')) throw new Error('Program loan changes uniform declarations');
    const matches = materials.filter(material => program.aliases.includes(material.name));
    if (matches.length === 0) throw new Error('Program loan has no actual material');
    for (const material of matches) {
      if (seen.has(material)) throw new Error('Program loan overlaps an actual material');
      if (material.vertexShader !== program.before.vertex || material.fragmentShader !== program.before.fragment) throw new Error('Actual material source differs from program loan');
      if (program.uniforms.some(name => !Object.hasOwn(material.uniforms, name))) throw new Error('Program loan needs absent native uniforms');
      seen.add(material);
      changes.push({material, vertex: material.vertexShader, fragment: material.fragmentShader});
    }
    receipts.push({aliases:program.aliases, materials:matches.length, before:{vertexHash:program.before.vertexHash,fragmentHash:program.before.fragmentHash}, after:{vertexHash:program.after.vertexHash,fragmentHash:program.after.fragmentHash}});
  }
  if (changes.length === 0) throw new Error('Program loan is empty');
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    for (const change of changes) {
      change.material.vertexShader = change.vertex; change.material.fragmentShader = change.fragment; change.material.needsUpdate = true;
    }
  };
  try {
    for (const change of changes) {
      const program = programs.find(row => row.aliases.includes(change.material.name));
      if (program === undefined) throw new Error('Program loan lost its source');
      change.material.vertexShader = program.after.vertex; change.material.fragmentShader = program.after.fragment; change.material.needsUpdate = true;
    }
  } catch (error) { restore(); throw error; }
  return {receipts, restore};
}
