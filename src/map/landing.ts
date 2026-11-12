import {geoPath,geoGraticule10,geoContains,type GeoProjection} from "d3";
import {CONT_NAMES,type ContinentName} from "../data";
import type {World} from "../geo";

const graticule=geoGraticule10();

export interface LandingDraw{
  W:number;H:number;
  view:"globe"|"flat";
  proj:GeoProjection;
  /** continent currently hovered / highlighted */
  hover:ContinentName|null;
  /** 0..1 share of a continent you have learned, drives the navy tint */
  frac:(cn:ContinentName)=>number;
}

export function drawLanding(ctx:CanvasRenderingContext2D,world:World,o:LandingDraw){
  const {W,H,proj}=o;
  ctx.clearRect(0,0,W,H);
  if(!world.continents)return;
  const path=geoPath(proj,ctx);
  if(o.view==="globe"){
    ctx.beginPath();path({type:"Sphere"});ctx.fillStyle="#F6F8FB";ctx.fill();
    ctx.beginPath();path(graticule);ctx.strokeStyle="#E3E8EF";ctx.lineWidth=.5;ctx.stroke();
  }
  for(const c of world.continents){
    ctx.beginPath();path(c.geo);ctx.fillStyle=c.name==="Antarctica"?"#F1F4F8":"#FFFFFF";ctx.fill();
    if(c.name==="Antarctica")continue;
    const f=o.frac(c.name);
    if(f>0){ctx.fillStyle=`rgba(0,48,87,${.1+.6*f})`;ctx.fill()}
    if(o.hover===c.name){ctx.fillStyle="rgba(179,163,105,.42)";ctx.fill()}
  }
  ctx.beginPath();path(world.innerMesh!);ctx.strokeStyle="#CBD3DD";ctx.lineWidth=.6;ctx.stroke();
  ctx.beginPath();path(world.contMesh!);ctx.strokeStyle="#1E293B";ctx.lineWidth=1;ctx.lineJoin="round";ctx.stroke();
  if(o.view==="globe"){ctx.beginPath();path({type:"Sphere"});ctx.strokeStyle="#1E293B";ctx.lineWidth=1.2;ctx.stroke()}
}

/** which continent is under screen point (x, y), or null */
export function pickContinent(world:World,proj:GeoProjection,view:"globe"|"flat",x:number,y:number):ContinentName|null{
  const ll=proj.invert?.([x,y]);
  if(!ll||!isFinite(ll[0])||!isFinite(ll[1]))return null;
  if(view==="globe"){
    const [tx,ty]=proj.translate(),r=proj.scale();
    if((x-tx)**2+(y-ty)**2>r*r)return null;
  }
  for(const c of world.continents??[]){
    if(c.name!=="Antarctica"&&geoContains(c.geo as any,ll))return c.name as ContinentName;
  }
  return null;
}
export const isContinent=(n:string):n is ContinentName=>(CONT_NAMES as readonly string[]).includes(n);

/* quaternion (trackball) rotation so the globe can be dragged around every axis */
const R=Math.PI/180;
type Q=[number,number,number,number];
type V3=[number,number,number];
export const vq={
  fromEuler(e:number[]):Q{
    const l=e[0]/2*R,p=e[1]/2*R,g=(e[2]||0)/2*R;
    const sl=Math.sin(l),cl=Math.cos(l),sp=Math.sin(p),cp=Math.cos(p),sg=Math.sin(g),cg=Math.cos(g);
    return[cl*cp*cg+sl*sp*sg,sl*cp*cg-cl*sp*sg,cl*sp*cg+sl*cp*sg,cl*cp*sg-sl*sp*cg];
  },
  cart(e:number[]):V3{const l=e[0]*R,p=e[1]*R,cp=Math.cos(p);return[cp*Math.cos(l),cp*Math.sin(l),Math.sin(p)]},
  toEuler(q:Q):[number,number,number]{
    return[
      Math.atan2(2*(q[0]*q[1]+q[2]*q[3]),1-2*(q[1]*q[1]+q[2]*q[2]))/R,
      Math.asin(Math.max(-1,Math.min(1,2*(q[0]*q[2]-q[3]*q[1]))))/R,
      Math.atan2(2*(q[0]*q[3]+q[1]*q[2]),1-2*(q[2]*q[2]+q[3]*q[3]))/R,
    ];
  },
  delta(a:V3,b:V3):Q{
    const w:V3=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
    const l=Math.hypot(...w);if(!l)return[1,0,0,0];
    const t=Math.acos(Math.max(-1,Math.min(1,a[0]*b[0]+a[1]*b[1]+a[2]*b[2])))/2,s=Math.sin(t)/l;
    return[Math.cos(t),w[2]*s,-w[1]*s,w[0]*s];
  },
  mul(a:Q,b:Q):Q{
    return[
      a[0]*b[0]-a[1]*b[1]-a[2]*b[2]-a[3]*b[3],
      a[0]*b[1]+a[1]*b[0]+a[2]*b[3]-a[3]*b[2],
      a[0]*b[2]-a[1]*b[3]+a[2]*b[0]+a[3]*b[1],
      a[0]*b[3]+a[1]*b[2]-a[2]*b[1]+a[3]*b[0],
    ];
  },
};
