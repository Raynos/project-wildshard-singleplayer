/**
 * Driftwood complete (E132, D6, mockup A): the data and the moments for the shared ShardComplete card
 * (src/ui/ShardComplete.ts). This file knows Driftwood; the card does not.
 *
 *   - It shows when the reward view's hold ends (Finale.ts calls `showAfterReward()` while it still owns the camera,
 *     `player.carried`), so it never lands in a fight. The first time it shows, `seen:complete` is saved in the
 *     shard's flags, and after that it only opens from the menu.
 *   - While it is up the world is frozen (main.ts's frameGate reads `shardCompleteUp()`), world audio is muted, and
 *     the HUD and touch controls hide.
 *   - KEEP EXPLORING gives back control, the sword, the HUD and the running clock (the HUD's resume, as the pause
 *     menu's close does). The quest chip then reads "Still to find" with the nearest thing left (`leftMarkers`).
 *     NEXT SHARD reloads with `?chunk=nalati-grasslands`, as ENTER WORLD does. TITLE SCREEN is `hud.exitToMenu()`.
 *   - A save that finished before this existed, or a reload during the hold, gets a toast once per session, out of
 *     combat (nothing hostile within 25 m). The menu's Achievements tab has a "Driftwood complete" row any time.
 */
import { SEA_GLASS_COUNT, SHARD_FLAGS, DRIFTWOOD_INTERACT } from '../../world/interact/driftwood';
import { ShardComplete, setCompleteEntry, type ShardCompleteData } from '../../ui/ShardComplete';
import { findChunk } from '../../chunks/registry';
import { requestShard } from '../../shard/switch';
import { DRIFTWOOD_PLACES } from './Places';
import { QUEST_DONE } from './driftwood';
import type { LiveMarker } from './core';
import type { Adventure, AdventureWorld, AdvAnimal } from './Adventure';

export const SEEN_COMPLETE = 'seen:complete';
const NEXT_SHARD = 'nalati-grasslands';
const SAFE_R = 25;   // the fallback toast waits until nothing hostile is this close
const MAX_TODO = 7;  // chips on the card; the rest fold into "+N more"

/** what the card reads of the shard's achievements (src/game/Progress.ts satisfies it) */
export interface CompleteProgress {
  readonly rows: readonly { def: { id: string; name: string; count: number; event?: string | undefined }; count: number; earned: boolean }[];
  readonly earnedCount: number;
  readonly title: { title: string } | null;
  readonly playS: number;
}

export interface Complete {
  /** the reward hold is over: show the card if it has never shown; false = it did not (the finale releases control itself) */
  showAfterReward: () => boolean;
  /** open the card now (the menu row) */
  open: () => void;
  readonly up: boolean;
  /** after the quest: the things still out there, for the quest chip's "Still to find" nav */
  leftMarkers: () => LiveMarker[];
}

interface Spot { label: string; short: string; flag: string; x: number; z: number }

