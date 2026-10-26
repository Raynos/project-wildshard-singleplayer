import speciesRows from '../data/speciesRows.json' with { type: 'json' };
import authoredLooks from '../data/speciesLooks.json' with { type: 'json' };
import { SPECIES_POSES } from './speciesPoses';

interface LookRow {
  id: string; species: string; kind: string; family: string;
  skeleton: string; sockets: string[]; clips: unknown[];
  variants: Record<string, { body: string; tint?: unknown; traits?: unknown }>;
  material: { family: 'painterly'; rim: number; bands: number }; hulls: true;
  rig?: unknown; stance?: unknown; gait?: unknown; eyeGlow?: unknown;
  eyeGlowIntensity?: number; postPose?: unknown; animate?: string; frame?: 'king';
  attachments?: { name: string; file: string; colour: number[]; geometry: unknown }[];
}

/** Existing authored looks and frame metadata. Opaque geometry/program rows retain their complete shape. */
export interface NalatiSpeciesLookPreparation {
  hullBook: { slug: string; compactBody: unknown; definitions: Record<string, never>; derived: Record<string, never>; rows: never[] };
  looks: {
    poses: typeof SPECIES_POSES;
    frames: { king: {
      programs: unknown; surface: string; observe: string; pose: string; look: number[];
      smooth: { input: string; output: string; initial: number | null }[];
      floor: { lift: string; death: string }; memory: typeof speciesRows.kingPoseDefaults;
    } };
    rows: LookRow[];
  };
}

/** Construct fresh metadata in the original assignment order, without a compiler, file read or publisher. */
export function prepareNalatiSpeciesLooks(compactBody: unknown, kingPose: { readonly programs: unknown; readonly group: string }, crackRow: unknown): NalatiSpeciesLookPreparation {
  const source = structuredClone({ compactBody, kingPose, crackRow, rows: authoredLooks, poses: SPECIES_POSES,
    kingFrame: speciesRows.kingFrame, memory: speciesRows.kingPoseDefaults });
  const hullBook = { slug: 'nalati-grasslands', compactBody: source.compactBody, definitions: {}, derived: {}, rows: [] };
  const rows = source.rows.map((row): LookRow => {
    const variants: LookRow['variants'] = {};
    for (const [id, variant] of Object.entries(row.variants)) {
      const coat: LookRow['variants'][string] = { body: variant.body };
      if ('tint' in variant && variant.tint !== undefined) coat.tint = variant.tint;
      if ('traits' in variant && variant.traits !== undefined) coat.traits = variant.traits;
      variants[id] = coat;
    }
    const look: LookRow = { id: row.id, species: row.metadata.id, kind: row.metadata.kind, family: row.family,
      skeleton: row.rigContract.skeleton, sockets: row.rigContract.sockets, clips: row.rigContract.clips, variants,
      material: { family: 'painterly', rim: row.material.rim, bands: row.material.bands }, hulls: true };
    if (row.rig !== undefined) look.rig = row.rig;
    if (row.pose !== undefined) look.stance = row.pose;
    if (row.gait !== undefined) look.gait = row.gait;
    if (row.eyeGlow !== undefined) look.eyeGlow = row.eyeGlow;
    if (row.eyeGlowIntensity !== undefined) look.eyeGlowIntensity = row.eyeGlowIntensity;
    if (row.postPose !== undefined) look.postPose = row.postPose;
    if (row.metadata.kind === 'balbal' || row.metadata.kind === 'eagle') look.animate = row.metadata.kind;
    if (row.metadata.kind === speciesRows.king.kind) look.frame = 'king';
    if (row.metadata.kind === 'balbal') look.attachments = [{ name: 'balbal-cracks', file: 'actors/balbal-cracks.bin', colour: [1, .46, .1], geometry: source.crackRow }];
    return look;
  });
  const frame = source.kingFrame;
  const frames = { king: { programs: source.kingPose.programs, surface: 'king.surface', observe: frame.group, pose: source.kingPose.group, look: frame.look,
    smooth: frame.smooth.map(({ input, output, initial }) => ({ input, output, initial })), floor: { lift: frame.floor.lift, death: frame.floor.death }, memory: source.memory } };
  return { hullBook, looks: { poses: source.poses, frames, rows } };
}
