import {ClientChannels} from '@wildshard/sdk/clientChannels';
import {parseClientChannels,type ClientChannelProgram} from '@wildshard/format/clientChannels';

type Expr=number|string|readonly [Op,...Expr[]];
type Op='+'|'-'|'*'|'/'|'min'|'max'|'gt'|'if'|'lerp'|'ss';
const s='overcast',fl='flash',rain='rain',wet='wet';
const field=(name:string):Expr=>`look.${name}`;
const nf:Expr=['min',1,['max',.1,['/',['+',['+',field('horizon.r'),field('horizon.g')],field('horizon.b')],2.2]]];
const after:Expr=['*',wet,['-',1,s]];
const over=(value:Expr,base:Expr):Expr=>['if',['gt',s,0],value,base];
const flash=(value:Expr,base:Expr):Expr=>['if',['gt',fl,0],value,base];
const recipes:[string,Expr][]=[];
function scalar(name:string,overcast:Expr,post?:(base:Expr)=>Expr):void{
 const initial=field(name),base=over(overcast,initial);recipes.push([name,post===undefined?base:post(base)]);
}
function colour(name:string,target:readonly number[],alpha:Expr,scale:Expr=1,post?:(base:Expr,index:number)=>Expr):void{
 for(const [index,component] of ['r','g','b'].entries()){
  const initial=field(`${name}.${component}`),t=target[index];if(t===undefined)throw new Error('Missing colour component');
  const base=over(['lerp',initial,['*',t,scale],alpha],initial);
  recipes.push([`${name}.${component}`,post===undefined?base:post(base,index)]);
 }
}
const FLASH=[.85,.82,1] as const;
scalar('keyIntensity',['*',field('keyIntensity'),['-',1,['*',.82,s]]]);
colour('keyColor',[.78,.82,.95],['*',s,.6]);
scalar('disc',['*',field('disc'),['-',1,['ss',.25,.75,s]]]);
colour('zenith',[.12,.13,.19],s,nf);
colour('horizon',[.3,.31,.38],s,nf);
for(const component of ['r','g','b'])scalar(`glow.${component}`,['*',field(`glow.${component}`),['-',1,s]]);
scalar('stars',['*',field('stars'),['-',1,s]]);
colour('hemiSky',[.42,.46,.58],['*',s,.8],nf,(base,index)=>flash(['lerp',base,FLASH[index]??0,fl],base));
scalar('hemiIntensity',['*',field('hemiIntensity'),['+',1,['*',.2,s]]],base=>flash(['+',base,['*',2.6,fl]],base));
scalar('envIntensity',['*',field('envIntensity'),['-',1,['*',.4,s]]]);
colour('fogColor',[.17,.18,.23],s,nf,(base,index)=>flash(['lerp',base,['*',FLASH[index]??0,.55],['*',fl,.6]],base));
colour('fogSunColor',[.17,.18,.23],s,['*',nf,1.2]);
colour('shadeTint',[.13,.14,.22],['*',s,.7],nf);
for(const component of ['r','g','b'])scalar(`rimColor.${component}`,['*',field(`rimColor.${component}`),['-',1,['*',.7,s]]]);
colour('cloudLight',[.36,.38,.46],s,nf,(base,index)=>flash(['lerp',base,FLASH[index]??0,['*',fl,.7]],base));
scalar('planetOpacity',['*',field('planetOpacity'),['-',1,['*',.85,s]]]);
scalar('saturation',['-',field('saturation'),['*',.28,s]],base=>['if',['gt',after,0],['+',base,['*',.12,after]],base]);
colour('shadowTint',[.9,.97,1.12],s);
colour('highTint',[.95,.98,1.05],s,1,(base,index)=>['if',['gt',after,0],['lerp',base,[1.08,1.02,.92][index]??0,['*',.4,after]],base]);
for(const name of ['volStrength','godRays'])scalar(name,['*',field(name),['-',1,s]]);
recipes.push(['fogDist',['+',field('fogDist'),['+',['*',.002,s],['*',.009,rain]]]],['fogHeightDensity',['+',field('fogHeightDensity'),['*',.003,rain]]]);

/** Build-only scalar lowering; all runtime arithmetic remains the existing client-channel DAG. */
function program(name:string,expression:Expr):ClientChannelProgram{
 const out=new ClientChannels(`nalati.weather.${name}`),nodes=new Map<string,number>();
 function lower(expr:Expr):number{
  const key=JSON.stringify(expr),found=nodes.get(key);if(found!==undefined)return found;
  let node:number;
  if(typeof expr==='number')node=out.constant(expr);
  else if(typeof expr==='string')node=out.read(expr);
  else{
   const arg=(i:number):number=>{const value=expr[i];if(value===undefined)throw new Error('Missing channel argument');return lower(value);};
   switch(expr[0]){
    case 'if':node=out.select(arg(1),arg(2),arg(3));break;
    case 'lerp':{const a=arg(1);node=out.binary('add',a,out.binary('mul',out.binary('sub',arg(2),a),arg(3)));break;}
    case 'ss':{const a=arg(1),b=arg(2),x=arg(3),t=out.binary('min',out.constant(1),out.binary('max',out.constant(0),out.binary('div',out.binary('sub',x,a),out.binary('sub',b,a))));node=out.binary('mul',out.binary('mul',t,t),out.binary('sub',out.constant(3),out.binary('mul',out.constant(2),t)));break;}
    case '+':case '-':case '*':case '/':case 'min':case 'max':case 'gt':{const op={'+':'add','-':'sub','*':'mul','/':'div',min:'min',max:'max',gt:'gt'} as const;node=out.binary(op[expr[0]],arg(1),arg(2));break;}
    default:throw new Error('Unknown channel operation');
   }
  }
  nodes.set(key,node);return node;
 }
 out.output('value',lower(expression));const row=out.build();
 return parseClientChannels([{...row,numeric:{group:'weather',outputs:[{property:'value',target:'look',path:name.split('.')}],inputs:row.reads.filter(id=>id.startsWith('look.')).map(input=>({input,owner:'look',path:input.split('.').slice(1)}))}}])[0]??(()=>{throw new Error('Missing weather program');})();
}
export const NALATI_WEATHER_PROGRAMS=parseClientChannels(recipes.map(([name,expression])=>program(name,expression)));
