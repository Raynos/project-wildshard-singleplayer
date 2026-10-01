/**
 * Feature playgrounds (E307, Jake: "unique gameplay features need their own arenas … standalone, not slammed into the dummy
 * arena"): the Explore hub lists the shared entries (Model explorer, World explorer, Practice arena), then the current
 * shard's own playgrounds. Pure data, so the hub can list them without loading a single scene: the scenes are
 * src/shards/nine-dragon-stack/playground/GrapplePlayground.ts and HorsePlayground.ts, imported on the tap (src/engine/practice/playground/load.ts).
 *
 * Driftwood Isle (melee) and Pine Hollow (crossbow) have no feature of their own that needs one (Jake): none listed.
 */

export type PlaygroundId = 'grapple' | 'horse';

export interface PlaygroundCard {
  id: PlaygroundId;
  /** the shard whose feature it is: listed on that shard only */
  shard: string;
  title: string;
  /** the card's one line */
  blurb: string;
  /** the placeholder art's glyph (an inline SVG on the card's dev-grid tile) until real card art exists */
  icon: string;
}

/** the Fei Zhua's three-talon claw on its line (the grapple's own LOCK icon, Traversal.ts) */
const CLAW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2v9.3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="12" cy="3.4" r="1.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M12 11.5c-3.9 0-6.6 2.5-6.9 6.6l1.9-1.3M12 11.5c3.9 0 6.6 2.5 6.9 6.6l-1.9-1.3M12 11.5v10" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
/** the horse's head (the riding HUD's own glyph, RideHUD.ts) */
const HORSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19.5 3.2c-1.6.2-3 .9-4.1 2L8.3 8.4c-1.2.5-2.2 1.4-2.8 2.6L3.6 14.8c-.3.6-.1 1.3.5 1.6.5.2 1 .1 1.4-.3l1.9-2.2.3 5.6c0 .6.5 1 1.1 1s1-.5 1-1.1l.2-3.9h4.4l.6 4c.1.6.6 1 1.2.9.6-.1 1-.6.9-1.2l-.8-5.8c1.3-.9 2.1-2.4 2.1-4l.1-1.3 1.7-.5c.6-.2.9-.8.7-1.4l-.3-1c.6-.5.8-1.4.4-2.1z"/></svg>';

export const PLAYGROUND_CARDS: readonly PlaygroundCard[] = [
  { id: 'grapple', shard: 'nine-dragon-stack', title: 'Grapple playground', blurb: 'Fei Zhua parkour · dev course · timer', icon: CLAW },
  { id: 'horse', shard: 'nalati-grasslands', title: 'Horse playground', blurb: 'Oval track · jumps · lap timer', icon: HORSE },
];

/** the playgrounds the hub lists on `slug` (none on Driftwood Isle and Pine Hollow) */
export function playgroundsFor(slug: string): PlaygroundCard[] {
  return PLAYGROUND_CARDS.filter((c) => c.shard === slug);
}

export function playgroundCard(id: PlaygroundId): PlaygroundCard | undefined {
  return PLAYGROUND_CARDS.find((c) => c.id === id);
}

/** a card's `data-pg` read back as an id (anything else: null) */
export function asPlaygroundId(s: string | undefined): PlaygroundId | null {
  return PLAYGROUND_CARDS.find((c) => c.id === s)?.id ?? null;
}
