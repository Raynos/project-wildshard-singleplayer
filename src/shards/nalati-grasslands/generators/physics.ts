import rows from '../data/physicsRows.json' with { type: 'json' };

/** G350-NA: Nalati's physics product from authoring inputs only: the authored rows no recipe computes yet (the floor,
 * actors, herds, spruces and their tops, yurts, pieces, fixed solids, spawn / group / flock rows, Crags ledges, marmots and
 * grass). No world, model, registry, engine or runtime code runs. */
export function nalatiPhysics(): Record<string, unknown> {
  const { notice: _notice, ...physics } = rows;
  return { version: 1, profile: 'authored rows', notice: 'DO NOT EDIT: regenerate with generators/physics.ts (nalati-physics).', ...physics };
}

/** The native floor's original bytes, copied by the standard product writer. */
export function nalatiPhysicsSources():{name:string;kind:'bin';source:string;options:{decoded:number}}[]{
  const file=rows.ground.heights.file;
  return [{name:file,kind:'bin',source:file,options:{decoded:(rows.ground.rows+1)*(rows.ground.cols+1)*4}}];
}
