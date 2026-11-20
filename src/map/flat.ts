import {geoCentroid,geoContains,geoNaturalEarth1,geoPath,type GeoProjection} from "d3";
import type {Geometry} from "geojson";
import type {ContinentName} from "../data";
import type {Shape,World} from "../geo";
import {OCEAN} from "./palette";

/**
 * The flat world map: full-bleed ocean, Antarctica cropped, pan (wraps around the date line) and zoom.
 * The map is sized to the screen: the whole world across on a normal landscape screen, taller than the
 * screen (so you pan sideways) on portrait phones.
 */

const LAT_MIN=-58,LAT_MAX=84;
export const FLAT_ZOOM_MAX=14;
/** from this zoom on, country names show and a tap picks a country instead of opening the continent */
export const LABEL_ZOOM=2;
/** the sharper (but heavier) 50m map takes over from this scale, measured against fitting the world to the width */
export const DETAIL_SCALE=1.8;

export interface FlatView{zoom:number;px:number;py:number}
export const FLAT_HOME:FlatView={zoom:1,px:0,py:0};

/** projected extent of the cropped world at scale 1 */
const unit=geoNaturalEarth1().scale(1).translate([0,0]);
const UB=(()=>{
  const pts:[number,number][]=[];
  for(let lat=LAT_MIN;lat<=LAT_MAX;lat+=2)pts.push([-180,lat],[180,lat]);
  for(let lon=-180;lon<=180;lon+=10)pts.push([lon,LAT_MIN],[lon,LAT_MAX]);
  const ps=pts.map(p=>unit(p)!);
  return{x0:Math.min(...ps.map(p=>p[0])),x1:Math.max(...ps.map(p=>p[0])),y0:Math.min(...ps.map(p=>p[1])),y1:Math.max(...ps.map(p=>p[1]))};
})();
const UW=UB.x1-UB.x0,UH=UB.y1-UB.y0;

export interface FlatLayout{
  proj:GeoProjection;
  W:number;H:number;
  /** projected scale and the size of the whole cropped world in px */
  s:number;ww:number;hh:number;
  /** the view after clamping */
  view:FlatView;
  minZoom:number;
  /** scale relative to fitting the world to the width (1 = whole world across) */
  abs:number;
}

const clamp=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v));

/** how much taller than fit-to-width the map is drawn: 1 on landscape screens (laptops, phones held sideways), up to 2.4 on tall phones */
export function baseFactor(W:number,H:number){
  const r=(H/UH)/(W/UW);   // how much taller the screen is than the world
  return r<=1.6?1:1+Math.min(r-1.6,.8)*1.75;
}

/** place the projection for a screen of W x H (H = the free height) and a pan/zoom */
export function flatLayout(proj:GeoProjection,W:number,H:number,v:FlatView):FlatLayout{
  const f=baseFactor(W,H),minZoom=1/f;
  const zoom=clamp(v.zoom,minZoom,FLAT_ZOOM_MAX);
  const s=(W/UW)*f*zoom,ww=UW*s,hh=UH*s;
  // sideways pan wraps around the world; up/down stays inside the map
  let px=v.px%ww;
  if(px>ww/2)px-=ww;else if(px<-ww/2)px+=ww;
  const py=hh<=H?0:clamp(v.py,-(hh-H)/2,(hh-H)/2);
  const cx=(UB.x0+UB.x1)/2,cy=(UB.y0+UB.y1)/2;
  proj.scale(s).translate([W/2+px-cx*s,H/2+py-cy*s]);
  return{proj,W,H,s,ww,hh,view:{zoom,px,py},minZoom,abs:zoom*f};
}

export const makeFlatProjection=()=>geoNaturalEarth1();

/** zoom to `nz` keeping screen point (x, y) where it is */
export function zoomFlatAt(lay:FlatLayout,x:number,y:number,nz:number):FlatView{
  const v=lay.view;
  const zoom=clamp(nz,lay.minZoom,FLAT_ZOOM_MAX);
  const k=zoom/v.zoom;
  // the map centre sits at (W/2+px, H/2+py); scaling about the pointer moves that centre
  return{zoom,px:x-lay.W/2-(x-lay.W/2-v.px)*k,py:y-lay.H/2-(y-lay.H/2-v.py)*k};
}

