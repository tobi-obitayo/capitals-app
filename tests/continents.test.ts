import {describe,expect,it} from "vitest";
import {createCanvas} from "@napi-rs/canvas";
import {mkdirSync,writeFileSync} from "node:fs";
import {CONT,CONT_NAMES} from "../src/data";
import {loadWorld50} from "../src/geo";
import {buildScene,drawFind,type View} from "../src/map/find";
import {clickPointFor} from "./helpers";

const W=1100,H=780,V1:View={k:1,tx:0,ty:0};

describe("quizzes for every continent",()=>{
  it("every country can be clicked (main map or inset)",async()=>{
    const world=await loadWorld50();
    mkdirSync("/tmp/v",{recursive:true});
    const miss:string[]=[];
    for(const cn of CONT_NAMES){
      const scene=buildScene(world,cn,W,H,{top:84});
      const cv=createCanvas(W,H),ctx=cv.getContext("2d") as unknown as CanvasRenderingContext2D;
      drawFind(ctx,world,scene,V1,{},null);
      writeFileSync(`/tmp/v/quiz-${cn.replace(/ /g,"_")}.png`,cv.toBuffer("image/png"));

      for(const d of CONT[cn]){
        try{
          const {p}=clickPointFor(world,scene,V1,d.k);
          // keep the click inside the pane
          if(p[0]<0||p[0]>W||p[1]<0||p[1]>H)miss.push(`${cn}/${d.k} off-screen`);
        }catch(e){
          miss.push(`${cn}/${d.k}: ${(e as Error).message}`);
        }
      }
    }
    // Europe intentionally clips eastern Russia so Western Europe stays large
    expect(miss.filter(m=>m!=="Europe/Russia off-screen")).toEqual([]);
  });

  it("insets exist wherever a continent needs them",async()=>{
    const world=await loadWorld50();
    const expectIds:Record<string,string[]>={
      "North America":["main","antilles"],
      Europe:["main","micro"],
      Africa:["main","atlantic","gulf","indian"],
      Asia:["main","gulf","maldives","singapore"],
      Oceania:["main","micronesia","polynesia"],
      "South America":["main"],
    };
    for(const cn of CONT_NAMES){
      const scene=buildScene(world,cn,W,H,{top:84});
      expect(scene.panels.map(p=>p.id),cn).toEqual(expectIds[cn]);
    }
  });
});
