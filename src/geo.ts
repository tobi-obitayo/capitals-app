import {geoBounds,geoCentroid} from "d3";
import * as topojson from "topojson-client";
import type {Feature,Geometry} from "geojson";
import {ATLAS_ALIAS,TERRITORY,CONT_NAMES,dataByName,type ContinentName} from "./data";

export type ContKey=ContinentName|"Antarctica";
export type Bounds=[[number,number],[number,number]];

export interface Shape{
  /** name from our country data, or null for territories we don't drill */
  n:string|null;
  cn:ContKey|null;
  feat:Feature<Geometry>;
  bounds:Bounds;
}
export interface World{
  shapes:Shape[];
  /** present only for worlds built with `landing: true` */
  continents?:{name:ContKey;geo:Geometry}[];
  innerMesh?:Geometry;
  contMesh?:Geometry;
}

/** French overseas departments are part of the "France" shape; send each piece to its real continent. */
function classifyFrancePiece(c:[number,number]):{cn:ContKey;n:string|null}{
  if(c[0]<-30)return c[1]>10?{cn:"North America",n:null}:{cn:"South America",n:null};
  if(c[0]>30&&c[0]<70&&c[1]<0)return{cn:"Africa",n:null};
  return{cn:"Europe",n:"France"};
}

/**
 * Turn a world-atlas topology into shapes tagged with our country names.
 * `landing` additionally builds merged continents and border meshes for the globe/flat map
 * (110m only; unassigned shapes fall back to Antarctica there).
 */
export function buildWorld(topo:any,opts:{landing:boolean}):World{
  const geoms:any[]=[];
  const contOf=new Map<any,ContKey|null>();
  const nameOf=new Map<any,string|null>();
  const add=(g:any,cn:ContKey|null,n:string|null)=>{geoms.push(g);contOf.set(g,cn);nameOf.set(g,n)};

  for(const g of topo.objects.countries.geometries){
    const raw:string=g.properties.name,dn=ATLAS_ALIAS[raw]||raw;
    const hit=dataByName[dn];
    const cn=(hit?hit.cn:(TERRITORY[raw] as ContKey|undefined))??null;
    if(raw==="France"&&g.type==="MultiPolygon"){
      for(const arcs of g.arcs){
        const poly={type:"Polygon",arcs};
        const c=geoCentroid(topojson.feature(topo,poly as any) as any) as [number,number];
        const k=classifyFrancePiece(c);
        add(poly,k.cn,k.n);
      }
    }else{
      if(!cn&&opts.landing)console.warn("unassigned map shape:",raw);
      add(g,cn??(opts.landing?"Antarctica":null),hit?dn:null);
    }
  }

  const shapes:Shape[]=geoms.map(g=>{
    const feat=topojson.feature(topo,g) as Feature<Geometry>;
    return{n:nameOf.get(g)??null,cn:contOf.get(g)??null,feat,bounds:geoBounds(feat as any) as Bounds};
  });
  const world:World={shapes};

  if(opts.landing){
    const names:ContKey[]=[...CONT_NAMES,"Antarctica"];
    world.continents=names.map(name=>({
      name,
      geo:topojson.merge(topo,geoms.filter(g=>contOf.get(g)===name)) as Geometry,
    }));
    const col={type:"GeometryCollection",geometries:geoms};
    world.innerMesh=topojson.mesh(topo,col as any,(a:any,b:any)=>a!==b&&contOf.get(a)===contOf.get(b)) as Geometry;
    world.contMesh=topojson.mesh(topo,col as any,(a:any,b:any)=>a===b||contOf.get(a)!==contOf.get(b)) as Geometry;
  }
  return world;
}

let landing:World|null=null;
let world50:World|null=null;
let world50Promise:Promise<World>|null=null;

/** small 110m world for the globe/flat landing map (bundled, built once) */
export async function getLanding():Promise<World>{
  if(!landing){
    const topo=(await import("world-atlas/countries-110m.json")).default;
    landing=buildWorld(topo,{landing:true});
  }
  return landing;
}

/** detailed 50m world for drill and quiz maps (loaded on demand, cached) */
export function loadWorld50():Promise<World>{
  if(world50)return Promise.resolve(world50);
  world50Promise??=import("world-atlas/countries-50m.json").then(m=>{
    world50=buildWorld(m.default,{landing:false});
    return world50;
  });
  return world50Promise;
}
export const peekWorld50=()=>world50;