/** x of the copy of the world nearest the pointer, so inverting works on every wrapped copy */
export const unwrapFlatX=(lay:FlatLayout,x:number)=>{
  const t=lay.proj.translate()[0];
  return x-Math.round((x-t)/lay.ww)*lay.ww;
};

export function lonLatAt(lay:FlatLayout,x:number,y:number):[number,number]|null{
  const ll=lay.proj.invert?.([unwrapFlatX(lay,x),y]);
  if(!ll||!isFinite(ll[0])||!isFinite(ll[1])||Math.abs(ll[0])>180||ll[1]<LAT_MIN-6||ll[1]>LAT_MAX+6)return null;
  return ll as [number,number];
}

const lonLatIn=(b:Shape["bounds"],lon:number,lat:number)=>{
  const [[w,s],[e,n]]=b;
  if(lat<s||lat>n)return false;
  return w<=e?lon>=w&&lon<=e:lon>=w||lon<=e;
};

/** the named country under a screen point, or null (ocean, territory, greyed out) */
export function pickCountryFlat(world:World,lay:FlatLayout,x:number,y:number):string|null{
  const ll=lonLatAt(lay,x,y);
  if(!ll)return null;
  for(const s of world.shapes){
    if(!s.n||!lonLatIn(s.bounds,ll[0],ll[1]))continue;
    if(geoContains(s.feat as any,ll))return s.n;
  }
  // a tiny country (Monaco, Malta...) is only a few pixels wide: accept a tap just beside it
  const path=geoPath(lay.proj);
  let best:string|null=null,bd=12;
  for(const s of world.shapes){
    if(!s.n)continue;
    const a=anchorOf(s);
    const p=lay.proj(a);
    if(!p)continue;
    const px=p[0]-Math.round((p[0]-x)/lay.ww)*lay.ww;
    const d=Math.hypot(px-x,p[1]-y);
    if(d<bd&&path.area(s.feat)<30){bd=d;best=s.n}
  }
  return best;
}

/* ---------------- labels ---------------- */

const anchors=new WeakMap<Shape,[number,number]>();
/** a point inside the country's biggest piece, found once */
function anchorOf(s:Shape):[number,number]{
  let a=anchors.get(s);
  if(a)return a;
  const g=s.feat.geometry as Geometry;
  let feat:any=s.feat;
  if(g.type==="MultiPolygon"){
    let bestA=-1;
    for(const coords of g.coordinates){
      const f={type:"Feature",properties:{},geometry:{type:"Polygon",coordinates:coords}};
      const b=ringSpan(coords[0]);
      if(b>bestA){bestA=b;feat=f}
    }
  }
  a=geoCentroid(feat) as [number,number];
  anchors.set(s,a);
  return a;
}
const ringSpan=(ring:number[][])=>{
  let w=Infinity,e=-Infinity,so=Infinity,n=-Infinity;
  for(const p of ring){if(p[0]<w)w=p[0];if(p[0]>e)e=p[0];if(p[1]<so)so=p[1];if(p[1]>n)n=p[1]}
  return(e-w)*(n-so);
};

/** approximate on-screen size (px) of a country from its lon/lat box */
function boxPx(lay:FlatLayout,b:Shape["bounds"]){
  const [[w,s],[e,n]]=b;
  const lon=w<=e?e-w:e+360-w;
  return{w:lon/360*lay.ww,h:(n-s)/(LAT_MAX-LAT_MIN)*lay.hh};
}

/* ---------------- drawing ---------------- */

export interface FlatDraw{
  W:number;H:number;
  lay:FlatLayout;
  /** the merged continents of the world to draw (with border meshes) */
  world:World;
  /** the 50m world, used for country shapes, fills and names (null until loaded) */
  detail:World|null;
  hover:ContinentName|null;
  hoverCountry:string|null;
  frac:(cn:ContinentName)=>number;
  /** a country's learning level 0..3, for tinting once zoomed in */
  level:(name:string)=>number;
  lvlFill:(level:number)=>string;
}

