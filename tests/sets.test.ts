import {afterEach,describe,expect,it} from "vitest";
import {ALL,CONT_NAMES,MARK,type ContinentName} from "../src/data";
import {buildWorld,loadWorld50} from "../src/geo";
import {CROSS,countriesIn,updateSettings,type CountrySet} from "../src/sets";
import {buildScene,hitTest,type View} from "../src/map/find";
import {clickPointFor} from "./helpers";

const V1:View={k:1,tx:0,ty:0};
const counts=(set:CountrySet,cross=false)=>countriesIn("World",{set,cross}).length;

afterEach(()=>updateSettings({set:"obs",cross:false}));

describe("country sets",()=>{
  it("193 UN members, 195 with the two observers, 202 with the seven other states",()=>{
    expect(counts("un")).toBe(193);
    expect(counts("obs")).toBe(195);
    expect(counts("all")).toBe(202);
    expect(new Set(ALL.map(d=>d.k)).size).toBe(202);
    expect(ALL.filter(d=>d.tier==="obs").map(d=>d.k).sort()).toEqual(["Palestine","Vatican City"]);
    expect(ALL.filter(d=>d.tier==="other").map(d=>d.k).sort()).toEqual(
      ["Cook Islands","Kosovo","Niue","Northern Cyprus","Somaliland","Taiwan","Western Sahara"]);
  });

  it("every continent keeps countries in every set, and the world list has no duplicates",()=>{
    for(const set of ["un","obs","all"] as const){
      for(const cn of CONT_NAMES)expect(countriesIn(cn,{set,cross:false}).length,`${set}/${cn}`).toBeGreaterThan(5);
      const w=countriesIn("World",{set,cross:true});
      expect(new Set(w.map(d=>d.k)).size).toBe(w.length);
    }
  });

  it("transcontinental countries join the other continent only when the setting is on",()=>{
    expect(countriesIn("Europe",{set:"obs",cross:false}).some(d=>d.k==="Turkey")).toBe(false);
    expect(countriesIn("Europe",{set:"obs",cross:true}).some(d=>d.k==="Turkey")).toBe(true);
    expect(countriesIn("Asia",{set:"obs",cross:true}).some(d=>d.k==="Russia")).toBe(true);
    // the world list never counts them twice
    expect(counts("obs",true)).toBe(195);
  });
});

describe("map shapes follow the set",()=>{
  it("Somaliland is Somalia and Northern Cyprus is Cyprus until 'all states'; Kosovo, Taiwan, Western Sahara are greyed",async()=>{
    const topo=(await import("world-atlas/countries-50m.json")).default;
    for(const set of ["un","obs"] as const){
      const w=buildWorld(topo,{landing:false,set});
      const names=new Set(w.shapes.map(s=>s.n));
      expect(names.has("Somaliland")).toBe(false);
      expect(names.has("Northern Cyprus")).toBe(false);
      expect(w.shapes.filter(s=>s.n==="Somalia").length).toBe(2);
      expect(w.shapes.filter(s=>s.n==="Cyprus").length).toBe(2);
      // greyed: Kosovo, Taiwan, W. Sahara, Cook Is., Niue (and the two observers when only UN members count)
      expect(w.shapes.filter(s=>s.off).length).toBe(set==="un"?7:5);
      for(const k of ["Kosovo","Taiwan","Western Sahara","Cook Islands","Niue"])expect(names.has(k)).toBe(false);
      expect(names.has("Vatican City")).toBe(set==="obs");
    }
    const all=buildWorld(topo,{landing:false,set:"all"});
    const names=new Set(all.shapes.map(s=>s.n));
    for(const k of ["Somaliland","Northern Cyprus","Kosovo","Taiwan","Western Sahara","Cook Islands","Niue"])expect(names.has(k),k).toBe(true);
    expect(all.shapes.filter(s=>s.off).length).toBe(0);
    expect(all.shapes.filter(s=>s.n==="Somalia").length).toBe(1);
  });

  it("all 202 countries have a polygon or a marker",async()=>{
    const w=await loadWorld50("all");
    const have=new Set(w.shapes.map(s=>s.n));
    expect(ALL.filter(d=>!have.has(d.k)&&!MARK[d.k]).map(d=>d.k)).toEqual([]);
  });
});

describe("world quiz map",()=>{
  it("every country can be clicked on the world map (main map, inset, or zoomed in for the tiniest)",async()=>{
    updateSettings({set:"all",cross:false});
    const world=await loadWorld50("all");
    const W=1440,H=800;
    const scene=buildScene(world,"World",W,H,{top:84});
    const miss:string[]=[];
    for(const d of countriesIn("World")){
      try{clickPointFor(world,scene,V1,d.k)}catch(e){miss.push(d.k)}
    }
    expect(miss).toEqual([]);
    expect(scene.panels.map(p=>p.id)).toEqual(["main","antilles","micro","polynesia"]);
  });

  it("phones get the plain world map with no boxes",async()=>{
    const world=await loadWorld50("obs");
    const scene=buildScene(world,"World",390,700,{top:150});
    expect(scene.panels.map(p=>p.id)).toEqual(["main"]);
  });
});

describe("transcontinental guests are tappable on the other continent's map",()=>{
  it("every listed pair has a click point",async()=>{
    updateSettings({set:"obs",cross:true});
    const world=await loadWorld50("obs");
    const bad:string[]=[];
    for(const [k,cn] of Object.entries(CROSS)){
      for(const [W,H] of [[1100,780],[390,700]]){
        const scene=buildScene(world,cn as ContinentName,W,H,{top:84});
        try{clickPointFor(world,scene,V1,k)}catch{bad.push(`${k} in ${cn} at ${W}x${H}`)}
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("quizzes follow the set",()=>{
  it("'all states': every extra country can be tapped on its continent's map, phone and desktop",async()=>{
    updateSettings({set:"all",cross:false});
    const world=await loadWorld50("all");
    const extras=new Set(ALL.filter(d=>d.tier==="other").map(d=>d.k));
    const miss:string[]=[];
    for(const cn of CONT_NAMES){
      for(const [W,H] of [[1100,780],[390,700]]){
        const scene=buildScene(world,cn,W,H,{top:84});
        for(const d of countriesIn(cn))if(extras.has(d.k)){
          try{clickPointFor(world,scene,V1,d.k)}catch{miss.push(`${d.k} ${W}x${H}`)}
        }
      }
    }
    expect(miss).toEqual([]);
  });

  it("default set: tapping Somaliland counts as Somalia, and grey countries can't be tapped",async()=>{
    updateSettings({set:"obs",cross:false});
    const world=await loadWorld50("obs");
    const af=buildScene(world,"Africa",1100,780,{top:84});
    const hargeisa=af.panels[0].P([44.06,9.56])!;
    expect(hitTest(world,af,V1,hargeisa[0],hargeisa[1])).toBe("Somalia");
    const eu=buildScene(world,"Europe",1100,780,{top:84});
    const pristina=eu.panels[0].P([21.17,42.66])!;
    expect(hitTest(world,eu,V1,pristina[0],pristina[1])).toBe(null);

    updateSettings({set:"all"});
    const worldAll=await loadWorld50("all");
    const af2=buildScene(worldAll,"Africa",1100,780,{top:84});
    const h2=af2.panels[0].P([44.06,9.56])!;
    expect(hitTest(worldAll,af2,V1,h2[0],h2[1])).toBe("Somaliland");
  });
});
