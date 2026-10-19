// SHARD-PLATFORM M3: the post passes' programs (data/passes.ts) on the SDK shader family, with the splices the data
// cannot hold: the clean room's (look/style.ts) and the LUT's texel mapping (the size is the engine's).
import { ShaderFamily } from '@wildshard/sdk/looks/shaderFamily';
import { LUT_SPLICES } from '../light/grade';
import { Y0 } from '../../layout';

export const PASS_FAMILY = new ShaderFamily({ y0: String(Y0), ...LUT_SPLICES }, {});
