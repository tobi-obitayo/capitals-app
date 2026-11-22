import {geoNaturalEarth1,geoPath} from "d3";
import type {Shape,World} from "../geo";
import {anchorOf,FLAT_REF} from "./flat";

/**
 * Cached, already-projected outlines of the flat world map.
 *
 * Projecting ~100k vertices through d3 on every pan or zoom frame is what made the map lag. Instead every
 * outline is projected once, at a fixed reference scale, into a Path2D; a frame is then just
 * `ctx.translate(tx,ty); ctx.scale(k,k); ctx.fill(path)` with k = (current scale) / FLAT_REF,
 * which the canvas does on the GPU. The flat projection is a plain scale + translate of the reference one:
 *   screen = (s / FLAT_REF) * ref + translate
 */

/** resampling precision in reference px: <1 screen px at the deepest zoom */
const PRECISION=.35;

export interface Box{x0:number;y0:number;x1:number;y1:number}
export interface CachedShape{shape:Shape;path:Path2D;box:Box|null;/** label anchor in reference px */anchor:[number,number]|null}
export interface CachedContinent{name:string;path:Path2D;box:Box|null}
/** a spatial piece of a border mesh, so a deep zoom strokes only the pieces on screen */
export interface MeshBin{path:Path2D;box:Box}
export interface CachedMesh{
  /** the whole mesh: cheapest when most of it is on screen */
  all:Path2D;
  bins:MeshBin[];
}
export interface FlatGeo{
  world:World;
  continents:CachedContinent[];
  innerMesh:CachedMesh;
  contMesh:CachedMesh;
  shapes:CachedShape[];
}

/** side of a mesh bin in reference px (the world is about 10800 x 6000 of them) */
const BIN=900;

const refProjection=()=>geoNaturalEarth1().scale(FLAT_REF).translate([0,0]).precision(PRECISION);

/** a d3 path "context" that writes into a Path2D and notes the extent of what it draws */
export function recorder(){
  const path=new Path2D();
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  const note=(x:number,y:number)=>{if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y};
  const ctx={
    beginPath(){},
    moveTo(x:number,y:number){path.moveTo(x,y);note(x,y)},
    lineTo(x:number,y:number){path.lineTo(x,y);note(x,y)},
    arc(x:number,y:number,r:number,a:number,b:number){path.arc(x,y,r,a,b);note(x-r,y-r);note(x+r,y+r)},
    closePath(){path.closePath()},
  };
  return{ctx:ctx as unknown as CanvasRenderingContext2D,path,box:():Box|null=>x0<=x1?{x0,y0,x1,y1}:null};
}

/** like recorder(), but also deals the line segments out into BIN-sized cells of the plane */
function meshRecorder(){
  const whole=recorder();
  const bins=new Map<number,{path:Path2D;box:Box;px:number;py:number}>();
  let lx=0,ly=0;
  const ctx={
    beginPath(){},
    moveTo(x:number,y:number){whole.ctx.moveTo(x,y);lx=x;ly=y},
    lineTo(x:number,y:number){
      whole.ctx.lineTo(x,y);
      const cx=Math.floor((lx+x)/2/BIN),cy=Math.floor((ly+y)/2/BIN),key=cx*4096+cy;
      let b=bins.get(key);
      if(!b){b={path:new Path2D(),box:{x0:Infinity,y0:Infinity,x1:-Infinity,y1:-Infinity},px:NaN,py:NaN};bins.set(key,b)}
      if(b.px!==lx||b.py!==ly){b.path.moveTo(lx,ly)}   // this bin's pen is elsewhere: start a new piece
      b.path.lineTo(x,y);b.px=x;b.py=y;
      const bx=b.box;
      bx.x0=Math.min(bx.x0,lx,x);bx.x1=Math.max(bx.x1,lx,x);bx.y0=Math.min(bx.y0,ly,y);bx.y1=Math.max(bx.y1,ly,y);
      lx=x;ly=y;
    },
    arc(){},
    closePath(){whole.ctx.closePath()},
  };
  return{ctx:ctx as unknown as CanvasRenderingContext2D,mesh:():CachedMesh=>({all:whole.path,bins:[...bins.values()].map(b=>({path:b.path,box:b.box}))})};
}

function* steps(world:World,out:FlatGeo):Generator<void>{
  const proj=refProjection(),gp=geoPath(proj);
  const rec=(geom:any)=>{const r=recorder();gp.context(r.ctx);gp(geom);return r};
  for(const c of world.continents??[]){
    const r=rec(c.geo);
    out.continents.push({name:c.name,path:r.path,box:r.box()});
    yield;
  }
  const recMesh=(geom:any)=>{const r=meshRecorder();gp.context(r.ctx);gp(geom);return r.mesh()};
  if(world.innerMesh){out.innerMesh=recMesh(world.innerMesh);yield}
  if(world.contMesh){out.contMesh=recMesh(world.contMesh);yield}
  for(const s of world.shapes){
    const r=rec(s.feat);
    const a=proj(anchorOf(s));
    out.shapes.push({shape:s,path:r.path,box:r.box(),anchor:a?[a[0],a[1]]:null});
    yield;
  }
}

const emptyMesh=():CachedMesh=>({all:new Path2D(),bins:[]});
const empty=(world:World):FlatGeo=>({world,continents:[],innerMesh:emptyMesh(),contMesh:emptyMesh(),shapes:[]});
const done=new WeakMap<World,FlatGeo>();
const pending=new WeakMap<World,Promise<FlatGeo>>();

/** the cache for this world if it has been built */
export const peekFlatGeo=(world:World)=>done.get(world)??null;

/** build the cache in one go (fine for the small 110m world) */
export function buildFlatGeo(world:World):FlatGeo{
  const have=done.get(world);
  if(have)return have;
  const out=empty(world);
  for(const _ of steps(world,out));
  done.set(world,out);
  return out;
}

/** time slice for the lazy build, so a phone never blocks a frame on the 50m world */
const SLICE_MS=6;

/** build the cache a little at a time between frames (for the heavy 50m world) */
export function ensureFlatGeo(world:World):Promise<FlatGeo>{
  const have=done.get(world);
  if(have)return Promise.resolve(have);
  let p=pending.get(world);
  if(!p){
    p=new Promise<FlatGeo>(resolve=>{
      const out=empty(world),it=steps(world,out);
      const run=()=>{
        const t0=performance.now();
        for(;;){
          if(it.next().done){done.set(world,out);resolve(out);return}
          if(performance.now()-t0>SLICE_MS){setTimeout(run,0);return}
        }
      };
      run();
    });
    pending.set(world,p);
  }
  return p;
}
