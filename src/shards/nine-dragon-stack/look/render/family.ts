// SHARD-PLATFORM M3: the post passes' programs (data/passes.ts) on the SDK shader family, with the splices the data
// cannot hold: the clean room's (look/style.ts) and the LUT's texel mapping (the size is the engine's).
import { ShaderFamily } from '@wildshard/sdk/looks/shaderFamily';
import { PASS_PROGRAMS } from '../../data/passes';
import { LUT_SPLICES } from '../light/grade';
import { LOOK_FRAGMENTS } from '../style';

export const PASS_FAMILY = new ShaderFamily({ ...LOOK_FRAGMENTS, ...LUT_SPLICES }, PASS_PROGRAMS);
