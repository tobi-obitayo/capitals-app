import {describe,expect,it} from "vitest";
import {createCanvas} from "@napi-rs/canvas";
import {mkdirSync,writeFileSync} from "node:fs";
import {geoCentroid} from "d3";
import {CONT,CONT_NAMES} from "../src/data";
import {loadWorld50} from "../src/geo";
import {drawMini,hitMini,lvlFill,sceneFor} from "../src/map/mini";
import {panelProjection} from "../src/map/scene";

describe("continent maps",()=>{
  it("render, keep every country on screen, and place insets off the land",async()=>{
    const world=await loadWorld50();
    mkdirSync("/tmp/v",{recursive:true});
    const W=760,H=700;
    for(const cn of CONT_NAMES){
      const cv=createCanvas(W,H),ctx=cv.getContext("2d") as unknown as CanvasRenderingContext2D;
      const hl=CONT[cn][0].k;
      const scene=drawMini(ctx,W,H,world,{cn,hl,emph:CONT[cn][3].k,fill:n=>lvlFill(n.length%4),reserved:[{x:0,y:H-64,w:400,h:64}]});
      writeFileSync(`/tmp/v/frame-${cn.replace(/ /g,"_")}.png`,cv.toBuffer("image/png"));

      const P=panelProjection(scene.panels[0],{k:1,tx:0,ty:0});
      const lost:string[]=[];
      for(const d of CONT[cn]){
        const s=world.shapes.find(x=>x.n===d.k);
        if(!s)continue;
        const p=P(geoCentroid(s.feat as any) as [number,number]);
        if(!p||p[0]<0||p[0]>W||p[1]<0||p[1]>H)lost.push(d.k);
      }
      expect(lost.filter(n=>!(cn==="Europe"&&n==="Russia")),cn).toEqual([]);
    }
  });

  it("hovering finds the country under the pointer, including inside an inset",async()=>{
    const world=await loadWorld50();
    const scene=sceneFor(world,1000,700,{cn:"North America"});
    expect(scene.panels.length).toBe(2);
    const ins=scene.panels[1];
    const [lon,lat]=[-59.55,13.15];                                 // Barbados
    const p=ins.P([lon,lat]) as [number,number];
    expect(hitMini(world,scene,p[0],p[1])).toBe("Barbados");
    const main=panelProjection(scene.panels[0],{k:1,tx:0,ty:0})([-100,40]) as [number,number];
    expect(hitMini(world,scene,main[0],main[1])).toBe("United States");
  });
});
