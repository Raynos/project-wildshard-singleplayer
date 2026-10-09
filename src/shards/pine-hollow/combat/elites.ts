import { app } from '@wildshard/engine/app/runtime';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import { Impacts } from '@wildshard/engine/fx/Impacts';
import { inChunk } from '@wildshard/engine/world/Heightfield';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import * as THREE from 'three';
import { GroundTell, type Elites, type EliteScript } from '@wildshard/game/Elite';
import { swapRolledElites as swapRolled } from './eliteRoster';
import type { SkinId } from '../loadout/skins';
import { Puffs } from './fxKit';
import { own, release, retire, voice, LaneCharge, type PineCtx } from './ctx';
import { pineEliteScripts, type PineEliteScript, type PineEliteWorld } from './eliteScripts';


/**
 * Pine Hollow's four NAMED ELITES (PINE-HOLLOW-REMASTER PH-C3; Jake's PH-U13). Each is an `EliteScript` over the engine's
 * elite system (src/game/Elite.ts, ported from Nalati: lair + leash, the bar over the head → pinned, phase 2 at 50 %,
 * the banner, the minimap skull, the 20-minute respawn, the first-kill skin orb + a trophy every kill).
 *
 * IDENTITY: an elite is its species' legendary / rare variant placed at a lair — kind + variant, never a mesh — so it
 * wears whatever hull the creature lane gives that variant (PH-M1's generated coats), and the journal (compendium
 * shards/pine-hollow.ts `match`), the trophy wall and the achievements see the kill exactly as before. A herd that
 * rolled one of these variants at boot gets an ordinary one of its kind instead (`swapRolledElites`, eliteRoster.ts): there
 * is one Old Ironhide, and he lives at his lair.
 *
 * ONE IMPLEMENTATION (SF72): the scripts are eliteScripts.ts's, renderer-free over any body and world, and the system's rules
 * are the game's EliteCore; this file is the page's half (its decals, puffs, dirt and voices, the orb's model). The
 * renderer-free host runs the same scripts and rules (runtime/elites.ts).
 *
 * AI: the scripts drive their animal from this tick (`own()` in ctx.ts parks it in a state the manager's AI skips), so
 * the species files are untouched:
 *
 *   OLD IRONHIDE, Terror of the Hollow (boar 'ironhide', the SW woods off the S road) — circles you at a trot, then
 *     GORE CHARGE: a red lane paints from him through you (0.9 s, he paws) → 12.5 m/s down it, 30 if you are still in
 *     it → he skids and stands (the window). Phase 2 (BOTH TUSKS NOW): a quicker tell, a faster run, often a second
 *     charge straight after.
 *   THE GHOST STAG, the Pale One (deer 'ghost', the old-growth's E fringe) — flees rather than fights: runs in a circle
 *     round its glade, stops to stare back (the shot). FADE: hit it, or walk up on it, and it goes — a pale burst,
 *     unaimable for 2 s — and comes back BEHIND you 14–18 m off, staring. Phase 2 (NOW YOU DON'T): fades twice as often,
 *     and on its own mid-run.
 *   OLD BLACKPAW, the Den's Landlord (bear 'black-old', the Den) — waits in the cave. AMBUSH: come within ~22 m of the
 *     cave mouth and he bursts out of it roaring. ROAR-STUN: a ring paints round him (1.1 s) → the roar roots anyone
 *     inside it for 1.3 s (12) — step out of the ring. Then a charge lane, or a swipe up close (22). Phase 2 (WOKEN UP
 *     PROPERLY): roars twice as often, and the ring is 11 m, not 8.
 *   THE IMPERIAL BULL, Seven by Seven (elk 'imperial', the N meadow) — postures at 18–26 m and charges down lanes (34).
 *     BUGLE: at dusk and by night (PineDayNight) he stops and bugles, and two rival bulls come in out of the trees 55 m
 *     off and charge you too. Once per phase; phase 2 (FULL VOLUME) bugles again.
 *
 * Drops (cosmetic, the skins are Skins.ts's): IRONHIDE rifle · GHOST STAG crossbow · BLACKPAW crossbow · IMPERIAL
 * crossbow; the trophies go into the pack (Inventory). Kills go through the AnimalManager like any kill (kill feed,
 * Progress, the journal's TAKEN, the trophy wall's mount).
 *
 * Dev: `?elite=ironhide|ghost-stag|blackpaw|imperial-bull` spawns it now whatever its timer and stands you `&from=` m
 * (default 30) off it, facing it; `window.__pineElites` (the Elites + `.force(id, move)` for the evidence captures).
 */


