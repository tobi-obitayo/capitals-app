import {geoContains,geoMercator,geoPath,type GeoProjection} from "d3";
import {MARK,type Scope} from "../data";
import {countriesIn,getSettings,shapeInScope} from "../sets";
import type {Shape,World} from "../geo";
import {framePoints,frameProjection} from "./frame";
import {recorder,type Box} from "./flatcache";
import {DEFAULT_LOOK,GOLD,INSET_BORDER,NAVY,OCEANIA_LOOK,type Look} from "./palette";

/** the colours a scope is painted with */
export const lookOf=(cn:Scope):Look=>cn==="Oceania"?OCEANIA_LOOK:DEFAULT_LOOK;

/* ------------------------------------------------------------------ */
/* Scene: the main map plus boxed, magnified insets for tiny islands.  */
/* ------------------------------------------------------------------ */

export interface Rect{x:number;y:number;w:number;h:number}
export interface Panel{
  id:string;
  label:string|null;
  short?:string;
  rect:Rect|null;            // null = the main map, which fills the whole pane
  P:GeoProjection;
  s0:number;t0:[number,number];
  /** lon/lat box an inset magnifies: [west, south, east, north] */
  box?:[number,number,number,number];
}
export interface Scene{cn:Scope;W:number;H:number;panels:Panel[]}

export interface View{k:number;tx:number;ty:number}
export const MAX_ZOOM=16;

type Corner="br"|"bl"|"tr"|"tl";
interface InsetDef{
  id:string;label:string;
  /** shorter title used when the full one doesn't fit the box width */
  short?:string;
  box:[number,number,number,number];corners:Corner[];
  /** multiply the usual inset size (crowded island chains need more room) */
  boost?:number;
  /** same, on short or narrow panes (phones), where the map is smallest and islands hardest to hit */
  shortBoost?:number;
  /** shrink the usual inset size (a single country that needs little room) */
  shrink?:number;
}

/** boxed magnifications: where the islands/micro-states are too small to see or click */
export const INSETS:Partial<Record<Scope,InsetDef[]>>={
  "North America":[
    // padded lon/lat box + boost so St Kitts→Trinidad stay tappable on phones
    {id:"antilles",label:"Lesser Antilles",short:"Antilles",box:[-64.8,9.2,-57.8,18.9],corners:["br","tr","bl","tl"],boost:1.45},
  ],
  Europe:[
    {id:"micro",label:"Micro-states",short:"Micro",box:[0,35.5,15,48.5],corners:["bl","br","tl","tr"]},
    // Vatican City and San Marino are specks inside Italy: a close-up of just that stretch
    {id:"rome",label:"Rome & San Marino",short:"Rome",box:[11.4,41.3,13.5,44.4],corners:["br","tr","bl","tl"]},
  ],
  Africa:[
    {id:"atlantic",label:"Atlantic islands",short:"Atlantic",box:[-25.5,14,-22.5,17.5],corners:["tl","bl","tr","br"]},
    {id:"gulf",label:"Gulf of Guinea",short:"G. of Guinea",box:[5.5,-0.2,7.8,1.8],corners:["bl","tl","br","tr"]},
    {id:"indian",label:"Indian Ocean",short:"Indian Oc.",box:[42.5,-22,60,-3],corners:["br","tr","bl","tl"]},
  ],
  Asia:[
    {id:"gulf",label:"Persian Gulf",short:"Gulf",box:[47.5,23.5,56.5,30.5],corners:["bl","br","tl","tr"]},
    {id:"maldives",label:"Maldives",box:[72.5,-1,74.2,8],corners:["bl","tl","br","tr"],shrink:.65},
    {id:"singapore",label:"Singapore",box:[103.5,1.1,104.2,1.55],corners:["br","tr","bl","tl"]},
  ],
  Oceania:[
    // most Oceania countries are specks, so on phones both boxes are drawn much larger than usual
    {id:"micronesia",label:"Micronesia",box:[130,-2,175,12],corners:["tl","tr","bl","br"],shortBoost:1.5},
    // wraps the date line so Tuvalu (179°), Samoa, Tonga, Niue and the Cook Islands sit in one box
    {id:"polynesia",label:"Polynesia",box:[168,-23,-157,-5],corners:["br","bl","tr","tl"],shortBoost:1.5},
  ],
  // the world pane is mostly ocean, so only the crowded chains get a box; the rest are reached by zooming
  World:[
    {id:"antilles",label:"Lesser Antilles",short:"Antilles",box:[-64.8,9.2,-57.8,18.9],corners:["bl","tl","br","tr"]},
    {id:"micro",label:"Micro-states",short:"Micro",box:[0,35.5,15,48.5],corners:["tr","tl","br","bl"]},
    {id:"polynesia",label:"Polynesia",box:[168,-23,-157,-5],corners:["br","bl","tr","tl"]},
  ],
};

