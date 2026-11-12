import {geoContains,geoMercator,geoPath,type GeoProjection} from "d3";
import {DATA,MARK,type ContinentName} from "../data";
import type {Shape,World} from "../geo";
import {framePoints,frameProjection} from "./frame";
import {
  GOLD,INSET_BORDER,LAND_STROKE,NAVY,NEIGHBOUR,NEIGHBOUR_STROKE,OCEAN,TERRITORY,
} from "./palette";

/* ------------------------------------------------------------------ */
/* Scene: the main map plus boxed, magnified insets for tiny islands.  */
/* ------------------------------------------------------------------ */

export interface Rect{x:number;y:number;w:number;h:number}
export interface Panel{
  id:string;
  label:string|null;
  rect:Rect|null;            // null = the main map, which fills the whole pane
  P:GeoProjection;
  s0:number;t0:[number,number];
  /** lon/lat box an inset magnifies: [west, south, east, north] */
  box?:[number,number,number,number];
}
export interface Scene{cn:ContinentName;W:number;H:number;panels:Panel[]}

export interface View{k:number;tx:number;ty:number}
export const MAX_ZOOM=16;

type Corner="br"|"bl"|"tr"|"tl";
interface InsetDef{id:string;label:string;box:[number,number,number,number];corners:Corner[]}

/** boxed magnifications: where the islands/micro-states are too small to see or click */
export const INSETS:Partial<Record<ContinentName,InsetDef[]>>={
  "North America":[
    {id:"antilles",label:"Lesser Antilles",box:[-64,10,-58.5,18.5],corners:["br","tr","bl","tl"]},
  ],
  Europe:[
    {id:"micro",label:"Micro-states",box:[0,35.5,15,48.5],corners:["bl","br","tl","tr"]},
  ],
  Africa:[
    {id:"atlantic",label:"Atlantic islands",box:[-25.5,14,-22.5,17.5],corners:["tl","bl","tr","br"]},
    {id:"gulf",label:"Gulf of Guinea",box:[5.5,-0.2,7.8,1.8],corners:["bl","tl","br","tr"]},
    {id:"indian",label:"Indian Ocean",box:[42.5,-22,60,-3],corners:["br","tr","bl","tl"]},
  ],
  Asia:[
    {id:"gulf",label:"Persian Gulf",box:[47.5,23.5,56.5,30.5],corners:["bl","br","tl","tr"]},
    {id:"maldives",label:"Maldives",box:[72.5,-1,74.2,8],corners:["bl","tl","br","tr"]},
    {id:"singapore",label:"Singapore",box:[103.5,1.1,104.2,1.55],corners:["br","tr","bl","tl"]},
  ],
  Oceania:[
    {id:"micronesia",label:"Micronesia",box:[130,-2,175,12],corners:["tl","tr","bl","br"]},
    // wraps the date line so Tuvalu (179°), Samoa and Tonga sit in one box
    {id:"polynesia",label:"Polynesia",box:[168,-23,-168,-5],corners:["br","bl","tr","tl"]},
  ],
};

const MARGIN=14;
const DOT_AREA=30;   // px²: smaller than this in an inset, a country is drawn as a dot
const LABEL_H=20;

/** the main panel's projection with the user's pan/zoom applied (insets never move) */
export function panelProjection(p:Panel,v:View):GeoProjection{
  if(p.rect||v.k===1&&!v.tx&&!v.ty)return p.P.scale(p.s0).translate(p.t0);
  return p.P.scale(p.s0*v.k).translate([p.t0[0]*v.k+v.tx,p.t0[1]*v.k+v.ty]);
}

/** zoom to `nk` keeping screen point (px, py) fixed */
export function zoomView(v:View,px:number,py:number,nk:number):View{
  const k=Math.max(1,Math.min(MAX_ZOOM,nk));
  if(k===1)return{k:1,tx:0,ty:0};
  return{k,tx:px-(k/v.k)*(px-v.tx),ty:py-(k/v.k)*(py-v.ty)};
}

