// oxlint-disable-next-line import/no-nodejs-modules -- Admit every actual committed camera fixture, including new sets.
import {readFileSync,readdirSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {parsePlotGoldens,plotGoldenCamera,plotGoldenPlacement} from '../scripts/goldens/plot-inputs.mjs';

const root='art/open-plots/golden-2026-11-03';
const read=(plot:string):unknown=>JSON.parse(readFileSync(`${root}/${plot}/cameras.json`,'utf8'));
describe('open plot golden cameras',()=>{
  it('admits the exact eight local/world poses in every existing set',()=>{
    for (const plot of readdirSync(root,{withFileTypes:true}).filter(row=>row.isDirectory())) {
      const plan=parsePlotGoldens(read(plot.name));
      expect(plan.views).toHaveLength(8);
      for (const view of plan.views) expect(plotGoldenCamera(view,plan.origin)).toEqual(view.world);
    }
  });
  it('rebases by served product identity after a grid move and retains provenance',()=>{
    const plan=parsePlotGoldens(read('night-market'));
    const grid={pitch:562.5,cells:[{slug:plan.slug,instance:'open-plot-new',cell:[2,-1] as const}]};
    expect(plotGoldenPlacement(plan,grid)).toEqual({instance:'open-plot-new',origin:{x:1125,z:-562.5},pitch:562.5,
      sourceInstance:plan.instance,sourceOrigin:plan.origin});
    expect(()=>plotGoldenPlacement(plan,{...grid,cells:[]})).toThrow();
    expect(()=>plotGoldenPlacement(plan,{...grid,cells:[...grid.cells,...grid.cells]})).toThrow();
    expect(()=>plotGoldenPlacement(plan,{cells:grid.cells})).toThrow();
  });
  it('refuses truncated sets, stale world coordinates and out-of-cell player anchors',()=>{
    const plan=parsePlotGoldens(read('night-market'));
    expect(()=>parsePlotGoldens({...plan,views:plan.views.slice(1)})).toThrow();
    const first=plan.views[0];if (first===undefined) throw new Error('Missing fixture view');
    expect(()=>parsePlotGoldens({...plan,views:[{...first,world:{...first.world,fov:30}},...plan.views.slice(1)]})).toThrow();
    expect(()=>parsePlotGoldens({...plan,views:[{...first,player:[251,0]},...plan.views.slice(1)]})).toThrow();
  });
});
