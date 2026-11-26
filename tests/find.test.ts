import {describe,expect,it} from "vitest";
import {createCanvas} from "@napi-rs/canvas";
import {mkdirSync,writeFileSync} from "node:fs";
import {CONT} from "../src/data";
import {loadWorld50} from "../src/geo";
import {buildScene,drawFind,hitTest,insetAt,panelProjection,zoomView,type View} from "../src/map/find";
import {BAD_FILL,drawMini,lvlFill,OK_FILL} from "../src/map/mini";
import {clickPointFor} from "./helpers";

const W=1440,H=860,V1:View={k:1,tx:0,ty:0};
const setup=async()=>{
  const world=await loadWorld50();
  return{world,scene:buildScene(world,"North America",W,H,{top:84})};
};

describe("find the country: scene and hit testing",()=>{
  it("North America has a Lesser Antilles inset placed inside the pane and off the HUD",async()=>{
    const {scene}=await setup();
    expect(scene.panels.map(p=>p.id)).toEqual(["main","antilles"]);
    const r=scene.panels[1].rect!;
    expect(r.x).toBeGreaterThanOrEqual(0);expect(r.y).toBeGreaterThanOrEqual(84);
    expect(r.x+r.w).toBeLessThanOrEqual(W);expect(r.y+r.h).toBeLessThanOrEqual(H);
  });

  it("clicking inside every North America country returns that country",async()=>{
    const {world,scene}=await setup();
    for(const d of CONT["North America"]){
      const {p}=clickPointFor(world,scene,V1,d.k);
      expect(hitTest(world,scene,V1,p[0],p[1]),d.k).toBe(d.k);
    }
  });

  it("the small Caribbean countries are clicked inside the inset",async()=>{
    const {world,scene}=await setup();
    for(const n of ["Barbados","Saint Lucia","Grenada","Dominica","Antigua and Barbuda","Saint Kitts and Nevis","Saint Vincent and the Grenadines","Trinidad and Tobago"]){
      expect(clickPointFor(world,scene,V1,n).panel,n).toBe("antilles");
    }
  });

  it("a few pixels off a small island in the inset still hits it",async()=>{
    const {world,scene}=await setup();
    const {p}=clickPointFor(world,scene,V1,"Barbados");
    expect(hitTest(world,scene,V1,p[0]+4,p[1]-3)).toBe("Barbados");
  });

  it("ocean and other continents are ignored",async()=>{
    const {world,scene}=await setup();
    const P=panelProjection(scene.panels[0],V1);
    const free=(ll:[number,number])=>{
      const p=P(ll) as [number,number];
      return !insetAt(scene,p[0],p[1])?p:null;       // skip points that fall under the inset box
    };
    let checked=0;
    for(const ll of [[-40,30],[-125,20],[-90,5]] as [number,number][]){      // open ocean
      const p=free(ll);if(!p)continue;
      checked++;expect(hitTest(world,scene,V1,p[0],p[1]),String(ll)).toBeNull();
    }
    expect(checked).toBeGreaterThan(0);
    const brazil=free([-52,-10]);                                           // another continent
    if(brazil)expect(hitTest(world,scene,V1,brazil[0],brazil[1])).toBeNull();
  });

  it("zoom keeps the point under the cursor fixed, and insets never move",async()=>{
    const {scene}=await setup();
    const main=scene.panels[0],inset=scene.panels[1];
    const before=panelProjection(main,V1)([-70,18]) as [number,number];
    const insetBefore=panelProjection(inset,V1)([-59.5,13.2]) as [number,number];
    const v1=zoomView(V1,before[0],before[1],6);
    const after=panelProjection(main,v1)([-70,18]) as [number,number];
    expect(Math.hypot(after[0]-before[0],after[1]-before[1])).toBeLessThan(.01);
    expect(panelProjection(inset,v1)([-59.5,13.2])).toEqual(insetBefore);
    expect(zoomView(v1,0,0,.2)).toEqual(V1);
  });

  it("enclaves in Europe can be tapped: the dot wins over the country around it",async()=>{
    const world=await loadWorld50();
    const P2=(c:[number,number])=>c;
    for(const [W2,H2] of [[1440,860],[390,844],[820,1180]]){
      const scene=buildScene(world,"Europe",W2,H2,{top:W2<480?150:84});
      for(const n of ["Vatican City","San Marino","Monaco","Liechtenstein","Andorra","Malta"]){
        const {p,panel}=clickPointFor(world,scene,V1,n);
        expect(panel,n).not.toBe("main");
        // on the dot, and a few pixels off it
        for(const [dx,dy] of [[0,0],[5,4],[-5,-4]]){
          const q=P2([p[0]+dx,p[1]+dy]);
          expect(hitTest(world,scene,V1,q[0],q[1]),`${n} ${W2}x${H2} ${dx},${dy}`).toBe(n);
        }
      }
    }
  });

  it("renders screenshots",async()=>{
    const {world,scene}=await setup();
    mkdirSync("/tmp/v",{recursive:true});
    const cv=createCanvas(W,H),ctx=cv.getContext("2d") as unknown as CanvasRenderingContext2D;
    drawFind(ctx,world,scene,V1,{Canada:"ok",Mexico:"bad","United States":"ok",Cuba:"bad",Barbados:"ok","Saint Lucia":"bad"},{name:"Haiti",alpha:.8});
    writeFileSync("/tmp/v/find-zoom1.png",cv.toBuffer("image/png"));

    const cv2=createCanvas(700,640),c2=cv2.getContext("2d") as unknown as CanvasRenderingContext2D;
    drawMini(c2,700,640,world,{cn:"North America",hl:null,emph:"Mexico",fill:n=>n==="Canada"||n==="Cuba"?OK_FILL:n==="Mexico"?BAD_FILL:lvlFill(0)});
    writeFileSync("/tmp/v/results-map.png",cv2.toBuffer("image/png"));
  });
});