const inRect=(r:Rect,x:number,y:number)=>x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h;
const overlap=(a:Rect,b:Rect)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));

export interface SceneOpts{
  /** top strip kept clear of the map (the quiz bar) */
  top?:number;
  pad?:number;
  /** areas insets should stay out of (a legend, for example) */
  reserved?:Rect[];
}

export function buildScene(world:World,cn:ContinentName,W:number,H:number,o:SceneOpts={}):Scene{
  const pad=o.pad??Math.max(24,Math.min(W,H)*.05);
  const top=o.top??0;
  const P=frameProjection(world,cn,pad,Math.max(pad,top),W-pad,H-pad);
  const main:Panel={id:"main",label:null,rect:null,P,s0:P.scale(),t0:P.translate() as [number,number]};
  const panels:Panel[]=[main];

  const short=H<420||W<480;
  let defs=INSETS[cn]??[];
  // on short/narrow panes, fewer inset boxes so the main map stays usable
  if(short&&defs.length>2)defs=defs.slice(0,2);
  if(defs.length){
    const land=framePoints(world,cn).map(p=>P(p)).filter((q):q is [number,number]=>!!q);
    const placed:Rect[]=[];
    const maxW=Math.max(short?110:150,Math.min(280,W*(short?0.42:0.26)));
    const maxH=Math.max(short?110:140,Math.min(320,H*(short?0.32:0.4)));
    for(const d of defs){
      const [w0,s0,e0,n0]=d.box;
      // centre the Mercator on the box so boxes that cross the date line stay continuous
      const midLon=w0<=e0?(w0+e0)/2:((w0+e0+360)/2+540)%360-180;
      const midLat=(s0+n0)/2;
      const unit=geoMercator().rotate([-midLon,-midLat]).scale(1).translate([0,0]);
      const corners:[number,number][]=[[w0,n0],[e0,n0],[e0,s0],[w0,s0]];
      const ps=corners.map(c=>unit(c)!);
      const aspect=Math.max(.35,(Math.max(...ps.map(p=>p[0]))-Math.min(...ps.map(p=>p[0])))/(Math.max(...ps.map(p=>p[1]))-Math.min(...ps.map(p=>p[1]))));
      // tiny geographic boxes (Singapore, Maldives) stay compact so they don't cover other land
      const span=Math.hypot((w0<=e0?e0-w0:e0+360-w0),(n0-s0));
      const sizeCap=span<3?.55:span<12?.75:1;
      let w=maxW*sizeCap,h=(w-12)/aspect+LABEL_H+8;
      if(h>maxH*sizeCap){h=maxH*sizeCap;w=(h-LABEL_H-8)*aspect+12}
      const at=(c:Corner,k:number):Rect=>{
        const ww=w*k,hh=h*k;
        return{
          x:c[1]==="l"?MARGIN:W-MARGIN-ww,
          y:c[0]==="t"?Math.max(top,0)+MARGIN:H-MARGIN-hh,
          w:ww,h:hh,
        };
      };
      // prefer a corner with no land underneath; shrink until one is found
      let best:Rect|null=null,bestScore=Infinity;
      for(const k of [1,.85,.7,.55,.4]){
        for(const c of d.corners){
          const r=at(c,k);
          let landHits=0;
          for(const q of land)if(inRect(r,q[0],q[1]))landHits++;
          let score=landHits*20+(1-k)*15;
          for(const q of placed)score+=overlap(r,q)*12;
          for(const q of o.reserved??[])score+=overlap(r,q)*12;
          if(score<bestScore){bestScore=score;best=r}
        }
        if(bestScore<20)break; // found a placement that barely touches land
      }
      const rect=best!;
      placed.push(rect);
      const Pi=geoMercator().rotate([-midLon,-midLat]).fitExtent(
        [[rect.x+6,rect.y+LABEL_H],[rect.x+rect.w-6,rect.y+rect.h-6]],
        {type:"MultiPoint",coordinates:corners},
      );
      panels.push({id:d.id,label:d.label,rect,P:Pi,s0:Pi.scale(),t0:Pi.translate() as [number,number],box:d.box});
    }
  }
  return{cn,W,H,panels};
}

