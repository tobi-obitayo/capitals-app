// @vitest-environment jsdom
import {beforeEach,describe,expect,it} from "vitest";
import {ALL} from "../src/data";
import {countryId,currentCode,decodeBackup,encodeBackup,restoreCode} from "../src/backup";
import {lvl,record,resetProgress} from "../src/progress";
import {lockWorld,worldUnlocked} from "../src/unlock";

beforeEach(()=>{localStorage.clear();resetProgress();lockWorld()});

const levels=(m:Record<string,number>)=>(k:string)=>m[k]??0;

/** hand-build a code (same layout and checksum as src/backup.ts) to test inputs the encoder never produces */
function build(flag:number,entries:[number,number][]){
  const b:number[]=[flag];
  for(const[id,l] of entries){const v=(id<<2)|l;b.push((v>>>16)&255,(v>>>8)&255,v&255)}
  let h=0x811c9dc5;
  for(const x of b){h^=x;h=Math.imul(h,0x01000193)}
  const c=(h>>>0)&0xffff;
  b.push(c>>>8,c&255);
  return "CAP1-"+btoa(String.fromCharCode(...b)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}

describe("copy code",()=>{
  it("gives every country its own id (a collision would merge two countries)",()=>{
    expect(new Set(ALL.map(d=>countryId(d.k))).size).toBe(ALL.length);
  });

  it("round-trips levels and the World unlock",()=>{
    const code=encodeBackup(levels({France:2,Japan:3,Chad:1}),true);
    expect(code.startsWith("CAP1-")).toBe(true);
    const r=decodeBackup(code);
    if(!r.ok)throw new Error(r.error);
    expect(Object.fromEntries(r.backup.levels)).toEqual({France:2,Japan:3,Chad:1});
    expect(r.backup.world).toBe(true);
  });

  it("stays short: a full code is under 900 characters",()=>{
    const all=Object.fromEntries(ALL.map(d=>[d.k,3]));
    expect(encodeBackup(levels(all),false).length).toBeLessThan(900);
    expect(encodeBackup(levels({}),false).length).toBeLessThan(15);
  });

  it("ignores spaces, line breaks and a trailing newline from pasting",()=>{
    const code=encodeBackup(levels({France:2}),false);
    expect(decodeBackup(`  ${code.slice(0,12)}\n${code.slice(12)}  \n`).ok).toBe(true);
  });

  it("rejects anything that is not a code, without throwing",()=>{
    const code=encodeBackup(levels({France:2}),false);
    for(const bad of ["","   ","hello","CAP2-AAAA","CAP1-","CAP1-%%%","CAP1-"+"A".repeat(5000),"{\"France\":3}","<script>alert(1)</script>",code.slice(0,-3)]){
      expect(decodeBackup(bad).ok,bad.slice(0,30)).toBe(false);
    }
  });

  it("catches a changed code with the checksum",()=>{
    const code=encodeBackup(levels({France:2,Japan:3}),false);
    const i=code.length-6;
    const flipped=code.slice(0,i)+(code[i]==="A"?"B":"A")+code.slice(i+1);
    expect(decodeBackup(flipped).ok).toBe(false);
  });

  it("skips unknown countries and level 0, keeps the rest",()=>{
    const france=countryId("France");
    const used=new Set(ALL.map(d=>countryId(d.k)));
    let unknown=1;while(used.has(unknown))unknown++;
    const r=decodeBackup(build(0,[[unknown,3],[france,0],[france,2],[france,1]]));
    if(!r.ok)throw new Error(r.error);
    expect(r.skipped).toBe(2);
    expect(Object.fromEntries(r.backup.levels)).toEqual({France:2});
  });

  it("restore only raises levels and never lowers them",()=>{
    record("France",true);record("France",true);record("France",true);      // 3
    record("Japan",true);                                                    // 1
    const code=encodeBackup(levels({France:1,Japan:3,Chad:2}),true);
    expect(restoreCode(code)).toEqual({ok:true,updated:2});
    expect(lvl("France")).toBe(3);
    expect(lvl("Japan")).toBe(3);
    expect(lvl("Chad")).toBe(2);
    expect(worldUnlocked()).toBe(true);
    expect(restoreCode(code)).toEqual({ok:true,updated:0});
  });

  it("a bad code changes nothing",()=>{
    record("France",true);
    expect(restoreCode("CAP1-nonsense").ok).toBe(false);
    expect(lvl("France")).toBe(1);
    expect(worldUnlocked()).toBe(false);
  });

  it("current progress restores on a clean browser",()=>{
    record("Peru",true);record("Peru",true);
    const code=currentCode();
    resetProgress();
    expect(lvl("Peru")).toBe(0);
    expect(restoreCode(code)).toEqual({ok:true,updated:1});
    expect(lvl("Peru")).toBe(2);
  });
});