const MARGIN=14;
const DOT_AREA=30;   // px²: smaller than this in an inset, a country is drawn as a dot
const MAIN_DOT_AREA=60;   // the same on the main map, where a scope's look asks for it (Oceania)
const LABEL_H=20;

/**
 * inset title that fits `maxW`: the full label, else the short one, else the short one cut with an ellipsis.
 * `measure` returns the pixel width of a string in the font the title is drawn with.
 */
export function fitLabel(measure:(t:string)=>number,label:string,short:string|undefined,maxW:number):string{
  const full=label.toUpperCase();
  if(measure(full)<=maxW)return full;
  const sh=short?.toUpperCase();
  if(sh&&measure(sh)<=maxW)return sh;
  let t=sh??full;
  while(t.length>1&&measure(t+"…")>maxW)t=t.slice(0,-1);
  return t.trimEnd()+"…";
}

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
  /** world map on a tall (portrait) pane: draw it up to 2.4x the pane's width (pan sideways) instead of a small strip */
  cover?:boolean;
}

export function buildScene(world:World,cn:Scope,W:number,H:number,o:SceneOpts={}):Scene{
  const pad=o.pad??Math.max(24,Math.min(W,H)*.05);
  const top=o.top??0;
  const y0=Math.max(pad,top);
  const P=frameProjection(world,cn,pad,y0,W-pad,H-pad);
  if(cn==="World"&&o.cover&&H>W*.9){
    // the fitted world is wide and short; on a tall pane grow it (up to 2.4x) around the pane's centre
    const used=P([0,84]),usedB=P([0,-58]);
    const hUsed=used&&usedB?usedB[1]-used[1]:0;
    const f=hUsed>0?Math.min(2.4,(H-pad-y0)/hUsed):1;
    if(f>1.15){
      const c:[number,number]=[W/2,(y0+H-pad)/2],t=P.translate();
      P.scale(P.scale()*f).translate([c[0]+f*(t[0]-c[0]),c[1]+f*(t[1]-c[1])]);
    }
  }
  const main:Panel={id:"main",label:null,rect:null,P,s0:P.scale(),t0:P.translate() as [number,number]};
  const panels:Panel[]=[main];

  const short=H<420||W<480;
  let defs=INSETS[cn]??[];
  // on short/narrow panes, fewer inset boxes so the main map stays usable
  if(short&&defs.length>2)defs=defs.slice(0,2);
  // phones: the world map is small enough already, so no boxes on top of it (pinch to zoom instead)
  if(cn==="World"&&short)defs=[];
  if(defs.length){
    const land=framePoints(world,cn).map(p=>P(p)).filter((q):q is [number,number]=>!!q);
    const placed:Rect[]=[];
    const maxW0=Math.max(short?110:150,Math.min(280,W*(short?0.42:0.26)));
    const maxH0=Math.max(short?110:140,Math.min(320,H*(short?0.32:0.4)));
    for(const d of defs){
      const boost=(short?d.shortBoost:undefined)??d.boost??1;
      const maxW=Math.min(W-MARGIN*2,maxW0*boost);
      const maxH=Math.min(H-MARGIN*2-Math.max(top,0),maxH0*boost);
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
      const sizeCap=(d.boost?1:span<3?.55:span<12?.75:1)*(d.shrink??1);
      let w=maxW*sizeCap,h=(w-12)/aspect+LABEL_H+8;
      if(h>maxH*sizeCap){h=maxH*sizeCap;w=(h-LABEL_H-8)*aspect+12}
      if(d.shrink)w=Math.max(w,78);   // still wide enough for its title
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
      panels.push({id:d.id,label:d.label,short:d.short,rect,P:Pi,s0:Pi.scale(),t0:Pi.translate() as [number,number],box:d.box});
    }
  }
  return{cn,W,H,panels};
}