export function drawFlat(ctx:CanvasRenderingContext2D,o:FlatDraw){
  const {W,H,lay,world}=o;
  ctx.fillStyle=OCEAN;ctx.fillRect(0,0,W,H);
  if(!world.continents)return;
  const path=geoPath(lay.proj,ctx);
  const countryMode=lay.view.zoom>=LABEL_ZOOM&&!!o.detail;
  const left=lay.proj.translate()[0]+lay.s*UB.x0;   // left edge of the centre copy of the world

  for(let i=-1;i<=1;i++){
    const dx=i*lay.ww;
    if(left+dx>W||left+dx+lay.ww<0)continue;
    ctx.save();ctx.translate(dx,0);
    // crop to the shown latitudes: no Antarctica, and no stray border lines below the map
    ctx.beginPath();ctx.rect(left,lay.proj.translate()[1]+lay.s*UB.y0,lay.ww,lay.hh);ctx.clip();
    for(const c of world.continents){
      if(c.name==="Antarctica")continue;
      ctx.beginPath();path(c.geo);ctx.fillStyle="#FFFFFF";ctx.fill();
      if(countryMode)continue;
      const f=o.frac(c.name as ContinentName);
      if(f>0){ctx.fillStyle=`rgba(0,48,87,${.1+.6*f})`;ctx.fill()}
      if(o.hover===c.name){ctx.fillStyle="rgba(179,163,105,.42)";ctx.fill()}
    }
    if(countryMode){
      // zoomed in: each country carries its own progress colour; greyed-out ones sit back
      for(const s of o.detail!.shapes){
        if(s.cn==="Antarctica")continue;
        if(s.off){ctx.beginPath();path(s.feat);ctx.fillStyle="#E4E9EF";ctx.fill();continue}
        if(!s.n)continue;
        const lv=o.level(s.n),hv=o.hoverCountry===s.n;
        if(lv>0||hv){
          ctx.beginPath();path(s.feat);
          if(lv>0){ctx.fillStyle=o.lvlFill(lv);ctx.fill()}
          if(hv){ctx.fillStyle="rgba(179,163,105,.42)";ctx.fill()}
        }
      }
    }
    ctx.beginPath();path(world.innerMesh!);ctx.strokeStyle="#CBD3DD";ctx.lineWidth=.6;ctx.stroke();
    ctx.beginPath();path(world.contMesh!);ctx.strokeStyle="#1E293B";ctx.lineWidth=1;ctx.lineJoin="round";ctx.stroke();
    ctx.restore();
  }

  if(countryMode)drawNames(ctx,o);
}

function drawNames(ctx:CanvasRenderingContext2D,o:FlatDraw){
  const {lay,W,H}=o;
  const size=lay.view.zoom<4?11:lay.view.zoom<8?12:13;
  ctx.font=`600 ${size}px Inter,system-ui,sans-serif`;
  ctx.textAlign="center";ctx.textBaseline="middle";ctx.lineJoin="round";
  const cand:{n:string;x:number;y:number;area:number;tw:number}[]=[];
  for(const s of o.detail!.shapes){
    if(!s.n||s.cn==="Antarctica")continue;
    const a=anchorOf(s),p=lay.proj(a);
    if(!p)continue;
    const bx=boxPx(lay,s.bounds);
    const tw=ctx.measureText(s.n).width;
    // the name has to fit inside the country's box (small ones wait until you zoom further)
    if(tw>bx.w*.92||size*1.2>bx.h)continue;
    const x=p[0]-Math.round((p[0]-W/2)/lay.ww)*lay.ww;
    if(x<-40||x>W+40||p[1]<-20||p[1]>H+20)continue;
    cand.push({n:s.n,x,y:p[1],area:bx.w*bx.h,tw});
  }
  cand.sort((a,b)=>b.area-a.area);
  const placed:{x0:number;x1:number;y0:number;y1:number}[]=[];
  const named=new Set<string>();
  for(const c of cand){
    if(named.has(c.n))continue;   // Somalia + Somaliland share a name
    const r={x0:c.x-c.tw/2-3,x1:c.x+c.tw/2+3,y0:c.y-size*.65,y1:c.y+size*.65};
    if(placed.some(q=>r.x0<q.x1&&r.x1>q.x0&&r.y0<q.y1&&r.y1>q.y0))continue;
    placed.push(r);named.add(c.n);
    ctx.strokeStyle="rgba(255,255,255,.92)";ctx.lineWidth=3.2;ctx.strokeText(c.n,c.x,c.y);
    ctx.fillStyle="#1E293B";ctx.fillText(c.n,c.x,c.y);
  }
}
