// @vitest-environment jsdom
import {afterEach,beforeAll,beforeEach,describe,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import {geoOrthographic} from "d3";
import App from "../src/App";
import {CountryCard} from "../src/components/CountryCard";
import {countriesIn,updateSettings} from "../src/sets";
import {record,resetProgress} from "../src/progress";
import {ELEPHANT_ISLAND,elephantHit,elephantSpot} from "../src/map/landing";
import {lockWorld,unlockWorld,worldUnlocked,WORLD_UNLOCK_AT} from "../src/unlock";

beforeAll(()=>{
  const noop:any=new Proxy(function(){},{get:(_t,k)=>k==="canvas"?{}:noop,apply:()=>noop,set:()=>true});
  HTMLCanvasElement.prototype.getContext=(()=>noop) as any;
  HTMLCanvasElement.prototype.setPointerCapture=()=>{};
  (globalThis as any).ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
  window.confirm=()=>true;
  Element.prototype.getBoundingClientRect=function(){
    return{x:0,y:0,left:0,top:0,right:1440,bottom:860,width:1440,height:860,toJSON(){}} as DOMRect;
  };
  window.matchMedia=((q:string)=>({matches:false,media:q,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){},onchange:null,dispatchEvent:()=>false})) as any;
  Object.defineProperty(window,"innerWidth",{value:1440,configurable:true});
  Object.defineProperty(window,"innerHeight",{value:860,configurable:true});
});
beforeEach(()=>{localStorage.clear();resetProgress();lockWorld();updateSettings({set:"obs",cross:false})});
afterEach(()=>{cleanup();vi.useRealTimers();resetProgress();lockWorld();updateSettings({set:"obs",cross:false})});

const master=(n:number,set=countriesIn("World"))=>{for(const d of set.slice(0,n)){record(d.k,true);record(d.k,true)}};

describe("World is locked until 80% mastered",()=>{
  it("starts locked: key 7 does nothing and the World tile is disabled",()=>{
    render(<App/>);
    fireEvent.keyDown(window,{key:"7"});
    expect(screen.queryByText("World Capitals")).toBeNull();
    fireEvent.click(screen.getByRole("button",{name:"Show continent list"}));
    const chip=document.querySelector(".chip.world") as HTMLButtonElement;
    expect(chip.disabled).toBe(true);
    expect(chip.textContent).toContain("Unlocks at 80%");
  });

  it("opens at 80% of the chosen set, and stays open afterwards",()=>{
    const need=Math.ceil(WORLD_UNLOCK_AT*195);
    master(need-1);
    expect(worldUnlocked()).toBe(false);
    master(need);
    expect(worldUnlocked()).toBe(true);
    // a bigger set drops the share below 80%, but World stays open
    updateSettings({set:"all"});
    expect(JSON.parse(localStorage.getItem("capitals.unlock.v1")!)).toEqual({world:true});
    resetProgress();
    expect(worldUnlocked()).toBe(true);
  });

  it("counts against the set in use (193 needs fewer)",()=>{
    updateSettings({set:"un"});
    master(Math.ceil(WORLD_UNLOCK_AT*193));
    expect(worldUnlocked()).toBe(true);
  });

  it("key 7 opens World once it is unlocked",()=>{
    unlockWorld();
    render(<App/>);
    fireEvent.keyDown(window,{key:"7"});
    expect(screen.getByText("World Capitals")).toBeTruthy();
  });

  it("the shortcut for 7 is only listed once World is open",()=>{
    const {unmount}=render(<App/>);
    fireEvent.click(screen.getByRole("button",{name:"About and progress"}));
    expect(screen.queryByText("World (all countries)")).toBeNull();
    unmount();
    unlockWorld();
    render(<App/>);
    fireEvent.click(screen.getByRole("button",{name:"About and progress"}));
    expect(screen.getByText("World (all countries)")).toBeTruthy();
  });
});

describe("the Elephant Island circle",()=>{
  const globe=(rotate:[number,number])=>geoOrthographic().translate([300,300]).scale(200).rotate(rotate).clipAngle(90);
  const facing:[number,number]=[-ELEPHANT_ISLAND[0],-ELEPHANT_ISLAND[1]];

  it("sits where the island is when it faces you, and is tappable around it",()=>{
    const g=globe(facing),p=elephantSpot(g)!;
    expect(p[0]).toBeCloseTo(300,0);expect(p[1]).toBeCloseTo(300,0);
    expect(elephantHit(g,303,297,12)).toBe(true);
    expect(elephantHit(g,330,300,12)).toBe(false);
  });

  it("is not there when the island is on the far side of the globe",()=>{
    const g=globe([facing[0]+180,-facing[1]]);
    expect(elephantSpot(g)).toBeNull();
    expect(elephantHit(g,300,300,50)).toBe(false);
  });

  it("is not there at the default view, where Antarctica is at the edge",()=>{
    expect(elephantSpot(globe([-73,-25]))).toBeNull();
  });
});

describe("country card",()=>{
  it("shows the name, the capital and one button into its continent",()=>{
    const onOpen=vi.fn();
    render(<CountryCard name="North Korea" onOpen={onOpen} onClose={()=>{}}/>);
    expect(screen.getByText("North Korea")).toBeTruthy();
    expect(screen.getByText("Pyongyang")).toBeTruthy();
    fireEvent.click(screen.getByRole("button",{name:"Open Asia"}));
    expect(onOpen).toHaveBeenCalledWith("Asia");
  });
});