const TELL_RED = new THREE.Color(2.4, 0.75, 0.3);

/** the boot swap (eliteRoster.ts) through the page's creature manager */
export function swapRolledElites(animals: AnimalManager): number {
  return swapRolled({ bodies: animals.animals, herds: animals.herds, retire: (a) => { retire(animals, a); }, spawn: (kind, x, z, yaw, variants) => animals.spawn(kind, x, z, yaw, variants) });
}

const elitesOwned = new WeakSet<Animal>();
/** one of the named elites (main.ts: its legendary skin comes from the elite's orb, not the kill hook) */
export function isPineElite(a: Animal): boolean { return elitesOwned.has(a); }

const _v = new THREE.Vector3();

/** The page's world for the shared scripts (eliteScripts.ts): its Animals, painted decals, puffs, dirt bursts and voices. */
function pageWorld(ctx: PineCtx, elites: Elites, puffs: Puffs): PineEliteWorld<Animal> {
  return {
    player: ctx.player, reach: ctx.reach, god: ctx.god, trauma: ctx.trauma, stun: ctx.stun, dusk: ctx.dusk, night: ctx.night, hurt: ctx.hurt,
    voice: (name, a) => { voice(ctx.animals, name, a.position); },
    spawn: (kind, x, z, yaw, variant) => ctx.animals.spawn(kind, x, z, yaw, variant),
    own, release, retire: (a) => { retire(ctx.animals, a); }, adopt: (a) => { elitesOwned.add(a); },
    lane: (row) => new LaneCharge(ctx.game.scene, TELL_RED, row, ctx.reach),
    ring: () => new GroundTell(ctx.game.scene, 'ring', TELL_RED),
    heightAt, inChunk, show: (a, visible) => { a.mesh.visible = visible; },
    fx: {
      fade: (a) => { _v.copy(a.position); _v.y += 1.1 * a.scale; puffs.burst(_v, 0.6, 3.2, 0.7, 0.95); },
      reappear: (a) => { _v.copy(a.position); _v.y += 1.1 * a.scale; puffs.burst(_v, 2.8, 0.8, 0.5, 0.8); },
      burstOut: (a) => {
        const p = ctx.player.position;
        _v.copy(a.position); _v.y += 0.4;
        Impacts.for(ctx.game).burst('dirt', _v, _v.set(p.x - a.position.x, 0, p.z - a.position.z), 18);
      },
      roar: (a, radius) => { a.headWorld(_v); puffs.burst(_v, 1, radius, 0.55, 0.5); },
    },
    signature: (id) => { elites.signature(id); },
    feed: ctx.feed,
  };
}

// ─────────────────────────────── the wiring ───────────────────────────────

export interface PineElitesHandle {
  elites: Elites;
  update: (dt: number, t: number) => void;
  /** dev / captures: run an elite's signature move now ('charge' | 'fade' | 'roar' | 'bugle') */
  force: (id: string, move: string) => void;
}

type PageScript = PineEliteScript<Animal> & EliteScript;

export function makePineElites(ctx: PineCtx, elites: Elites): PineElitesHandle {
  const puffs = new Puffs(ctx.game.scene, new THREE.Color(0.75, 1.6, 2.0));
  const scripts: PageScript[] = [];
  for (const brain of pineEliteScripts(pageWorld(ctx, elites, puffs))) {
    // the page's half: the orb's display model (the skin)
    const s: PageScript = Object.assign(brain, { dropModel: (): THREE.Object3D => ctx.skinModel(brain.def.drop.skin as SkinId) });
    const scope = app.levelScope;
    if (scope !== null) app.encounters.elite(s.def.id, s, scope);
    elites.add(s); scripts.push(s);
  }
  return {
    elites,
    update: (dt, t) => { elites.update(dt, t); puffs.update(dt, t); },
    force: (id, move) => { const s = scripts.find((x) => x.def.id === id); s?.force(move); },
  };
}
