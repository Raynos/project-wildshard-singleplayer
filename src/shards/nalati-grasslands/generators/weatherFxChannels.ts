import ts from '@typescript/typescript6';
import { ClientChannels } from '@wildshard/sdk/clientChannels';
import { parseClientChannels, CLIENT_CHANNEL_LIMITS, type ClientChannelProgram } from '@wildshard/format/clientChannels';

/** One visual output: a numeric field of `target` at `path`, from a build-only expression. */
export interface VisualRow { readonly target: string; readonly path: string; readonly expression: string }
const PROPERTIES = ['value', 'x', 'y', 'z', 'yaw', 'pitch', 'roll', 'scaleX', 'scaleY', 'scaleZ', 'turn', 'visible'] as const;

/** Build-only expressions become bounded presentation DAGs, never evaluated JS: several outputs share one program. */
function visualProgram(rows: readonly VisualRow[], id: string, group: string): ClientChannelProgram {
  const b = new ClientChannels(id), reads = new Map<string, number>();
  function lower(n: ts.Expression, file: ts.SourceFile): number {
   if(ts.isParenthesizedExpression(n))return lower(n.expression,file);
   if(ts.isNumericLiteral(n))return b.constant(Number(n.text));
   if(ts.isIdentifier(n)||ts.isPropertyAccessExpression(n)||ts.isElementAccessExpression(n)){
    const name=n.getText(file).replaceAll(/\[(\d+)\]/gu, '.$1'),found=reads.get(name);if(found!==undefined)return found;
    const node=b.read(name);reads.set(name,node);return node;
   }
   if(ts.isConditionalExpression(n))return b.select(lower(n.condition,file),lower(n.whenTrue,file),lower(n.whenFalse,file));
   if(ts.isPrefixUnaryExpression(n)&&n.operator===ts.SyntaxKind.MinusToken)return b.unary('neg',lower(n.operand,file));
   if(ts.isBinaryExpression(n)){
    const op=n.operatorToken.getText(file),a=lower(n.left,file),c=lower(n.right,file);
    switch(op){case '+':return b.binary('add',a,c);case '-':return b.binary('sub',a,c);case '*':return b.binary('mul',a,c);case '/':return b.binary('div',a,c);case '%':return b.binary('mod',a,c);case '>':return b.binary('gt',a,c);case '<':return b.binary('gt',c,a);case '&&':return b.binary('mul',a,c);case '||':return b.binary('max',a,c);default:throw new Error(`Unknown weather operation ${op}`);}
   }
   if(ts.isCallExpression(n)){
    const a=n.arguments[0],c=n.arguments[1];if(a===undefined)throw new Error('Missing visual argument');
    switch(n.expression.getText(file)){case 'sin':return b.unary('sin',lower(a,file));case 'cos':return b.unary('cos',lower(a,file));
     case 'ss':{const hi=n.arguments[1],x=n.arguments[2];if(hi===undefined||x===undefined)throw new Error('Missing smoothstep argument');const lo=lower(a,file),t=b.binary('min',b.constant(1),b.binary('max',b.constant(0),b.binary('div',b.binary('sub',lower(x,file),lo),b.binary('sub',lower(hi,file),lo))));return b.binary('mul',b.binary('mul',t,t),b.binary('sub',b.constant(3),b.binary('mul',b.constant(2),t)));}
     case 'min':case 'max':if(c===undefined)throw new Error('Missing binary visual argument');return b.binary(n.expression.getText(file)==='min'?'min':'max',lower(a,file),lower(c,file));default:throw new Error('Unknown visual function');}
   }
   throw new Error(`Unsupported visual expression ${n.getText(file)}`);
  }
  const outputs=rows.map((row,i)=>{
   const file=ts.createSourceFile('expression.ts',`(${row.expression})`,ts.ScriptTarget.Latest,true),statement=file.statements[0],property=PROPERTIES[i];
   if(statement===undefined||!ts.isExpressionStatement(statement)||property===undefined)throw new Error('Missing visual expression');
   b.output(property,lower(statement.expression,file));return {property,target:row.target,path:row.path.split('.')};
  });
  const built=b.build();
  const row=parseClientChannels([{...built,numeric:{group,outputs,inputs:built.reads.filter(input=>input.includes('.')).map(input=>({input,owner:input.split('.')[0],path:input.split('.').slice(1).map(part=>/^\d+$/u.test(part)?Number(part):part)}))}}])[0];
  if(row===undefined)throw new Error('Missing visual expression row');return row;
}
/** Greedy packing under the format's per-program bounds: fewer programs, the same arithmetic (a group snapshots every read
 *  before it publishes, so the split never changes what a program sees). */
export function visualPack(rows: readonly VisualRow[], prefix: string, group: string): ClientChannelProgram[] {
  const programs: ClientChannelProgram[] = []; let current: VisualRow[] = [];
  const build = (list: readonly VisualRow[]): ClientChannelProgram => visualProgram(list, `${prefix}.${String(programs.length)}`, group);
  const fits = (list: readonly VisualRow[]): boolean => { if (list.length > PROPERTIES.length) return false; try { const p = build(list); return p.nodes.length <= CLIENT_CHANNEL_LIMITS.nodes && p.reads.length <= CLIENT_CHANNEL_LIMITS.reads; } catch { return false; } };
  for (const row of rows) { if (current.length > 0 && !fits([...current, row])) { programs.push(build(current)); current = []; } current.push(row); }
  if (current.length > 0) programs.push(build(current));
  return programs;
}

