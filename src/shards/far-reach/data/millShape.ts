/**
 * The windmill's shape (world/mill.ts draws it, generators/mill.ts builds its code set): the tower's foot and top radius,
 * its height, the cap's height and a sail's length (metres; local frame: base at y 0, the sails face +z), and the painted
 * stone's courses (`tile` m tall, `around` repeats round the tower).
 */
export const MILL_TOWER = { base: 2.5, top: 1.7, height: 8.6, cap: 2.9, sail: 7.4 } as const;
export const MILL_COURSES = { tile: 2.8, around: 5 } as const;
/**
 * The modelled set (E410, Sky Reach top-10 row 6; `art/far-reach/round-34-mill/`): codex references of mockup A's tower
 * mill (the whitewashed rubble tower, the ivy, the arched door, the boarded curb and the dark shingled cap with its
 * windshaft stub, no sails) and of mockup C's rock under it, BiRefNet, Hunyuan3D-2 turbo + paint, finish.sh. The tower
 * is scaled so its windshaft stub sits where the code hub was (`hub` y, so the sails sweep the same circle the mockup
 * framing was tuned on) and turned so the stub faces +z (the spawn); the code sails stay, turning on the stub. The rock
 * foot is squashed to `foot.h` and sunk `foot.sink` into the deck: up to 0.65 m of it hugs the wall inside the meadow's
 * 2.9 m hole round the mill (where the code tower's plinth stood), and from `foot.walk` m out (0.3 m on) none of it stands
 * more than `foot.lip` m proud, so the walk round the mill (the code collider's 2.3 m box) is over a stone lip, not a
 * wall. The code tower stays the fallback when a model fails to load.
 */
export const MODELLED = { hub: MILL_TOWER.height + 1.0, baseR: 2.6, foot: { span: 8.2, h: 1.7, sink: 0.45, walk: 3.0, lip: 0.3 } } as const;
