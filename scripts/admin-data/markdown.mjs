/** Markdown receipts stay readable verbatim; extracted fields carry source lines, not invented grades. */

/** Split table cells without treating escaped or inline-code pipes as delimiters.
 * @param {string} line @returns {string[]} */
export function tableCells(line) {
  const cells=[];let cell='',code=0;
  for(let i=0;i<line.length;i++) {
    const c=line[i];
    if(c==='\\' && i+1<line.length){cell+=c+line[++i];continue;}
    if(c==='`'){
      let width=1;while(line[i+width]==='`')width++;
      if(code===0)code=width;else if(code===width)code=0;
      cell+='`'.repeat(width);i+=width-1;continue;
    }
    if(c==='|'&&code===0){cells.push(cell.trim());cell='';}else cell+=c;
  }
  cells.push(cell.trim());
  if(cells[0]==='')cells.shift();if(cells.at(-1)==='')cells.pop();
  return cells;
}
/** @param {string} markdown @returns {import('./types.mjs').MarkdownTable[]} */
export function markdownTables(markdown) {
  const lines=markdown.split('\n'),tables=[];let fence=false;
  for(let i=0;i<lines.length-1;i++){
    const line=lines[i]??'',next=lines[i+1]??'';
    if(/^\s*(```|~~~)/u.test(line)){fence=!fence;continue;}
    const headers=tableCells(line),separator=tableCells(next);
    if(fence||!line.trimStart().startsWith('|')||separator.length!==headers.length||!separator.every(cell=>/^:?-{3,}:?$/u.test(cell)))continue;
    /** @type {import('./types.mjs').TableRow[]} */
    const rows=[];i+=2;
    for(;i<lines.length&&(lines[i]??'').trimStart().startsWith('|');i++){
      const cells=tableCells(lines[i]??'');
      // Historical prose tables can have extra cells; preserve them rather than drop or relabel text.
      rows.push({line:i+1,cells});
    }
    tables.push({headers,rows});i--;
  }
  return tables;
}
/** @param {string} markdown @returns {import('./types.mjs').TextSection[]} */
export function markdownSections(markdown) {
  const lines=markdown.split('\n');let fence=false;
  /** @type {{title:string;line:number;start:number;level:number}[]} */
  const headings=[];
  for(let i=0;i<lines.length;i++){
    const text=lines[i]??'';
    if(/^\s*(```|~~~)/u.test(text)){fence=!fence;continue;}
    const match=/^(#{1,6})\s+(.+)$/u.exec(text);
    if(!fence&&match)headings.push({title:match[2],line:i+1,start:i,level:match[1].length});
  }
  return headings.map((row,index)=>{
    const end=headings.slice(index+1).find(next=>next.level<=row.level)?.start??lines.length;
    return {title:row.title,line:row.line,markdown:lines.slice(row.start,end).join('\n').trimEnd()};
  });
}
/** @param {string} markdown @param {readonly import('./types.mjs').Media[]} media @returns {string[]} */
function mentionedMedia(markdown,media){
  return media.filter(row=>{
    const name=row.path.split('/').at(-1)??'';
    if(markdown.includes(name))return true;
    const clip=/^clip-\d+/u.exec(name)?.[0];
    return clip!==undefined&&new RegExp(`${clip}(?![\\d-])`,'u').test(markdown);
  }).map(row=>row.path);
}
/** @param {string} markdown @param {import('./types.mjs').Source} source @param {readonly import('./types.mjs').Media[]} media @returns {import('./types.mjs').Playtest} */
export function parsePlaytest(markdown,source,media){
  const sections=markdownSections(markdown),top=sections.find(row=>/Top 10 problems/iu.test(row.title));
  const setup=sections.find(row=>/Build.*setup/iu.test(row.title))?.markdown??'';
  // Build/version identifiers only: commits mentioned as included fixes are not separate playtest builds.
  const deployments=[...setup.matchAll(/`([a-f\d]{7,40}-[a-z\d]+)`/gu)].map(match=>match[1]);
  const explicit=/\*\*Build:\*\*\s*`([a-f\d]{7,40})`/u.exec(setup)?.[1];
  const builds=[...new Set([...(explicit?[explicit]:[]),...deployments])];
  const findings=[];
  if(top){
    const lines=top.markdown.split('\n'),starts=[];
    for(let i=0;i<lines.length;i++){const match=/^(\d+)\.\s+(.+)$/u.exec(lines[i]??'');if(match)starts.push({index:i,rank:Number(match[1]),title:match[2]});}
    for(let i=0;i<starts.length;i++){
      const row=starts.at(i);if(!row)continue;
      const body=lines.slice(row.index,starts[i+1]?.index??lines.length).join('\n').trimEnd();
      findings.push({rank:row.rank,title:row.title,line:top.line+row.index,markdown:body,media:mentionedMedia(body,media)});
    }
  }
  return {id:source.path.split('/').at(-2)??source.path,source,title:sections[0]?.title??source.path,builds,markdown,findings,tables:markdownTables(markdown),media:media.map(row=>row.path),missing:[...(builds.length > 0?[]:['No build id found in setup']),...(top?[]:['No Top 10 section found'])]};
}
/** @param {string} markdown @param {import('./types.mjs').Source} source @returns {import('./types.mjs').Plan} */
export function parsePlan(markdown,source){
  const lines=markdown.split('\n'),sections=markdownSections(markdown),tables=markdownTables(markdown);
  const stateIndex=lines.findIndex(line=>line.startsWith('**State:**'));
  if(stateIndex===-1)throw new Error('Plan requires a State line');
  const state=lines[stateIndex]??'';
  const effortTable=tables.find(table=>table.headers.join('|')==='|Total|Done|Left|Basis');
  if(!effortTable)throw new Error('Plan requires its dated effort table');
  const contextIndex=lines.findIndex(line=>line.startsWith('Effort by milestone'));
  const effort=effortTable.rows.map(row=>{
    const values=row.cells.slice(1,4).map(cell=>Number(cell.replaceAll(/[≈,\s]/gu,'')));
    const total=values[0]??Number.NaN,done=values[1]??Number.NaN,left=values[2]??Number.NaN;
    if(![total,done,left].every(value=>Number.isFinite(value)&&value>=0)||total===0||done>total||Math.abs(total-done-left)>0.01)throw new Error(`Invalid effort at line ${row.line}`);
    return {milestone:row.cells[0]??'',total,done,left,percent:Math.round(done/total*1000)/10,approximate:row.cells.some(cell=>cell.includes('≈')),basis:row.cells[4]??'',line:row.line};
  });
  /** @type {import('./types.mjs').PlanRow[]} */
  const rows=[],decisions=[];
  // Only canonical tables before handoffs; narrative references never become new work/decision rows.
  const handoff=sections.find(section=>/^Handoff\b/u.test(section.title))?.line??Infinity;
  for(const table of tables)for(const row of table.rows){
    const id=row.cells[0]??'';
    if(row.line>=handoff)continue;
    if(/^SF\d+[a-z]?(?:-[a-z])?$/u.test(id))rows.push({id,...row});
    if(/^G\d+$/u.test(id))decisions.push({id,...row});
  }
  if(rows.length === 0||decisions.length === 0)throw new Error('Plan requires work and decision tables');
  const reportedPercent=[...state.matchAll(/(whole plan|Part A|M[123])\s*≈\s*(\d+(?:\.\d+)?)\s*%/gu)].map(match=>({label:match[1],percent:Number(match[2]),approximate:true}));
  const waitingForJake=[...rows,...decisions].filter(row=>{
    const text=row.cells.slice(1).join(' ');
    const decision=row.cells[2]??'';
    return /^(?:\*\*)?(?:needs pick\b|waiting for Jake\b|After Jake(?:'s|’s) yes\b)/iu.test(decision) || /\b(?:grid goes public only after his yes|goes public only after Jake(?:'s|’s) yes)\b/iu.test(text);
  });
  return {source,title:sections[0]?.title??source.path,state,stateLine:stateIndex+1,reportedPercent,effort:{context:lines[contextIndex]??'',rows:effort},milestones:sections.filter(section=>/^6\. Done when$/u.test(section.title)),rows,decisions,waitingForJake};
}
