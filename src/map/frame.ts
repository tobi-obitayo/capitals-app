import {geoAzimuthalEqualArea,geoConicEqualArea,geoNaturalEarth1,type GeoProjection} from "d3";
import {ALL,MARK,MINI,type Scope} from "../data";
import type {World} from "../geo";

type LL=[number,number];

/**
 * One undistorted (equal-area) projection per continent, so countries keep their real shapes.
 * Azimuthal ones are centred on the continent; conic ones suit the wide east-west continents.
 */
const PROJECTIONS:Record<Scope,()=>GeoProjection>={
  World:()=>geoNaturalEarth1(),
  "North America":()=>geoAzimuthalEqualArea().rotate([100,-50]).clipAngle(105),
  "South America":()=>geoAzimuthalEqualArea().rotate([60,20]).clipAngle(105),
  Africa:()=>geoAzimuthalEqualArea().rotate([-20,-5]).clipAngle(105),
  Europe:()=>geoConicEqualArea().parallels([38,62]).rotate([-15,0]),
  Asia:()=>geoConicEqualArea().parallels([12,52]).rotate([-88,0]),
  Oceania:()=>geoAzimuthalEqualArea().rotate([-160,25]).clipAngle(105),
};
export const makeProjection=(cn:Scope)=>PROJECTIONS[cn]();

/** is lon/lat inside the continent's framing box? (the box may wrap the date line, e.g. Oceania) */
export function boxTest(cn:Scope){
  const c=MINI[cn];
  const lats=c.map(p=>p[1]);
  // corners are given as [W,N],[E,N],[E,S],[W,S]; west/east are the first two longitudes
  const west=c[0][0],east=c[1][0];
  const s=Math.min(...lats),n=Math.max(...lats);
  return(lon:number,lat:number)=>lat>=s&&lat<=n&&(west<=east?lon>=west&&lon<=east:lon>=west||lon<=east);
}

function eachVertex(coords:any,fn:(p:LL)=>void){
  if(typeof coords[0]==="number")fn(coords as LL);
  else for(const c of coords)eachVertex(c,fn);
}

const ptsCache=new WeakMap<World,Map<string,LL[]>>();
/** every land vertex of the continent (or world) that lies inside its framing box, plus dots for micro-states */
export function framePoints(world:World,cn:Scope):LL[]{
  let byCn=ptsCache.get(world);
  if(!byCn){byCn=new Map();ptsCache.set(world,byCn)}
  let pts=byCn.get(cn);
  if(pts)return pts;
  const inBox=boxTest(cn);
  const out:LL[]=[];
  for(const s of world.shapes){
    // framing uses each shape's home continent only, so the frame doesn't move with the settings
    if(cn==="World"?s.cn==="Antarctica":s.cn!==cn)continue;
    eachVertex((s.feat.geometry as any).coordinates,p=>{if(inBox(p[0],p[1]))out.push(p)});
  }
  const have=new Set(world.shapes.map(s=>s.n));
  for(const d of ALL)if((cn==="World"||d.cn===cn)&&!have.has(d.k)&&MARK[d.k]&&inBox(MARK[d.k][0],MARK[d.k][1]))out.push(MARK[d.k]);
  byCn.set(cn,out);
  return out;
}

/**
 * The continent's projection, scaled to fit its land in [x0,y0]–[x1,y1] and centred there.
 * (Anything outside the framing box, such as eastern Russia on the Europe map, runs off the edge.)
 */
export function frameProjection(world:World,cn:Scope,x0:number,y0:number,x1:number,y1:number):GeoProjection{
  const P=makeProjection(cn);
  const s0=P.scale(),t0=P.translate();
  let minx=Infinity,miny=Infinity,maxx=-Infinity,maxy=-Infinity;
  for(const p of framePoints(world,cn)){
    const q=P(p);
    if(!q)continue;
    if(q[0]<minx)minx=q[0];if(q[0]>maxx)maxx=q[0];
    if(q[1]<miny)miny=q[1];if(q[1]>maxy)maxy=q[1];
  }
  if(!isFinite(minx))return P.fitExtent([[x0,y0],[x1,y1]],{type:"MultiPoint",coordinates:MINI[cn]});
  const k=Math.min((x1-x0)/(maxx-minx),(y1-y0)/(maxy-miny));
  const s=s0*k;
  // projected = s*u + t with u fixed, so put the middle of the land on the middle of the target
  const ux=((minx+maxx)/2-t0[0])/s0,uy=((miny+maxy)/2-t0[1])/s0;
  return P.scale(s).translate([(x0+x1)/2-s*ux,(y0+y1)/2-s*uy]);
}
