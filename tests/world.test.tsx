// @vitest-environment jsdom
import {afterEach,beforeAll,beforeEach,describe,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import App from "../src/App";
import {dataByName} from "../src/data";
import {updateSettings} from "../src/sets";
import {lockWorld,unlockWorld} from "../src/unlock";

beforeAll(()=>{
  const noop:any=new Proxy(function(){},{get:(_t,k)=>k==="canvas"?{}:noop,apply:()=>noop,set:()=>true});
  HTMLCanvasElement.prototype.getContext=(()=>noop) as any;
  HTMLCanvasElement.prototype.setPointerCapture=()=>{};
  Element.prototype.getBoundingClientRect=function(){
    return{x:0,y:0,left:0,top:0,right:1440,bottom:860,width:1440,height:860,toJSON(){}} as DOMRect;
  };
  (globalThis as any).ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
  window.matchMedia=((q:string)=>({matches:false,media:q,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){},onchange:null,dispatchEvent:()=>false})) as any;
  window.confirm=()=>true;
  Object.defineProperty(window,"innerWidth",{value:1440,configurable:true});
  Object.defineProperty(window,"innerHeight",{value:860,configurable:true});
  if(typeof (window as any).PointerEvent==="undefined"){
    (window as any).PointerEvent=class extends MouseEvent{pointerId:number;constructor(t:string,i:any={}){super(t,i);this.pointerId=i.pointerId??1}};
  }
});
beforeEach(()=>{localStorage.clear();lockWorld();updateSettings({set:"obs",cross:false})});
afterEach(()=>{cleanup();vi.useRealTimers();updateSettings({set:"obs",cross:false})});

const click=(name:string|RegExp)=>fireEvent.click(screen.getByRole("button",{name}));
const radio=(name:RegExp)=>fireEvent.click(screen.getByRole("radio",{name}));
const openSettings=()=>{click("About and progress");click("Settings")};

describe("World entry",()=>{
  beforeEach(()=>{unlockWorld()});
  it("key 7 opens the world quiz setup with every country",()=>{
    render(<App/>);
    fireEvent.keyDown(window,{key:"7"});
    click("Quiz");
    expect(screen.getByText("World Capitals")).toBeTruthy();
    expect(screen.getByRole("button",{name:/Start quiz · 195 countries/})).toBeTruthy();
  });

  it("the continent list has a World tile",()=>{
    render(<App/>);
    click("Show continent list");
    fireEvent.click(document.querySelector(".chip.world")!);
    expect(screen.getByText("World Capitals")).toBeTruthy();
  });

  it("answering every capital in the world quiz gives 100%",()=>{
    render(<App/>);
    fireEvent.keyDown(window,{key:"7"});
    click("Quiz");click("Name the capital");
    click(/Start quiz/);
    for(let n=0;n<195;n++){
      const country=document.querySelector(".q h3")!.textContent!;
      const input=screen.getByPlaceholderText("Type the capital…") as HTMLInputElement;
      fireEvent.change(input,{target:{value:dataByName[country].c}});
      fireEvent.submit(input.closest("form")!);
      fireEvent.keyDown(input,{key:"Enter"});
    }
    expect(screen.getByText("100%")).toBeTruthy();
    expect(screen.getByText(/195 of 195 correct/)).toBeTruthy();
  });
});

describe("country set in the (i) panel",()=>{
  const startLabel=()=>{
    unlockWorld();
    fireEvent.keyDown(window,{key:"7"});
    click("Quiz");
    return screen.getByRole("button",{name:/Start quiz/}).textContent;
  };

  it("193 / 195 / 202 change every count",()=>{
    const {unmount}=render(<App/>);
    click("About and progress");
    expect(screen.getByText(/\/ 195 mastered/)).toBeTruthy();
    click("Settings");
    radio(/^UN members, 193/);
    click("Progress");
    expect(screen.getByText(/\/ 193 mastered/)).toBeTruthy();
    unmount();

    render(<App/>);
    expect(startLabel()).toBe("Start quiz · 193 countries");
    cleanup();

    updateSettings({set:"all"});
    render(<App/>);
    expect(startLabel()).toBe("Start quiz · 202 countries");
  });

  it("the choice is remembered",()=>{
    render(<App/>);
    openSettings();
    radio(/^All states, 202/);
    expect(JSON.parse(localStorage.getItem("capitals.settings.v1")!)).toEqual({set:"all",cross:false});
  });

  it("the transcontinental switch adds the guests to the neighbouring continent",()=>{
    render(<App/>);
    openSettings();
    fireEvent.click(screen.getByRole("switch",{name:/Transcontinental/}));
    fireEvent.keyDown(window,{key:"Escape"});
    fireEvent.keyDown(window,{key:"2"});   // Europe: 45 + Turkey, Georgia, Armenia, Azerbaijan
    click("Quiz");
    expect(screen.getByRole("button",{name:/Start quiz · 49 countries/})).toBeTruthy();
  });
});

describe("progress and settings tabs",()=>{
  it("opens on Progress; Settings is one tap away and back again",()=>{
    render(<App/>);
    click("About and progress");
    expect(screen.getByText(/\/ 195 mastered/)).toBeTruthy();
    expect(screen.queryByRole("radio",{name:/^UN members, 193/})).toBeNull();
    click("Settings");
    expect(screen.getByRole("radio",{name:/^UN members, 193/})).toBeTruthy();
    click("Progress");
    expect(screen.getByText(/\/ 195 mastered/)).toBeTruthy();
  });
});

describe("reset progress confirmation",()=>{
  it("requires typing RESET before wiping mastery",async()=>{
    const {record,lvl,resetProgress}=await import("../src/progress");
    resetProgress();
    record("USA",true);record("USA",true);
    expect(lvl("USA")).toBe(2);

    render(<App/>);
    openSettings();
    click("Reset all progress");
    const confirm=screen.getByRole("button",{name:"Reset progress"}) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    const input=screen.getByLabelText("Confirmation");
    fireEvent.change(input,{target:{value:"reset"}});
    expect(confirm.disabled).toBe(true);
    fireEvent.change(input,{target:{value:"RESET"}});
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);
    expect(lvl("USA")).toBe(0);
  });
});
