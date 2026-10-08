import { writeSaveFixture } from './debug-settings.mjs';
import { gridFloorPlans } from './frame-floor-grid.mjs';

/** Pre-release capture only: seed the existing expiring tap intent, without enabling Developer or changing admission.
 * @param {{instance:string,slug:string}} home */
export function publicGridIntentCode(home) {
  return `(() => {const target={...${JSON.stringify(home)},at:Date.now()};const write=${writeSaveFixture.toString()};write({scope:'session',key:'gridIntent',data:target});write({scope:'device',key:'gridIntent.once',data:target});})()`;
}

/** A single initial home approach, followed by real-input road and template-centre legs.
 * @param {Pick<import('./frame-floor-grid.mjs').FloorGridState,'home'|'cells'>} state */
export function publicGridPlans(state) {
  const entry = gridFloorPlans(state, 'template').at(0);
  if (!entry?.start) throw new Error('Public grid needs its home approach');
  const cell = state.cells.find(row => row.instance === entry.to), end = entry.waypoints.at(-1);
  if (!cell || !end) throw new Error('Public grid needs a template destination');
  const road = entry.waypoints.length > 2 ? entry.waypoints.slice(0, 2)
    : [{x:(entry.start.x+end.x)/2,z:(entry.start.z+end.z)/2}];
  return [{name:'public-road',from:entry.from,to:null,start:entry.start,waypoints:road,requiredResidents:[]},
    {name:'public-template',from:null,to:entry.to,waypoints:[...entry.waypoints.slice(entry.waypoints.length > 2 ? 2 : 0),
      {x:cell.cell[0]*555,z:cell.cell[1]*555}],requiredResidents:[cell.instance]}];
}

/** Serialized read-only witness: effective mode, catalogue, runtime residents and the platform's own refusal receipt. */
export function readPublicGridWitness() {
  const grid = window.__wildshard.shard.grid;
  const device = JSON.parse(localStorage.getItem('wildshard.save.v2.device') ?? '{}');
  const session = JSON.parse(sessionStorage.getItem('wildshard.save.v2.session') ?? '{}');
  return {developer:Object.hasOwn(document.documentElement.dataset,'dev'),savedDeveloper:device.keys?.devMode?.data,
    state:grid.state(),refusals:session.keys?.shardRefusals?.data ?? {},homeResidency:grid.residency().home,
    runtimeLevel:window.__wildshard.world.game.level.id};
}

/** Refuse a mislabelled public receipt or any native region admitted through a Developer override.
 * @param {import('./public-grid.mjs').PublicGridWitness} witness @param {boolean} requireRefusals */
export function publicGridWitnessFailures(witness, requireRefusals) {
  const failures = [], state = witness.state;
  if (witness.developer || witness.savedDeveloper !== false) failures.push('Developer is not saved and effective OFF');
  if (state.home !== 'driftwood-isle' || witness.runtimeLevel !== 'driftwood-isle') failures.push('Public home is not borrowed Driftwood');
  if (state.cells.some(row => !['driftwood-isle','_template','pine-hollow','nalati-grasslands'].includes(row.slug))) failures.push('Developer-only catalogue override installed');
  if (state.live.live.residents.some(id => !state.cells.some(row => row.instance === id && ['driftwood-isle','_template'].includes(row.slug)))) failures.push('A refused native shard became a runtime resident');
  if (requireRefusals && ['pine-hollow','nalati-grasslands'].some(slug => !['upgrade','too-big','safety','load'].includes(witness.refusals[slug] ?? ''))) failures.push('Pine/Nalati hard-admission refusal was not witnessed');
  return failures;
}