/* ----------------------------- helpers ----------------------------- */

const markerCache=new WeakMap<World,Map<ContinentName,{n:string;ll:[number,number]}[]>>();
/** countries that have no polygon in this world (tiny states) get a dot at an approximate location */
export function markersFor(world:World,cn:ContinentName){
  let byCn=markerCache.get(world);
  if(!byCn){byCn=new Map();markerCache.set(world,byCn)}
  let list=byCn.get(cn);
  if(!list){
    const have=new Set(world.shapes.map(s=>s.n));
    list=DATA.filter(d=>d.cn===cn&&!have.has(d.k)&&MARK[d.k]).map(d=>({n:d.k,ll:MARK[d.k]}));
    byCn.set(cn,list);
  }
  return list;
}

export const lonLatBoxOverlaps=boundsOverlapBox;
function boundsOverlapBox(b:Shape["bounds"],box:[number,number,number,number]){
  const [[w,s],[e,n]]=b,[bw,bs,be,bn]=box;
  if(n<bs||s>bn)return false;
  return w<=e?!(e<bw||w>be):(w<=be||e>=bw);
}
const lonLatIn=(b:Shape["bounds"],lon:number,lat:number)=>{
  const [[w,s],[e,n]]=b;
  if(lat<s||lat>n)return false;
  return w<=e?lon>=w&&lon<=e:lon>=w||lon<=e;
};

/** the inset under a screen point, if any */
export const insetAt=(scene:Scene,x:number,y:number)=>scene.panels.find(p=>p.rect&&inRect(p.rect,x,y))??null;

/* ------------------------------ drawing ------------------------------ */

export interface DrawOpts{
  view?:View;
  /** fill for a country of this continent (by data name) */
  fill:(name:string)=>string;
  /** colour laid over a country's fill (answer status, wrong-click flash) */
  overlay?:(name:string)=>string|null;
  /** country drawn navy (the one being asked about) */
  hl?:string|null;
  /** country lifted out of the map (hover link between list and map) */
  emph?:string|null;
}

function roundRect(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){
  c.beginPath();
  c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();
}