const titleCase = (s: string): string => s.toLowerCase().replaceAll(/(^|[\s'’-])(\p{L})/gu, (_m: string, a: string, b: string) => a + b.toUpperCase()).replaceAll(/'S\b/g, "'s");

export function fmtPlayTime(s: number): string {
  const m = Math.floor(s / 60);
  if (m < 1) return '< 1m';
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`;
}

export function installComplete<A extends AdvAnimal>(adv: Adventure, w: AdventureWorld<A>, progress: CompleteProgress | undefined): Complete {
  const { flags } = adv;
  const card = new ShardComplete();
  const shardName = findChunk(w.chunk.slug)?.displayName ?? 'Driftwood Isle';
  const next = findChunk(NEXT_SHARD);

  // ── the finds, resolved to world coordinates once ──
  const glass: Spot[] = [], extras: Spot[] = [];
  for (const r of DRIFTWOOD_INTERACT.rows) {
    if (r.kind === 'pickup' && r.look === 'seaglass') {
      const f = r.sets?.[0], p = adv.place(r.at);
      if (f !== undefined) glass.push({ label: 'Sea glass', short: 'SEA GLASS', flag: f, x: p.x, z: p.z });
    } else if (r.id === 'reef-treasure') { const p = adv.place(r.at); extras.push({ label: 'The reef treasure', short: 'REEF TREASURE', flag: `open:${r.id}`, x: p.x, z: p.z }); }
  }
  const places: Spot[] = DRIFTWOOD_PLACES.map((d) => { const p = adv.place(d.at); return { label: titleCase(d.label), short: d.label, flag: `seen:${d.id}`, x: p.x, z: p.z }; });
  const left = (list: Spot[]): Spot[] => list.filter((s) => !flags.has(s.flag));

  const todo = (): string[] => {
    const out: string[] = [];
    const g = left(glass).length;
    if (g > 0) out.push(`${g} sea glass`);
    for (const s of left(extras)) out.push(s.label);
    for (const s of left(places)) out.push(s.label);
    // the achievements not already covered by a find above (Beachcomber = the sea glass, Pearl Diver = the treasure)
    for (const r of progress?.rows ?? []) {
      if (r.earned || r.def.event === 'glass' || r.def.event === 'treasure') continue;
      out.push(r.def.count > 1 ? `${r.def.name} ${r.count} / ${r.def.count}` : r.def.name);
    }
    return out.length > MAX_TODO ? [...out.slice(0, MAX_TODO - 1), `+${out.length - MAX_TODO + 1} more`] : out;
  };

  const data = (): ShardCompleteData => {
    const rows = progress?.rows ?? [];
    const got = glass.length - left(glass).length, seen = places.length - left(places).length;
    const shards = SHARD_FLAGS.filter((f) => flags.has(f)).length;
    const glassN = Math.max(SEA_GLASS_COUNT, glass.length);
    return {
      kicker: 'The Sealed Ring · opened',
      title: shardName,
      flavour: ['Captain Brine is gone and the ring is open.', 'The island is still yours.'],
      stats: [
        { label: 'Time played', value: fmtPlayTime(progress?.playS ?? 0) },
        { label: 'Achievements', value: `${progress?.earnedCount ?? 0} / ${rows.length}`, frac: rows.length > 0 ? (progress?.earnedCount ?? 0) / rows.length : 0 },
        { label: 'Glyph shards', value: `${shards} / ${SHARD_FLAGS.length}`, frac: shards / SHARD_FLAGS.length },
        { label: 'Sea glass', value: `${got} / ${glassN}`, frac: got / Math.max(1, glassN) },
        { label: 'Places', value: `${seen} / ${places.length}`, frac: seen / Math.max(1, places.length) },
        { label: 'Title', value: progress?.title?.title ?? 'None yet' },
      ],
      todo: todo(),
      ...(next ? { next: next.displayName } : {}),
    };
  };

  let wasMuted = false;
  const close = (): void => {
    card.close();
    w.player.carried = false;
    w.setViewmodel?.(true);
    adv.spine?.objective.root.classList.remove('ws-quest-hide');
  };
  const open = (): void => {
    if (card.isOpen) return;
    flags.set(SEEN_COMPLETE);
    if (document.pointerLockElement) document.exitPointerLock();
    w.player.carried = true; w.player.velocity.set(0, 0, 0);
    w.setViewmodel?.(false);
    wasMuted = w.audio.worldMuted;
    w.audio.worldMuted = true;
    card.open(data(), {
      keep: () => { close(); w.audio.worldMuted = wasMuted; w.hud.onResume?.(); },   // the pause menu's close: control, the sword, the pointer lock
      next: () => { if (next) { close(); requestShard(next.slug, { enter: true }); } },   // E155: switched to in the page (this island parks under its title)
      title: () => { close(); w.hud.exitToMenu?.(); },                                 // its hush + the title theme are main.ts's
    });
  };

  // the menu row only exists once the quest is done
  const syncEntry = (): void => {
    if (!flags.has(QUEST_DONE)) { setCompleteEntry(null); return; }
    setCompleteEntry({ label: `${shardName} complete`, sub: 'Your island · the time, the finds, what is still out there', open });
  };
  syncEntry();
  flags.onChange((f) => { if (f === QUEST_DONE) syncEntry(); });

  // ── the fallback: done, never shown → one toast a session, out of combat ──
  let offered = false, checkT = 0;
  const hostileNear = (): boolean => {
    const pp = w.player.position;
    return (w.animals.animals ?? []).some((a) => a.alive && a.aggressive === true && Math.hypot(a.position.x - pp.x, a.position.z - pp.z) < SAFE_R);
  };
  w.game.onUpdate((_dt, t) => {
    if (offered || t - checkT < 1) return;
    checkT = t;
    if (!flags.has(QUEST_DONE) || flags.has(SEEN_COMPLETE) || w.player.carried || card.isOpen || hostileNear()) return;
    offered = true;
    w.hud.toast(`${shardName} complete · open the menu to see your island`);
  });

  return {
    showAfterReward: () => { if (flags.has(SEEN_COMPLETE)) return false; open(); return true; },
    open,
    get up() { return card.isOpen; },
    leftMarkers: () => [...left(glass), ...left(extras), ...left(places)].map((s) => ({ id: s.flag, label: s.short, short: s.short, x: s.x, z: s.z })),
  };
}
