// SHARD-PLATFORM M3: the post passes' programs (data/passes.ts) on the SDK shader family, with the splices the data
// cannot hold: the clean room's (look/style.ts), the window glow's and the grade's GLSL and the flagstones'.
import { ShaderFamily } from '@wildshard/sdk/looks/shaderFamily';
import { PASS_PROGRAMS } from '../../data/passes';
import { GLOW_COMP_GLSL, GLOW_PRE_GLSL } from '../light/glow';
import { GRADE_GLSL } from '../light/grade';
import { FLAG_GLSL } from '../paint';
import { LOOK_FRAGMENTS } from '../style';

export const PASS_FAMILY = new ShaderFamily({ ...LOOK_FRAGMENTS, glowPre: GLOW_PRE_GLSL, glowComp: GLOW_COMP_GLSL, grade: GRADE_GLSL, flag: FLAG_GLSL }, PASS_PROGRAMS);

/** a march's step count as its splices */
export const stepSplices = (steps: number): Readonly<Record<string, string>> => ({ steps: String(steps), stepsF: steps.toFixed(1) });