function paintPanel(c:CanvasRenderingContext2D,scene:Scene,panel:Panel,world:World,P:GeoProjection,o:DrawOpts){
  const path=geoPath(P,c);
  const inset=!!panel.rect;
  const sw=inset?1.1:.8;
  const shape=(s:Shape,fill:string,stroke:string,lw:number)=>{
    c.beginPath();path(s.feat);c.fillStyle=fill;c.fill();
    c.strokeStyle=stroke;c.lineWidth=lw;c.lineJoin="round";c.stroke();
  };
  const visible=(s:Shape)=>!panel.box||boundsOverlapBox(s.bounds,panel.box);

  // quiet neighbours first, then this continent on top
  for(const s of world.shapes)if(s.cn!==scene.cn&&visible(s))shape(s,NEIGHBOUR,NEIGHBOUR_STROKE,.6);
  for(const s of world.shapes)if(s.cn===scene.cn&&!s.n&&visible(s))shape(s,TERRITORY,NEIGHBOUR_STROKE,.6);
  for(const s of world.shapes){
    if(s.cn!==scene.cn||!s.n||!visible(s))continue;
    const hl=o.hl===s.n;
    shape(s,hl?NAVY:o.fill(s.n),hl?NAVY:LAND_STROKE,hl?1.4:sw);
    const ov=!hl&&o.overlay?.(s.n);
    if(ov){c.fillStyle=ov;c.beginPath();path(s.feat);c.fill()}
  }

  // in an inset, a country still too small to see (Vatican, Monaco…) is drawn as a dot you can click
  if(inset){
    for(const s of world.shapes){
      if(s.cn!==scene.cn||!s.n||!visible(s)||path.area(s.feat)>=DOT_AREA)continue;
      const ctr=path.centroid(s.feat) as [number,number];
      if(!isFinite(ctr[0])||!inRect(panel.rect!,ctr[0],ctr[1]))continue;
      const hl=o.hl===s.n;
      const r=dotR(hl);
      c.beginPath();c.arc(ctr[0],ctr[1],r,0,7);
      c.fillStyle=hl?NAVY:o.fill(s.n);c.fill();
      c.strokeStyle=hl?NAVY:"#64748B";c.lineWidth=1.1;c.stroke();
      const ov=!hl&&o.overlay?.(s.n);
      if(ov){c.beginPath();c.arc(ctr[0],ctr[1],r,0,7);c.fillStyle=ov;c.fill()}
    }
  }

  const onPanel=(p:[number,number]|null)=>!!p&&isFinite(p[0])&&isFinite(p[1])&&(panel.rect
    ?inRect(panel.rect,p[0],p[1])
    :p[0]>-10&&p[0]<scene.W+10&&p[1]>-10&&p[1]<scene.H+10);
  let ring:[number,number]|null=null;
  for(const mk of markersFor(world,scene.cn)){
    const p=P(mk.ll) as [number,number]|null;
    if(!onPanel(p))continue;
    const hl=o.hl===mk.n;
    const r=dotR(hl);
    c.beginPath();c.arc(p![0],p![1],r,0,7);
    c.fillStyle=hl?NAVY:o.fill(mk.n);c.fill();
    c.strokeStyle=hl?NAVY:"#64748B";c.lineWidth=1;c.stroke();
    const ov=!hl&&o.overlay?.(mk.n);
    if(ov){c.beginPath();c.arc(p![0],p![1],r,0,7);c.fillStyle=ov;c.fill()}
    if(hl&&!inset)ring=p;
  }

  // a highlighted country too small to see on the main map still gets a ring (insets cover most)
  if(o.hl&&!inset){
    const hs=world.shapes.filter(s=>s.n===o.hl&&s.cn===scene.cn);
    if(hs.length){
      const area=hs.reduce((a,s)=>a+path.area(s.feat),0);
      if(area<40){
        const big=hs.reduce((a,b)=>path.area(a.feat)>=path.area(b.feat)?a:b);
        const ctr=path.centroid(big.feat) as [number,number];
        const inInset=scene.panels.some(p=>p.box&&big.bounds&&boundsOverlapBox(big.bounds,p.box));
        if(isFinite(ctr[0])&&!inInset)ring=ctr;
      }
    }
  }
  if(ring&&isFinite(ring[0])){
    c.beginPath();c.arc(ring[0],ring[1],13,0,7);c.strokeStyle=GOLD;c.lineWidth=2.2;c.stroke();
  }

  // lift the hovered country out of the map
  if(o.emph){
    const es=world.shapes.filter(s=>s.n===o.emph&&s.cn===scene.cn&&visible(s));
    c.save();
    c.shadowColor="rgba(0,48,87,.45)";c.shadowBlur=14;c.shadowOffsetY=3;
    for(const s of es)shape(s,o.hl===s.n?NAVY:o.fill(o.emph),NAVY,2.2);
    c.restore();
    for(const s of es){
      const ov=o.overlay?.(o.emph);
      if(ov){c.fillStyle=ov;c.beginPath();path(s.feat);c.fill()}
      c.beginPath();path(s.feat);c.strokeStyle=NAVY;c.lineWidth=2;c.stroke();
    }
    if(inset)for(const s of es){
      if(path.area(s.feat)>=DOT_AREA)continue;
      const ctr=path.centroid(s.feat) as [number,number];
      if(isFinite(ctr[0])){c.beginPath();c.arc(ctr[0],ctr[1],8,0,7);c.strokeStyle=NAVY;c.lineWidth=2.4;c.stroke()}
    }
    for(const mk of markersFor(world,scene.cn)){
      if(mk.n!==o.emph)continue;
      const p=P(mk.ll) as [number,number]|null;
      if(!onPanel(p))continue;
      c.beginPath();c.arc(p![0],p![1],8,0,7);c.strokeStyle=NAVY;c.lineWidth=2.4;c.stroke();
    }
  }
}

