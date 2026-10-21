/** Numeric identities come from the admitted catalogue. -1 denotes an
 * omitted optional selector; an unknown observation has a distinct id. */
@inline export function contractTag(kind:f64,variant:f64,label:f64,wantKind:f64,wantVariant:f64,wantLabel:f64):bool {
  return (wantKind<0||wantKind==kind)&&(wantVariant<0||wantVariant==variant)&&(wantLabel<0||wantLabel==label);
}
/** A named target is identity-only; labels never create an elite. */
@inline export function contractElite(kind:f64,variant:f64,wantKind:f64,wantVariant:f64):bool {
  return kind==wantKind&&variant==wantVariant;
}
/** The ABI receives normalized identities/ranks and numeric observations;
 * every exclusion and boundary decision stays in this authored guest. */
@inline export function contractCounts(match:i32,target:f64,kind:f64,elite:f64,hasTag:bool,excludedTag:bool,excludeElite:bool,
 observedRank:f64,targetRank:f64,knownTargetRank:bool,below:f64):bool {
  if(excludedTag||(excludeElite&&elite!=-1))return false;
  if(match==0)return kind==target;
  if(match==1)return elite==target;
  if(match==2)return hasTag;
  return knownTargetRank&&observedRank>=targetRank&&(below<0||observedRank<below);
}
@inline export function contractProgress(have:f64,need:f64,counts:bool):f64 {
  return have<need&&counts?have+1:have;
}
@inline export function contractLoadedProgress(have:f64,need:f64):f64 {
  return Math.max(0,Math.min(need,Math.floor(have)));
}
/** The page picker uses a strict spherical prompt radius. */
@inline export function contractNear(x:f64,y:f64,z:f64,px:f64,py:f64,pz:f64,radius:f64):bool {
  const dx=x-px,dy=y-py,dz=z-pz;
  return Math.sqrt(dx*dx+dy*dy+dz*dz)<radius;
}