export function weatherFxChannels(): ClientChannelProgram[] {
 const rows: VisualRow[] = [];
 const put=(target:string,path:string,expression:string):void=>{rows.push({target,path,expression});};
 const param=(id:string,path:string,expr:string):void=>put(`nalati-${id}`,path,expr);
 const flag=(id:string,expr:string):void=>put('flags',id,expr);
 const storm='(weather.front > .01 && weather.front < 1.499)';
 const bow='weather.rainbow * min(1,max(0,look.sunDir.y*6)) * (look.moon > 0 ? 0 : 1)';
 flag('deck',`${storm} || ${bow} > .001`);flag('curtains',storm);flag('rain','weather.rain > .01');
 flag('bolt','strike.age < .4');flag('glow','telegraph.age < 1.6 && telegraph.age < strike.age');flag('smoke','burn.age < 360');flag('fire','burn.age < 360 && active');flag('puddles','weather.wet > .02');
 for(const axis of ['x','y','z'])put('deck',`position.${axis}`,`camera.${axis}`);
 for(const axis of ['x','z'])put('curtains',`position.${axis}`,`camera.${axis}`);
 for(const id of ['storm-deck','storm-curtains']){
  param(id,'storm.x','cos(weather.stormFrom)');param(id,'storm.y','sin(weather.stormFrom)');param(id,'storm.z','weather.front');
 }
 param('storm-deck','deck.x','weather.overcast');param('storm-deck','deck.y','weather.flash');
 param('storm-deck','deck.z',`${storm} ? min(1,weather.front*12)*min(1,(1.5-weather.front)*12) : 0`);param('storm-deck','deck.w',bow);
 param('storm-curtains','curtain.x','weather.rain');param('storm-curtains','curtain.y','max(0,weather.overcast-.3)/.7');
 param('storm-curtains','curtain.z','wind.x');param('storm-curtains','curtain.w','wind.z');
 for(const [axis,c] of [['x','r'],['y','g'],['z','b']]){
  param('storm-deck',`light.${axis}`,`look.cloudLight.${c}*1.35`);param('storm-curtains',`light.${axis}`,`look.cloudLight.${c}`);
  param('storm-deck',`sunCol.${axis}`,`look.keyColor.${c}`);param('storm-deck',`sunDir.${axis}`,`look.sunDir.${axis}`);
  param('strike-smoke',`light.${axis}`,`look.hemiSky.${c}+(look.keyColor.${c}-look.hemiSky.${c})*.3`);
  param('puddles',`sky.${axis}`,`look.zenith.${c}`);param('puddles',`horizon.${axis}`,`look.horizon.${c}`);
  param('puddles',`sunDir.${axis}`,`look.keyDir.${axis}`);param('puddles',`sunCol.${axis}`,`look.keyColor.${c}*look.keyIntensity*(1-weather.overcast)`);
  put('rainU',`uCol${axis}`,`(look.fogColor.${c}+(look.hemiSky.${c}-look.fogColor.${c})*.5)*1.9+.05+.8*weather.flash`);
 }
 param('strike-smoke','smoke.x','min(1,max(0,360-burn.age)/30)');param('strike-smoke','smoke.y','wind.x*.2');param('strike-smoke','smoke.z','wind.z*.2');
 param('puddles','puddle.x','weather.wet');param('puddles','puddle.y','weather.rain');
 param('lightning-bolt','alpha','strike.age < .07 ? 1 : strike.age < .11 ? .25 : strike.age < .18 ? 1 : strike.age < .22 ? .3 : strike.age < .26 ? .8 : max(0,.8-(strike.age-.26)*8)');
 // the events' places (WeatherReactions records): the bolt at the strike, the smoke and fire at the last struck spruce, the glow on
 // the telegraphed point, the deck's flash toward the last flash's bearing
 for(const axis of ['x','y','z'])param('lightning-bolt',`origin.${axis}`,`strike.${axis}`);
 param('strike-smoke','origin.x','burn.x');param('strike-smoke','origin.y','burn.y-2');param('strike-smoke','origin.z','burn.z');
 put('fire','position.x','burn.x');put('fire','position.y','burn.y-1.5');put('fire','position.z','burn.z');
 put('glow','position.x','telegraph.x');put('glow','position.y','telegraph.y+.4');put('glow','position.z','telegraph.z');
 param('storm-deck','flashDir.x','cos(flash.bearing)/1.0307764064044151');param('storm-deck','flashDir.y','.25/1.0307764064044151');param('storm-deck','flashDir.z','sin(flash.bearing)/1.0307764064044151');
 const pulse='(.6+.4*sin(telegraph.age*28))',size=`(1.5+3.5*min(1,telegraph.age/1.2))*${pulse}`;
 for(const axis of ['x','y','z'])put('glow',`scale.${axis}`,size);
 put('glowMaterial','opacity',`(.35+.65*min(1,telegraph.age/1.2))*${pulse}`);
 put('fireMaterial','opacity','min(1,max(0,360-burn.age)/60)*(.55+.45*sin(burn.age*13)*sin(burn.age*7.3))');
 for(const axis of ['x','y','z'])put('fire',`scale.${axis}`,'2.2');
 put('rainU','uVelx','wind.x*.35');put('rainU','uVely','-9.5');put('rainU','uVelz','wind.z*.35');
 put('rainU','uLen',' .7+.4*weather.rain');put('rainU','uAlpha','.16+.16*weather.rain');
 put('draw','count','count*min(1,weather.rain*1.1)');
 return visualPack(rows,'nalati.fx','nalati.fx');
}
