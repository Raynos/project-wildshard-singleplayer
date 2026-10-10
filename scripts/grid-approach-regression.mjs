import { ownedSoakPlans } from './soak/owned.mjs';
import { gridFloorWitnessFailures, runFloorGridRoute } from './frame-floor-grid.mjs';

/** Plan one real-input entry into every cell advertised by the running grid, including the return home.
 * No prepared-only subset: new catalogue cells become mandatory automatically.
 * @param {Pick<import('./frame-floor-grid.mjs').FloorGridState, 'home' | 'cells'>} state
 * @returns {import('./frame-floor-grid.mjs').FloorGridPlan[]} */
export function gridApproachPlans(state) {
  const route = ownedSoakPlans(state, 'cells', 'catalogue', 'owned');
  /** @type {import('./frame-floor-grid.mjs').FloorGridPlan[]} */
  const plans = [];
  for (const [index, plan] of route.plans.entries()) plans.push({ ...plan, movement: 'road-hover',
    ...(index === 0 ? { start: route.reference } : {}) });
  const expected = new Set(state.cells.map(cell => cell.instance));
  const planned = new Set(plans.map(plan => plan.to));
  if (expected.size !== state.cells.length || planned.size !== expected.size || [...expected].some(id => !planned.has(id))) {
    throw new Error('Approach regression must enter every catalogue cell exactly once');
  }
  return plans;
}

/** Run the actual grid driver through admission, road preparation and entry for the entire live catalogue.
 * Each route must publish its destination sim and playable state with no refusal; actions are held by the driver.
 * The caller owns a muted browser, the pinned preview, grid boot and the document fence.
 * @param {{evaluate:(expression:string)=>Promise<unknown>}} page
 * @param {import('./frame-floor-grid.mjs').FloorGridState} state
 * @param {import('./frame-floor-grid.mjs').FloorGridDocumentIdentity} identity
 * @returns {Promise<import('./frame-floor-grid.mjs').FloorGridWitness[]>} */
export async function runGridApproachRegression(page, state, identity) {
  const witnesses = [];
  for (const plan of gridApproachPlans(state)) {
    const witness = await runFloorGridRoute(page, plan, identity);
    const failures = gridFloorWitnessFailures(witness);
    const issues = await page.evaluate('window.__wildshard.shard.grid.state().live.live.issues');
    if (issues === null || typeof issues !== 'object' || Object.keys(issues).length > 0) failures.push('Missing or refused runtime admission');
    if (failures.length > 0) throw new Error(`${plan.name}: ${failures.join('; ')}`);
    witnesses.push(witness);
  }
  return witnesses;
}
