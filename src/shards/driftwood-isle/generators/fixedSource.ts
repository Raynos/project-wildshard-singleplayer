import { Matrix4, type BufferGeometry } from 'three';
import { captainHatGeometry } from './captainHat';
import { boatGeometry } from './boat';
import { sailclothCapeGeometry } from './sailclothCape';
import { chimeGeometry } from './seaGlassChime';
import { plaquesGeometry } from './trophyPlaques';
import { TROPHY_LAYOUT } from '../data/trophyLayout';
import { counterGeometry } from './tradeCounter';
import { ironSwordGeometry } from './ironSword';
import { coverGeometry } from './groundCover';
import { originalTrailside } from './driftwoodTrailside.mjs';
import { originalCove } from './driftwoodCove.mjs';
import { originalHut, originalLookout } from './driftwoodHut.mjs';

/** The original ordered fixed builders, shared by their retained byte oracle and the scene producer. */
export function driftwoodFixedSource(): {
  geometries: Map<string, BufferGeometry>; world: Map<string, Matrix4>; rows: Record<string, unknown>;
} {
  const geometries = new Map<string, BufferGeometry>(), world = new Map<string, Matrix4>(), rows: Record<string, unknown> = {};
  for (const [part, geometry] of Object.entries(ironSwordGeometry())) geometries.set(`iron-sword-${part}`, geometry);
  geometries.set('captain-hat', captainHatGeometry());
  geometries.set('sailcloth-cape', sailclothCapeGeometry());
  for (const [part, geometry] of Object.entries(boatGeometry())) geometries.set(`boat-${part}`, geometry);
  const chime = chimeGeometry(); geometries.set('sea-glass-chime', chime.geometry); rows['chimeSlots'] = chime.ranges;
  const plaques = plaquesGeometry(TROPHY_LAYOUT.gap), drop = plaquesGeometry(0);
  geometries.set('trophy-plaques', plaques.geometry); geometries.set('trophy-drop', drop.geometry);
  const { ranges, boards, empty, full } = plaques; rows['trophySlots'] = { ranges, boards, empty, full };
  geometries.set('trade-counter', counterGeometry());
  const cover = coverGeometry();
  for (const [name, geometry] of Object.entries(cover.geometry)) geometries.set(`cover-${name}`, geometry);
  rows['coverLook'] = cover.look;
  const cove = originalCove();
  for (const [name, geometry] of Object.entries(cove.geometry)) {
    const id = `cove-${name}`; geometries.set(id, geometry); world.set(id, new Matrix4());
  }
  rows['coveBake'] = cove.metadata;
  const trail = originalTrailside(); geometries.set('trailside', trail.geometry); world.set('trailside', new Matrix4()); rows['trailsideBake'] = trail.metadata;
  const hut = originalHut(), h = hut.layout.origin;
  geometries.set('hut-kit', hut.kit); geometries.set('hut-flames', hut.flames);
  for (const id of ['hut-kit', 'hut-flames']) world.set(id, new Matrix4().makeTranslation(h.x, h.y, h.z));
  rows['hutBake'] = hut.layout;
  const tower = originalLookout(), t = tower.layout.origin;
  geometries.set('lookout', tower.geometry); world.set('lookout', new Matrix4().makeTranslation(t.x, t.y, t.z)); rows['lookoutBake'] = tower.layout;
  return { geometries, world, rows };
}
