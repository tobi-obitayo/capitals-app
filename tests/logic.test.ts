import {describe,expect,it} from "vitest";
import {autoMatches,checkAnswer,fmtTime} from "../src/util";
import {CONT,CONT_NAMES,DATA,MARK} from "../src/data";
import {buildWorld,getLanding,loadWorld50} from "../src/geo";
import {score,type QuizResult,DEFAULT_CFG} from "../src/quiz";

describe("autoMatches",()=>{
  it("fires on an exact match, ignoring case, accents and punctuation",()=>{
    expect(autoMatches(["Chișinău","Chisinau"],"CHISINAU")).toBe(true);
    expect(autoMatches(["Nairobi"],"Nairob")).toBe(false);
    expect(autoMatches(["Nairobi"],"")).toBe(false);
  });
  it("waits when a longer accepted answer starts with what was typed",()=>{
    expect(autoMatches(["Washington","Washington, D.C."],"washington")).toBe(false);
    expect(autoMatches(["Washington","Washington, D.C."],"washington dc")).toBe(true);
  });
  it("never fires on a near miss (that is what spell check is for)",()=>{
    expect(autoMatches(["Ottawa"],"Ottowa")).toBe(false);
  });
});

describe("checkAnswer",()=>{
  it("ignores case, accents and punctuation",()=>{
    expect(checkAnswer(["Chișinău","Chisinau"],"chisinau",false).ok).toBe(true);
    expect(checkAnswer(["Washington, D.C."],"washington dc",false).ok).toBe(true);
  });
  it("forgives one typo only with spell check on",()=>{
    expect(checkAnswer(["Ottawa"],"Ottowa",true)).toMatchObject({ok:true,close:true});
    expect(checkAnswer(["Ottawa"],"Ottowa",false).ok).toBe(false);
    expect(checkAnswer(["Ottawa"],"Ottxxa",true).ok).toBe(false);
  });
  it("does not forgive typos in short answers",()=>{
    expect(checkAnswer(["Lima"],"Lina",true).ok).toBe(false);
  });
  it("treats empty input as empty",()=>{
    expect(checkAnswer(["Ottawa"],"  ",true).empty).toBe(true);
  });
  it("accepts alternate capitals",()=>{
    expect(checkAnswer(["La Paz","Sucre"],"sucre",true).ok).toBe(true);
  });
});

describe("fmtTime",()=>{
  it("formats mm:ss",()=>{expect(fmtTime(300)).toBe("5:00");expect(fmtTime(61.2)).toBe("1:02");expect(fmtTime(-3)).toBe("0:00")});
});

describe("data",()=>{
  it("has 195 unique countries across 6 continents",()=>{
    expect(DATA.length).toBe(195);
    expect(new Set(DATA.map(d=>d.k)).size).toBe(195);
    expect(CONT_NAMES.every(c=>CONT[c].length>0)).toBe(true);
    expect(CONT["North America"].length).toBe(23);
  });
});

describe("score",()=>{
  it("counts unseen as missed",()=>{
    const r:QuizResult={cn:"North America",cfg:DEFAULT_CFG,reason:"giveup",elapsed:5,items:[
      {k:"Canada",status:"ok",attempts:0},{k:"Cuba",status:"bad",attempts:2},{k:"Haiti",status:"unseen",attempts:0},{k:"Belize",status:"ok",attempts:0}]};
    expect(score(r)).toEqual({ok:2,total:4,pct:50});
  });
});

describe("maps",()=>{
  it("landing: every shape is assigned and each continent exists",async()=>{
    const warn:string[]=[];const orig=console.warn;console.warn=(...a)=>warn.push(a.join(" "));
    const w=await getLanding();console.warn=orig;
    expect(warn).toEqual([]);
    expect(w.continents!.map(c=>c.name)).toEqual([...CONT_NAMES,"Antarctica"]);
  });
  it("50m: every country has a polygon or a marker location",async()=>{
    const w=await loadWorld50();
    const have=new Set(w.shapes.map(s=>s.n));
    const missing=DATA.filter(d=>!have.has(d.k)&&!MARK[d.k]).map(d=>d.k);
    expect(missing).toEqual([]);
  });
  it("50m: every North America country is a clickable polygon",async()=>{
    const w=await loadWorld50();
    const have=new Set(w.shapes.filter(s=>s.cn==="North America").map(s=>s.n));
    expect(CONT["North America"].filter(d=>!have.has(d.k)).map(d=>d.k)).toEqual([]);
  });
  it("france overseas pieces go to the right continent",async()=>{
    const topo=(await import("world-atlas/countries-50m.json")).default;
    const w=buildWorld(topo,{landing:false});
    const fr=w.shapes.filter(s=>s.n==="France").map(s=>s.cn);
    expect(new Set(fr)).toEqual(new Set(["Europe"]));
    expect(w.shapes.some(s=>s.n===null&&s.cn==="South America")).toBe(true);
    expect(w.shapes.some(s=>s.n===null&&s.cn==="Africa")).toBe(true);
  });
});
