import {describe,expect,it} from "vitest";
import {CONT} from "../src/data";
import {loadWorld50} from "../src/geo";
import {buildScene,hitTest,type View} from "../src/map/find";
import {DEFAULT_LOOK,LAND,OCEANIA_LOOK} from "../src/map/palette";
import {lonLatBoxOverlaps,lookOf} from "../src/map/scene";
import {clickPointFor} from "./helpers";

const V1:View={k:1,tx:0,ty:0};
const sizes:[number,number][]=[[390,844],[1280,800]];

const lum=(hex:string)=>{
  const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);
  return .2126*r+.7152*g+.0722*b;
};
const contrast=(a:string,b:string)=>{const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);return(x+.05)/(y+.05)};

describe("Oceania find quiz",()=>{
  it("an inset box that wraps the date line still catches islands on both sides of it",async()=>{
    const world=await loadWorld50();
    const polynesia:[number,number,number,number]=[168,-23,-157,-5];
    const bounds=(n:string)=>world.shapes.find(s=>s.n===n)!.bounds;
    expect(lonLatBoxOverlaps(bounds("Samoa"),polynesia)).toBe(true);     // -172°: the far side of the date line from 168°
    expect(lonLatBoxOverlaps(bounds("Tonga"),polynesia)).toBe(true);
    expect(lonLatBoxOverlaps(bounds("Palau"),polynesia)).toBe(false);
    expect(lonLatBoxOverlaps(bounds("Australia"),polynesia)).toBe(false);
  });

  it("every country, Samoa and Tonga included, is clickable and the Polynesia inset holds them",async()=>{
    const world=await loadWorld50();
    for(const [W,H] of sizes){
      const scene=buildScene(world,"Oceania",W,H,{top:150,cover:true});
      for(const d of CONT.Oceania){
        const {p}=clickPointFor(world,scene,V1,d.k);
        expect(hitTest(world,scene,V1,p[0],p[1]),`${W}x${H} ${d.k}`).toBe(d.k);
      }
      expect(clickPointFor(world,scene,V1,"Samoa").panel).toBe("polynesia");
      expect(clickPointFor(world,scene,V1,"Tonga").panel).toBe("polynesia");
    }
  });

  it("the larger insets stay inside the pane, below the quiz bar and apart from each other",async()=>{
    const world=await loadWorld50();
    for(const [W,H] of sizes){
      const scene=buildScene(world,"Oceania",W,H,{top:150,cover:true});
      const rects=scene.panels.filter(p=>p.rect).map(p=>p.rect!);
      expect(rects.length).toBe(2);
      for(const r of rects){
        expect(r.x).toBeGreaterThanOrEqual(0);expect(r.y).toBeGreaterThanOrEqual(150);
        expect(r.x+r.w).toBeLessThanOrEqual(W);expect(r.y+r.h).toBeLessThanOrEqual(H);
      }
      const [a,b]=rects;
      const overlap=Math.min(a.x+a.w,b.x+b.w)>Math.max(a.x,b.x)&&Math.min(a.y+a.h,b.y+b.h)>Math.max(a.y,b.y);
      expect(overlap,`${W}x${H}`).toBe(false);
    }
  });

  it("a tap a little beside a tiny island on the main map still finds it",async()=>{
    const world=await loadWorld50();
    const scene=buildScene(world,"Oceania",390,844,{top:150,cover:true});
    const main=scene.panels[0];
    // Vanuatu is a few pixels wide on a phone; its inset-free main-map spot is its centroid
    const p=main.P([167.2,-16]) as [number,number];
    expect(hitTest(world,scene,V1,p[0]+9,p[1]+7)).toBe("Vanuatu");
  });

  it("Oceania is painted with more contrast than the other continents, and only Oceania",()=>{
    expect(lookOf("Oceania")).toBe(OCEANIA_LOOK);
    for(const cn of ["Africa","Europe","Asia","North America","South America","World"] as const)expect(lookOf(cn)).toBe(DEFAULT_LOOK);
    expect(contrast(LAND,OCEANIA_LOOK.ocean)).toBeGreaterThan(1.25);
    expect(contrast(LAND,DEFAULT_LOOK.ocean)).toBeLessThan(1.25);
    expect(contrast(LAND,OCEANIA_LOOK.landStroke)).toBeGreaterThan(5);
  });
});