/** draw the ocean, the main map, then each inset box */
export function drawScene(c:CanvasRenderingContext2D,scene:Scene,world:World,o:DrawOpts){
  const view=o.view??{k:1,tx:0,ty:0};
  c.clearRect(0,0,scene.W,scene.H);
  c.fillStyle=OCEAN;c.fillRect(0,0,scene.W,scene.H);
  for(const panel of scene.panels){
    const P=panelProjection(panel,view);
    c.save();
    if(panel.rect){
      const r=panel.rect;
      roundRect(c,r.x,r.y,r.w,r.h,12);
      c.shadowColor="rgba(15,23,42,.18)";c.shadowBlur=18;c.shadowOffsetY=4;
      c.fillStyle=OCEAN;c.fill();
      c.shadowColor="transparent";
      c.clip();
    }
    paintPanel(c,scene,panel,world,P,o);
    if(panel.rect){
      // title strip, so the label never sits on top of land
      const r=panel.rect;
      c.fillStyle=OCEAN;c.fillRect(r.x,r.y,r.w,LABEL_H);
      c.beginPath();c.moveTo(r.x,r.y+LABEL_H);c.lineTo(r.x+r.w,r.y+LABEL_H);
      c.strokeStyle="rgba(100,116,139,.35)";c.lineWidth=1;c.stroke();
    }
    c.restore();
    if(panel.rect){
      const r=panel.rect;
      roundRect(c,r.x,r.y,r.w,r.h,12);
      c.strokeStyle=INSET_BORDER;c.lineWidth=1.4;c.stroke();
      if(panel.label){
        c.font="600 11px Inter,system-ui,sans-serif";c.textBaseline="middle";
        c.fillStyle="#475569";c.fillText(panel.label.toUpperCase(),r.x+10,r.y+LABEL_H/2+1);
      }
    }
  }
}

/* ------------------------------ hit testing ------------------------------ */

const coarsePointer=()=>typeof matchMedia==="function"&&matchMedia("(pointer: coarse)").matches;
const markerHit=()=>coarsePointer()?20:10;
const nearHit=()=>coarsePointer()?20:10;
const dotR=(hl:boolean)=>coarsePointer()?(hl?9:7.5):(hl?6:4.5);

function hitPanel(world:World,scene:Scene,panel:Panel,P:GeoProjection,x:number,y:number):string|null{
  const ll=P.invert?.([x,y]);
  if(ll&&isFinite(ll[0])&&isFinite(ll[1])){
    for(const s of world.shapes){
      if(s.cn!==scene.cn||!s.n||!lonLatIn(s.bounds,ll[0],ll[1]))continue;
      if(geoContains(s.feat as any,ll))return s.n;
    }
  }
  // micro-states drawn as dots
  let best:string|null=null,bd=markerHit();
  for(const mk of markersFor(world,scene.cn)){
    const p=P(mk.ll) as [number,number]|null;
    if(!p)continue;
    const d=Math.hypot(p[0]-x,p[1]-y);
    if(d<bd){bd=d;best=mk.n}
  }
  if(best)return best;
  // a few pixels off a very small island still counts
  const path=geoPath(P);
  bd=nearHit();
  for(const s of world.shapes){
    if(s.cn!==scene.cn||!s.n)continue;
    if(panel.box&&!boundsOverlapBox(s.bounds,panel.box))continue;
    if(path.area(s.feat)>80)continue;
    const c=path.centroid(s.feat);
    if(!isFinite(c[0]))continue;
    const d=Math.hypot(c[0]-x,c[1]-y);
    if(d<bd){bd=d;best=s.n}
  }
  return best;
}

/** which country (by data name) is at screen point (x, y)? Insets are checked first. */
export function hitScene(world:World,scene:Scene,view:View,x:number,y:number):string|null{
  const ins=insetAt(scene,x,y);
  if(ins)return hitPanel(world,scene,ins,ins.P,x,y);
  const main=scene.panels[0];
  return hitPanel(world,scene,main,panelProjection(main,view),x,y);
}
