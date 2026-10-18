import ts from '@typescript/typescript6';
import { ClientChannels } from '@wildshard/sdk/clientChannels';
import { parseClientChannels, type ClientChannelProgram } from '@wildshard/format/clientChannels';

/** Build-only expressions become bounded presentation DAGs, never evaluated JS. */
export function weatherFxChannels(): ClientChannelProgram[] {
 const rows: ClientChannelProgram[] = [];
 function put(target: string, path: string, expression: string): void {
  const b = new ClientChannels(`nalati.fx.${String(rows.length)}`);
  const file = ts.createSourceFile('expression.ts', `(${expression})`, ts.ScriptTarget.Latest, true);
  const statement = file.statements[0];
  if (statement === undefined || !ts.isExpressionStatement(statement)) throw new Error('Missing visual expression');
  function lower(n: ts.Expression): number {
   if(ts.isParenthesizedExpression(n))return lower(n.expression);
   if(ts.isNumericLiteral(n))return b.constant(Number(n.text));
   if(ts.isIdentifier(n)||ts.isPropertyAccessExpression(n))return b.read(n.getText(file));
   if(ts.isConditionalExpression(n))return b.select(lower(n.condition),lower(n.whenTrue),lower(n.whenFalse));
   if(ts.isPrefixUnaryExpression(n)&&n.operator===ts.SyntaxKind.MinusToken)return b.unary('neg',lower(n.operand));
   if(ts.isBinaryExpression(n)){
    const op=n.operatorToken.getText(file),a=lower(n.left),c=lower(n.right);
    switch(op){case '+':return b.binary('add',a,c);case '-':return b.binary('sub',a,c);case '*':return b.binary('mul',a,c);case '/':return b.binary('div',a,c);case '%':return b.binary('mod',a,c);case '>':return b.binary('gt',a,c);case '<':return b.binary('gt',c,a);case '&&':return b.binary('mul',a,c);case '||':return b.binary('max',a,c);default:throw new Error(`Unknown weather operation ${op}`);}
   }
   if(ts.isCallExpression(n)){
    const a=n.arguments[0],c=n.arguments[1];if(a===undefined)throw new Error('Missing visual argument');
    switch(n.expression.getText(file)){case 'sin':return b.unary('sin',lower(a));case 'cos':return b.unary('cos',lower(a));case 'min':case 'max':if(c===undefined)throw new Error('Missing binary visual argument');return b.binary(n.expression.getText(file)==='min'?'min':'max',lower(a),lower(c));default:throw new Error('Unknown visual function');}
   }
   throw new Error(`Unsupported visual expression ${n.getText(file)}`);
  }
  b.output('value',lower(statement.expression));
  const built=b.build();
  rows.push(...parseClientChannels([{...built,numeric:{group:'nalati.fx',outputs:[{property:'value',target,path:path.split('.')}],inputs:built.reads.filter(id=>id.includes('.')).map(input=>({input,owner:input.split('.')[0],path:input.split('.').slice(1)}))}}]));
 }
 const param=(id:string,path:string,expr:string):void=>put(`nalati-${id}`,path,expr);
 const flag=(id:string,expr:string):void=>put('flags',id,expr);
 const storm='(weather.front > .01 && weather.front < 1.499)';
 const bow='weather.rainbow * min(1,max(0,look.sunDir.y*6)) * (look.moon > 0 ? 0 : 1)';
 flag('deck',`${storm} || ${bow} > .001`);flag('curtains',storm);flag('rain','weather.rain > .01');
 flag('bolt','boltT < .4');flag('glow','glowT < 1.6');flag('smoke','smokeLeft > 0');flag('fire','smokeLeft > 0 && active');flag('puddles','weather.wet > .02');
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
 param('strike-smoke','smoke.x','min(1,smokeLeft/30)');param('strike-smoke','smoke.y','wind.x*.2');param('strike-smoke','smoke.z','wind.z*.2');
 param('puddles','puddle.x','weather.wet');param('puddles','puddle.y','weather.rain');
 param('lightning-bolt','alpha','boltT < .07 ? 1 : boltT < .11 ? .25 : boltT < .18 ? 1 : boltT < .22 ? .3 : boltT < .26 ? .8 : max(0,.8-(boltT-.26)*8)');
 const pulse='(.6+.4*sin(glowT*28))',size=`(1.5+3.5*min(1,glowT/1.2))*${pulse}`;
 for(const axis of ['x','y','z'])put('glow',`scale.${axis}`,size);
 put('glowMaterial','opacity',`(.35+.65*min(1,glowT/1.2))*${pulse}`);
 put('fireMaterial','opacity','min(1,smokeLeft/60)*(.55+.45*sin(smokeT*13)*sin(smokeT*7.3))');
 for(const axis of ['x','y','z'])put('fire',`scale.${axis}`,'2.2');
 put('rainU','uVelx','wind.x*.35');put('rainU','uVely','-9.5');put('rainU','uVelz','wind.z*.35');
 put('rainU','uLen',' .7+.4*weather.rain');put('rainU','uAlpha','.16+.16*weather.rain');
 put('draw','count','count*min(1,weather.rain*1.1)');
 return rows;
}
