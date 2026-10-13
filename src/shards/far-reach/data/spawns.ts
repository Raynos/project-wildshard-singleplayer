import { GOATS, RAY_HOMES, ROC, ROOST_RAYS, WISP_HOMES, APOTHEM, DECK, type Home } from './layout';

const flying = (id: string, kind: string, look: string, home: Home) => ({ id, kind, look, at: [home.x + home.r, home.z] as const, yaw: 0 });
/** Actual installation order and home of each finite native body; goats land after install-time registrations. */
export const SKY_FLOCK_ROWS = [
  ...RAY_HOMES.map((home, index) => Object.assign(flying(`far.ray.${String(index)}`, 'driftRay', 'dusk', home), { home })),
  ...ROOST_RAYS.map((home, index) => Object.assign(flying(`far.roost.${String(index)}`, 'driftRay', 'dusk', home), { home })),
  ...WISP_HOMES.map((home, index) => Object.assign(flying(`far.wisp.${String(index)}`, 'galeWisp', 'gale', home), { home })),
  { ...flying('far.roc', 'stormRoc', 'storm', ROC), home: ROC },
  ...GOATS.map((goat, index) => ({ id: `far.goat.${String(index)}`, kind: 'skyGoat', look: 'cloud',
    at: [goat.isle.x + goat.dx, goat.isle.z + goat.dz] as const, yaw: 0,
    home: { x: goat.isle.x, z: goat.isle.z, r: goat.isle.r * APOTHEM, y: goat.isle.y } })),
];

/** The admitted spawn closure uses the same authored rows, retaining its original actor and boss list order. */
export const SKY_SPAWNS = { homes: [], bosses: SKY_FLOCK_ROWS.filter(row => row.kind === 'stormRoc').map(({ home: _home, ...row }) => row),
  actors: SKY_FLOCK_ROWS.filter(row => row.kind !== 'stormRoc').map(({ home: _home, ...row }) => row) };

/** Named browser batches retain the same native allocation order and exact homes as the headless roster. */
export const SKY_FLOCK_GROUPS = {
  rays: SKY_FLOCK_ROWS.filter(row => row.id.startsWith('far.ray.')),
  roost: SKY_FLOCK_ROWS.filter(row => row.id.startsWith('far.roost.')),
  wisps: SKY_FLOCK_ROWS.filter(row => row.kind === 'galeWisp'),
  goats: SKY_FLOCK_ROWS.filter(row => row.kind === 'skyGoat'),
};

/** Page landing and actual-home authority, preserving the original two-metre goat ray. */
export const GOAT_SPAWN_ABOVE = 2;
export const SKY_PAGE_BODY_HOMES = SKY_FLOCK_ROWS.map(row => ({ id: row.id, home: row.home }));
export const SKY_PAGE_HELD = { order: SKY_FLOCK_ROWS.map(row => row.id), settle: 'far.goats',
  placements: SKY_FLOCK_GROUPS.goats.map(row => ({ id: row.id, fromY: row.home.y + GOAT_SPAWN_ABOVE, y: row.home.y })) };

/** The native keeper uses the same body order and authored homes as the page. */
export const FLOCK_STEP = 'far.flock';
/** The structures-only analytic fallback and the manifest's death plane. */
export const SKY_ANALYTIC_FLOOR = -1000;
export const SKY_KILL_Y = DECK - 24;
export const SKY_FLOCK_PLACEMENT = { fallback: SKY_ANALYTIC_FLOOR,
  rows: SKY_FLOCK_ROWS.map(row => ({ id: row.id, home: row.home, fromY: row.kind === 'skyGoat' ? row.home.y + GOAT_SPAWN_ABOVE : DECK + 2 })) };
