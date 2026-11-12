import {geoCentroid,geoContains} from "d3";
import {MARK} from "../src/data";
import type {World} from "../src/geo";
import {hitTest,panelProjection,type Scene,type View} from "../src/map/find";
import {lonLatBoxOverlaps,markersFor} from "../src/map/scene";

function eachPoly(geom:any):[number,number][][][]{
  if(!geom)return[];
  if(geom.type==="Polygon")return[geom.coordinates];
  if(geom.type==="MultiPolygon")return geom.coordinates;
  return[];
}

/** a screen point that really lands on `name` (inset first when the country lives in one) */
export function clickPointFor(world:World,scene:Scene,view:View,name:string):{p:[number,number];panel:string}{
  const shapes=world.shapes.filter(s=>s.n===name&&s.cn===scene.cn);
  const mark=markersFor(world,scene.cn).find(m=>m.n===name)||(MARK[name]?{n:name,ll:MARK[name] as [number,number]}:null);
  const lls:[number,number][]=[];
  for(const s of shapes){
    for(const coords of eachPoly(s.feat.geometry)){
      const feat={type:"Feature",properties:{},geometry:{type:"Polygon",coordinates:coords}};
      const c=geoCentroid(feat as any) as [number,number];
      if(geoContains(feat as any,c))lls.push(c);
      const ring=coords[0];
      const step=Math.max(1,Math.floor(ring.length/8));
      for(let i=0;i<ring.length;i+=step)lls.push(ring[i]);
    }
    const [[w,so],[e,n]]=s.bounds;
    if(e>=w&&e-w<90){
      for(let i=1;i<12;i++)for(let j=1;j<12;j++){
        const ll:[number,number]=[w+(e-w)*i/12,so+(n-so)*j/12];
        if(geoContains(s.feat as any,ll))lls.push(ll);
      }
    }
  }
  if(mark)lls.push(mark.ll);

  const panels=[...scene.panels.slice(1),scene.panels[0]];
  for(const panel of panels){
    if(panel.box){
      const inBox=shapes.some(s=>lonLatBoxOverlaps(s.bounds,panel.box!))
        ||(mark?lonLatBoxOverlaps([[mark.ll[0],mark.ll[1]],[mark.ll[0],mark.ll[1]]],panel.box):false);
      if(!inBox)continue;
    }
    const P=panelProjection(panel,view);
    for(const ll of lls){
      const p=P(ll) as [number,number]|null;
      if(!p||!isFinite(p[0]))continue;
      if(panel.rect&&(p[0]<panel.rect.x+2||p[0]>panel.rect.x+panel.rect.w-2||p[1]<panel.rect.y+2||p[1]>panel.rect.y+panel.rect.h-2))continue;
      if(!panel.rect&&(p[0]<0||p[0]>scene.W||p[1]<0||p[1]>scene.H))continue;
      if(hitTest(world,scene,view,p[0],p[1])===name)return{p,panel:panel.id};
    }
  }
  throw new Error("no click point for "+name);
}
