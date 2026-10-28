import observed from '../data/spawnPackDemand.json' with {type:'json'};

interface Member {
  readonly hash: string;
  readonly name: string | null;
  readonly bytes: number;
  readonly phase: string;
  readonly firstReadMs: number | null;
  readonly paths: readonly string[];
}
interface Observation {
  readonly schema: string;
  readonly source: {readonly sha: string; readonly indexSha256: string};
  readonly window: {readonly controlMs: number; readonly playMs: number; readonly frames: number; readonly throughMs: number};
  readonly demanded: readonly {readonly hash: string; readonly firstReadMs: number; readonly paths: readonly string[]}[];
  readonly groups: readonly {readonly hash: string; readonly bytes: number; readonly members: readonly Member[]}[];
}
interface File {
  readonly name?: string;
  readonly hash: string;
  readonly compressed: number;
  readonly critical: boolean;
}

/** Only exact, measured unread named members enter the existing deferred-pack
 * phase. New revisions, aliases and critical readers keep eager admission.
 * No blob, consumer binding, material or cost record is changed here. */
export function nalatiSpawnPackLateNames(files: readonly File[], profile: Observation = observed): readonly string[] {
  const hash=/^[a-f0-9]{64}$/u;
  if(profile.schema!=='wildshard-spawn-pack-demand/1'||!/^[a-f0-9]{40}$/u.test(profile.source.sha)
    ||!hash.test(profile.source.indexSha256)||!Number.isFinite(profile.window.playMs)||profile.window.playMs<30000
    ||!Number.isSafeInteger(profile.window.frames)||profile.window.frames<=0
    ||!Number.isFinite(profile.window.throughMs)||profile.window.throughMs<profile.window.playMs
    ||!Number.isFinite(profile.window.controlMs)||profile.window.controlMs<0)throw new Error('Incomplete spawn pack observation');
  const demands=new Map<string,Observation['demanded'][number]>();
  for(const row of profile.demanded){
    if(!hash.test(row.hash)||demands.has(row.hash)||!Number.isFinite(row.firstReadMs)||row.firstReadMs>profile.window.throughMs
      ||row.paths.length===0||row.paths.some(path=>path!=='read'&&path!=='retained'&&path!=='url'))throw new Error('Invalid spawn consumer journal');
    demands.set(row.hash,row);
  }
  const seen=new Set<string>(),late:string[]=[];
  for(const group of profile.groups){
    if(!hash.test(group.hash)||group.members.reduce((sum,row)=>sum+row.bytes,0)!==group.bytes)throw new Error('Invalid observed pack inventory');
    for(const row of group.members){
      if(!hash.test(row.hash)||seen.has(row.hash)||!Number.isSafeInteger(row.bytes)||row.bytes<0)throw new Error('Invalid observed pack member');
      seen.add(row.hash);
      const demand=demands.get(row.hash);
      if(row.phase==='unread'){
        if(row.firstReadMs!==null||row.paths.length>0||demand!==undefined)throw new Error('Unread member has a consumer');
      }else if(!['control','first30'].includes(row.phase)||row.firstReadMs===null||!Number.isFinite(row.firstReadMs)
        ||row.firstReadMs>profile.window.throughMs||row.paths.length===0||demand?.firstReadMs!==row.firstReadMs
        ||row.paths.join(',')!==demand.paths.join(',')
        ||(row.firstReadMs<=profile.window.controlMs)!==(row.phase==='control'))throw new Error('Missing observed consumer');
      if(row.phase!=='unread'||row.name===null)continue;
      const aliases=files.filter(file=>file.hash===row.hash);
      if(aliases.length>0&&aliases.every(file=>file.name===row.name&&file.compressed===row.bytes&&!file.critical))late.push(row.name);
    }
  }
  return late.sort();
}
