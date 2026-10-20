import { expect,test } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { configureGrassFieldData } from '../src/game/systems/looks/grassField';

test('orchard meadow rows preserve river widths and clamp beyond the admitted profile',()=>{
  const scope=new Scope('orchard.meadow'),input={seed:29,world:{res:2,size:20,water:-100,wet:'raster',pond:'raster'},trails:[],
    river:{from:-10,step:20,values:[[1,3],[5,7]]},meadow:{short:[],tall:[],bare:[],valley:.4,plateau:.7}};
  try{
    const field=configureGrassFieldData(input,scope);
    expect(field.riverZ(0)).toBe(3);expect(field.riverHalf(0)).toBe(5);
    expect(field.riverZ(-100)).toBe(1);expect(field.riverHalf(100)).toBe(7);
    expect(field.valley).toBe(.4);
    expect(()=>configureGrassFieldData({...input,river:{...input.river,step:0}},scope)).toThrow();
    expect(()=>configureGrassFieldData({...input,riverZ:()=>0},scope)).toThrow();
  }finally{scope.dispose();}
});
