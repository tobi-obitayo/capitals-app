import {describe,expect,it} from "vitest";
import {createCanvas} from "@napi-rs/canvas";
import {geoPath} from "d3";
import {loadWorld50} from "../src/geo";
import {buildScene,drawFind,panelProjection,zoomView,type View} from "../src/map/find";
import {lookOf,panelGeo} from "../src/map/scene";
import {LAND} from "../src/map/palette";
import {shapeInScope} from "../src/sets";

const W=1100,H=760;
type Ctx=CanvasRenderingContext2D;

/** the renderer the cache replaced: every outline re-projected through d3 for the current view */
function legacy(c:Ctx,scene:ReturnType<typeof buildScene>,world:Awaited<ReturnType<typeof loadWorld50>>,view:View){
  const look=lookOf(scene.cn);
  c.fillStyle=look.ocean;c.fillRect(0,0,W,H);
  const path=geoPath(panelProjection(scene.panels[0],view),c);
  const shape=(feat:any,fill:string,stroke:string,lw:number)=>{
    c.beginPath();path(feat);c.fillStyle=fill;c.fill();
    c.strokeStyle=stroke;c.lineWidth=lw;c.lineJoin="round";c.stroke();
  };
  for(const s of world.shapes)if(!shapeInScope(s,scene.cn))shape(s.feat,look.neighbour,look.neighbourStroke,.6);
  for(const s of world.shapes)if(shapeInScope(s,scene.cn)&&!s.n)shape(s.feat,look.territory,look.neighbourStroke,.6);
  for(const s of world.shapes)if(shapeInScope(s,scene.cn)&&s.n)shape(s.feat,LAND,look.landStroke,look.landW);
}
const pixels=(c:Ctx)=>(c as any).getImageData(0,0,W,H).data as Uint8ClampedArray;

describe("cached scene outlines",()=>{
  it("look the same as re-projecting through d3, at every zoom",async()=>{
    const world=await loadWorld50();
    // South America has no inset boxes and no marker dots, so only the cached outlines are compared
    const scene=buildScene(world,"South America",W,H,{top:0});
    expect(scene.panels.length).toBe(1);
    let v:View={k:1,tx:0,ty:0},sea:number[]|null=null;
    const brazil=panelProjection(scene.panels[0],v)([-52,-12]) as [number,number];   // zoom in on land
    for(const k of [1,4,16]){
      v=zoomView(v,brazil[0],brazil[1],k);
      const a=createCanvas(W,H).getContext("2d") as unknown as Ctx;
      const b=createCanvas(W,H).getContext("2d") as unknown as Ctx;
      drawFind(a,world,scene,v,{},null);
      legacy(b,scene,world,v);
      const pa=pixels(a),pb=pixels(b);
      sea??=[pa[0],pa[1],pa[2]];   // the first frame's corner is open ocean
      let off=0,land=0;
      for(let i=0;i<pa.length;i+=4){
        if(pa[i]!==sea[0]||pa[i+1]!==sea[1]||pa[i+2]!==sea[2])land++;
        const d=Math.max(Math.abs(pa[i]-pb[i]),Math.abs(pa[i+1]-pb[i+1]),Math.abs(pa[i+2]-pb[i+2]));
        if(d>60)off++;
      }
      expect(land/(W*H),`something is drawn at zoom ${k}`).toBeGreaterThan(.1);
      expect(off/(W*H),`zoom ${k}`).toBeLessThan(.004);
    }
  });

  it("are built once, not again for a new answer, a redraw or an identical layout",async()=>{
    const world=await loadWorld50();
    const s1=buildScene(world,"North America",W,H,{top:84});
    const c=createCanvas(W,H).getContext("2d") as unknown as Ctx;
    drawFind(c,world,s1,{k:1,tx:0,ty:0},{},null);
    const g1=s1.panels.map(p=>panelGeo(world,s1.cn,p));
    drawFind(c,world,s1,{k:3,tx:-100,ty:-50},{Canada:"ok"},{name:"Mexico",alpha:.5});
    const s2=buildScene(world,"North America",W,H,{top:84});   // what the quiz does after every answer
    drawFind(c,world,s2,{k:1,tx:0,ty:0},{Canada:"ok"},null);
    s2.panels.forEach((p,i)=>expect(panelGeo(world,s2.cn,p)).toBe(g1[i]));
    // a different window size is a different projection
    const s3=buildScene(world,"North America",W-200,H,{top:84});
    expect(panelGeo(world,s3.cn,s3.panels[0])).not.toBe(g1[0]);
  });

  it("keep insets in their box: an inset only holds the shapes of its lon/lat window",async()=>{
    const world=await loadWorld50();
    const scene=buildScene(world,"North America",W,H,{top:84});
    const inset=scene.panels.find(p=>p.id==="antilles")!;
    const names=panelGeo(world,scene.cn,inset).countries.map(e=>e.shape.n);
    expect(names).toContain("Barbados");
    expect(names).not.toContain("Canada");
  });
});