/* ----------------------------- helpers ----------------------------- */

const markerCache=new WeakMap<World,Map<string,{n:string;ll:[number,number]}[]>>();
/** countries that have no polygon in this world (tiny states) get a dot at an approximate location */
export function markersFor(world:World,cn:Scope){
  let byCn=markerCache.get(world);
  if(!byCn){byCn=new Map();markerCache.set(world,byCn)}
  const key=cn+"|"+getSettings().set+"|"+getSettings().cross;
  let list=byCn.get(key);
  if(!list){
    const have=new Set(world.shapes.map(s=>s.n));
    list=countriesIn(cn).filter(d=>!have.has(d.k)&&MARK[d.k]).map(d=>({n:d.k,ll:MARK[d.k]}));
    byCn.set(key,list);
  }
  return list;
}

export const lonLatBoxOverlaps=boundsOverlapBox;
function boundsOverlapBox(b:Shape["bounds"],box:[number,number,number,number]){
  const [[w,s],[e,n]]=b,[bw,bs,be,bn]=box;
  if(n<bs||s>bn)return false;
  // either longitude range (either may wrap the date line) contains the other's west edge
  const within=(lon:number,from:number,to:number)=>from<=to?lon>=from&&lon<=to:lon>=from||lon<=to;
  return within(w,bw,be)||within(bw,w,e);
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

/* ---------------- cached, projected outlines (one per panel) ---------------- */

/**
 * Projecting a continent's outlines through d3 is by far the most expensive part of a frame, so each panel is
 * projected once, at its unzoomed layout, into Path2Ds. Pan and zoom then only move the canvas transform:
 *   screen = k * base + (tx, ty)
 * (the main panel's projection is exactly that scale + translate of its base, see panelProjection).
 */
export interface PanelShape{shape:Shape;path:Path2D;box:Box|null;/** unzoomed px² */area:number;/** unzoomed px */ctr:[number,number]|null}
export interface PanelGeo{
  neighbours:Path2D;
  territories:Path2D;
  /** the named countries of this scope that show in this panel */
  countries:PanelShape[];
  byName:Map<string,PanelShape[]>;
}

const UNZOOMED:View={k:1,tx:0,ty:0};
/** resampling precision of the cached outlines: finer than the default so they hold up at MAX_ZOOM */
const PANEL_PRECISION=.12;
const CACHE_MAX=24;
const geoCache=new WeakMap<World,Map<string,PanelGeo>>();

function buildPanelGeo(world:World,cn:Scope,panel:Panel):PanelGeo{
  const P=panelProjection(panel,UNZOOMED);
  const old=P.precision();
  P.precision(PANEL_PRECISION);
  const gp=geoPath(P);
  const visible=(s:Shape)=>!panel.box||boundsOverlapBox(s.bounds,panel.box);
  const group=(keep:(s:Shape)=>boolean)=>{
    const r=recorder();gp.context(r.ctx);
    for(const s of world.shapes)if(keep(s)&&visible(s))gp(s.feat);
    return r.path;
  };
  const neighbours=group(s=>!shapeInScope(s,cn)&&!(cn==="World"&&s.cn==="Antarctica"));
  const territories=group(s=>shapeInScope(s,cn)&&!s.n);
  const countries:PanelShape[]=[],byName=new Map<string,PanelShape[]>();
  for(const s of world.shapes){
    if(!shapeInScope(s,cn)||!s.n||!visible(s))continue;
    const r=recorder();gp.context(r.ctx);gp(s.feat);
    gp.context(null);
    const ctr=gp.centroid(s.feat) as [number,number];
    const e:PanelShape={shape:s,path:r.path,box:r.box(),area:gp.area(s.feat),ctr:isFinite(ctr[0])&&isFinite(ctr[1])?ctr:null};
    countries.push(e);
    const l=byName.get(s.n);
    if(l)l.push(e);else byName.set(s.n,[e]);
  }
  P.precision(old);
  return{neighbours,territories,countries,byName};
}

/** the cached outlines of a panel; rebuilt only when its projection or the shapes in scope change (not on every answer) */
export function panelGeo(world:World,cn:Scope,panel:Panel):PanelGeo{
  let m=geoCache.get(world);
  if(!m){m=new Map();geoCache.set(world,m)}
  const st=getSettings();
  const key=[cn,st.set,st.cross?1:0,panel.id,panel.s0.toFixed(3),panel.t0[0].toFixed(2),panel.t0[1].toFixed(2)].join("|");
  let g=m.get(key);
  if(!g){
    g=buildPanelGeo(world,cn,panel);
    m.set(key,g);
    if(m.size>CACHE_MAX)m.delete(m.keys().next().value!);
  }
  return g;
}

function paintPanel(c:CanvasRenderingContext2D,scene:Scene,panel:Panel,world:World,view:View,o:DrawOpts){
  const inset=!!panel.rect;
  const geo=panelGeo(world,scene.cn,panel);          // (before panelProjection below: building it moves the projection)
  const P=panelProjection(panel,view);               // only for the handful of marker dots
  const v=inset?UNZOOMED:view,k=v.k;
  const look=lookOf(scene.cn);
  const sw=inset?1.1:look.landW;
  const onScreen=(b:Box|null)=>!b||inset||!(b.x1*k+v.tx<-8||b.x0*k+v.tx>scene.W+8||b.y1*k+v.ty<-8||b.y0*k+v.ty>scene.H+8);

  c.save();
  c.translate(v.tx,v.ty);c.scale(k,k);
  c.lineJoin="round";
  const paint=(path:Path2D,fill:string,stroke:string,lw:number)=>{
    c.fillStyle=fill;c.fill(path);
    c.strokeStyle=stroke;c.lineWidth=lw/k;c.stroke(path);
  };

  // quiet neighbours first, then this continent on top
  paint(geo.neighbours,look.neighbour,look.neighbourStroke,.6);
  paint(geo.territories,look.territory,look.neighbourStroke,.6);
  for(const e of geo.countries){
    if(!onScreen(e.box))continue;
    const n=e.shape.n!,hl=o.hl===n;
    paint(e.path,hl?NAVY:o.fill(n),hl?NAVY:look.landStroke,hl?1.4:sw);
    const ov=!hl&&o.overlay?.(n);
    if(ov){c.fillStyle=ov;c.fill(e.path)}
  }
  c.restore();

  /** an unzoomed point to its place on screen */
  const toScreen=(p:[number,number]):[number,number]=>[p[0]*k+v.tx,p[1]*k+v.ty];
  const onPanel=(p:[number,number]|null)=>!!p&&isFinite(p[0])&&isFinite(p[1])&&(panel.rect
    ?inRect(panel.rect,p[0],p[1])
    :p[0]>-10&&p[0]<scene.W+10&&p[1]>-10&&p[1]<scene.H+10);
  /** a clickable dot for a country too small to see; bold looks add a white halo and a dark rim so it stands out on the sea */
  const dot=(x:number,y:number,name:string,lw:number)=>{
    const hl=o.hl===name,r=dotR(hl);
    if(look.bold){c.beginPath();c.arc(x,y,r+2.2,0,7);c.fillStyle="rgba(255,255,255,.88)";c.fill()}
    c.beginPath();c.arc(x,y,r,0,7);
    c.fillStyle=hl?NAVY:o.fill(name);c.fill();
    c.strokeStyle=hl?NAVY:look.bold?"#334155":"#64748B";c.lineWidth=look.bold?Math.max(lw,1.5):lw;c.stroke();
    const ov=!hl&&o.overlay?.(name);
    if(ov){c.beginPath();c.arc(x,y,r,0,7);c.fillStyle=ov;c.fill()}
  };

  // a country still too small to see (Vatican, Monaco…) is drawn as a dot you can click: in an inset, and on
  // the main map too for looks that ask for it (Oceania: a speck there is easy to miss)
  const dotBelow=inset?DOT_AREA:look.bold?MAIN_DOT_AREA:0;
  if(dotBelow){
    for(const e of geo.countries){
      if(e.area*k*k>=dotBelow||!e.ctr)continue;
      const ctr=toScreen(e.ctr);
      if(!onPanel(ctr))continue;
      dot(ctr[0],ctr[1],e.shape.n!,1.1);
    }
  }

  let ring:[number,number]|null=null;
  for(const mk of markersFor(world,scene.cn)){
    const p=P(mk.ll) as [number,number]|null;
    if(!onPanel(p))continue;
    dot(p![0],p![1],mk.n,1);
    if(o.hl===mk.n&&!inset)ring=p;
  }

  // a highlighted country too small to see on the main map still gets a ring (insets cover most)
  if(o.hl&&!inset){
    const hs=geo.byName.get(o.hl)??[];
    if(hs.length){
      const area=hs.reduce((a,e)=>a+e.area,0)*k*k;
      if(area<40){
        const big=hs.reduce((a,b)=>a.area>=b.area?a:b);
        const inInset=scene.panels.some(p=>p.box&&big.shape.bounds&&boundsOverlapBox(big.shape.bounds,p.box));
        if(big.ctr&&!inInset)ring=toScreen(big.ctr);
      }
    }
  }
  if(ring&&isFinite(ring[0])){
    c.beginPath();c.arc(ring[0],ring[1],13,0,7);c.strokeStyle=GOLD;c.lineWidth=2.2;c.stroke();
  }

  // lift the hovered country out of the map
  if(o.emph){
    const es=geo.byName.get(o.emph)??[];
    c.save();
    c.translate(v.tx,v.ty);c.scale(k,k);c.lineJoin="round";
    c.save();
    c.shadowColor="rgba(0,48,87,.45)";c.shadowBlur=14;c.shadowOffsetY=3;
    for(const e of es)paint(e.path,o.hl===e.shape.n?NAVY:o.fill(o.emph),NAVY,2.2);
    c.restore();
    for(const e of es){
      const ov=o.overlay?.(o.emph);
      if(ov){c.fillStyle=ov;c.fill(e.path)}
      c.strokeStyle=NAVY;c.lineWidth=2/k;c.stroke(e.path);
    }
    c.restore();
    if(inset)for(const e of es){
      if(e.area>=DOT_AREA||!e.ctr)continue;
      c.beginPath();c.arc(e.ctr[0],e.ctr[1],8,0,7);c.strokeStyle=NAVY;c.lineWidth=2.4;c.stroke();
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
  const look=lookOf(scene.cn);
  c.fillStyle=look.ocean;c.fillRect(0,0,scene.W,scene.H);
  for(const panel of scene.panels){
    c.save();
    if(panel.rect){
      const r=panel.rect;
      roundRect(c,r.x,r.y,r.w,r.h,8);
      c.shadowColor="rgba(15,23,42,.08)";c.shadowBlur=8;c.shadowOffsetY=2;
      c.fillStyle=look.ocean;c.fill();
      c.shadowColor="transparent";
      c.clip();
    }
    paintPanel(c,scene,panel,world,view,o);
    if(panel.rect){
      // title strip, so the label never sits on top of land
      const r=panel.rect;
      c.fillStyle=look.ocean;c.fillRect(r.x,r.y,r.w,LABEL_H);
      c.beginPath();c.moveTo(r.x,r.y+LABEL_H);c.lineTo(r.x+r.w,r.y+LABEL_H);
      c.strokeStyle="rgba(100,116,139,.22)";c.lineWidth=1;c.stroke();
    }
    c.restore();
    if(panel.rect){
      const r=panel.rect;
      roundRect(c,r.x,r.y,r.w,r.h,8);
      c.strokeStyle=INSET_BORDER;c.lineWidth=1;c.stroke();
      if(panel.label){
        c.font="500 10px Inter,system-ui,sans-serif";c.textBaseline="middle";
        c.fillStyle="#64748B";
        const width=(t:string)=>{const w=c.measureText(t).width;return typeof w==="number"?w:0};
        c.fillText(fitLabel(width,panel.label,panel.short,r.w-20),r.x+10,r.y+LABEL_H/2+1);
      }
    }
  }
}

/* ------------------------------ hit testing ------------------------------ */

const coarsePointer=()=>typeof matchMedia==="function"&&matchMedia("(pointer: coarse)").matches;
const markerHit=()=>coarsePointer()?20:10;
const nearHit=()=>coarsePointer()?20:10;
/** Oceania's islands are mostly specks, so a tap may land a little further off */
const hitBoost=(scene:Scene)=>lookOf(scene.cn).bold?1.35:1;
const dotR=(hl:boolean)=>coarsePointer()?(hl?9:7.5):(hl?6:4.5);

/** a country this small on screen is a dot you aim at, so its dot wins over the country around it (Vatican City inside Italy) */
const DOT_PRIORITY_AREA=DOT_AREA;
const dotHit=()=>coarsePointer()?18:11;

function hitPanel(world:World,scene:Scene,panel:Panel,P:GeoProjection,x:number,y:number):string|null{
  // tiny countries first: a tap on (or near) their dot would otherwise land in the polygon of the country that surrounds them
  {
    const path=geoPath(P);
    const reach=dotHit()*hitBoost(scene);
    let near:string|null=null,nd=reach;
    // only where such countries are drawn as dots: in the boxes, and on the main map of looks that ask for it
    const dotsShown=!!panel.rect||lookOf(scene.cn).bold;
    for(const s of dotsShown?world.shapes:[]){
      if(!shapeInScope(s,scene.cn)||!s.n)continue;
      if(panel.box&&!boundsOverlapBox(s.bounds,panel.box))continue;
      if(path.area(s.feat)>=(panel.rect?DOT_PRIORITY_AREA:MAIN_DOT_AREA))continue;
      const c=path.centroid(s.feat);
      if(!isFinite(c[0])||!isFinite(c[1]))continue;
      const d=Math.hypot(c[0]-x,c[1]-y);
      if(d<nd){nd=d;near=s.n}
    }
    for(const mk of markersFor(world,scene.cn)){
      const p=P(mk.ll) as [number,number]|null;
      if(!p)continue;
      const d=Math.hypot(p[0]-x,p[1]-y);
      if(d<nd){nd=d;near=mk.n}
    }
    if(near)return near;
  }
  const ll=P.invert?.([x,y]);
  if(ll&&isFinite(ll[0])&&isFinite(ll[1])){
    for(const s of world.shapes){
      if(!shapeInScope(s,scene.cn)||!s.n||!lonLatIn(s.bounds,ll[0],ll[1]))continue;
      if(geoContains(s.feat as any,ll))return s.n;
    }
  }
  // micro-states drawn as dots
  let best:string|null=null,bd=markerHit()*hitBoost(scene);
  for(const mk of markersFor(world,scene.cn)){
    const p=P(mk.ll) as [number,number]|null;
    if(!p)continue;
    const d=Math.hypot(p[0]-x,p[1]-y);
    if(d<bd){bd=d;best=mk.n}
  }
  if(best)return best;
  // a few pixels off a very small island still counts
  const path=geoPath(P);
  bd=nearHit()*hitBoost(scene);
  for(const s of world.shapes){
    if(!shapeInScope(s,scene.cn)||!s.n)continue;
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
